
# Configuration
ZORGDK_CONDA_ENV_NAME="zordejrant"
ZORGDK_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZORGDK_PYTHON_SCRIPT="$ZORGDK_SCRIPT_DIR/parse_looplijst.py"

# Colors for output
ZORGDK_RED='\033[0;31m'
ZORGDK_GREEN='\033[0;32m'
ZORGDK_YELLOW='\033[1;33m'
ZORGDK_NC='\033[0m' # No Color

# Function to print colored messages
zorgdk_print_info() {
    echo -e "${ZORGDK_GREEN}[INFO]${ZORGDK_NC} $1"
}

zorgdk_print_warn() {
    echo -e "${ZORGDK_YELLOW}[WARN]${ZORGDK_NC} $1"
}

zorgdk_print_error() {
    echo -e "${ZORGDK_RED}[ERROR]${ZORGDK_NC} $1"
}

# Function to check if conda is installed
zorgdk_check_conda() {
    if ! command -v conda &> /dev/null; then
        zorgdk_print_error "Conda is not installed or not in PATH"
        zorgdk_print_info "Please install Miniconda or Anaconda first"
        zorgdk_print_info "Visit: https://docs.conda.io/en/latest/miniconda.html"
        return 1
    fi
    return 0
}

# Function to check if environment exists
zorgdk_env_exists() {
    conda env list | grep -q "^${ZORGDK_CONDA_ENV_NAME} "
    return $?
}

# Function to create conda environment
zorgdk_create_env() {
    zorgdk_print_info "Creating conda environment: $ZORGDK_CONDA_ENV_NAME"
    conda create -n "$ZORGDK_CONDA_ENV_NAME" python=3.10 -y
    
    if [ $? -ne 0 ]; then
        zorgdk_print_error "Failed to create conda environment"
        return 1
    fi
    
    zorgdk_print_info "Environment created successfully"
    return 0
}

# Function to install dependencies
zorgdk_install_dependencies() {
    zorgdk_print_info "Installing Python dependencies..."
    
    # Activate environment
    eval "$(conda shell.bash hook)"
    conda activate "$ZORGDK_CONDA_ENV_NAME"
    
    # Install all required dependencies to avoid conflicts
    zorgdk_print_info "Installing base dependencies..."
    pip install --upgrade pip
    pip install idna certifi click itsdangerous Jinja2 PyYAML
    
    zorgdk_print_info "Installing pdfplumber..."
    pip install pdfplumber
    
    if [ $? -ne 0 ]; then
        zorgdk_print_error "Failed to install dependencies"
        return 1
    fi
    
    zorgdk_print_info "Dependencies installed successfully"
    return 0
}

# Function to setup everything
zorgdk_setup_environment() {
    zorgdk_print_info "Starting setup process..."
    
    # Check conda
    if ! zorgdk_check_conda; then
        return 1
    fi
    
    # Check if environment exists
    if zorgdk_env_exists; then
        zorgdk_print_info "Environment '$ZORGDK_CONDA_ENV_NAME' already exists"
        
        # Check if pdfplumber is installed
        eval "$(conda shell.bash hook)"
        conda activate "$ZORGDK_CONDA_ENV_NAME"
        
        if ! python -c "import pdfplumber" 2>/dev/null; then
            zorgdk_print_warn "pdfplumber not found, installing..."
            zorgdk_install_dependencies
        else
            zorgdk_print_info "All dependencies are already installed"
        fi
    else
        # Create environment and install dependencies
        zorgdk_create_env
        if [ $? -eq 0 ]; then
            zorgdk_install_dependencies
        else
            return 1
        fi
    fi
    
    zorgdk_print_info "Setup complete!"
    return 0
}

# Main parse function
zorgdk_parse_looplijst() {
    local pdf_path="$1"
    
    # Validate input
    if [ -z "$pdf_path" ]; then
        zorgdk_print_error "No PDF file specified"
        echo "Usage: zorgdk_parse_looplijst <pdf_file_path>"
        return 1
    fi
    
    # Convert to absolute path
    pdf_path="$(realpath "$pdf_path" 2>/dev/null || echo "$pdf_path")"
    
    # Check if file exists
    if [ ! -f "$pdf_path" ]; then
        zorgdk_print_error "File not found: $pdf_path"
        return 1
    fi
    
    # Check if it's a PDF
    if [[ ! "$pdf_path" =~ \.pdf$ ]]; then
        zorgdk_print_error "Not a PDF file: $pdf_path"
        return 1
    fi
    
    zorgdk_print_info "Processing: $pdf_path"
    
    # Setup environment if needed
    if ! zorgdk_check_conda; then
        return 1
    fi
    
    if ! zorgdk_env_exists; then
        zorgdk_print_warn "Environment not found, setting up..."
        zorgdk_setup_environment
        if [ $? -ne 0 ]; then
            return 1
        fi
    fi
    
    # Activate environment and run parser
    eval "$(conda shell.bash hook)"
    conda activate "$ZORGDK_CONDA_ENV_NAME"
    
    # Check if Python script exists
    if [ ! -f "$ZORGDK_PYTHON_SCRIPT" ]; then
        zorgdk_print_error "Parser script not found: $ZORGDK_PYTHON_SCRIPT"
        return 1
    fi
    
    # Run the parser
    python "$ZORGDK_PYTHON_SCRIPT" "$pdf_path"
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        local json_path="${pdf_path%.pdf}.json"
        zorgdk_print_info "JSON output: $json_path"
    else
        zorgdk_print_error "Parser failed with exit code: $exit_code"
    fi
    
    return $exit_code
}

# If script is being sourced, just define the function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    if [ "$1" == "setup" ]; then
        zorgdk_setup_environment
    elif [ -n "$1" ]; then
        zorgdk_parse_looplijst "$1"
    else
        echo "Looplijst Parser (ZORGDK)"
        echo ""
        echo "Usage:"
        echo "  $0 setup                    # Setup conda environment and dependencies"
        echo "  $0 <pdf_file>              # Parse a PDF file"
        echo ""
        echo "Or source this script and use the function:"
        echo "  source $0"
        echo "  zorgdk_parse_looplijst <pdf_file>"
    fi
fi
