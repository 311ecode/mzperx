import re
def clean_street_name(s: str) -> str:
    annotation_re = re.compile(
        r'^[^A-Za-z]+$'
        r'|^[A-Z0-9]+(-+[A-Z0-9]*){2,}-?$'
    )
    tokens = s.split()
    while tokens and annotation_re.match(tokens[0]):
        tokens.pop(0)
    return ' '.join(tokens)
