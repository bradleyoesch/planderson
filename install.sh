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
echo "To enable tmux integration, add to ~/.tmux.conf:"
echo "  bind-key g run-shell 'planderson tmux'"
echo ""
echo "Restart Claude Code after plugin install."
