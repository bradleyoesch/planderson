# CLAUDE.md

> **Rule for future updates:** This file is for things Claude Code cannot discover — hard constraints, architectural decisions, business rules, and CI/environment quirks. Keep it short. Don't duplicate README, CONTRIBUTING.md, or what's discoverable from reading the code.

## Commit Conventions

Conventional Commits enforced by commitlint (commit-msg hook rejects violations).

Format: `<type>(<scope>): <description>` — max 120 chars, subject lowercase, imperative mood, no trailing period.

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Breaking changes: append `!` (e.g. `feat(ui)!:`).

## Worktrees

Stored in `.worktrees/` (gitignored). After switching to a worktree, run `bun run dev:set` to override tmux keybindings to point at the worktree. Reset with `bun run dev:reset`.
