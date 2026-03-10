#!/bin/bash
# Run Planderson TUI and restore original pane configuration
# 1. Runs Planderson in current (respawned) pane called by `init.sh`
# 2. Swaps panes back to original positions
# 3. Kills temp window for cleanup
#
# Uses EXIT trap to guarantee restore runs even if Planderson crashes (non-zero exit).

set -euo pipefail

# Validate all required arguments
SESSION_ID="${1:?Missing SESSION_ID argument}"
PLANDERSON_DIR="${2:?Missing PLANDERSON_DIR argument}"
PLANDERSON_COMMAND="${3:?Missing PLANDERSON_COMMAND argument}"
TEMP_PANE="${4:?Missing TEMP_PANE argument}"
CURRENT_PANE="${5:?Missing CURRENT_PANE argument}"
TEMP_WINDOW="${6:?Missing TEMP_WINDOW argument}"
ORIGINAL_TITLE="${7:?Missing ORIGINAL_TITLE argument}"

# Important: Ensure we're in the Planderson directory so relative paths work in the src code
cd "$PLANDERSON_DIR" || exit 1

ACTIVITY_LOG="logs/activity.log"
mkdir -p "$(dirname "$ACTIVITY_LOG")"

# Always restore the original pane on exit, regardless of how Planderson exits.
# Using EXIT trap ensures this runs even if Planderson crashes with a non-zero exit code.
restore_pane() {
    trap - EXIT  # Remove trap to prevent re-entry if restore itself errors
    SWAP_ERROR=$(tmux swap-pane -s "$TEMP_PANE" -t "$CURRENT_PANE" 2>&1) || {
        echo "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") ERROR | ${SESSION_ID} | tmux.run.errored | run-and-restore.sh | Error: Failed to restore original pane. Manual cleanup may be needed: ${SWAP_ERROR}" >> "$ACTIVITY_LOG"
        echo "  tmux swap-pane -s $TEMP_PANE -t $CURRENT_PANE" >> "$ACTIVITY_LOG"
        return 1
    }
    # Restore original pane title
    tmux select-pane -T "$ORIGINAL_TITLE" -t "$CURRENT_PANE"
    # Log before killing temp window (can't log after window is gone)
    echo "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") INFO  | ${SESSION_ID} | tmux.run.ended | run-and-restore.sh | ORIGINAL_PANE=${CURRENT_PANE} ORIGINAL_TITLE=${ORIGINAL_TITLE}" >> "$ACTIVITY_LOG"
    # Clean up temp window (non-critical, can fail silently)
    tmux kill-window -t "$TEMP_WINDOW" 2>/dev/null || true
}
trap restore_pane EXIT

echo "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") INFO  | ${SESSION_ID} | tmux.run.started | run-and-restore.sh | ORIGINAL_PANE=${CURRENT_PANE} ORIGINAL_TITLE=${ORIGINAL_TITLE} PLANDERSON_COMMAND=${PLANDERSON_COMMAND}" >> "$ACTIVITY_LOG"

# 1. Run Planderson in current (respawned) pane called by `init.sh`
# Capture exit code without triggering set -e on non-zero exit (|| prevents early abort).
# The EXIT trap above guarantees pane restore regardless of exit code.
PLANDERSON_EXIT=0
$PLANDERSON_COMMAND || PLANDERSON_EXIT=$?
if [ $PLANDERSON_EXIT -ne 0 ]; then
    echo "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") WARN  | ${SESSION_ID} | tmux.run.crashed | run-and-restore.sh | Planderson exited with code ${PLANDERSON_EXIT}" >> "$ACTIVITY_LOG"
fi

# 2. & 3. Restore original pane and clean up temp window
# Handled by restore_pane() EXIT trap above — no explicit code needed here.
