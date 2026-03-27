import re

from ..helpers import fix_ocr


def parse_newspaper_summary(text: str) -> list:
    """
    Dynamically extract newspaper rows from the summary table.
    Each row has: CODE  EDITION  NAME  <6 numbers>
    No hard-coded newspaper list needed.
    """
    num_tail_re = re.compile(
        r'([O0]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s+([O0-9]+)\s*$'
    )
    # CODE(2-4 caps)  EDITION(caps, may contain underscore/digits e.g. HD_MA, NRC_MA)  NAME(mixed case words)
    code_re = re.compile(
        r'([A-Z]{2,4})\s{2,}([A-Z][A-Z0-9_]{1,8})\s{2,}([A-Za-z][A-Za-z .]+?)(?:\s{3,}|\s+(?=[O0]))'
    )

    newspapers = []
    for line in text.splitlines():
        m_nums = num_tail_re.search(line)
        if not m_nums:
            continue

        prefix = line[:m_nums.start()]
        matches = list(code_re.finditer(prefix))
        if not matches:
            continue

        # Take the last match (handles lines with WIJKLIJST junk before the code)
        cm = matches[-1]
        nums = [int(fix_ocr(m_nums.group(i))) for i in range(1, 7)]

        newspapers.append({
            'code':              cm.group(1),
            'edition':           cm.group(2),
            'name':              cm.group(3).strip(),
            'standard_bundles':  nums[0],
            'loose_copies':      nums[1],
            'subscriber_count':  nums[2],
            'lv_count':          nums[3],
            'leftover_papers':   nums[4],
            'total_circulation': nums[5],
        })

    return newspapers
