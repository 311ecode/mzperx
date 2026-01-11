#!/usr/bin/env bash

# Configuration
ZORGDK_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZORGDK_PARSE_SCRIPT="$ZORGDK_SCRIPT_DIR/setup_and_parse.sh"
ZORGDK_NORMALIZE_SCRIPT="$ZORGDK_SCRIPT_DIR/normalize_json.py"

# Colors for output
ZORGDK_RED='\033[0;31m'
ZORGDK_GREEN='\033[0;32m'
ZORGDK_YELLOW='\033[1;33m'
ZORGDK_NC='\033[0m'

# Function to print colored messages
zorgdk_print_info() {
    echo -e "${ZORGDK_GREEN}[INFO]${ZORGDK_NC} $1" >&2
}
zorgdk_print_warn() {
    echo -e "${ZORGDK_YELLOW}[WARN]${ZORGDK_NC} $1" >&2
}
zorgdk_print_error() {
    echo -e "${ZORGDK_RED}[ERROR]${ZORGDK_NC} $1" >&2
}

# Function to update sample wijklijst
update_sample_wijklijst() {
    local downloads_dir="${1:-$HOME/Downloads}"
    local private_dir="${PRIVATE_DIR:-$HOME/.private}"

    if [[ ! -d "$downloads_dir" ]]; then
        zorgdk_print_error "Downloads directory not found: $downloads_dir"
        return 1
    fi

    # Source the parse script
    if [[ ! -f "$ZORGDK_PARSE_SCRIPT" ]]; then
        zorgdk_print_error "Parse script not found: $ZORGDK_PARSE_SCRIPT"
        return 1
    fi
    source "$ZORGDK_PARSE_SCRIPT"

    # Override print functions to stderr after sourcing
    zorgdk_print_info() {
        echo -e "${ZORGDK_GREEN}[INFO]${ZORGDK_NC} $1" >&2
    }
    zorgdk_print_warn() {
        echo -e "${ZORGDK_YELLOW}[WARN]${ZORGDK_NC} $1" >&2
    }
    zorgdk_print_error() {
        echo -e "${ZORGDK_RED}[ERROR]${ZORGDK_NC} $1" >&2
    }

    # Find latest PDF
    pushd "$downloads_dir" > /dev/null
    local latest_relative
    # Changed to *.pdf to get the absolute latest PDF regardless of name pattern
    # ls -t sorts by time (newest first), head -n 1 gets the first one
    latest_relative=$(ls -t *.pdf 2>/dev/null | head -n 1)
    popd > /dev/null

    if [[ -z "$latest_relative" ]]; then
        zorgdk_print_error "No PDF files found in $downloads_dir"
        return 1
    fi

    local latest_pdf="$downloads_dir/$latest_relative"
    zorgdk_print_info "Found latest PDF: $latest_pdf"

    # Parse PDF
    local parse_output
    parse_output=$(zorgdk_parse_looplijst "$latest_pdf")
    local exit_code=$?

    local json_path
    json_path=$(echo "$parse_output" | grep '\.json$' | tail -1)

    if [[ $exit_code -ne 0 || -z "$json_path" ]]; then
        zorgdk_print_error "Failed to parse PDF: $latest_pdf"
        return 1
    fi

    # Normalize JSON (merge duplicate streets)
    if [[ -f "$ZORGDK_NORMALIZE_SCRIPT" ]]; then
        zorgdk_print_info "Normalizing JSON (merging duplicate streets)..."
        python3 "$ZORGDK_NORMALIZE_SCRIPT" "$json_path"
        if [[ $? -ne 0 ]]; then
            zorgdk_print_warn "Normalization failed, continuing with unnormalized JSON"
        else
            zorgdk_print_info "JSON normalized successfully"
        fi
    else
        zorgdk_print_warn "Normalize script not found: $ZORGDK_NORMALIZE_SCRIPT (skipping normalization)"
    fi

    local sample_dir="$private_dir/projects/bezorgdk/promzdkr/examples"
    local sample_json="$sample_dir/sample.json"

    mkdir -p "$sample_dir"
    cp "$json_path" "$sample_json"

    if [[ $? -eq 0 ]]; then
        zorgdk_print_info "Successfully updated sample: $sample_json"
        echo "$sample_json"

        cd $PRIVATE_DIR
        ga $sample_dir
        agaimcp "Updated sample.json from latest PDF ($latest_relative) at $(date) ."
        manage_site_visibility

        return 0
    else
        zorgdk_print_error "Failed to copy to sample: $sample_json"
        return 1
    fi
}
