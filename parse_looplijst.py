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
"""

import sys
import json
import re
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

# Lines that appear in the route section but are NOT deliveries or street names
NOISE_PATTERNS = re.compile(
    r'^('
    r'huisnr\s+\d+'           # annotation: "huisnr 590"
    r'|doorduwen'             # annotation: "doorduwen"
    r'|krant\s+goed'          # annotation: "Krant goed doorduwen"
    r'|doc\.nr\.'             # page footer
    r'|pagina\s+'             # page footer
    r'|powered\s+by'          # tcpdf footer
    r'|wijklijst\s*:'         # page header continuation
    r')',
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fix_ocr(s: str) -> str:
    """Replace OCR artefact O→0 only in numeric-looking contexts."""
    # Replace standalone O that looks like zero in house numbers / dates
    return s.replace('O', '0')


def format_date(date_str: str) -> str:
    """Normalise date to YYYY-MM-DD, handling DD-MM-YYYY and O→0 artefacts."""
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


def is_street_header(line: str) -> bool:
    """Return True if the line looks like a street header."""
    if not line:
        return False
    # Must be all-uppercase (letters, spaces, digits only in the name part after comma)
    # Street headers never contain a newspaper code as the last token alone
    tokens = line.split()
    if not tokens:
        return False
    # Contains a known street suffix → definitely a street
    for suffix in STREET_SUFFIXES:
        if suffix in line:
            return True
    return False


def extract_text_from_pdf(pdf_path: Path) -> str:
    """
    Extract text from all pages using a 3-column crop strategy for page 1
    (which has a wide summary table on the right) and full-page for page 2+.
    The delivery route spans both pages so we collect a single text blob.
    """
    with pdfplumber.open(pdf_path) as pdf:
        parts = []
        for page_num, page in enumerate(pdf.pages):
            pw, ph = page.width, page.height
            if page_num == 0:
                # Page 1: three columns — left two hold the route, right holds summary
                for i in range(3):
                    col = page.crop((i * pw / 3, 0, (i + 1) * pw / 3, ph))
                    ct = col.extract_text()
                    if ct:
                        parts.append(ct)
            else:
                # Page 2+: full page
                ct = page.extract_text()
                if ct:
                    parts.append(ct)
        return '\n'.join(parts)


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

    # Route code: first token(s) after </ronde>
    m = re.search(r'</ronde>\s*\n\s*([0-9O ]+)', text)
    if m:
        metadata['route_code'] = fix_ocr(m.group(1).strip())

    # Area name: uppercase word(s) before WIJKLIJST on same/nearby line
    m = re.search(r'\n([A-Z][A-Z ]+[A-Z])\s*\n.*WIJKLIJST', text)
    if m:
        metadata['area'] = m.group(1).strip()

    # Generated timestamp
    m = re.search(r'gegenereerd op ([O0-9\-]+ [O0-9:]+)', text)
    if m:
        metadata['generated_on'] = fix_ocr(m.group(1))

    return metadata


# ---------------------------------------------------------------------------
# Newspaper summary
# ---------------------------------------------------------------------------

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


def parse_newspaper_summary(text: str) -> list:
    """
    The summary table is split across columns by the crop strategy:
    - Col 0 has: "HDC HD", "TEL LA", "NRC NR" ... (codes + truncated names)
    - Col 2 has: "O 47 47 O O 47", "O 16 15 O 1 16" ... (the 6 numbers)

    Strategy: find all 6-number rows in the text in order, then zip them
    with the known newspaper order (HDC, TEL, NRC, ...).
    """
    # Collect all rows of exactly 6 O/0-digit tokens in sequence
    num_row_pattern = re.compile(
        r'^([O0]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s*$'
    )
    number_rows = []
    for line in text.split('\n'):
        m = num_row_pattern.match(line.strip())
        if m:
            number_rows.append([int(fix_ocr(m.group(i))) for i in range(1, 7)])

    newspapers = []
    ordered_codes = list(KNOWN_NEWSPAPERS.keys())
    for i, nums in enumerate(number_rows):
        if i >= len(ordered_codes):
            break
        code = ordered_codes[i]
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
    Due to the 3-column crop, the complaint fields are split across columns:
    - Col 0: "NIET BIJLAGE  21-O3-2O26  VK"
    - Col 1: "ZA  Gruttostraat 8, HAARLEM"
    - Col 2: "Bank"

    We parse each part from its column section and reassemble.
    """
    complaints = []

    # Part 1: type + date + product (col 0)
    m1 = re.search(
        r'(NIET\s+BIJLAGE|NIET\s+KRANT|VERKEERD\s+KRANT|VERKEERD)\s+'
        r'(\d{2}-\d{2}-\d{4}|[O0-9]{2}-[O0-9]{2}-[O0-9]{4})\s+'
        r'([A-Z]+)',
        text,
    )
    if not m1:
        return complaints

    complaint_type = m1.group(1).strip()
    date           = format_date(m1.group(2))
    product        = m1.group(3)

    # Part 2: abovorm + address (col 1 — appears near "Abovorm Adres" header)
    m2 = re.search(r'Abovorm Adres\s*\n([A-Z]+)\s+(.+?,\s*[A-Z]+)', text)
    subscription = m2.group(1).strip() if m2 else ''
    address      = m2.group(2).strip() if m2 else ''

    # Part 3: name (col 2 — appears after "Naam" header, before next street)
    m3 = re.search(r'\bNaam\s*\n([A-Za-z][^\n]+)', text)
    name = m3.group(1).strip() if m3 else ''

    complaints.append({
        'type':              complaint_type,
        'date':              date,
        'product':           product,
        'subscription_type': subscription,
        'address':           address,
        'name':              name,
    })

    return complaints


# ---------------------------------------------------------------------------
# Delivery route  ← this is where the original bug was
# ---------------------------------------------------------------------------

def parse_delivery_route(text: str) -> list:
    """
    Delivery route starts after the last complaint (look for the complaint
    name field, then the next street header) and ends at EINDE WIJKLIJST.

    Bug fix: the original parser started at VONDELWEG, missing all streets
    that appear earlier in the document.
    """
    delivery_route = []

    # Find start: first street header after 'Naam\n<name>\n'
    # Reliable anchor: the text just after the complaints block ends.
    # We detect this by finding 'ANTONIDES' (first street) or more robustly
    # by finding the first all-caps street-suffix line after the complaint header.
    route_end_idx = text.find('EINDE WIJKLIJST')
    if route_end_idx == -1:
        route_end_idx = len(text)

    # Find the complaint header, then scan forward for first street
    complaint_header = text.find('Klacht Datum Product')
    scan_from = complaint_header if complaint_header != -1 else 0

    # Walk lines to find where the route actually begins
    all_lines = text[scan_from:route_end_idx].split('\n')
    route_start_line = None
    for i, line in enumerate(all_lines):
        if is_street_header(line.strip()):
            route_start_line = i
            break

    if route_start_line is None:
        return delivery_route

    route_lines = all_lines[route_start_line:]

    current_street = None
    current_city   = 'HAARLEM'
    deliveries     = []

    for line in route_lines:
        line = line.strip()
        if not line:
            continue

        # Skip noise lines (annotations, footers, headers)
        if NOISE_PATTERNS.match(line):
            continue

        # House number + newspaper code line
        # Matches: "508 TEL", "930 HD", "97 NRC", "105 TEL", "8O6 HD" etc.
        m = re.match(r'^([0-9O]+[A-Za-z]?)\s+([A-Z]+)$', line)
        if m:
            house_number = fix_ocr(m.group(1))
            newspaper    = m.group(2)
            if newspaper in NEWSPAPER_CODES and current_street:
                deliveries.append({
                    'house_number': house_number,
                    'newspaper':    newspaper,
                })
            continue

        # Street header  (may include city: "ANTONIDES VD GOESSTRAAT, HAARLEM")
        if is_street_header(line):
            # Save previous street
            if current_street and deliveries:
                delivery_route.append({
                    'street':     current_street,
                    'city':       current_city,
                    'deliveries': deliveries,
                })
            elif current_street and not deliveries:
                # Street with no deliveries yet — keep accumulating
                # (can happen when a street is split across columns)
                pass

            if ',' in line:
                parts = line.split(',', 1)
                current_street = parts[0].strip()
                current_city   = parts[1].strip()
            else:
                current_street = line.strip()
                current_city   = 'HAARLEM'
            deliveries = []
            continue

    # Flush last street
    if current_street and deliveries:
        delivery_route.append({
            'street':     current_street,
            'city':       current_city,
            'deliveries': deliveries,
        })

    # Merge consecutive duplicate street entries (column-split artifact)
    merged = []
    for entry in delivery_route:
        if merged and merged[-1]['street'] == entry['street'] and merged[-1]['city'] == entry['city']:
            merged[-1]['deliveries'].extend(entry['deliveries'])
        else:
            merged.append(entry)

    return merged


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
        print("Usage: python3 parse_looplijst.py <input.pdf> [output.json]", file=sys.stderr)
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"Error: file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    if pdf_path.suffix.lower() != '.pdf':
        print(f"Error: not a PDF file: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    json_path = Path(sys.argv[2]) if len(sys.argv) >= 3 else pdf_path.with_suffix('.json')

    print(f"Parsing: {pdf_path}", file=sys.stderr)
    result = parse_pdf(pdf_path)

    if not result:
        print("✗ Failed to parse PDF", file=sys.stderr)
        sys.exit(1)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    streets = len(result['delivery_route'])
    deliveries = sum(len(s['deliveries']) for s in result['delivery_route'])
    print(f"✓ {streets} streets, {deliveries} deliveries → {json_path}", file=sys.stderr)
    print(json_path)


if __name__ == '__main__':
    main()