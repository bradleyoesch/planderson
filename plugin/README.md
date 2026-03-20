# planderson plugin

A terminal user interface (TUI) for reviewing Claude's plans before implementation. When Claude exits plan mode, Planderson intercepts the request and displays the plan fullscreen in terminal — accept, deny, or provide feedback.

## Prerequisites

- **macOS or Linux** (has not been tested on Windows)
- **tmux 3.2+**

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
