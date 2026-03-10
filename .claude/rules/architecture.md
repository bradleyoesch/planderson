
# Architecture: Local vs. Prod Environments

`PLANDERSON_BASE_DIR` env var is the single source of truth for all path decisions. The `dev/planderson` wrapper (created by `bun run dev:set`) sets `PLANDERSON_BASE_DIR="$REPO_ROOT"` — this isolates all paths to the repo:

- Sockets: `$PLANDERSON_BASE_DIR/sockets/` (vs `~/.planderson/sockets/`) — keeps dev sessions from colliding with a running global install
- Settings: `$PLANDERSON_BASE_DIR/settings.json` (vs `~/.planderson/settings.json`) — separate dev settings from prod
- `planderson tmux`: uses `$PLANDERSON_BASE_DIR/integrations/tmux/init.sh` (vs `~/.planderson/integrations/tmux/init.sh`)

Prod binary never sets `PLANDERSON_BASE_DIR`, so `getPlandersonBaseDir()` falls back to `~/.planderson/` automatically.

**Hook is also routed through `dev/planderson`:** The Claude Code hook is configured as `"command": "planderson hook"` in `~/.claude/settings.json` (global, not local). In dev mode, `planderson` on PATH resolves to the `dev/planderson` wrapper, so `PLANDERSON_BASE_DIR` is set for hook invocations too — no separate hook configuration needed.

**Warning:** Enabling `launchMode: "auto-tmux"` in both local and prod settings simultaneously causes both to trigger.
