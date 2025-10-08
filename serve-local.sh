#!/usr/bin/env bash

# serve-local.sh
# A bash function to serve index.html from the script's directory using npx serve
# Usage: serve-local.sh [port]

serve_local() {
    local port="${1:-8000}"
    # Get the directory where the script is located
    local target_dir="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
    
    # Check if index.html exists in the target directory
    if [[ ! -f "$target_dir/index.html" ]]; then
        echo "Error: 'index.html' does not exist in '$target_dir'" >&2
        return 1
    fi
    
    echo "========================================="
    echo "Starting local web server..."
    echo "========================================="
    echo "Directory: $target_dir"
    echo "Serving:   index.html"
    echo "Port:      $port"
    echo "URL:       http://localhost:$port"
    echo "========================================="
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    
    # Check if npx is available
    if ! command -v npx &> /dev/null; then
        echo "Error: npx is not installed. Please install Node.js first." >&2
        return 1
    fi
    
    # Start the server
    cd "$target_dir" || return 1
    npx serve -l "$port"
}

# If script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    serve_local "$@"
fi