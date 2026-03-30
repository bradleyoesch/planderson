#!/bin/bash
set -e

REPO="bradleyoesch/planderson"
PLANDERSON_DIR="$HOME/.planderson"
BIN_DIR="${XDG_DATA_HOME:-$HOME/.local}/bin"

case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux)  os="linux" ;;
    *)      echo "Unsupported OS. For Windows, see: https://github.com/${REPO}#install" >&2; exit 1 ;;
esac

case "$(uname -m)" in
    x86_64|amd64)  arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)             echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

platform="${os}-${arch}"
binary_name="planderson-${platform}"

base_url="https://github.com/${REPO}/releases/latest/download"
binary_url="${base_url}/${binary_name}"
checksum_url="${binary_url}.sha256"
tmux_url="${base_url}/planderson-tmux.tar.gz"

echo "Installing planderson..."

mkdir -p "$PLANDERSON_DIR"
mkdir -p "$PLANDERSON_DIR/integrations/tmux"
mkdir -p "$PLANDERSON_DIR/logs"
mkdir -p "$BIN_DIR"

# Download and verify binary
tmp_file=$(mktemp)
curl -fsSL -o "$tmp_file" "$binary_url"

expected_checksum=$(curl -fsSL "$checksum_url" | cut -d' ' -f1)

if [ "$(uname -s)" = "Darwin" ]; then
    actual_checksum=$(shasum -a 256 "$tmp_file" | cut -d' ' -f1)
else
    actual_checksum=$(sha256sum "$tmp_file" | cut -d' ' -f1)
fi

if [ "$actual_checksum" != "$expected_checksum" ]; then
    echo "Checksum verification failed!" >&2
    rm -f "$tmp_file"
    exit 1
fi

mv "$tmp_file" "$PLANDERSON_DIR/planderson"
chmod +x "$PLANDERSON_DIR/planderson"

# Symlink binary to PATH
ln -sf "$PLANDERSON_DIR/planderson" "$BIN_DIR/planderson"

# Download and extract tmux scripts
tmp_tmux=$(mktemp)
curl -fsSL -o "$tmp_tmux" "$tmux_url"
tar -xzf "$tmp_tmux" -C "$PLANDERSON_DIR"
rm -f "$tmp_tmux"
chmod +x "$PLANDERSON_DIR/integrations/tmux/init.sh"
chmod +x "$PLANDERSON_DIR/integrations/tmux/run-and-restore.sh"

# Write shell completions
# NOTE: These script strings must stay in sync with app/src/commands/completions.ts
mkdir -p "$PLANDERSON_DIR/completions"

cat > "$PLANDERSON_DIR/completions/planderson.bash" << 'BASH_COMPLETION'
_planderson_complete() {
    local cmds="help hook settings setup tui tmux upgrade completions"
    COMPREPLY=($(compgen -W "$cmds" -- "${COMP_WORDS[COMP_CWORD]}"))
}
complete -F _planderson_complete planderson
BASH_COMPLETION

cat > "$PLANDERSON_DIR/completions/planderson.zsh" << 'ZSH_COMPLETION'
#compdef planderson
_planderson() {
    local -a commands
    commands=(
        'help:Show help and keybindings'
        'hook:Process plan events from Claude Code hooks'
        'settings:View and update settings'
        'setup:Interactive onboarding and configuration'
        'tui:Launch the plan viewer TUI'
        'tmux:Replace current pane with TUI and restore on exit'
        'upgrade:Upgrade planderson to the latest version'
        'completions:Output shell completion script'
    )
    _describe 'command' commands
}
compdef _planderson planderson
ZSH_COMPLETION

# Auto-source completions in shell config
case "$SHELL" in
    */zsh)
        shell_config="$HOME/.zshrc"
        completion_file="$PLANDERSON_DIR/completions/planderson.zsh"
        ;;
    */bash)
        shell_config="$HOME/.bashrc"
        completion_file="$PLANDERSON_DIR/completions/planderson.bash"
        ;;
    *)
        shell_config=""
        ;;
esac

if [ -n "$shell_config" ]; then
    if grep -q "planderson/completions" "$shell_config" 2>/dev/null; then
        echo "Skipped: completions already configured in $shell_config"
    else
        echo "" >> "$shell_config"
        echo "# planderson shell completions" >> "$shell_config"
        echo "source \"$completion_file\"" >> "$shell_config"
        echo "Added planderson completions to $shell_config"
    fi
fi

# Create empty log files
touch "$PLANDERSON_DIR/logs/activity.log"
touch "$PLANDERSON_DIR/logs/error.log"

echo ""
echo "planderson installed to ${PLANDERSON_DIR}/planderson"
echo "Symlinked to ${BIN_DIR}/planderson"

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
    echo ""
    echo "${BIN_DIR} is not in your PATH. Add it with:"
    echo ""
    case "$SHELL" in
        */zsh)  shell_config="~/.zshrc" ;;
        */bash) shell_config="~/.bashrc" ;;
        *)      shell_config="your shell config" ;;
    esac
    echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ${shell_config}"
    echo "  source ${shell_config}"
fi

echo ""
echo "=========================================="
echo "  INSTALL COMPLETE"
echo "=========================================="
echo ""
echo "Now install the Claude Code plugin:"
echo "  /plugin marketplace add bradleyoesch/planderson"
echo "  /plugin install planderson@planderson"
echo ""
echo "Reload plugins or restart claude for plugin to take effect:"
echo "  /reload-plugins"
echo ""
echo "For recommended setup and next steps, see:"
echo "  https://github.com/bradleyoesch/planderson?tab=readme-ov-file#recommended-setup"
