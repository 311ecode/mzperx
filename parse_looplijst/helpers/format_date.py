from .fix_ocr import fix_ocr


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
