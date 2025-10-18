#!/usr/bin/env bash

# This script temporarily modifies the .github-sync.yaml file using yq
# to make a project public, then restores from backup.
#
# All functions and variables are namespaced with 'msv_' to prevent
# polluting the global shell environment.

# --- Namespaced Constants ---
MSV_CONFIG_FILE="${PRIVATE_DIR:-$HOME/.private}/.github-sync.yaml"
# This is the literal path string from inside the YAML file
MSV_PROJECT_PATH="projects/bezorgdk/promzdkr/examples"

# --- Namespaced Colors ---
MSV_RED='\033[0;31m'
MSV_GREEN='\033[0;32m'
MSV_YELLOW='\033[1;33m'
MSV_NC='\033[0m' # No Color

# --- Namespaced Helper Functions ---

# Prints an INFO message to stderr.
# @param $1 Message to print.
msv_print_info() {
    echo -e "${MSV_GREEN}[INFO]${MSV_NC} $1" >&2
}

# Prints a WARN message to stderr.
# @param $1 Message to print.
msv_print_warn() {
    echo -e "${MSV_YELLOW}[WARN]${MSV_NC} $1" >&2
}

# Prints an ERROR message to stderr.
# @param $1 Message to print.
msv_print_error() {
    echo -e "${MSV_RED}[ERROR]${MSV_NC} $1" >&2
}

# --- Main Workflow Function ---

# Main function to manage the site visibility workflow.
manage_site_visibility() {
    cd $PRIVATE_DIR
    # --- Pre-run Checks ---
    if ! command -v yq &> /dev/null; then
        msv_print_error "yq is not installed. Please install yq to continue."
        return 1
    fi

    if [[ ! -f "$MSV_CONFIG_FILE" ]]; then
        msv_print_error "Configuration file not found: $MSV_CONFIG_FILE"
        msv_print_error "Cannot proceed without the file."
        return 1
    fi

    # --- Local Variables ---
    local backup_file="${MSV_CONFIG_FILE}.bak"
    
    # Use $PRIVATE_DIR if set, otherwise default to $HOME/.private
    local private_dir_val="${PRIVATE_DIR:-$HOME/.private}"
    local json_output_path="$private_dir_val/.github-sync-output.json"

    # --- Main Script Logic ---

    # 1. Back up the original file
    msv_print_info "Backing up current configuration to $backup_file..."
    cp "$MSV_CONFIG_FILE" "$backup_file"
    if [[ $? -ne 0 ]]; then
        msv_print_error "Failed to create backup. Exiting."
        return 1
    fi

    # 2. Modify configuration to be PUBLIC using yq
    msv_print_info "Applying temporary (public) configuration using yq..."
    msv_print_info "Setting json_output to: $json_output_path"

    # Define the yq commands using single quotes
    # The $VARNAME syntax is for jq, which will read them
    # from the --arg flags below.
    local yq_cmd_project='.projects[] |= (select(.path == $MSV_PROJ_PATH) |= (.private = false | .githubPages = true))'
    local yq_cmd_json='.json_output = $MSV_JSON_PATH'

    # Run yq to apply both changes
    # FIX: Pass variables directly to jq using --arg
    # This avoids environment variable scoping issues.
    yq -i -y \
       --arg MSV_PROJ_PATH "$MSV_PROJECT_PATH" \
       --arg MSV_JSON_PATH "$json_output_path" \
       "$yq_cmd_project | $yq_cmd_json" \
       "$MSV_CONFIG_FILE"

    if [[ $? -ne 0 ]]; then
        msv_print_error "yq command failed. Restoring from backup."
        cp "$backup_file" "$MSV_CONFIG_FILE"
        return 1
    fi

    # 3. Run 'sy' twice
    msv_print_info "Running 'sy' (first time) to apply public settings..."
    sy
    msv_print_info "Running 'sy' (second time)..."
    sy

    msv_print_info "Site is now public."

    # 4. Ask for confirmation
    echo "" # Add a newline for clarity
    local answer
    read -p "Can I continue to close the site? (y/n): " answer

    # 5. Conditional Restore
    if [[ "$answer" == "y" || "$answer" == "Y" ]]; then
        msv_print_info "Restoring original (private) configuration from backup..."
        cp "$backup_file" "$MSV_CONFIG_FILE"
        if [[ $? -ne 0 ]]; then
            msv_print_error "Failed to restore original configuration from $backup_file!"
            msv_print_warn "You may need to restore it manually."
            return 1
        fi

        # 6. Run 'sy' one last time
        msv_print_info "Running 'sy' to apply private settings..."
        sy

        msv_print_info "Site closed. Original configuration restored."
        rm "$backup_file"
        msv_print_info "Backup file removed."
    else
        msv_print_warn "Aborting."
        msv_print_warn "The site is still PUBLIC with the modified configuration."
        msv_print_warn "To restore manually, run:"
        msv_print_warn "  cp $backup_file $MSV_CONFIG_FILE && sy"
    fi

    msv_print_info "Script finished."
}

# --- Script Execution ---
# Call the main function, passing all script arguments (if any)
# manage_site_visibility "$@"