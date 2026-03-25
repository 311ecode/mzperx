import re

STREET_SUFFIXES = (
    'STRAAT', 'WEG', 'LAAN', 'PLEIN', 'SINGEL', 'GRACHT',
    'KADE', 'DIJK', 'PAD', 'DREEF', 'ALLEE', 'BOULEVARD',
)

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
    r'|[A-Z0-9][A-Z0-9]*(?:-+[A-Z0-9]*){2,}-?$'
    r')',
    re.IGNORECASE,
)
