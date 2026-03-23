import re

from ..helpers import fix_ocr, KNOWN_NEWSPAPERS


def parse_newspaper_summary(text: str) -> list:
    """
    Summary rows in pdftotext -layout sit at the END of long lines that also
    contain the newspaper name, e.g.:
        HDC   HD   Haarlems Dagblad   O   36   35   O   1   36
    We search for the trailing 6-number pattern rather than requiring
    the whole line to be numbers only.
    """
    num_tail_re = re.compile(
        r'([O0]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s*$'
    )
    number_rows = []
    for line in text.splitlines():
        # Only consider lines that contain a known newspaper code
        if not any(code in line for code in KNOWN_NEWSPAPERS):
            continue
        m = num_tail_re.search(line)
        if m:
            number_rows.append([int(fix_ocr(m.group(i))) for i in range(1, 7)])

    newspapers = []
    for i, nums in enumerate(number_rows):
        if i >= len(KNOWN_NEWSPAPERS):
            break
        code = list(KNOWN_NEWSPAPERS.keys())[i]
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
