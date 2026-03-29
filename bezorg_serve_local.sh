#!/usr/bin/env bash

bezorg_serve_local() {
    local port="${1:-8000}"
    local target_dir="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

    if [[ ! -f "$target_dir/index.html" ]]; then
        echo "Error: 'index.html' does not exist in '$target_dir'" >&2
        return 1
    fi

    if ! command -v npx &> /dev/null; then
        echo "Error: npx is not installed. Please install Node.js first." >&2
        return 1
    fi

    echo "========================================="
    echo "Directory: $target_dir"
    echo "URL:       http://localhost:$port"
    echo "========================================="
    echo "Press Ctrl+C to stop"
    echo ""

    cd "$target_dir" && npx serve -l "$port"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    serve_local "$@"
fi
