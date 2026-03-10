# tmux Integration for Planderson

Planderson uses a **pane-swap mechanism** to display plans while preserving running processes (vim, htop, etc.) in your terminal.

## How It Works

Planderson uses a **pane-swap mechanism** instead of a simple popup to preserve running processes (vim, htop, long-running commands) while displaying the plan viewer.

### Flow

1. **Capture current state** - Saves your current pane and window IDs
2. **Create temp window** - Hidden background window with a dummy process
3. **Swap panes** - Moves your pane to the temp window, dummy pane to your position
4. **Run Planderson** - Respawns the pane (now in your original position) with the Planderson TUI
5. **User interaction** - You review the plan and accept/deny with comments
6. **Restore original** - Swaps panes back to original positions
7. **Cleanup** - Kills the temporary window

### Why Pane-Swap?

The goal is to replace the current view without affecting existing processes (like Claude Code) or disrupting the plan iteration workflow. Opening new windows or split panes would require manual navigation and break the seamless flow between making plan decisions and continuing work.

Pane-swap makes Planderson appear to replace your current view temporarily, preserving all running processes and exact layout/position.

### Two-Script Design

- **`init.sh [--filepath /path/to/plan.md]`** - Runs in original shell context (before swap). Accepts `--filepath` flag for file mode (dev mode only).
- **`run-and-restore.sh`** - Runs in respawned pane (after swap). Receives mode flag from init script.

They execute in different processes - the swap mechanism requires this separation.

## Setup

### Requirements

- **tmux 3.0+** - For `swap-pane` support
- **bun** - To run Planderson TUI
- **Planderson project** - Must have `app/src/commands/tui.tsx` in parent directory

### Global Installation (Recommended for Users)

After installing planderson, add to your `~/.tmux.conf`:

```bash
bind-key g run-shell "planderson tmux"
```

Reload tmux config:

```bash
tmux source-file ~/.tmux.conf
```

### Dev Mode (Recommended for Contributors)

When developing Planderson locally, use:

```bash
bun run dev:set
```

This generates a local configuration that points to your current directory's code. The script auto-detects whether you're in the main repo or a worktree.

### Resetting to Main Repository

To revert back to using the main repository's code:

```bash
bun run dev:reset
```

This:

- Removes `dev/planderson` wrapper script
- Restores `~/.local/bin/planderson` symlink to `~/.planderson/planderson`
- Sets `launchMode: "manual"` in local `settings.json`
- Sources `~/.tmux.conf` (restores global keybindings)

### Testing the Integration

**Test production mode:** Open vim, press `bind-key g`, Planderson appears (requires Claude Code waiting), press `Esc`, vim returns unchanged.

**Test file mode (dev mode only):** Run `bun run dev:set` first (sets up `bind-key t` with `--filepath dev/plan-test.md`), then press `bind-key t`, Planderson appears with test plan, press `Esc`, returns unchanged.

### How It Works

- **Global mode**: `planderson tmux` runs `~/.planderson/integrations/tmux/init.sh`
- **Dev mode**: when `PLANDERSON_BASE_DIR` is set (via `dev/planderson` wrapper), `planderson tmux` runs `./integrations/tmux/init.sh` from the repo root and isolates sockets/settings to the repo
- `bun run dev:set` symlinks `planderson` to a local wrapper and configures tmux keybindings
- `bun run dev:reset` fully restores global state (symlink, settings, tmux keybindings)

## Keybindings

The default keybinding is:

- **bind-key then g** - Socket mode (requires Claude Code with pending plan approval via socket)

The 'g' key aligns with Claude Code's Ctrl+g (edit plan in vim).

Dev mode adds `bind-key t` for file mode (with `--filepath dev/plan-test.md`) — run `bun run dev:set` to set this up.

To use a different key, edit `~/.tmux.conf` and reload. For dev mode, run `bun run dev:set`.

## Troubleshooting

**Pane doesn't restore:**

```bash
tmux list-panes -a  # Find pane IDs
tmux swap-pane -s %X -t %Y  # Swap back manually
tmux kill-window -t planderson-temp-XXXXX  # Kill leftover temp window
```

**"Not running in a tmux session":** Run `tmux` first before using the keybinding.

**Scripts not executable:** `chmod +x integrations/tmux/init.sh integrations/tmux/run-and-restore.sh`

**Worktree changes not showing:**

Make sure you've run `bun run dev:set` from the worktree directory to override the keybindings (or `bun run dev:reset` to go back to global). Check which config is active:

```bash
tmux show-options -g | grep planderson
```

To reset to main repo, reload your default config:

```bash
tmux source-file ~/.tmux.conf
```
