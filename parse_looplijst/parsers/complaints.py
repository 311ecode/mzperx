import re
from ..helpers import fix_ocr, format_date
def parse_complaints(text: str) -> list:
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
            r'(\S+)\s+([A-Z]+)\s+([A-Z][A-Z\-]*)\s+(.+?,\s*[A-Z]+)(?:\s+(.+))?$',
            stripped,
        )
        if m:
            complaints.append({
                'type': m.group(1).strip(), 'date': format_date(m.group(2)),
                'product': m.group(3), 'subscription_type': m.group(4),
                'address': fix_ocr(m.group(5).strip()), 'name': (m.group(6) or '').strip(),
            })
    return complaints
