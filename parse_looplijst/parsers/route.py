import re
from collections import OrderedDict

from ..helpers import fix_ocr, is_street_header, clean_street_name, NEWSPAPER_CODES, COL_BOUNDS, NOISE_RE


def _find_route_start(text: str) -> int:
    """
    Find the line index where delivery-route columns begin.
    Primary trigger: a line containing 'Klacht' (complaints header).
    Fallback: the first line that contains a street header recognised by
    is_street_header — this handles PDFs that have no complaints section.
    """
    lines = text.splitlines()

    for i, line in enumerate(lines):
        if re.search(r'\bKlacht\b', line):
            return i

    # Fallback: first street-header line (skip the summary table area)
    for i, line in enumerate(lines):
        stripped = line.strip()
        if is_street_header(clean_street_name(stripped)):
            return max(0, i - 1)  # one line before so the street itself is processed

    return -1


def parse_delivery_route(text: str) -> list:
    col_streets = [None, None, None]
    col_cities  = ['HAARLEM', 'HAARLEM', 'HAARLEM']
    col_delivs  = [[], [], []]
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
            if tok in NEWSPAPER_CODES:
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
        for col_idx, (lo, hi) in enumerate(COL_BOUNDS):
            process_slot(raw_line[lo:min(hi, len(raw_line))], col_idx)

    for i in range(3):
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
