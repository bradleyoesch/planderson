#!/bin/bash
# Initialize pane-swap mechanism to run Planderson in current pane location
# 1. Creates temp window with dummy pane
# 2. Swaps current pane into temp window (preserves exact layout/position)
# 3. Respawns new pane in original location to run `run-and-restore.sh`
#
# Usage:
#   init.sh                              # Socket mode, prod installation
#   init.sh --filepath /path/to/plan.md  # File mode (explicit file path)

set -e

# Parse command-line arguments
FILEPATH=""
SESSION_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --session)
            SESSION_ID="$2"
            shift 2
            ;;
        --session=*)
            SESSION_ID="${1#*=}"
            shift
            ;;
        --filepath)
            if [[ -z "${2:-}" || "$2" =~ ^-- ]]; then
                echo "Error: --filepath requires a path argument" >&2
                exit 1
            fi
            FILEPATH="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# If session ID not provided, generate one
if [ -z "$SESSION_ID" ]; then
    SESSION_ID=$(head -c 4 /dev/urandom | xxd -p | head -c 7)
fi

# Check if running in tmux (required for this integration)
if [ -z "$TMUX" ]; then
    echo "Error: Not running in a tmux session" >&2
    echo "Start tmux first: tmux" >&2
    exit 1
fi

# Validation: Check tmux version (need 3.0+ for reliable swap-pane)
TMUX_VERSION=$(tmux -V | grep -oE '[0-9]+\.[0-9]+' | head -1)
if [ "$(printf '%s\n' "3.0" "$TMUX_VERSION" | sort -V | head -1)" != "3.0" ]; then
    echo "Error: tmux version $TMUX_VERSION is too old (need 3.0+)" >&2
    exit 1
fi

PLANDERSON_COMMAND=""
PLANDERSON_DIR=""

# Check 1: dev.json exists? (dev mode - written by 'bun run dev:set')
DEV_JSON="$HOME/.planderson/dev.json"
DEV_BASE_DIR=""
if [ -f "$DEV_JSON" ]; then
    DEV_BASE_DIR=$(python3 -c "import json; d=json.load(open('$DEV_JSON')); print(d.get('baseDir',''))" 2>/dev/null || true)
fi

if [ -n "$DEV_BASE_DIR" ]; then
    PLANDERSON_DIR="$DEV_BASE_DIR"
    PLANDERSON_COMMAND="planderson tui"

# Check 2: Does legacy prod binary exist at ~/.planderson/bin/planderson-tui?
elif [ -f "$HOME/.planderson/bin/planderson-tui" ]; then
    # Prod installation environment: run built binary
    # This is the normal case when not in explicitly defined directory
    PLANDERSON_DIR="$HOME/.planderson"
    PLANDERSON_COMMAND="$PLANDERSON_DIR/bin/planderson-tui"

# Check 3: Does unified planderson binary exist on PATH?
elif command -v planderson > /dev/null 2>&1; then
    PLANDERSON_DIR="$HOME/.planderson"
    PLANDERSON_COMMAND="planderson tui"

# Check 4: Neither local nor prod found - error
else
    # Planderson is not installed anywhere we can find it
    echo "Error: Planderson not found" >&2
    echo "" >&2
    echo "Install Planderson: cd planderson && bun run build:install" >&2
    echo "For dev mode: run 'bun run dev:set' first" >&2
    echo "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") ERROR | ${SESSION_ID} | tmux.env.errored | init.sh | Could not find environment, exiting. pwd=$(pwd)" >> "$ACTIVITY_LOG"
    exit 1
fi

if [ -n "$FILEPATH" ]; then
    PLANDERSON_COMMAND="$PLANDERSON_COMMAND $FILEPATH"
fi

ACTIVITY_LOG="$PLANDERSON_DIR/logs/activity.log"
mkdir -p "$(dirname "$ACTIVITY_LOG")"

# Safety net: if the swap succeeds but respawn fails, restore the original pane.
# Without this, set -e would exit after a respawn failure and leave the pane stranded.
# Note: trap is registered after all pane variables are obtained (see below) to ensure
# they are defined when the trap fires.
PANE_SWAPPED=false
RESPAWN_SUCCEEDED=false

cleanup_on_init_error() {
    trap - EXIT  # Remove trap to prevent re-entry
    if [ "$PANE_SWAPPED" = true ] && [ "$RESPAWN_SUCCEEDED" != true ]; then
        tmux swap-pane -s "$TEMP_PANE" -t "$CURRENT_PANE" 2>/dev/null || true
        tmux select-pane -T "$ORIGINAL_TITLE" -t "$CURRENT_PANE" 2>/dev/null || true
        tmux kill-window -t "$TEMP_WINDOW" 2>/dev/null || true
    fi
}

# Capture current pane ID, window, and title (to restore after Planderson exits).
# $TMUX_PANE is set by tmux at pane startup and inherited through the process chain
# (Claude → hook → init.sh), so it correctly identifies the origin pane even
# if the user switches focus before the hook fires. For run-shell keybinding invocations,
# $TMUX_PANE is not set (run-shell is a background subprocess, not a pane), so fall back
# to tmux display-message which returns the focused pane — correct for keybindings since
# the user just pressed the key in that pane.
if [ -n "${TMUX_PANE:-}" ]; then
    CURRENT_PANE="${TMUX_PANE}"
else
    CURRENT_PANE=$(tmux display-message -p '#{pane_id}')
fi
CURRENT_WINDOW=$(tmux display-message -p -t "$CURRENT_PANE" '#{window_id}')
ORIGINAL_TITLE=$(tmux display-message -p -t "$CURRENT_PANE" '#{pane_title}')

# Prefix pane ID with tmux-pane- for registry lookup
REGISTRY_ID="tmux-pane-$CURRENT_PANE"

echo "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") INFO  | ${SESSION_ID} | tmux.init.started | init.sh | PLANDERSON_DIR=${PLANDERSON_DIR} PLANDERSON_COMMAND=${PLANDERSON_COMMAND} CURRENT_PANE=${CURRENT_PANE} REGISTRY_ID=${REGISTRY_ID}" >> "$ACTIVITY_LOG"

# Append --pane flag to command with prefixed registry ID
PLANDERSON_COMMAND="$PLANDERSON_COMMAND --registry $REGISTRY_ID --session $SESSION_ID"

# Capture the currently focused pane before any pane operations.
# Used to restore focus after setup if the user was active in a different pane (auto-launch).
FOCUSED_PANE=$(tmux display-message -p '#{pane_id}')

# Create a temp dummy window to hold the existing process
TEMP_WINDOW="${ORIGINAL_TITLE}--planderson-bak-$$"
tmux new-window -d -n "$TEMP_WINDOW" -c "$PLANDERSON_DIR" "sleep 10"

# Get the temp window pane ID
TEMP_PANE=$(tmux list-panes -t "$TEMP_WINDOW" -F '#{pane_id}')
# All pane variables are now defined (CURRENT_PANE, ORIGINAL_TITLE, TEMP_WINDOW, TEMP_PANE).
# Register cleanup trap here so it only fires when it has valid variables to work with.
trap cleanup_on_init_error EXIT

# Swap current pane with the temp pane (preserves exact position)
# After this: original pane is in temp window, temp pane is in original position
tmux swap-pane -s "$CURRENT_PANE" -t "$TEMP_PANE"
PANE_SWAPPED=true  # Mark swap done so cleanup_on_init_error knows to restore if we fail below

# Name pane title to "planderson" so tmux configs can easily identify it if needed
tmux select-pane -T "planderson" -t "$TEMP_PANE"

# Restore focus if the user was active in a different pane when auto-launch fired.
# select-pane above changes focus to the TUI pane; if the user was elsewhere we want
# them to stay there. If FOCUSED_PANE == CURRENT_PANE (keybinding, or auto-launch from
# the same pane), we leave focus on the TUI — that's the expected behavior.
if [ "$FOCUSED_PANE" != "$CURRENT_PANE" ]; then
    tmux select-pane -t "$FOCUSED_PANE"
fi

# Now respawn the temp pane (now in original position) to run Planderson
# respawn-pane gives Planderson a proper TTY environment
RUN_SCRIPT="$(dirname "$0")/run-and-restore.sh"
tmux respawn-pane -k -t "$TEMP_PANE" "$RUN_SCRIPT" "$SESSION_ID" "$PLANDERSON_DIR" "$PLANDERSON_COMMAND" "$TEMP_PANE" "$CURRENT_PANE" "$TEMP_WINDOW" "$ORIGINAL_TITLE"
RESPAWN_SUCCEEDED=true  # Mark respawn done; run-and-restore.sh now owns the restore
