#!/bin/bash
# Sets up dev mode: creates a dev/planderson wrapper script and symlinks
# ~/.local/bin/planderson to it, so `planderson <cmd>` runs `bun run src/cli.ts <cmd>`
# from this repo. Also configures tmux keybindings to use local source.
# Usage: bun run dev:set (from repo root or worktree)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SETTINGS_FILE="$REPO_ROOT/settings.json"
BIN_DIR="${XDG_DATA_HOME:-$HOME/.local}/bin"
WRAPPER="$SCRIPT_DIR/planderson"

# Create wrapper script that forwards all args to bun run src/cli.ts
# Use full path to bun so the wrapper works even in environments with restricted PATH
# (e.g. Claude Code hook subprocesses that don't inherit ~/.bun/bin)
BUN_PATH="$(which bun)"
cat > "$WRAPPER" << EOF
#!/bin/bash
exec "$BUN_PATH" run "$REPO_ROOT/app/src/cli.ts" "\$@"
EOF
chmod +x "$WRAPPER"
echo "✓ Created $WRAPPER"

# Symlink ~/.local/bin/planderson to wrapper
mkdir -p "$BIN_DIR"
ln -sf "$WRAPPER" "$BIN_DIR/planderson"
echo "✓ Symlinked $BIN_DIR/planderson → $WRAPPER"

# Write dev config so getPlandersonBaseDir() uses this worktree regardless of which binary runs
mkdir -p "$HOME/.planderson"
printf '{\n    "baseDir": "%s"\n}\n' "$REPO_ROOT" > "$HOME/.planderson/dev.json"
echo "✓ Created $HOME/.planderson/dev.json"

# Create local settings.json if it doesn't exist
if [ ! -f "$SETTINGS_FILE" ]; then
    cat > "$SETTINGS_FILE" << 'SETTINGS'
{
    "launchMode": "manual",
    "approveAction": "approve"
}
SETTINGS
    echo "✓ Created $SETTINGS_FILE"
fi

# Only configure tmux if running in a tmux session
if [ -z "$TMUX" ]; then
    echo "⚠ Not running in a tmux session - skipping tmux configuration"
    exit 0
fi

# Generate local tmux config
CONFIG_FILE="$REPO_ROOT/integrations/tmux/.tmux.local.conf"
cat > "$CONFIG_FILE" << TMUXCONF
# Planderson - Local tmux configuration
# Auto-generated for: $REPO_ROOT
# Generated: $(date)

bind-key g run-shell "planderson tmux"
bind-key t run-shell "planderson tmux --filepath dev/plan-test.md"
TMUXCONF

tmux source-file "$CONFIG_FILE"
echo "✓ Sourced $CONFIG_FILE"
