def fix_ocr(s: str) -> str:
    """Replace OCR artefact uppercase-O → 0."""
    return s.replace('O', '0')
