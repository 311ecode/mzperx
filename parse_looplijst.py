#!/usr/bin/env python3
"""
parse_looplijst.py
Parses a Wijklijst/Looplijst PDF into structured JSON.

Usage:
    python3 parse_looplijst.py <input.pdf> [output.json]

If output.json is omitted, the result is written next to the PDF
with the same base name and a .json extension.

Requirements:
    pip install pdfplumber
    apt install poppler-utils   (provides pdftotext)
"""

import sys
import json
import re
import subprocess
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("Error: pdfplumber not installed. Run: pip install pdfplumber", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

NEWSPAPER_CODES = {'HD', 'TEL', 'VK', 'NRC', 'AD', 'ND', 'HFD', 'TR', 'HP', 'KW'}

STREET_SUFFIXES = (
    'STRAAT', 'WEG', 'LAAN', 'PLEIN', 'SINGEL', 'GRACHT',
    'KADE', 'DIJK', 'PAD', 'DREEF', 'ALLEE', 'BOULEVARD',
)

KNOWN_NEWSPAPERS = {
    'HDC': ('HD',  'Haarlems Dagblad'),
    'TEL': ('LAN', 'Telegraaf Landelijk'),
    'NRC': ('NRC', 'NRC'),
    'AD':  ('AD',  'Algemeen Dagblad NLD'),
    'ND':  ('ND',  'Nederlands Dagblad'),
    'HFD': ('HFD', 'Het Financieele Dagblad'),
    'TR':  ('TR',  'Trouw'),
    'VK':  ('VK',  'Volkskrant'),
    'HP':  ('HP',  'Het Parool'),
    'KW':  ('KW',  'Kwartaalblad'),
}

# pdftotext -layout column x-positions (char indices in each physical row)
# Col 0: left route column   →   0 – 110
# Col 1: middle route column → 111 – 206
# Col 2: right route column  → 207 – end  (also holds summary table on page 1)
COL_BOUNDS = [(0, 110), (111, 206), (207, 9999)]

# Noise lines to skip inside the route section
NOISE_RE = re.compile(
    r'^('
    r'huisnr\s'
    r'|doorduwen'
    r'|krant\s+goed'
    r'|doc\.nr\.'
    r'|pagina\s'
    r'|powered\s'
    r'|wijklijst\s*:'
    r'|\x0c'
    r'|[A-Z0-9][A-Z0-9]*(?:-+[A-Z0-9]*){2,}-?$'  # delivery schedule codes: M---VZ-, MA-VR-ZA
    r')',
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fix_ocr(s: str) -> str:
    """Replace OCR artefact uppercase-O → 0."""
    return s.replace('O', '0')


def format_date(date_str: str) -> str:
    """Normalise to YYYY-MM-DD. Handles DD-MM-YYYY input and O→0 artefacts."""
    cleaned = fix_ocr(date_str)
    parts = cleaned.split('-')
    if len(parts) != 3:
        return cleaned
    if len(parts[0]) == 4:
        year, month, day = parts
    elif len(parts[2]) == 4:
        day, month, year = parts
    else:
        day, month, year = parts[0], parts[1], '20' + parts[2]
    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"


def clean_street_name(s: str) -> str:
    """
    Strip leading annotation tokens from a slot that may prefix the street name.
    e.g. "M---VZ-  REIGERSTRAAT" → "REIGERSTRAAT"
         "REIJER ANSLOSTRAAT"    → "REIJER ANSLOSTRAAT"  (unchanged)
         "P.C. HOOFTSTRAAT"      → "P.C. HOOFTSTRAAT"   (unchanged)

    Two kinds of annotation tokens to strip:
    1. No letters at all:          purely symbolic like "---"
    2. Letters+multiple-dashes:   delivery-schedule codes like "M---VZ-", "MA-VR-ZA"
       (real street tokens with dashes like SINT-BAVOSTRAAT have only ONE dash)
    """
    tokens = s.split()
    annotation_re = re.compile(
        r'^[^A-Za-z]+$'               # no letters at all
        r'|^[A-Z0-9]+(-+[A-Z0-9]*){2,}-?$'  # letters+2-or-more-dash-groups: M---VZ-
    )
    while tokens and annotation_re.match(tokens[0]):
        tokens.pop(0)
    return ' '.join(tokens)


def is_street_header(s: str) -> bool:
    """
    True if s (after cleaning) is an all-caps street name.
    Handles: P.C. HOOFTSTRAAT, SINT-BAVOSTRAAT, ANTONIDES VD GOESSTRAAT
    Rejects:  mixed-case lines like "Vondelweg 440" (complaint addresses)
    """
    if not s:
        return False
    cleaned = clean_street_name(s)
    check = re.sub(r'[.\-]', ' ', cleaned.split(',')[0]).strip()
    # Must be all-uppercase (letters, digits, spaces — no lowercase)
    if not re.match(r'^[A-Z][A-Z0-9 ]+$', check):
        return False
    return any(suffix in check for suffix in STREET_SUFFIXES)


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(pdf_path: Path) -> str:
    """
    pdftotext -layout preserves spatial column x-positions, giving us clean
    fixed-width rows we can slice into column slots.
    Falls back to pdfplumber if pdftotext is unavailable.
    """
    try:
        result = subprocess.run(
            ['pdftotext', '-layout', str(pdf_path), '-'],
            capture_output=True, text=True, check=True,
        )
        return result.stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        with pdfplumber.open(pdf_path) as pdf:
            return '\n'.join(page.extract_text() or '' for page in pdf.pages)


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------

def extract_metadata(text: str) -> dict:
    metadata = {}

    for tag, key in [
        ('distributiedatum', 'distribution_date'),
        ('doctype',          'document_type'),
        ('elementtype',      'element_type'),
        ('elementno',        'element_number'),
    ]:
        m = re.search(rf'<{tag}>([^<]+)</{tag}>', text)
        if m:
            val = m.group(1).strip()
            metadata[key] = format_date(val) if key == 'distribution_date' else val

    m = re.search(r'</ronde>\s*\n\s*([0-9O ]+)', text)
    if m:
        metadata['route_code'] = fix_ocr(m.group(1).strip())

    m = re.search(r'\n([A-Z][A-Z ]+)\s*\nWIJKLIJST', text)
    if m:
        metadata['area'] = m.group(1).strip()

    m = re.search(r'gegenereerd op ([O0-9\-]+ [O0-9:]+)', text)
    if m:
        metadata['generated_on'] = fix_ocr(m.group(1))

    return metadata


# ---------------------------------------------------------------------------
# Newspaper summary
# ---------------------------------------------------------------------------

def parse_newspaper_summary(text: str) -> list:
    """
    Summary rows look like: O  47  47  O  O  47  (exactly 6 O/digit tokens).
    We find all such rows and zip them with the known newspaper order.
    """
    num_row_re = re.compile(
        r'^\s*([O0]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s*$'
    )
    number_rows = []
    for line in text.splitlines():
        m = num_row_re.match(line)
        if m:
            number_rows.append([int(fix_ocr(m.group(i))) for i in range(1, 7)])

    newspapers = []
    for i, nums in enumerate(number_rows):
        if i >= len(KNOWN_NEWSPAPERS):
            break
        code = list(KNOWN_NEWSPAPERS.keys())[i]
        edition, name = KNOWN_NEWSPAPERS[code]
        newspapers.append({
            'code':              code,
            'edition':           edition,
            'name':              name,
            'standard_bundles':  nums[0],
            'loose_copies':      nums[1],
            'subscriber_count':  nums[2],
            'lv_count':          nums[3],
            'leftover_papers':   nums[4],
            'total_circulation': nums[5],
        })

    return newspapers


# ---------------------------------------------------------------------------
# Complaints
# ---------------------------------------------------------------------------

def parse_complaints(text: str) -> list:
    """
    With pdftotext -layout the full complaint is one line:
      "NIET KRANT  21-O3-2O26  HD  MA-ZA  Vondelweg 440, HAARLEM  Galen"
    """
    complaints = []
    in_complaints = False

    for line in text.splitlines():
        stripped = line.strip()

        if re.search(r'\bKlacht\b', stripped):
            in_complaints = True
            continue

        if not in_complaints or not stripped:
            continue

        if 'EINDE WIJKLIJST' in stripped:
            break

        m = re.match(
            r'^(NIET\s+BIJLAGE|NIET\s+KRANT|VERKEERD\s+KRANT|VERKEERD)\s+'
            r'(\S+)\s+'            # date
            r'([A-Z]+)\s+'         # product
            r'([A-Z][A-Z\-]*)\s+'  # abovorm / subscription type
            r'(.+?,\s*[A-Z]+)'     # address incl city
            r'(?:\s+(.+))?$',      # optional name
            stripped,
        )
        if m:
            complaints.append({
                'type':              m.group(1).strip(),
                'date':              format_date(m.group(2)),
                'product':           m.group(3),
                'subscription_type': m.group(4),
                'address':           fix_ocr(m.group(5).strip()),
                'name':              (m.group(6) or '').strip(),
            })

    return complaints


# ---------------------------------------------------------------------------
# Delivery route
# ---------------------------------------------------------------------------

def parse_delivery_route(text: str) -> list:
    """
    pdftotext -layout gives fixed-width rows. Each physical row spans up to 3
    route columns side by side (col boundaries measured from actual PDFs):
        Col 0:   0 – 110
        Col 1: 111 – 206
        Col 2: 207 – end  (also contains summary table on page 1 — ignored)

    We track three independent column states (current street + deliveries),
    flush each when a new street header appears in that column, then at the end
    merge all entries by street name to reunite splits across pages/columns.

    The final list preserves the order in which each street *first* appears.
    """
    # Per-column state
    col_streets  = [None, None, None]
    col_cities   = ['HAARLEM', 'HAARLEM', 'HAARLEM']
    col_delivs   = [[], [], []]

    delivery_route: list = []
    in_route = False

    def flush_col(i: int):
        """Append col i's current street+deliveries to delivery_route, then reset."""
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
        """
        Classify one column slot as either a street header or a delivery line.

        A slot may prefix the street name with an annotation token, e.g.:
            "M---VZ- REIGERSTRAAT"  →  strip "M---VZ-", use "REIGERSTRAAT"
        We do this by finding the shortest right-aligned suffix that still
        contains a known street suffix — annotations never contain street words.
        """
        slot = raw_slot.strip()
        if not slot:
            return
        if NOISE_RE.match(slot):
            return

        # --- Street header detection ---
        # Only try if the slot does NOT start with a digit (delivery lines do)
        if not re.match(r'^[0-9]|^O[0-9]', slot):  # O only = digit if followed by digit (OCR zero)
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

        # --- Delivery line ---
        # Format: "<house_number> [annotation_tokens...] <NEWSPAPER_CODE> [name...]"
        # Annotation tokens (e.g. ZWAR, RD) appear between house number and code.
        m = re.match(r'^([0-9O]+[A-Za-z]?)\s+(.+)$', slot)
        if m and col_streets[col_idx]:
            house_number = fix_ocr(m.group(1))
            tokens       = m.group(2).split()
            # Collect annotation tokens that appear BEFORE the first newspaper code
            annotation_tokens = []
            newspaper         = None
            for tok in tokens:
                if tok in NEWSPAPER_CODES:
                    newspaper = tok
                    break
                annotation_tokens.append(tok)
            if newspaper:
                entry: dict = {
                    'house_number': house_number,
                    'newspaper':    newspaper,
                }
                # Only add annotation if there are tokens AND they look like
                # route/delivery codes (all-uppercase, not subscriber names)
                if annotation_tokens:
                    ann = ' '.join(annotation_tokens)
                    if re.match(r'^[A-Z0-9 \-]+$', ann):
                        entry['annotation'] = ann
                col_delivs[col_idx].append(entry)

    # --- Main line loop ---
    for raw_line in text.splitlines():
        stripped = raw_line.strip()

        if 'EINDE WIJKLIJST' in stripped:
            break

        if not in_route:
            if re.search(r'\bKlacht\b', stripped):
                in_route = True
            continue

        if NOISE_RE.match(stripped):
            continue

        # Slice into column slots
        for col_idx, (start, end) in enumerate(COL_BOUNDS):
            slot = raw_line[start:min(end, len(raw_line))]
            process_slot(slot, col_idx)

    # Flush remaining column state
    for i in range(3):
        flush_col(i)

    # Merge all entries with the same (street, city) key, preserving first-seen order.
    # This handles column-split fragments that may be non-consecutive in the list
    # (e.g. REIJER ANSLOSTRAAT first appears in col2, then continues in col1).
    from collections import OrderedDict
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
                key=lambda d: int(re.sub(r'[^0-9]', '', d['house_number']) or '0')
            ),
        }
        for (street, city), deliveries in seen.items()
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_pdf(pdf_path: Path) -> dict | None:
    try:
        text = extract_text_from_pdf(pdf_path)
    except Exception as e:
        print(f"Error reading PDF: {e}", file=sys.stderr)
        return None

    return {
        'metadata':          extract_metadata(text),
        'newspaper_summary': parse_newspaper_summary(text),
        'complaints':        parse_complaints(text),
        'delivery_route':    parse_delivery_route(text),
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 parse_looplijst.py <input.pdf> [output.json]",
              file=sys.stderr)
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"Error: file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    if pdf_path.suffix.lower() != '.pdf':
        print(f"Error: not a PDF file: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    json_path = (
        Path(sys.argv[2]) if len(sys.argv) >= 3
        else pdf_path.with_suffix('.json')
    )

    print(f"Parsing: {pdf_path}", file=sys.stderr)
    result = parse_pdf(pdf_path)

    if not result:
        print("✗ Failed to parse PDF", file=sys.stderr)
        sys.exit(1)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    streets    = len(result['delivery_route'])
    deliveries = sum(len(s['deliveries']) for s in result['delivery_route'])
    print(f"✓ {streets} streets, {deliveries} deliveries → {json_path}", file=sys.stderr)
    print(json_path)


if __name__ == '__main__':
    main()