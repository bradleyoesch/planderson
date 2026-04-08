# Planderson

[![CI](https://github.com/bradleyoesch/planderson/actions/workflows/ci.yml/badge.svg)](https://github.com/bradleyoesch/planderson/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/bradleyoesch/planderson)](https://github.com/bradleyoesch/planderson/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A terminal user interface (TUI) for reviewing Claude's plans before implementation. When Claude exits plan mode, Planderson intercepts the request and displays the plan fullscreen in terminal — accept, deny, or provide feedback.

The default plan mode in Claude involves scrolling up/down and copy/pasting parts of the plan to provide feedback in a small text input. This plugin enables a more interactive and user-friendly way to provide inline feedback and approve/deny plans to iterate until satisfied.

The goal is to provide a lightweight TUI to bridge the gap between "pure" terminal interactions and complex external user interfaces to support seamless plan iteration with Claude.

<video src="https://github.com/user-attachments/assets/80271a64-d472-4da9-8662-7b4dc88f1bf3" width="600" autoplay loop muted playsinline></video>

## Prerequisites

- **macOS or Linux** (has not been tested on Windows)
- **tmux 3.0+** (optional, for [tmux integration](./integrations/tmux/README.md))

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

3. **Reload plugins or restart claude for plugin to take effect:**

    ```
    /reload-plugins
    ```

4. **(Optional) Run setup to configure planderson:**

    ```bash
    planderson setup
    ```

## Usage

Without any further setup or integrations, you may manually trigger the plan TUI. After Claude presents the plan to review, in a separate terminal, launch the TUI:

```bash
planderson tui
```

For more control and seamless integration, set up tmux integration: [integrations/tmux/README.md](./integrations/tmux/README.md).

### Controls

Basic controls while in the plan TUI:

| Key                     | Action                         |
| ----------------------- | ------------------------------ |
| `Up`/`Down`             | Navigate lines                 |
| `Shift+Up`/`Shift+Down` | Multi-select lines             |
| `c`                     | Add comment                    |
| `q`                     | Add question                   |
| `Delete`                | Mark line for deletion         |
| `Enter`                 | Submit feedback or approve     |
| `Esc`                   | Exit TUI                       |
| `?`                     | Show full keybinding reference |

1. Move up and down the plan to review.
2. Add feedback
    - Comment - feedback for Claude to address directly
    - Question - question to discuss with Claude before returning to plan iteration
    - Deletion - delete from the plan completely
3. Hit `Enter` to submit that feedback and wait for Claude to modify plan to iterate again
   If no feedback to submit, `Enter` will approve the plan

For details and more keybindings, run `planderson help` or hit `?` while in the TUI.

## Upgrading

To upgrade to latest version, run:

```bash
planderson upgrade
```

### Auto-upgrade

You can opt into automatic upgrades at TUI startup.

Set `autoUpgrade` setting to `always`:

```bash
planderson settings --autoUpgrade always
```

For details, run `planderson settings --autoUpgrade`

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, building, and testing.

## License

MIT
