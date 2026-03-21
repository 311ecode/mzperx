import re

from ..helpers import fix_ocr, format_date


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
