# Planderson - Plan Viewer TUI

[![CI](https://github.com/bradleyoesch/planderson/actions/workflows/ci.yml/badge.svg)](https://github.com/bradleyoesch/planderson/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/bradleyoesch/planderson)](https://github.com/bradleyoesch/planderson/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A terminal user interface (TUI) for reviewing Claude's plans before implementation. When Claude exits plan mode, Planderson intercepts the request and displays the plan fullscreen in terminal — accept, deny, or provide feedback.

The default plan mode in Claude involves scrolling up/down and copy/pasting parts of the plan to provide feedback in a small text input. This plugin enables a more interactive and user-friendly way to provide inline feedback and approve/deny plans to iterate until satisfied.

The goal is to provide a lightweight TUI to bridge the gap between "pure" terminal interactions and complex external user interfaces to support seamless plan iteration with Claude.

`TODO: add screenshot`

## Prerequisites

- **macOS or Linux**
- **tmux 3.2+** (optional, for tmux integration)

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

For details, run `planderson help`.

## Manual usage

After Claude presents the plan to review, in a separate terminal, launch the TUI:

```bash
planderson tui
```

This will open the latest plan in the TUI.

For more control and seamless integration, see [Optional: tmux integration](#optional-tmux-integration) below.

## Optional: tmux integration

Integrate with tmux to open the TUI in the Claude tmux pane.

This also enables more control over multiple Claude sessions and plans executing at once.

### Manual launch

Add to `~/.tmux.conf` to open Planderson manually via keybinding of your choice.

```bash
# Example with bind-key g to mirror Claude Code's ctrl-g to edit plan in editor
bind-key g run-shell "planderson tmux"
```

Then reload: `tmux source-file ~/.tmux.conf`

### Auto launch

Set `launchMode` setting to `auto-tmux` to automatically launch TUI in tmux pane when a plan is ready.

```bash
planderson settings --launchMode auto-tmux
```

For details, run `planderson settings --launchMode`

## Optional: tmux mouse and scroll

Enable mouse support and proper scroll behavior inside Planderson.

Planderson navigates through lines with up/down keys.

```conf
# Enable mouse interactions
set -g mouse on
```

If you have a more specific setup for different scrolling, you may benefit from a more complex setup.
For example, the below configuration enables copy mode scrolling on claude and normal shell instances, but sends up/down otherwise.

```conf
# Send arrow keys to Planderson instead of entering copy mode
bind -n WheelUpPane {
  if -F '#{==:#{pane_title},planderson}' {
    send Up
  } {
    if -F '#{||:#{m:*claude*,#{pane_current_command}},#{m:*bash*,#{pane_current_command}},#{m:*zsh*,#{pane_current_command}}}' {
      copy-mode -e
    } {
      send Up
    }
  }
}
bind -n WheelDownPane {
  if -F '#{==:#{pane_title},planderson}' {
    send Down
  } {
    if -F '#{||:#{m:*claude*,#{pane_current_command}},#{m:*bash*,#{pane_current_command}},#{m:*zsh*,#{pane_current_command}}}' {
    } {
      send Down
    }
  }
}
```

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, building, and testing.

## License

MIT
