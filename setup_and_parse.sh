#!/usr/bin/env bash

# Configuration
ZORGDK_CONDA_ENV_NAME="zordejrant"
ZORGDK_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZORGDK_PYTHON_SCRIPT="$ZORGDK_SCRIPT_DIR/parse_looplijst.py"

# Colors for output
ZORGDK_RED='\033[0;31m'
ZORGDK_GREEN='\033[0;32m'
ZORGDK_YELLOW='\033[1;33m'
ZORGDK_NC='\033[0m' # No Color

zorgdk_print_info()  { echo -e "${ZORGDK_GREEN}[INFO]${ZORGDK_NC} $1" >&2; }
zorgdk_print_warn()  { echo -e "${ZORGDK_YELLOW}[WARN]${ZORGDK_NC} $1" >&2; }
zorgdk_print_error() { echo -e "${ZORGDK_RED}[ERROR]${ZORGDK_NC} $1" >&2; }

# --- Python resolution ---

# Return the first python3/python binary that can import pdfplumber, or "".
zorgdk_find_python() {
    for candidate in python3 python; do
        if command -v "$candidate" &>/dev/null; then
            if "$candidate" -c "import pdfplumber" 2>/dev/null; then
                echo "$candidate"
                return 0
            fi
        fi
    done
    echo ""
}

# Install pdfplumber into the system/user Python (no conda needed).
zorgdk_pip_install() {
    local py="$1"
    zorgdk_print_info "Installing pdfplumber via pip..."
    "$py" -m pip install --user pdfplumber --break-system-packages 2>/dev/null \
        || "$py" -m pip install --user pdfplumber
}

# --- Conda helpers (kept for environments that do have it) ---

zorgdk_get_conda_base() {
    if command -v conda &>/dev/null; then
        conda info --base 2>/dev/null
    elif [ -n "$CONDA_EXE" ]; then
        dirname "$(dirname "$CONDA_EXE")"
    elif [ -d "$HOME/miniconda3" ]; then
        echo "$HOME/miniconda3"
    elif [ -d "$HOME/anaconda3" ]; then
        echo "$HOME/anaconda3"
    else
        echo ""
    fi
}

zorgdk_init_conda() {
    local conda_base
    conda_base=$(zorgdk_get_conda_base)
    [ -z "$conda_base" ] && return 1
    [ -f "$conda_base/etc/profile.d/conda.sh" ] || return 1
    source "$conda_base/etc/profile.d/conda.sh"
}

zorgdk_env_exists() {
    conda env list 2>/dev/null | grep -q "^${ZORGDK_CONDA_ENV_NAME} "
}

zorgdk_create_env() {
    zorgdk_print_info "Creating conda environment: $ZORGDK_CONDA_ENV_NAME"
    conda create -n "$ZORGDK_CONDA_ENV_NAME" python=3.10 -y || return 1
    zorgdk_print_info "Environment created successfully"
}

zorgdk_install_dependencies() {
    zorgdk_init_conda || return 1
    conda activate "$ZORGDK_CONDA_ENV_NAME" || return 1
    pip install --upgrade pip
    pip install idna certifi click itsdangerous Jinja2 PyYAML
    pip install pdfplumber
}

zorgdk_setup_environment() {
    zorgdk_print_info "Starting conda setup process..."
    command -v conda &>/dev/null || { zorgdk_print_error "Conda not found"; return 1; }
    zorgdk_init_conda || return 1
    if zorgdk_env_exists; then
        zorgdk_print_info "Environment '$ZORGDK_CONDA_ENV_NAME' already exists"
        conda activate "$ZORGDK_CONDA_ENV_NAME"
        python -c "import pdfplumber" 2>/dev/null \
            || zorgdk_install_dependencies
    else
        zorgdk_create_env && zorgdk_install_dependencies
    fi
    zorgdk_print_info "Conda setup complete!"
}

# --- Main parse function ---

zorgdk_parse_looplijst() {
    local pdf_path="$1"

    if [ -z "$pdf_path" ]; then
        zorgdk_print_error "No PDF file specified"
        echo "Usage: zorgdk_parse_looplijst <pdf_file_path>"
        return 1
    fi

    pdf_path="$(realpath "$pdf_path" 2>/dev/null || echo "$pdf_path")"

    if [ ! -f "$pdf_path" ]; then
        zorgdk_print_error "File not found: $pdf_path"
        return 1
    fi

    if [[ ! "$pdf_path" =~ \.pdf$ ]]; then
        zorgdk_print_error "Not a PDF file: $pdf_path"
        return 1
    fi

    if [ ! -f "$ZORGDK_PYTHON_SCRIPT" ]; then
        zorgdk_print_error "Parser script not found: $ZORGDK_PYTHON_SCRIPT"
        return 1
    fi

    zorgdk_print_info "Processing: $pdf_path"

    # --- Resolve which Python to use ---
    local PYTHON=""

    # 1. Try conda environment first (if conda is available)
    if command -v conda &>/dev/null && zorgdk_init_conda 2>/dev/null; then
        if ! zorgdk_env_exists; then
            zorgdk_print_warn "Conda env not found, setting up..."
            zorgdk_setup_environment
        fi
        conda activate "$ZORGDK_CONDA_ENV_NAME" 2>/dev/null
        if python -c "import pdfplumber" 2>/dev/null; then
            PYTHON="python"
            zorgdk_print_info "Using conda environment: $ZORGDK_CONDA_ENV_NAME"
        fi
    fi

    # 2. Fall back to system Python with pdfplumber already available
    if [ -z "$PYTHON" ]; then
        PYTHON=$(zorgdk_find_python)
        if [ -n "$PYTHON" ]; then
            zorgdk_print_info "Using system Python: $(command -v "$PYTHON")"
        fi
    fi

    # 3. Try installing pdfplumber into system Python
    if [ -z "$PYTHON" ]; then
        zorgdk_print_warn "pdfplumber not found, attempting pip install..."
        for candidate in python3 python; do
            if command -v "$candidate" &>/dev/null; then
                zorgdk_pip_install "$candidate"
                if "$candidate" -c "import pdfplumber" 2>/dev/null; then
                    PYTHON="$candidate"
                    break
                fi
            fi
        done
    fi

    if [ -z "$PYTHON" ]; then
        zorgdk_print_error "No suitable Python with pdfplumber found."
        zorgdk_print_error "Install it manually: pip install pdfplumber"
        return 1
    fi

    # --- Run the parser ---
    "$PYTHON" "$ZORGDK_PYTHON_SCRIPT" "$pdf_path"
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        local json_path="${pdf_path%.pdf}.json"
        zorgdk_print_info "JSON output: $json_path"
    else
        zorgdk_print_error "Parser failed with exit code: $exit_code"
    fi

    return $exit_code
}

# --- Direct execution ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [ "$1" == "setup" ]; then
        zorgdk_setup_environment
    elif [ -n "$1" ]; then
        zorgdk_parse_looplijst "$1"
    else
        echo "Looplijst Parser (ZORGDK)"
        echo ""
        echo "Usage:"
        echo "  $0 setup                    # Setup conda environment and dependencies"
        echo "  $0 <pdf_file>               # Parse a PDF file"
        echo ""
        echo "Or source this script and use the function:"
        echo "  source $0"
        echo "  zorgdk_parse_looplijst <pdf_file>"
    fi
fi
