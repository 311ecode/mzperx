import re

from ..helpers import fix_ocr, KNOWN_NEWSPAPERS


def parse_newspaper_summary(text: str) -> list:
    """
    Summary rows look like: O  47  47  O  O  47  (exactly 6 O/digit tokens).
    """
    num_row_re = re.compile(
        r'^\s*([O0]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s*$'
    )
    number_rows = []
    for line in text.splitlines():
        m = num_row_re.match(line)
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
