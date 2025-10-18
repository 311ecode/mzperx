#!/usr/bin/env bash

# Configuration
ZORGDK_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZORGDK_PARSE_SCRIPT="$ZORGDK_SCRIPT_DIR/setup_and_parse.sh"  # Assuming setup_and_parse.sh is present

# Colors for output
ZORGDK_RED='\033[0;31m'
ZORGDK_GREEN='\033[0;32m'
ZORGDK_YELLOW='\033[1;33m'
ZORGDK_NC='\033[0m' # No Color

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
    local private_dir="${PRIVATE_DIR:-$HOME/.private}"  # Assume $PRIVATE_DIR if set, else fallback

    if [[ ! -d "$downloads_dir" ]]; then
        zorgdk_print_error "Downloads directory not found: $downloads_dir"
        return 1
    fi

    # Source the parse script to get zorgdk_parse_looplijst function
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

    # Change to downloads_dir to get relative paths, then make absolute
    pushd "$downloads_dir" > /dev/null
    local latest_relative
    latest_relative=$(ls -lt . 2>/dev/null | grep Wijk | grep pdf | head -1 | awk '{print $NF}')
    popd > /dev/null

    if [[ -z "$latest_relative" ]]; then
        zorgdk_print_error "No Wijklijst*.pdf found in $downloads_dir"
        return 1
    fi

    local latest_pdf="$downloads_dir/$latest_relative"
    zorgdk_print_info "Found latest PDF: $latest_pdf"

    # Parse using zorgdk_parse_looplijst and extract json_path
    local parse_output
    parse_output=$(zorgdk_parse_looplijst "$latest_pdf")
    local exit_code=$?

    local json_path
    json_path=$(echo "$parse_output" | grep '\.json$' | tail -1)

    if [[ $exit_code -ne 0 || -z "$json_path" ]]; then
        zorgdk_print_error "Failed to parse PDF: $latest_pdf"
        return 1
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

        gacomp "Updated sample.json from latest Wijklijst PDF at $(date) ."

        manage_site_visibility

        return 0
    else
        zorgdk_print_error "Failed to copy to sample: $sample_json"
        return 1
    fi
}

# If script is being sourced, just define the function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    if [ -n "$1" ]; then
        update_sample_wijklijst "$1"
    else
        echo "Sample Wijklijst Updater"
        echo ""
        echo "Usage:"
        echo " $0 [downloads_dir] # Update sample.json from latest PDF in downloads_dir"
        echo ""
        echo "Or source this script and use the function:"
        echo " source $0"
        echo " update_sample_wijklijst [downloads_dir]"
    fi
fi