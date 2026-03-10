---
paths:
  - "app/src/commands/hook.ts"
  - "app/src/commands/hook.test.ts"
---

# Hook Scripts

## User Communication Constraint

`console.error()` in hook scripts and background processes is **not visible to users** — the TUI is the only user-facing channel. Use `logEvent()` / `logError()` for observability.
