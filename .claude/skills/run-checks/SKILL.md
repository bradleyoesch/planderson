---
name: run-checks
description: Run comprehensive checks on Planderson changes including formatting (Prettier), linting (ESLint), type checking (TypeScript), unit tests, integration tests, and build verification. Use this skill when the user asks to check code, run CI checks locally, or verify changes before committing.
---

# Check Planderson

## Overview

This skill runs all the checks that would run in CI/CD, allowing you to catch and fix issues locally before pushing. It mirrors the GitHub Actions workflow defined in `.github/workflows/ci.yml`.

## When to Use This Skill

Invoke this skill when:
- User asks to "check the code" or "run checks"
- User mentions "CI" or "before committing"
- About to create a commit or PR and want to verify everything passes
- User asks to "fix formatting", "fix linting", or "fix types"
- Need to verify changes won't break CI

## Quick Start

### Run All Checks (Read-Only) - Optimal Order

**IMPORTANT:** Run tests first to stabilize code, then run other checks. This prevents wasting time on formatting/linting code that will change when fixing test failures.

**Phase 1 - Stabilize code with tests (run in parallel - single message, two Bash calls):**
```bash
bun run test 2>&1
bun run test:integration 2>&1  # Or use run_in_background: true
```

**IMPORTANT:** Always use `2>&1` to capture both stdout and stderr - this ensures test failures and error messages are visible in the output.

If tests fail, fix them first, then re-run Phase 1. Once tests pass, proceed to Phase 2.

**Phase 2 - Quick checks on stable code (run in parallel - single message, three Bash calls):**
```bash
bun run format:check
bun run lint
bun run type-check
```

**Phase 3 - Build verification (sequential, after all checks pass):**
```bash
bun run build
```

**Expected time:**
- Phase 1 (tests): ~40 seconds (both complete around same time)
- Phase 2 (checks): ~4-5 seconds (vs 12-15 seconds sequential)
- Phase 3 (build): ~3 seconds
- **Total: ~47 seconds** (vs 60+ seconds sequential)

**Why this order?**
- Tests can fail and require code changes
- Code changes after test fixes might introduce formatting/linting/type issues
- Running format/lint/type first wastes time if tests fail and code changes

### Fix Common Issues

Auto-fix formatting and linting issues (run in parallel - single message, two Bash calls):

```bash
bun run format
bun run lint:fix
```

## Parallel Execution Strategy

This skill uses parallel execution to mirror CI workflow and maximize speed.

### How Parallel Execution Works in Claude Code

**Method 1: Multiple Bash tool calls in a single message**
- Claude makes multiple independent Bash tool calls in one response
- Each command runs concurrently (not sequential)
- All must complete before Claude continues
- Example: Three separate Bash calls for `format:check`, `lint`, and `type-check`

**Method 2: Background tasks with `run_in_background: true`**
- Long-running tasks (integration tests, builds) run in background
- Use `TaskOutput` tool to retrieve results later
- Allows other work to proceed while task completes
- Example: Integration tests running while you check other things

### Why Run Checks in Parallel?

- **Faster feedback:** Get results in ~47 seconds instead of 60+ seconds
- **Mirrors CI:** GitHub Actions runs lint, type-check, and tests as parallel jobs
- **Better resource utilization:** CPU cores aren't sitting idle during I/O operations
- **Same end result:** All checks must pass regardless of execution order

### What Can Run in Parallel?

**✅ Independent checks (run in parallel - multiple tool calls):**
- Format check + Lint + Type check (no shared state, all read-only)
- Unit tests + Integration tests (separate test suites, isolated environments)
- Format fix + Lint fix (operate on different aspects of code)

**❌ Sequential checks (must run in order):**
- Build must run after tests pass (CI workflow dependency)
- Re-checks after fixes must wait for fix commands to complete

### Execution Pattern

**In skill documentation (for Claude to follow):**
```bash
# Run in parallel (single message, three Bash calls)
bun run format:check
bun run lint
bun run type-check
```

**NOT this (shell backgrounding doesn't work in skill context):**
```bash
# ❌ Don't use shell backgrounding in skill instructions
bun run format:check & bun run lint & bun run type-check & wait
```

### Best Practices

1. **Use multiple Bash tool calls** - Each independent command in separate call
2. **Document parallelism** - Add comment "(single message, N Bash calls)"
3. **Group by speed** - Fast checks together, slow checks together
4. **Use background for long tasks** - Integration tests, builds (>30 seconds)
5. **Respect dependencies** - Don't parallelize if one depends on another's output

## Check Categories

### 1. Formatting (Prettier)

**Check:**
```bash
bun run format:check
```

**Fix:**
```bash
bun run format
```

**What it checks:**
- Code formatting consistency (indentation, line length, quotes)
- JSON, Markdown, TypeScript/TSX formatting
- Uses `.prettierrc.json` configuration

**Common issues:**
- Inconsistent indentation
- Missing semicolons or trailing commas
- Line length violations

### 2. Linting (ESLint)

**Check:**
```bash
bun run lint
```

**Fix:**
```bash
bun run lint:fix
```

**What it checks:**
- Code quality and best practices (Google style + React)
- Import ordering (simple-import-sort)
- React hooks rules
- TypeScript-specific rules
- Uses `eslint.config.js` configuration

**Common issues:**
- Unused variables or imports
- Incorrect import order
- React hooks dependency issues
- Missing return types

### 3. Type Checking (TypeScript)

**Check:**
```bash
bun run type-check
```

**What it checks:**
- TypeScript type safety (strict mode)
- Type annotations and inference
- Type compatibility
- Uses `tsconfig.json` configuration

**Common issues:**
- Missing type annotations
- Type mismatches
- Incorrect function signatures
- Untyped variables

**Note:** Type errors must be fixed manually - there's no auto-fix option.

### 4. Unit Tests

**Run:**
```bash
bun run test
```

**Watch mode:**
```bash
bun run test:watch
```

**Coverage:**
```bash
bun run test:coverage
```

**What it tests:**
- Component rendering and behavior
- Utility functions and business logic
- Pure functions and helpers
- Includes 96+ snapshot tests

**Locations:**
- `app/src/**/*.test.{ts,tsx}`
- `app/lib/**/*.test.ts`
- `integrations/tmux/**/*.test.ts`

### 5. Integration Tests

**Run:**
```bash
bun run test:integration
```

**What it tests:**
- Full user interaction workflows
- Socket communication between hook and TUI
- End-to-end behavioral scenarios
- Includes 5 integration snapshot tests

**Locations:**
- `app/tests/integration/*.integration.test.{ts,tsx}`

**Note:** Integration tests may be flaky due to timing - they use retry logic in CI.

### 6. Build Check

**Run:**
```bash
bun run build
```

**What it checks:**
- Binary compilation succeeds
- All dependencies resolve correctly
- No missing imports or modules

**Output:**
- Creates `planderson` binary in project root
- Verifies the binary is executable

## Workflow: Fix Everything Before Commit

Complete workflow to ensure code passes all CI checks. **CRITICAL:** Run tests first to stabilize code before wasting time on formatting/linting.

### Step 1: Stabilize Code - Run Tests First

Run in parallel (single message, two Bash calls):

```bash
bun run test 2>&1
bun run test:integration 2>&1
```

**Alternative for long integration tests:**
```bash
bun run test:integration 2>&1  # Use run_in_background: true
bun run test 2>&1              # Run immediately
# Use TaskOutput later to check integration test results
```

If tests fail:
- Review the error messages
- Check if snapshots need updating (see writing-snapshot-tests skill)
- Fix failing assertions
- **Re-run tests to verify** before proceeding

**Why tests first?**
- Test failures require code changes
- Code changes will affect formatting/linting/types
- Running format/lint/type before tests wastes time on unstable code

### Step 2: Auto-Fix What's Possible (After Tests Pass)

Run in parallel (single message, two Bash calls):

```bash
bun run format
bun run lint:fix
```

**Time saved:** ~2-3 seconds by running in parallel

### Step 3: Run All Checks on Stable Code

Run in parallel (single message, three Bash calls):

```bash
bun run format:check
bun run lint
bun run type-check
```

If type errors appear, fix them manually:
- Add missing type annotations
- Fix type mismatches
- Update function signatures
- Add proper return types

Then re-run Step 3 to verify fixes.

### Step 4: Verify Build

```bash
# Build binary (sequential, after all checks pass)
bun run build
```

### Step 5: Complete Check (Optimal Order)

**Phase 1 - Stabilize with tests (single message, two Bash calls):**
```bash
bun run test 2>&1
bun run test:integration 2>&1
```

**Phase 2 - Check stable code (single message, three Bash calls):**
```bash
bun run format:check
bun run lint
bun run type-check
```

**Phase 3 - Build (sequential):**
```bash
bun run build
```

**Total time: ~47 seconds** (vs 60+ seconds sequential)

If all pass, you're ready to commit!

## Common Issues and Solutions

### Prettier Format Failures

**Symptom:** `format:check` fails with file paths

**Solution:**
```bash
bun run format
```

This auto-formats all files to match Prettier rules.

### ESLint Failures

**Symptom:** `lint` fails with rule violations

**Solution:**
```bash
bun run lint:fix
```

For issues that can't be auto-fixed:
- Read the error message carefully
- Fix the code manually (remove unused vars, fix hooks deps, etc.)
- Re-run `bun run lint` to verify

### TypeScript Type Errors

**Symptom:** `type-check` fails with type mismatches

**Solution (no auto-fix):**
1. Read the error message and file location
2. Fix type issues manually:
   - Add explicit type annotations
   - Fix type incompatibilities
   - Update function signatures
3. Re-run `bun run type-check`

### Test Failures

**Symptom:** Tests fail with assertion errors or snapshots

**Solution:**
1. Read the failure output
2. If snapshot failures after intentional UI changes:
   ```bash
   bun run test:snapshots:update
   ```
3. If behavioral test failures:
   - Debug the issue
   - Fix the code or test
   - Re-run tests

### Integration Test Timeouts

**Symptom:** Integration tests timeout or fail intermittently

**Solution:**
- Integration tests can be flaky due to socket timing
- Re-run: `bun run test:integration`
- CI uses retry logic (3 attempts)

### Build Failures

**Symptom:** `build` command fails

**Common causes:**
- Missing dependencies: Run `bun install`
- Import errors: Check for typos in import paths
- Type errors: Run `bun run type-check` first

## CI/CD Workflow Reference

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs these checks in parallel:

1. **Lint & Format** job:
   - `bun run format:check`
   - `bun run lint`

2. **Type Check** job:
   - `bun run type-check`

3. **Unit Tests** job:
   - `bun run test`

4. **Integration Tests** job:
   - `bun run test:integration` (with 3 retry attempts)

5. **Build** job (runs after all pass):
   - `bun run build`
   - Uploads binary artifact

## Pre-Commit Hooks

The project uses `husky` and `lint-staged` for automatic checks on commit:

**What runs on commit:**
- Prettier formatting on staged `.ts`, `.tsx`, `.json`, `.md` files
- ESLint with auto-fix on staged `.ts`, `.tsx` files
- TypeScript type check on all files

**Configuration:**
- See `package.json` → `lint-staged` section
- Hooks configured in `.husky/` directory

**Bypass hooks (not recommended):**
```bash
git commit --no-verify
```

Only use `--no-verify` if explicitly instructed by the user.

## Available Scripts Reference

All scripts defined in `package.json`:

```json
{
  "format": "prettier --write .",          // Auto-fix formatting
  "format:check": "prettier --check .",    // Check formatting (read-only)
  "lint": "eslint . --ext .ts,.tsx",       // Check linting (read-only)
  "lint:fix": "eslint . --ext .ts,.tsx --fix", // Auto-fix linting
  "type-check": "tsc --noEmit",            // Check types (read-only)
  "test": "bun test ...",                  // Run unit tests
  "test:watch": "bun test --watch ...",    // Watch mode
  "test:coverage": "bun test --coverage ...", // With coverage
  "test:integration": "...",               // Run integration tests
  "test:snapshots": "...",                 // Run snapshot tests only
  "test:snapshots:update": "...",          // Update snapshots
  "build": "bun build app/src/commands/tui.tsx --compile --outfile planderson"
}
```

## Best Practices

1. **Run checks before committing** - Catch issues early
2. **Fix formatting and linting first** - Use auto-fix commands
3. **Address type errors carefully** - They often indicate real bugs
4. **Update snapshots intentionally** - Review diffs before updating
5. **Test locally before pushing** - Don't rely solely on CI
6. **Use the Task tool** - Track progress when fixing multiple issues

## Workflow Example

User asks: "Check if my code is ready to commit"

**Response (optimal order):**

1. **Stabilize code first - Run tests** (single message, two Bash calls):
   - Bash call 1: `bun run test 2>&1`
   - Bash call 2: `bun run test:integration 2>&1` (or use `run_in_background: true`)

   If tests fail, fix issues and re-run before proceeding. Do NOT continue to format/lint if tests fail.

2. **Auto-fix formatting and linting** (single message, two Bash calls):
   - Bash call 1: `bun run format`
   - Bash call 2: `bun run lint:fix`

3. **Run all checks on stable code** (single message, three Bash calls):
   - Bash call 1: `bun run format:check`
   - Bash call 2: `bun run lint`
   - Bash call 3: `bun run type-check`

4. **Verify build** (single Bash call):
   - Bash call: `bun run build`

5. Report results to user with clear next steps if any checks fail.

**Key points:**
- **Tests first** - Stabilize code before checking format/lint/types
- Multiple Bash tool calls in a single message run concurrently
- Each tool call completes independently
- Claude receives all results before continuing
- Use `run_in_background: true` for very long tasks (>30 seconds)
- Use `TaskOutput` to retrieve background task results

**Why this order matters:**
- Test failures → code changes → format/lint/type changes
- Running format/lint/type before tests wastes time if tests fail
- Follows "stabilize first, polish second" principle

## Related Skills

- **writing-unit-tests** - Write and fix unit tests
- **writing-integration-tests** - Write and fix integration tests
- **writing-snapshot-tests** - Write and manage visual regression snapshots
- **test-plan-mode** - Test the plan approval hook flow

## Troubleshooting

### "Cannot find module" errors in tests

**Solution:**
```bash
bun install
```

### "Socket already in use" in integration tests

**Solution:**
```bash
bun run clean:sockets
bun run test:integration
```

### All checks pass locally but fail in CI

**Common causes:**
- Uncommitted changes (CI uses committed code only)
- Different Node/Bun versions
- Platform-specific issues (macOS vs Linux)

**Solution:**
- Ensure all changes are committed
- Check CI logs for specific error messages
- Consider platform-specific issues (file paths, permissions)

### Need to skip checks temporarily

**Not recommended, but if necessary:**
```bash
# Skip pre-commit hooks
git commit --no-verify -m "message"

# Skip specific CI job
# (Not possible - must pass all checks)
```

Only use `--no-verify` when explicitly requested by the user.
