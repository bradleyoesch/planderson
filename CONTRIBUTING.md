# Contributing

Development guide for working on Planderson locally.

By contributing, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

### Clone and Install

```bash
git clone https://github.com/bradleyoesch/planderson.git
cd planderson
bun install
```

## Running Locally

### File Mode (No Socket)

Run directly from source with a test plan file:

```bash
bun run dev:set
bun run app/src/commands/tui.tsx dev/plan-test.md
```

### Socket Mode

Add hook to `~/.claude/settings.json`:

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

For testing the full hook integration:

```bash
bun run dev:set
```

In a tmux session with Claude Code, press `bind-key g` when a plan is pending, or `bind-key t` to launch with a test plan.

To reset:

```bash
bun run dev:reset
```

## Building

### Installing from source (global)

To build Planderson from source and install it globally to `~/.planderson/` (mirroring what the plugin installer does):

```bash
git clone https://github.com/bradleyoesch/planderson.git
cd planderson
bun install
bun run build:install
```

This builds the binary and runs `./dev/install.sh`, which copies it to `~/.planderson/` and symlinks `~/.local/bin/planderson`.

To test your local changes against that global install, see [dev/INSTALL.md](dev/INSTALL.md).

### TypeScript Type Checking

```bash
bun run type-check
```

## Testing

### Automated Tests

**Running tests:**

```bash
# Run unit tests (state logic)
bun run test 2>&1

# Run integration tests (keyboard behavior, full workflows)
bun run test:integration 2>&1

# Run snapshot tests
bun run test:snapshots 2>&1

# Update snapshots after UI changes
bun run test:snapshots:update

# Run specific failing test
bun test app/tests/integration/infrastructure/socket-communication.integration.test.ts 2>&1
```

**Test structure:**

- **Unit tests** - Co-located `*.test.ts` files testing state logic via dispatch
- **Integration tests** - Located in `app/tests/integration/` directory, organized by feature
- **Snapshot tests** - Co-located `*.snapshot.test.tsx` files for UI output
- **Test fixtures** - Auto-scoped fixtures in `app/test-utils/fixtures/`

**Adding new tests:**

- For unit tests: Create `*.test.ts` co-located with source, use dispatch to test state
- For integration tests: Add to `app/tests/integration/` with `.integration.test.ts` extension
- For snapshot tests: Create `*.snapshot.test.tsx` co-located with component

## Claude Code Skills

Slash commands available in this repo (invoke with `/skill-name`):

- `/run-checks` — run the full CI suite locally (prettier, eslint, tsc, unit, integration, snapshot)
- `/test-plan-mode` — trigger plan mode with a dummy plan to test the approve/deny hook UI end-to-end
- `/writing-unit-tests` — write or fix `*.test.ts` unit tests
- `/writing-integration-tests` — write or fix `*.integration.test.ts` keyboard/behavior tests
- `/writing-snapshot-tests` — write or fix `*.snapshot.test.tsx` visual regression tests

## Architecture

### Component Interaction Flow

```
1. Hook intercepts ExitPlanMode
   └─> Creates socket at sockets/planderson-{id}.sock
   └─> Cleans up old sockets (>1 hour)
   └─> Waits for TUI connection (15 minute timeout)

2. TUI discovers socket, connects (through auto launch mode or direct trigger, e.g. bash or tmux)
   └─> Requests plan via socket
   └─> User reviews, adds feedback
   └─> Approves or denies with feedback

3. TUI sends decision via socket
   └─> Hook receives decision
   └─> Returns to Claude with decision
   └─> Cleanup on exit
```

### Tech Stack

**Ink** - React for terminals, same as Claude Code uses
**TypeScript** - Type safety in strict mode
**Bun** - Fast runtime with built-in TypeScript support
**tmux** - Terminal multiplexer with pane-swap mechanism
**Zod** - Hook and settings validation
**unified + remark** - Markdown parsing and rendering
**lowlight** - Syntax highlighting

### Session Logging

Two log files under `logs/` (dev mode) or `~/.planderson/logs/` (global install):

**`activity.log`** — all session events (INFO and ERROR, one line each):

```
2026-02-01T06:48:42.699Z INFO  | a9f3d67 | process.started | tui.tsx - mode=socket
2026-02-01T06:49:15.123Z INFO  | a9f3d67 | plan.accepted   | socket
2026-02-01T06:49:15.124Z INFO  | a9f3d67 | process.exited  | tui.tsx - exitCode=0
2026-02-01T06:50:01.456Z ERROR | a9f3d67 | socket.errored  | App.tsx - Connection refused
```

Format: `ISO8601 LEVEL | session_id | EVENT | file - metadata`

**`error.log`** — errors only, with full stack traces:

```
2026-02-01T06:50:01.456Z ERROR | a9f3d67 | socket.errored |
Error: Connection refused
    at Socket.<anonymous> (src/utils/io/socket-client.ts:42:15)
    ...
```

## Releasing

### Via GitHub UI (recommended)

There is a workflow that bumps the version, commits, and pushes a tag. The existing `release.yml` triggers on the tag and handles building binaries and creating the GitHub Release. You must be an approved member of the `releases` environment to create a tag that starts this process.

1. Go to [Actions → Release (Dispatch) → Run workflow](https://github.com/bradleyoesch/planderson/actions/workflows/release-dispatch.yml)
2. Pick `patch`, `minor`, or `major`
3. Click Run.

### Locally

Run one of the following to bump the version, commit, tag, and push:

```bash
bun run release:patch   # 0.3.0 → 0.3.1
bun run release:minor   # 0.3.0 → 0.4.0
bun run release:major   # 0.3.0 → 1.0.0
```

GitHub Actions (`release.yml`) takes over from there: builds binaries for all targets, attaches artifacts, and creates the GitHub Release with auto-generated notes. No manual `gh release create` needed — the workflow is the single source of truth.

## Common Issues

### tmux keybinding not working

Reload: `bun run dev:set` (dev mode) or `tmux source-file ~/.tmux.conf` (global)
Verify: `tmux list-keys | grep planderson`

### Wrong version running

If changes aren't showing: `bun run dev:set` from the repo/worktree directory
Reset to global: `bun run dev:reset`
