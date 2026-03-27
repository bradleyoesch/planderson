
# Architecture: Local vs. Prod Environments

`~/.planderson/dev.json` is the mechanism for dev mode path isolation. `bun run dev:set` writes this file with `{ "baseDir": "<worktree>" }` — `getPlandersonBaseDir()` reads it at runtime and uses the worktree path for all file operations:

- Sockets: `<worktree>/sockets/` (vs `~/.planderson/sockets/`) — keeps dev sessions from colliding with a running global install
- Settings: `<worktree>/settings.json` (vs `~/.planderson/settings.json`) — separate dev settings from prod
- `planderson tmux`: uses `<worktree>/integrations/tmux/init.sh` (vs `~/.planderson/integrations/tmux/init.sh`)

`bun run dev:reset` removes `dev.json`, so `getPlandersonBaseDir()` falls back to `~/.planderson/` automatically.

**Hook resolution:** The Claude Code hook is configured as `"command": "planderson hook"` in the plugin's hooks.json. Claude Code caches the resolved binary at startup. In dev mode, since `dev.json` is read at runtime by `getPlandersonBaseDir()`, the hook uses the correct worktree path regardless of which binary Claude cached — no restart required after running `bun run dev:set`.
