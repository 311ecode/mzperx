import re
from .constants import STREET_SUFFIXES
from .clean_street_name import clean_street_name
def is_street_header(s: str) -> bool:
    if not s:
        return False
    cleaned = clean_street_name(s)
    check   = re.sub(r'[.\-]', ' ', cleaned.split(',')[0]).strip()
    if not re.match(r'^[A-Z][A-Z0-9 ]+$', check):
        return False
    return any(suffix in check for suffix in STREET_SUFFIXES)
