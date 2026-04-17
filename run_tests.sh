#!/usr/bin/env bash
#
# Test runner for parse_looplijst.
#
# Layout:
#   tests/cases/<name>/input.pdf
#   tests/cases/<name>/expected.json
#
# A case passes if, for every street in expected.json, the parser produces
# the same multiset of (house_number, newspaper) pairs. Metadata, complaints,
# annotations, and ordering are ignored.
#
# Usage:
#   ./run_tests.sh                      # run all cases
#   ./run_tests.sh <case_name>          # run a single case
#   ./run_tests.sh --update             # regenerate expected.json for all cases
#   ./run_tests.sh --update <case_name> # regenerate expected.json for one case

ZORGDK_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZORGDK_CASES_DIR="$ZORGDK_TEST_DIR/tests/cases"
ZORGDK_PARSER="$ZORGDK_TEST_DIR/parse_looplijst.py"

ZORGDK_RED='\033[0;31m'
ZORGDK_GREEN='\033[0;32m'
ZORGDK_YELLOW='\033[1;33m'
ZORGDK_BLUE='\033[0;34m'
ZORGDK_NC='\033[0m'

zorgdk_print_info()  { echo -e "${ZORGDK_BLUE}[INFO]${ZORGDK_NC} $1" >&2; }
zorgdk_print_pass()  { echo -e "${ZORGDK_GREEN}[PASS]${ZORGDK_NC} $1" >&2; }
zorgdk_print_fail()  { echo -e "${ZORGDK_RED}[FAIL]${ZORGDK_NC} $1" >&2; }
zorgdk_print_warn()  { echo -e "${ZORGDK_YELLOW}[WARN]${ZORGDK_NC} $1" >&2; }
zorgdk_print_error() { echo -e "${ZORGDK_RED}[ERROR]${ZORGDK_NC} $1" >&2; }

# Resolve a Python interpreter with pdfplumber available.
zorgdk_resolve_python() {
    for candidate in python3 python; do
        if command -v "$candidate" &>/dev/null; then
            if "$candidate" -c "import pdfplumber" 2>/dev/null; then
                echo "$candidate"
                return 0
            fi
        fi
    done
    echo ""
    return 1
}

# Run the parser; writes to the given output path.
zorgdk_run_parser() {
    local py="$1"
    local pdf="$2"
    local out_json="$3"

    "$py" "$ZORGDK_PARSER" "$pdf" "$out_json" >/dev/null
    return $?
}

# Compare expected vs actual on delivery_route key fields only.
# Returns 0 on match, 1 on mismatch. Prints a diff summary to stderr on mismatch.
zorgdk_compare_delivery_routes() {
    local expected="$1"
    local actual="$2"
    local py="$3"

    "$py" - "$expected" "$actual" <<'PY_EOF'
import json
import sys
from collections import Counter

expected_path, actual_path = sys.argv[1], sys.argv[2]

def load_route(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    route = {}
    for street in data.get('delivery_route', []):
        key = street['street']
        pairs = Counter(
            (d['house_number'], d['newspaper'])
            for d in street.get('deliveries', [])
        )
        route[key] = pairs
    return route

exp = load_route(expected_path)
act = load_route(actual_path)

failed = False

missing_streets = sorted(set(exp) - set(act))
extra_streets   = sorted(set(act) - set(exp))

if missing_streets:
    failed = True
    print(f"  Missing streets in parser output: {missing_streets}", file=sys.stderr)
if extra_streets:
    failed = True
    print(f"  Unexpected streets in parser output: {extra_streets}", file=sys.stderr)

for street in sorted(set(exp) & set(act)):
    exp_pairs = exp[street]
    act_pairs = act[street]
    if exp_pairs == act_pairs:
        continue
    failed = True
    missing = exp_pairs - act_pairs
    extra   = act_pairs - exp_pairs
    print(f"  Street '{street}' mismatch:", file=sys.stderr)
    if missing:
        for (hn, np), n in sorted(missing.items()):
            label = f" (x{n})" if n > 1 else ""
            print(f"    - missing: {hn} {np}{label}", file=sys.stderr)
    if extra:
        for (hn, np), n in sorted(extra.items()):
            label = f" (x{n})" if n > 1 else ""
            print(f"    - extra:   {hn} {np}{label}", file=sys.stderr)

sys.exit(1 if failed else 0)
PY_EOF
    return $?
}

# Run one case. Returns 0=pass, 1=fail, 2=skipped.
zorgdk_run_case() {
    local case_dir="$1"
    local update="$2"
    local py="$3"
    local case_name
    case_name="$(basename "$case_dir")"

    local pdf="$case_dir/input.pdf"
    local expected="$case_dir/expected.json"

    if [[ ! -f "$pdf" ]]; then
        zorgdk_print_warn "Skipping '$case_name': no input.pdf"
        return 2
    fi

    if [[ "$update" == "1" ]]; then
        zorgdk_print_info "Updating expected.json for '$case_name'"
        if zorgdk_run_parser "$py" "$pdf" "$expected"; then
            zorgdk_print_pass "$case_name (expected.json written)"
            return 0
        else
            zorgdk_print_fail "$case_name (parser failed)"
            return 1
        fi
    fi

    if [[ ! -f "$expected" ]]; then
        zorgdk_print_warn "Skipping '$case_name': no expected.json (run with --update to create one)"
        return 2
    fi

    local tmp_json
    tmp_json="$(mktemp --suffix=.json)"

    if ! zorgdk_run_parser "$py" "$pdf" "$tmp_json"; then
        zorgdk_print_fail "$case_name (parser crashed)"
        rm -f "$tmp_json"
        return 1
    fi

    if zorgdk_compare_delivery_routes "$expected" "$tmp_json" "$py"; then
        zorgdk_print_pass "$case_name"
        rm -f "$tmp_json"
        return 0
    else
        zorgdk_print_fail "$case_name"
        rm -f "$tmp_json"
        return 1
    fi
}

zorgdk_main() {
    local update=0
    local target=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --update) update=1; shift ;;
            -h|--help)
                cat <<EOF
Usage: $0 [--update] [<case_name>]

Runs parser tests from $ZORGDK_CASES_DIR.
Each case is a directory containing:
  input.pdf       - the PDF to parse
  expected.json   - the expected parser output (key-field compare on delivery_route)

Options:
  --update        Overwrite expected.json with fresh parser output
  <case_name>     Run only the named case (optional)
EOF
                return 0
                ;;
            *) target="$1"; shift ;;
        esac
    done

    if [[ ! -f "$ZORGDK_PARSER" ]]; then
        zorgdk_print_error "Parser not found at $ZORGDK_PARSER"
        return 1
    fi

    if [[ ! -d "$ZORGDK_CASES_DIR" ]]; then
        zorgdk_print_error "Cases directory not found: $ZORGDK_CASES_DIR"
        zorgdk_print_error "Create it and add <case_name>/input.pdf subdirectories."
        return 1
    fi

    local py
    py="$(zorgdk_resolve_python)"
    if [[ -z "$py" ]]; then
        zorgdk_print_error "No Python with pdfplumber found."
        return 1
    fi
    zorgdk_print_info "Using Python: $(command -v "$py")"

    local cases=()
    if [[ -n "$target" ]]; then
        local dir="$ZORGDK_CASES_DIR/$target"
        if [[ ! -d "$dir" ]]; then
            zorgdk_print_error "Case not found: $dir"
            return 1
        fi
        cases=("$dir")
    else
        local d
        for d in "$ZORGDK_CASES_DIR"/*/; do
            [[ -d "$d" ]] && cases+=("${d%/}")
        done
    fi

    if [[ ${#cases[@]} -eq 0 ]]; then
        zorgdk_print_warn "No cases found in $ZORGDK_CASES_DIR"
        return 0
    fi

    local pass=0 fail=0 skip=0
    local c
    for c in "${cases[@]}"; do
        zorgdk_run_case "$c" "$update" "$py"
        case $? in
            0) pass=$((pass+1)) ;;
            1) fail=$((fail+1)) ;;
            2) skip=$((skip+1)) ;;
        esac
    done

    echo >&2
    zorgdk_print_info "Results: ${pass} passed, ${fail} failed, ${skip} skipped"

    [[ $fail -eq 0 ]]
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    zorgdk_main "$@"
fi
