#!/bin/bash
# Planderson Global Installation Script
# Installs local changes to ~/.planderson for testing usage across all Claude Code projects
# Mirrors official installation script: `install.sh`

set -e

INSTALL_DIR="$HOME/.planderson"
BIN_DIR="${XDG_DATA_HOME:-$HOME/.local}/bin"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${PLANDERSON_BUILD_DIR:-$PROJECT_ROOT/build}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GREY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

echo ""

# Pre-flight checks
echo -e "${GREY}Running pre-flight checks...${NC}"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}✗ Error: bun is not installed${NC}"
    echo ""
    echo "Install bun first:"
    echo -e "  ${CYAN}curl -fsSL https://bun.sh/install | bash${NC}"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓${NC} ${GREY}bun found: $(command -v bun)${NC}"

# Check if unified binary is built
if [ ! -f "$BUILD_DIR/planderson" ]; then
    echo -e "${RED}✗ Error: Binary not found at $BUILD_DIR/planderson${NC}"
    echo ""
    echo "Build first:"
    echo -e "  ${CYAN}cd $PROJECT_ROOT${NC}"
    echo -e "  ${CYAN}bun run build${NC}"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓${NC} ${GREY}Binary found: $BUILD_DIR/planderson ($(du -h "$BUILD_DIR/planderson" | cut -f1 | xargs))${NC}"

# Clean runtime directories (sockets, registry)
echo -e "${GREY}Cleaning runtime directories...${NC}"
if [ -d "$INSTALL_DIR/sockets" ]; then
    rm -rf "$INSTALL_DIR/sockets"
    echo -e "${GREEN}✓${NC} ${GREY}Cleared stale sockets${NC}"
fi
if [ -d "$INSTALL_DIR/registry" ]; then
    rm -rf "$INSTALL_DIR/registry"
    echo -e "${GREEN}✓${NC} ${GREY}Cleared registry${NC}"
fi

# Create directory structure
echo -e "${GREY}Creating directory structure...${NC}"
mkdir -p "$INSTALL_DIR/integrations/tmux"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/registry"
mkdir -p "$INSTALL_DIR/sockets"
mkdir -p "$BIN_DIR"
echo -e "${GREEN}✓${NC} ${GREY}Directories created${NC}"

# Create empty log files for tailing
touch "$INSTALL_DIR/logs/activity.log"
touch "$INSTALL_DIR/logs/error.log"
echo -e "${GREEN}✓${NC} ${GREY}Log files initialized${NC}"

# Install unified binary
echo -e "${GREY}Installing binary...${NC}"
cp "$BUILD_DIR/planderson" "$INSTALL_DIR/planderson"
chmod +x "$INSTALL_DIR/planderson"
echo -e "${GREEN}✓${NC} ${GREY}Binary installed to $INSTALL_DIR/planderson${NC}"

# Symlink to PATH
ln -sf "$INSTALL_DIR/planderson" "$BIN_DIR/planderson"
echo -e "${GREEN}✓${NC} ${GREY}Symlinked to $BIN_DIR/planderson${NC}"

# Copy tmux integration scripts
echo -e "${GREY}Installing tmux integration...${NC}"
cp "$PROJECT_ROOT/integrations/tmux/init.sh" "$INSTALL_DIR/integrations/tmux/init.sh"
cp "$PROJECT_ROOT/integrations/tmux/run-and-restore.sh" "$INSTALL_DIR/integrations/tmux/run-and-restore.sh"
chmod +x "$INSTALL_DIR/integrations/tmux/init.sh"
chmod +x "$INSTALL_DIR/integrations/tmux/run-and-restore.sh"
echo -e "${GREEN}✓${NC} ${GREY}tmux integration installed${NC}"

echo ""

# Installation complete
echo -e "${GREEN}${BOLD}✓ Installation Complete!${NC}"
echo -e "${GREY}Planderson has been installed to: $INSTALL_DIR${NC}"
echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo ""
echo -e "${BOLD}1. Configure Claude Code Hook (Required)${NC}"
echo -e "   Add this to your ${YELLOW}~/.claude/settings.json${NC}:"
echo -e "${CYAN}"
echo '   {'
echo '       "hooks": {'
echo '           "PermissionRequest": ['
echo '               {'
echo '                   "matcher": "ExitPlanMode",'
echo '                   "hooks": ['
echo '                       {'
echo '                           "type": "command",'
echo '                           "command": "planderson hook",'
echo '                           "timeout": 900'
echo '                       }'
echo '                   ]'
echo '               }'
echo '           ]'
echo '       }'
echo '   }'
echo -e "${NC}"
echo -e "${BOLD}2. For recommended setup and next steps, see:${NC}"
echo -e "   ${CYAN}README.md#recommended-setup${NC}"
echo ""

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
    echo -e "${YELLOW}⚠ $BIN_DIR is not in your PATH. Add it with:${NC}"
    echo ""
    case "$SHELL" in
        */zsh)  shell_config="~/.zshrc" ;;
        */bash) shell_config="~/.bashrc" ;;
        *)      shell_config="your shell config" ;;
    esac
    echo -e "  ${CYAN}echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ${shell_config}${NC}"
    echo -e "  ${CYAN}source ${shell_config}${NC}"
    echo ""
fi

echo -e "For more details, see: ${YELLOW}$PROJECT_ROOT/dev/INSTALL.md${NC}"
