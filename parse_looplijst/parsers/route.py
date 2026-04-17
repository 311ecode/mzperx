import re
from collections import OrderedDict

from ..helpers import fix_ocr, is_street_header, clean_street_name, NOISE_RE


def _find_route_start(text: str) -> int:
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.search(r'\bKlacht\b', line):
            return i
    for i, line in enumerate(lines):
        stripped = line.strip()
        if is_street_header(clean_street_name(stripped)):
            return max(0, i - 1)
    return -1


def _street_headers_on_line(line: str) -> list:
    """Return (position, cleaned_name) for distinct street headers on a line.
    Filters sub-string duplicates like HOOFTSTRAAT inside P.C. HOOFTSTRAAT."""
    raw = []
    for m in re.finditer(r'\S+', line):
        rest = line[m.start():].split('  ')[0].strip()
        cleaned = clean_street_name(rest)
        if is_street_header(cleaned) and len(cleaned) > 4:
            raw.append((m.start(), cleaned))

    if len(raw) <= 1:
        return raw

    filtered = []
    for i, (pos_a, name_a) in enumerate(raw):
        is_substring = False
        for j, (pos_b, name_b) in enumerate(raw):
            if i != j and name_a in name_b and abs(pos_a - pos_b) < len(name_b):
                is_substring = True
                break
        if not is_substring:
            filtered.append((pos_a, name_a))

    return filtered


def _bounds_from_positions(positions: list) -> list:
    COL_MARGIN = 10
    adjusted = [max(positions[0] - COL_MARGIN, 0)]
    for i in range(1, len(positions)):
        shifted = max(positions[i] - COL_MARGIN, adjusted[-1] + 1)
        adjusted.append(shifted)
    bounds = []
    for i, s in enumerate(adjusted):
        end = adjusted[i + 1] - 1 if i + 1 < len(adjusted) else 9999
        bounds.append((s, end))
    return bounds


def _positions_match_bounds(positions: list, bounds: list) -> bool:
    """Check if detected header positions fall within existing column bounds,
    each in a DIFFERENT column. If two headers land in the same column,
    the layout has shifted and columns need redefining."""
    used_cols = set()
    for pos in positions:
        matched_col = None
        for col_idx, (lo, hi) in enumerate(bounds):
            if lo <= pos <= hi:
                matched_col = col_idx
                break
        if matched_col is None:
            return False
        if matched_col in used_cols:
            return False
        used_cols.add(matched_col)
    return True


def _detect_initial_columns(text: str, start_line: int) -> list:
    lines = text.splitlines()
    for line in lines[start_line + 1:]:
        headers = _street_headers_on_line(line)
        if len(headers) >= 2:
            return _bounds_from_positions([h[0] for h in headers])
    return [(0, 9999)]


def parse_delivery_route(text: str, newspaper_codes=None) -> list:
    start = _find_route_start(text)
    if start < 0:
        return []

    col_bounds = _detect_initial_columns(text, start)
    n_cols = len(col_bounds)

    col_streets = [None] * n_cols
    col_cities  = ['HAARLEM'] * n_cols
    col_delivs  = [[] for _ in range(n_cols)]
    delivery_route = []
    past_einde = False

    def flush_all():
        for i in range(len(col_streets)):
            flush_col(i)

    def flush_col(i):
        nonlocal col_streets, col_cities, col_delivs
        if i >= len(col_streets):
            return
        if col_streets[i] and col_delivs[i]:
            delivery_route.append({
                'street':     col_streets[i],
                'city':       col_cities[i],
                'deliveries': list(col_delivs[i]),
            })
        col_streets[i] = None
        col_cities[i]  = 'HAARLEM'
        col_delivs[i]  = []

    def reset_columns(new_bounds):
        nonlocal col_bounds, n_cols, col_streets, col_cities, col_delivs
        flush_all()
        col_bounds = new_bounds
        n_cols = len(new_bounds)
        col_streets = [None] * n_cols
        col_cities  = ['HAARLEM'] * n_cols
        col_delivs  = [[] for _ in range(n_cols)]

    def process_slot(raw_slot, col_idx):
        slot = raw_slot.strip()
        if not slot or NOISE_RE.match(slot):
            return

        # If the slot starts with a lowercase-letter token, it's almost certainly
        # overflow from the previous column's customer-name field (e.g. "dt" from
        # "Coerdt", "enhagen" from "Cobbenhagen"). Skip past such leading tokens
        # and retry parsing from the next whitespace-separated token.
        while slot and slot[0].islower():
            parts = slot.split(None, 1)
            if len(parts) < 2:
                return
            slot = parts[1]
            if NOISE_RE.match(slot):
                return

        if not re.match(r'^[0-9]|^O[0-9]', slot):
            cleaned = clean_street_name(slot)
            if is_street_header(cleaned):
                flush_col(col_idx)
                if ',' in cleaned:
                    parts = cleaned.split(',', 1)
                    col_streets[col_idx] = parts[0].strip()
                    col_cities[col_idx]  = parts[1].strip()
                else:
                    col_streets[col_idx] = cleaned
                return

        m = re.match(r'^([0-9O]+[A-Za-z]?)\s+(.+)$', slot)
        if not m or not col_streets[col_idx]:
            return

        house_number      = fix_ocr(m.group(1))
        annotation_tokens = []
        newspaper         = None

        for tok in m.group(2).split():
            if newspaper_codes:
                if tok in newspaper_codes:
                    newspaper = tok
                    break
            else:
                if re.match(r'^[A-Z]{2,3}$', tok):
                    newspaper = tok
                    break
            annotation_tokens.append(tok)

        if not newspaper:
            return

        entry = {'house_number': house_number, 'newspaper': newspaper}
        if annotation_tokens:
            ann = ' '.join(annotation_tokens)
            if re.match(r'^[A-Z0-9 \-]+$', ann):
                entry['annotation'] = ann

        col_delivs[col_idx].append(entry)

    lines = text.splitlines()

    for raw_line in lines[start + 1:]:
        stripped = raw_line.strip()

        if NOISE_RE.match(stripped):
            continue

        if 'EINDE WIJKLIJST' in stripped:
            past_einde = True
            continue

        if past_einde:
            has_street = bool(_street_headers_on_line(raw_line))
            has_delivery = bool(re.match(r'\s*[0-9O]', raw_line))
            if not has_street and not has_delivery:
                continue

        headers = _street_headers_on_line(raw_line)
        if len(headers) >= 2:
            positions = [h[0] for h in headers]
            if not _positions_match_bounds(positions, col_bounds):
                new_bounds = _bounds_from_positions(positions)
                reset_columns(new_bounds)

        for col_idx, (lo, hi) in enumerate(col_bounds):
            if lo < len(raw_line):
                process_slot(raw_line[lo:min(hi, len(raw_line))], col_idx)

    flush_all()

    seen = OrderedDict()
    for entry in delivery_route:
        key = (entry['street'], entry['city'])
        if key in seen:
            seen[key].extend(entry['deliveries'])
        else:
            seen[key] = list(entry['deliveries'])

    return [
        {
            'street':     street,
            'city':       city,
            'deliveries': sorted(
                deliveries,
                key=lambda d: int(re.sub(r'[^0-9]', '', d['house_number']) or '0'),
            ),
        }
        for (street, city), deliveries in seen.items()
    ]
