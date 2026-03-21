import re

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

COL_BOUNDS = [(0, 110), (111, 206), (207, 9999)]

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
