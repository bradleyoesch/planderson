#!/bin/bash
# Resets dev mode: removes dev/planderson wrapper and restores
# ~/.local/bin/planderson symlink to the global ~/.planderson/planderson binary.
# Usage: bun run dev:reset (from repo root or worktree)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SETTINGS_FILE="$REPO_ROOT/settings.json"
BIN_DIR="${XDG_DATA_HOME:-$HOME/.local}/bin"
WRAPPER="$SCRIPT_DIR/planderson"
GLOBAL_BINARY="$HOME/.planderson/planderson"

# Remove wrapper script
if [ -f "$WRAPPER" ]; then
    rm -f "$WRAPPER"
    echo "✓ Removed $WRAPPER"
fi

# Restore symlink to global binary
if [ -f "$GLOBAL_BINARY" ]; then
    ln -sf "$GLOBAL_BINARY" "$BIN_DIR/planderson"
    echo "✓ Restored $BIN_DIR/planderson → $GLOBAL_BINARY"
else
    echo "⚠ Global binary not found at $GLOBAL_BINARY - symlink not restored"
fi

# Remove dev config so getPlandersonBaseDir() falls back to ~/.planderson
rm -f "$HOME/.planderson/dev.json"
echo "✓ Removed $HOME/.planderson/dev.json"

# Ensure launchMode is set to manual in settings.json
if [ -f "$SETTINGS_FILE" ]; then
    if command -v jq >/dev/null 2>&1; then
        TMP_FILE=$(mktemp)
        jq --indent 4 '.launchMode = "manual"' "$SETTINGS_FILE" > "$TMP_FILE"
        mv "$TMP_FILE" "$SETTINGS_FILE"
    else
        cat > "$SETTINGS_FILE" << 'EOF'
{
    "launchMode": "manual",
    "approveAction": "approve"
}
EOF
    fi
    echo "✓ Updated $SETTINGS_FILE (launchMode: manual)"
else
    cat > "$SETTINGS_FILE" << 'EOF'
{
    "launchMode": "manual",
    "approveAction": "approve"
}
EOF
    echo "✓ Created $SETTINGS_FILE (launchMode: manual)"
fi

# Remove generated local tmux config
LOCAL_TMUX_CONF="$REPO_ROOT/integrations/tmux/.tmux.local.conf"
if [ -f "$LOCAL_TMUX_CONF" ]; then
    rm -f "$LOCAL_TMUX_CONF"
    echo "✓ Removed $LOCAL_TMUX_CONF"
fi

# Only configure tmux if running in a tmux session
if [ -z "$TMUX" ]; then
    echo "⚠ Not running in a tmux session - skipping tmux reset"
    exit 0
fi

tmux source-file ~/.tmux.conf
echo "✓ Sourced ~/.tmux.conf"
