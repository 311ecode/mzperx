import re
from collections import Counter, OrderedDict

from ..helpers import fix_ocr, is_street_header, clean_street_name, NOISE_RE


def _detect_columns(text: str) -> list[tuple[int, int]]:
    """
    Auto-detect column x-positions by finding where street headers appear.
    Only positions that appear 2+ times are treated as column starts.
    Applies a left margin to non-first columns because delivery house
    numbers may indent a few chars left of their header.
    """
    positions = []
    for line in text.splitlines():
        for m in re.finditer(r'\S+', line):
            rest = line[m.start():].split('  ')[0].strip()
            cleaned = clean_street_name(rest)
            if is_street_header(cleaned) and len(cleaned) > 4:
                positions.append(m.start())

    if not positions:
        return [(0, 9999)]

    counts = Counter(positions)
    frequent = sorted(p for p, c in counts.items() if c >= 2)

    if not frequent:
        frequent = [0]

    clusters = [[frequent[0]]]
    for p in frequent[1:]:
        if p - clusters[-1][-1] < 15:
            clusters[-1].append(p)
        else:
            clusters.append([p])

    starts = [min(c) for c in clusters]

    COL_MARGIN = 10
    adjusted = [starts[0]]
    for i in range(1, len(starts)):
        shifted = max(starts[i] - COL_MARGIN, adjusted[-1] + 1)
        adjusted.append(shifted)

    bounds = []
    for i, s in enumerate(adjusted):
        end = adjusted[i + 1] - 1 if i + 1 < len(adjusted) else 9999
        bounds.append((s, end))

    return bounds


def _find_route_start(text: str) -> int:
    """
    Find the line index where delivery-route columns begin.
    Primary: a line containing 'Klacht' (complaints header).
    Fallback: the first street-header line in the body.
    """
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.search(r'\bKlacht\b', line):
            return i
    for i, line in enumerate(lines):
        stripped = line.strip()
        if is_street_header(clean_street_name(stripped)):
            return max(0, i - 1)
    return -1


def parse_delivery_route(text: str, newspaper_codes: set[str] | None = None) -> list:
    """
    Parse delivery route columns.
    newspaper_codes: set of valid codes (e.g. {'HD','TEL','VK'}).
    If None, falls back to a broad pattern match for 2-3 letter uppercase tokens.
    """
    col_bounds = _detect_columns(text)
    n_cols = len(col_bounds)

    col_streets = [None] * n_cols
    col_cities  = ['HAARLEM'] * n_cols
    col_delivs  = [[] for _ in range(n_cols)]
    delivery_route: list = []

    def flush_col(i: int):
        if col_streets[i] and col_delivs[i]:
            delivery_route.append({
                'street':     col_streets[i],
                'city':       col_cities[i],
                'deliveries': list(col_delivs[i]),
            })
        col_streets[i] = None
        col_cities[i]  = 'HAARLEM'
        col_delivs[i]  = []

    def process_slot(raw_slot: str, col_idx: int):
        slot = raw_slot.strip()
        if not slot or NOISE_RE.match(slot):
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

        entry: dict = {'house_number': house_number, 'newspaper': newspaper}
        if annotation_tokens:
            ann = ' '.join(annotation_tokens)
            if re.match(r'^[A-Z0-9 \-]+$', ann):
                entry['annotation'] = ann

        col_delivs[col_idx].append(entry)

    lines = text.splitlines()
    start = _find_route_start(text)
    if start < 0:
        return []

    for raw_line in lines[start + 1:]:
        stripped = raw_line.strip()
        if 'EINDE WIJKLIJST' in stripped:
            break
        if NOISE_RE.match(stripped):
            continue

        for col_idx, (lo, hi) in enumerate(col_bounds):
            if lo < len(raw_line):
                process_slot(raw_line[lo:min(hi, len(raw_line))], col_idx)

    for i in range(n_cols):
        flush_col(i)

    seen: dict = OrderedDict()
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
