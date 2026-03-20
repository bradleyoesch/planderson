# tmux Integration for Planderson

Planderson uses a **pane-swap mechanism** to display the plan TUI in the Claude tmux pane so that all Claude planning and iteration is done in one place. This also enables more control over multiple Claude sessions and plans executing at once.

## Setup

### Requirements

- **tmux 3.0+**

### Installation

### Manual launch

After installing planderson, add to your `~/.tmux.conf`:

```bash
# Example with bind-key g to mirror Claude Code's ctrl-g to edit plan in editor
bind-key g run-shell 'planderson tmux'
```

Reload tmux config:

```bash
tmux source-file ~/.tmux.conf
```

When Claude presents a plan in plan mode, use the bind-key to open tht TUI in that pane.

### Auto launch

Planderson also supports automatically launching the TUI in the tmux pane when a plan is ready.

Set `launchMode` setting to `auto-tmux`:

```bash
planderson settings --launchMode auto-tmux
```

For details, run `planderson settings --launchMode`

## Optional: tmux mouse and scroll support

Like many things in tmux, this becomes less obvious, more opinionated, and more dependent on your local setup. Below are some potential options to set up mouse support and proper scroll behavior inside Planderson.

If you believe you have a somewhat standard mouse/scroll tmux setup and got it working outside of these below options, search [issues](https://github.com/bradleyoesch/planderson/issues) and submit a [pull request](https://github.com/bradleyoesch/planderson/pulls) if new.

### Basic mouse scrolling

Planderson navigates through lines with up/down keys. Basic mouse integration (e.g. `set -g mouse on`) enables scrolling with copy mode. You may need to instead use the [Send `Up` and `Down` keys for the mouse wheel](https://github.com/tmux/tmux/wiki/Recipes#send-up-and-down-keys-for-the-mouse-wheel) recipe.

### Only send up/down keys in specific cases

You may have a more complex setup, e.g. a unique variant on the [Send `Up` and `Down` keys for the mouse wheel](https://github.com/tmux/tmux/wiki/Recipes#send-up-and-down-keys-for-the-mouse-wheel) recipe and may require more specific changes.

For example, the below configuration enables copy mode scrolling on claude and normal shell instances, but sends up/down otherwise.

```conf
# use scroll through copy mode just for claude and terminal,
# map to up/down keys otherwise for native scrolling
# https://github.com/tmux/tmux/wiki/Recipes#send-up-and-down-keys-for-the-mouse-wheel
# planderson is bash so we have to exclude it manually to map like this
bind -n WheelUpPane {
  if -F '#{&&:#{||:#{m:*claude*,#{pane_current_command}},#{m:*bash*,#{pane_current_command}},#{m:*zsh*,#{pane_current_command}}},#{!=:#{pane_title},planderson}}' {
    copy-mode -e
  } {
    send Up
  }
}
bind -n WheelDownPane {
  if -F '#{&&:#{||:#{m:*claude*,#{pane_current_command}},#{m:*bash*,#{pane_current_command}},#{m:*zsh*,#{pane_current_command}}},#{!=:#{pane_title},planderson}}' {
  } {
    send Down
  }
}
```

## How the Integration Works

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

## Troubleshooting

**Pane doesn't restore:**

```bash
tmux list-panes -a  # Find pane IDs
tmux swap-pane -s %X -t %Y  # Swap back manually
tmux kill-window -t planderson-temp-XXXXX  # Kill leftover temp window
```

**"Not running in a tmux session":** Run `tmux` first before using the keybinding.
