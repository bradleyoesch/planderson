# Planderson - Plan Viewer TUI

[![CI](https://github.com/bradleyoesch/planderson/actions/workflows/ci.yml/badge.svg)](https://github.com/bradleyoesch/planderson/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/bradleyoesch/planderson)](https://github.com/bradleyoesch/planderson/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A terminal user interface (TUI) for reviewing Claude's plans before implementation. When Claude exits plan mode, Planderson intercepts the request and displays the plan fullscreen in terminal — accept, deny, or provide feedback.

The default plan mode in Claude involves scrolling up/down and copy/pasting parts of the plan to provide feedback in a small text input. This plugin enables a more interactive and user-friendly way to provide inline feedback and approve/deny plans to iterate until satisfied.

The goal is to provide a lightweight TUI to bridge the gap between "pure" terminal interactions and complex external user interfaces to support seamless plan iteration with Claude.

`TODO: add screenshot`

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

## Usage

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
2. Add comments and questions, delete and undelete lines or blocks
3. Hit `Enter` to submit that feedback and wait for Claude to modify plan to iterate again
   If no feedback to submit, `Enter` will approve the plan

For details and more keybindings, run `planderson help` or hit `?` while in the TUI.

## Manual launch

Without any further setup or integrations (as described in the next section), you may manually trigger the plan TUI. After Claude presents the plan to review, in a separate terminal, launch the TUI:

```bash
planderson tui
```

## Recommended setup

### Tmux integration

For more control and seamless integration, setup with tmux: [integrations/tmux/README.md](./integrations/tmux/README.md).

### Approve and clear context

Claude does not currently support programmatically approving a plan and clearing context, e.g. "Yes, clear context and auto-accept edits".

If you'd like to avoid accidentally approving a plan without clearing context, you may change the default action on approve to simply exit so you can trigger that manually. You may also exit as usual with other keybindings.

Set `approveAction` setting to `exit`:

```bash
planderson settings --approveAction exit
```

For details, run `planderson settings --approveAction`

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
