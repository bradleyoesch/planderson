# Testing Local Changes with a Global Install

This guide covers installing your local Planderson build to `~/.planderson/` so you can test changes end-to-end in a real install — with Claude Code hooks, tmux integration, and the actual binary path.

For prod installation, see [plugin/README.md](../plugin/README.md).
For local dev setup (no global install needed), see [CONTRIBUTING.md](../CONTRIBUTING.md).

## When to Use This

Use this when you want to verify that a code change works correctly in a production-like environment:

- Hook behavior with real Claude Code sessions outside of this repository
- Binary command-line interface (`planderson hook`, `planderson tui`, `planderson tmux`)
- Settings loading from `~/.planderson/settings.json`
- Logs written to `~/.planderson/logs/`

For most development, running directly with `bun run dev:set` is faster (no build step).

## Build and Install

```bash
bun run build:install
```

The installer:

- Copies the built binary to `~/.planderson/planderson`
- Copies tmux integration scripts to `~/.planderson/integrations/tmux/`
- Symlinks `~/.local/bin/planderson` → `~/.planderson/planderson`
- Preserves existing `~/.planderson/settings.json` and `sockets/`

### Installation directory structure

```
~/.planderson/
├── planderson                           # unified binary
├── integrations/
│   └── tmux/
│       ├── init.sh
│       └── run-and-restore.sh
├── logs/
│   ├── activity.log
│   └── error.log
├── sockets/                             # runtime (auto-created)
└── settings.json                        # user settings (optional)

~/.local/bin/planderson                  # symlink → ~/.planderson/planderson
```

## Configure Claude Code Hook

Add to `~/.claude/settings.json` to wire up the hook:

```json
{
    "hooks": {
        "PermissionRequest": [
            {
                "matcher": "ExitPlanMode",
                "hooks": [
                    {
                        "type": "command",
                        "command": "planderson hook",
                        "timeout": 900
                    }
                ]
            }
        ]
    }
}
```

If you already have hooks configured, merge the `ExitPlanMode` matcher into your existing `PermissionRequest` array.

## Verify the Install

**Test hook:**

```bash
echo '{"tool_name":"ExitPlanMode","tool_input":{},"hook_event_name":"PermissionRequest"}' | planderson hook
```

Expected: waits for TUI connection (Ctrl+C to cancel).

**Test non-plan event (should pass through):**

```bash
echo '{"tool_name":"SomeOtherTool","tool_input":{},"hook_event_name":"PermissionRequest"}' | planderson hook
```

Expected output:

```json
{ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": { "behavior": "allow" } } }
```

**Test binary:**

```bash
planderson tui
```

Expected: "Failed to connect" if no Claude Code session active — that's correct behavior.

## Updating After Code Changes

After making changes to source, rebuild and reinstall:

```bash
bun run build:install
```

The installer preserves your `~/.planderson/settings.json` and sockets.

## Troubleshooting

**Wrong version running after rebuild:**

```bash
# Verify the binary was updated
ls -la ~/.planderson/planderson
planderson --version
```

**Hook not firing:**

```bash
cat ~/.claude/settings.json | grep -A 10 "ExitPlanMode"
ls -l ~/.planderson/planderson
```

**View logs:**

```bash
tail -f ~/.planderson/logs/activity.log
tail -f ~/.planderson/logs/error.log
```
