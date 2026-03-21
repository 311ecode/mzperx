import re

from .constants import STREET_SUFFIXES
from .clean_street_name import clean_street_name


def is_street_header(s: str) -> bool:
    """
    True if s is an all-caps street name after annotation stripping.
    Accepts: P.C. HOOFTSTRAAT, SINT-BAVOSTRAAT, ANTONIDES VD GOESSTRAAT
    Rejects: mixed-case lines like "Vondelweg 440"
    """
    if not s:
        return False
    cleaned = clean_street_name(s)
    check   = re.sub(r'[.\-]', ' ', cleaned.split(',')[0]).strip()
    if not re.match(r'^[A-Z][A-Z0-9 ]+$', check):
        return False
    return any(suffix in check for suffix in STREET_SUFFIXES)
