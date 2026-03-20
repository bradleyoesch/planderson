# planderson plugin

A terminal user interface (TUI) for reviewing Claude's plans before implementation. When Claude exits plan mode, Planderson intercepts the request and displays the plan fullscreen in terminal — accept, deny, or provide feedback.

The default plan mode in Claude involves scrolling up/down and copy/pasting parts of the plan to provide feedback in a small text input. This plugin enables a more interactive and user-friendly way to provide inline feedback and approve/deny plans to iterate until satisfied.

The goal is to provide a lightweight TUI to bridge the gap between "pure" terminal interactions and complex external user interfaces to support seamless plan iteration with Claude.

## Prerequisites

- **macOS or Linux** (has not been tested on Windows)
- **tmux 3.0+** (optional, for tmux integration)

## Installation

1. **Install the binary:**

    ```bash
    curl -fsSL https://raw.githubusercontent.com/bradleyoesch/planderson/main/install.sh | bash
    ```

2. **Install the plugin in Claude Code:**

    ```
    /plugin marketplace add bradleyoesch/planderson
    /plugin install planderson@planderson
    ```

3. **Restart Claude Code.** Plugins need a restart to take effect.

## Usage

When the TUI launches, use these controls:

| Key                | Action                         |
| ------------------ | ------------------------------ |
| Up/down keys       | Navigate lines                 |
| Shift+up/down keys | Multi-select lines             |
| `c`                | Add a comment to a line        |
| `q`                | Add a question to a line       |
| `Delete`           | Mark a line for deletion       |
| **Enter**          | Accept plan                    |
| **Esc**            | Deny plan                      |
| **?**              | Show full keybinding reference |

For full documentation including tmux integration, manual usage, and more: https://github.com/bradleyoesch/planderson
