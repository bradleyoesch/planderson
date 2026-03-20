---
name: writing-integration-tests
description: Use when writing, creating, or modifying integration tests (.integration.test.ts/.tsx files). Use when asked to "add integration test", "write integration test", or when implementing features that need keyboard/behavioral test coverage. Also use when integration tests fail and need fixing.
---

# Writing Integration Tests

You are here because the testing rule's dispatcher determined this is an integration test. The shared conventions (describe naming, fixture scoping, mock.module() prohibition, Bun quirks) are already loaded from that rule — this skill covers only what is unique to integration tests.

Integration tests verify **user-visible behavior through keyboard interaction**. Every test answers: "When the user does X, do they see Y?"

**Integration tests are for:** keyboard workflows, mode transitions, multi-component interactions via user input, end-to-end flows.

**NOT for:** pure function logic, state transitions via dispatch (unit test), visual layout verification (snapshot test).

**Infrastructure Exception:** Tests in `app/tests/integration/infrastructure/` don't require keyboard input. They test multiple components interacting with real filesystem/sockets (e.g., hook writes registry → Planderson reads it → connects to socket). These verify integration of non-UI infrastructure components.

## Project Conventions (Non-Negotiable)

### 1. File Location and Naming

```
app/tests/integration/
  e2e/                          # Multi-feature workflows only
  ui/
    decision/                   # Approve/deny flows
    feedback/                   # Comments, questions, deletions
    markdown/                   # Code blocks, syntax highlighting
    navigation/                 # Scrolling, jumping, paging, command mode
    views/                      # Help view, error view
  claude-hook/                  # Hook behavior, validation, security
  infrastructure/               # Socket IPC
```

Name: `<feature>.integration.test.tsx` (or `.ts` for non-React tests).

Place in the subdirectory matching the feature. If it tests multiple features together, it goes in `e2e/`.

### 2. Required Boilerplate

Every integration test file MUST have:

```typescript
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeText, typeKey, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

describe('subdirectory feature-name integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    // tests go here
});
```

**Critical:** The `cleanup()` call is mandatory. Bun runs all test files in a single process — without it, Ink signal handlers accumulate and cause flaky failures.

### 3. Suppressing React Error Boundary Logs (When Testing Errors)

When testing error handling (e.g., missing files, invalid input), React's error boundary will log errors to `console.error`. This is expected behavior but creates noisy test output.

**For tests that intentionally trigger errors, suppress the logs:**

```typescript
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

describe('views error-view integration', () => {
    // Suppress React error boundary console output for intentional error tests
    let consoleErrorSpy: typeof console.error;

    beforeEach(() => {
        consoleErrorSpy = console.error;
        console.error = () => {}; // Suppress React error boundary logs
    });

    afterEach(() => {
        console.error = consoleErrorSpy; // Restore console.error
        cleanup();
    });

    test('should show error for missing file', async () => {
        // This intentionally triggers an error, but console.error is suppressed
        const { lastFrame } = render(
            <App mode="file" filepath="/nonexistent/file.md" settings={DEFAULT_SETTINGS} error={null} />,
        );
        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('not found'), 10000);
    });
});
```

**When to use:**
- Tests that pass invalid file paths (missing files, nonexistent directories)
- Tests that verify error messages are displayed correctly
- Tests that intentionally trigger errors to verify error handling

**When NOT to use:**
- Tests where errors are NOT expected (suppressing errors would hide real bugs)
- Most integration tests (only suppress when testing error scenarios)

### 4. Test Names Describe User-Visible Behavior

```typescript
// GOOD: what user does → what user sees
test('single line not deleted -> press x -> deleted', ...);
test('opens long plan at top with cursor on line 1', ...);
test('enter key shows approval confirmation', ...);

// BAD: implementation details
test('sets deletedLines Set entry', ...);
test('dispatches MOVE_CURSOR action', ...);
```

### 5. Keyboard Input Patterns

**Always use `typeText` for text input, never raw `stdin.write`:**

```typescript
// GOOD: Use typeText for all text input
await typeText(stdin, 'c');
await typeText(stdin, 'Test comment', { enter: true });
await typeText(stdin, ':wq', { enter: true });

// BAD: Raw stdin.write
stdin.write('c');  // Don't do this
stdin.write('Test comment');  // Don't do this
```

**For special keys (Keys.*), always use `typeKey`:**
```typescript
// GOOD: Use typeKey for all Keys.*
await typeKey(stdin, Keys.DOWN_ARROW);
await typeKey(stdin, Keys.ENTER);
await typeKey(stdin, Keys.ESCAPE);
await typeKey(stdin, Keys.SHIFT_DOWN);

// GOOD: Override default delay if needed
await typeKey(stdin, Keys.BACKSPACE, { delayMs: 5 });

// BAD: Raw stdin.write
stdin.write(Keys.DOWN_ARROW);  // Don't do this
```

**Default behavior:**
- `typeKey` has a default 50ms delay after key press (can be overridden)
- This provides consistent, reliable keyboard simulation
- Use `waitFor` for state assertions, not additional delays

**Pattern conversions:**
```typescript
// Text characters: OLD → NEW
stdin.write('c');
await waitForRender(500);
// Becomes:
await typeText(stdin, 'c', { delayMs: 500 });

// Keys: OLD → NEW
stdin.write(Keys.DOWN_ARROW);
await waitForRender(50);
// Becomes:
await typeKey(stdin, Keys.DOWN_ARROW);  // Has default 50ms delay

// Keys without delay: OLD → NEW
stdin.write(Keys.DOWN_ARROW);
// Becomes:
await typeKey(stdin, Keys.DOWN_ARROW);  // Still use typeKey for consistency
```

**Command mode pattern (colon commands):**

When testing command mode sequences, use separate actions for the colon and the command:

```typescript
// GOOD: Command mode with separate actions
await typeKey(stdin, ':');
await typeText(stdin, 'd', { enter: true });

await typeKey(stdin, ':');
await typeText(stdin, 'wq', { enter: true });

// BAD: Combined into single typeText
await typeText(stdin, ':d', { enter: true });  // Don't combine

// When testing cancellation (no Enter)
await typeKey(stdin, ':');
await typeText(stdin, 'wq');  // Type command but don't execute
await typeKey(stdin, Keys.ESCAPE);  // Cancel with Escape
```

**Rationale:** Command mode requires the colon to be a separate action to enter command mode, then the command text is typed separately.

### 6. Hook Subprocess Test Isolation

Tests in `tests/integration/claude-hook/` spawn the hook as a real subprocess. These tests MUST use `spawnHook()` from `./helpers` — never call `spawn('bun', [HOOK_PATH], { env: { ...process.env, ... } })` directly.

**Why isolation matters:** The hook calls `loadSettings()`, which reads `~/.planderson/settings.json`. Using `...process.env` inherits the developer's real `HOME`, meaning a custom settings file (e.g., `launchMode: 'auto-tmux'`) could affect test behavior and cause tests to launch real tmux panes, and a malformed settings file could break tests.

**`spawnHook()` automatically:**
- Creates a temp `HOME` directory (auto-cleaned after each test)
- Clears `TMUX` and `TMUX_PANE` to prevent auto-launch side effects
- Passes remaining `process.env` through for PATH, BUN_*, etc.

```typescript
// GOOD: Use spawnHook — HOME is isolated, TMUX/TMUX_PANE cleared
import { spawnHook, readStream, connectAndRespond } from './helpers';

const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });
const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH, PLANDERSON_TIMEOUT_SECONDS: '2' });
const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH, TMUX_PANE: '%0' }); // test tmux behavior
const hookProcess = spawnHook(); // for tests that don't reach socket (validation errors, etc.)

// BAD: Direct spawn leaks developer's HOME → reads real ~/.planderson/settings.json
import { spawn } from 'child_process';
const hookProcess = spawn('bun', [HOOK_PATH], {
    env: { ...process.env, TMUX: undefined, TMUX_PANE: undefined },  // ← still reads real HOME
});
```

**When testing file logging** (activity.log, error.log), pass `baseDir` as the second arg to `spawnHook()` to redirect log output to a known, isolated location. `spawnHook` writes `dev.json` in the subprocess's fake HOME pointing at `baseDir`:

```typescript
// GOOD: useTempDir() registers its own afterEach cleanup
const base = useTempDir('planderson-test-log-');
const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH }, base);
// spawnHook writes ~/.planderson/dev.json with { baseDir: base } so logs go to base/logs/
// ... then assert on path.join(base, 'logs', 'activity.log')

// BAD: module-level let + manual afterEach — this is shared mutable state
let logBase: string;
afterEach(() => { fs.rmSync(logBase, ...); });
const makeLogBase = () => { logBase = fs.mkdtempSync(...); return logBase; };
```

**UI integration tests** (those using `render(<App>)`) are already isolated because `App` receives settings as a prop — `DEFAULT_APP_PROPS.settings` provides `DEFAULT_SETTINGS`. No disk reads happen.

**Note on `useTestSettings`:** This fixture was removed because it wrote to the real `~/.planderson/settings.json`. Unit tests for `loadSettings()` instead use `spyOn(os, 'homedir')` to redirect to a temp dir. Do not recreate `useTestSettings`.

### 7. Frame Access Pattern

**Always use non-null assertion (`!`) for `lastFrame()`, never nullish coalescing:**

```typescript
// GOOD: Non-null assertion
expect(lastFrame()!).toContain('Line 1');
const frame = lastFrame()!;
expect(isLineDeleted(frame, 'Line 1')).toBe(true);

// BAD: Nullish coalescing with OR operator
expect(lastFrame() || '').toContain('Line 1');  // Don't do this
const frame = lastFrame() || '';  // Don't do this
```

**Rationale:** `lastFrame()` returns `string | undefined`, but in tests it should never be undefined after initial render. The `!` makes the assertion explicit and keeps tests concise.

## Test Structure Template

```typescript
test('description of user workflow', async () => {
    // Arrange: create content and render
    const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'unique-name.md');
    const { lastFrame, stdin } = render(
        <App mode="file" filepath={file} settings={DEFAULT_SETTINGS} error={null} />,
    );
    await waitFor(() => expect(lastFrame()).toContain('Line 1'), 10000);

    // Verify pre-condition (what user sees BEFORE action)
    expect(isLineNotDeleted(lastFrame()!, 'Line 1')).toBe(true);

    // Act + Assert: simulate user input, verify post-condition
    stdin.write('x');
    await waitFor(() => {
        expect(isLineDeleted(lastFrame()!, 'Line 1')).toBe(true);
        expect(isLineNotDeleted(lastFrame()!, 'Line 2')).toBe(true);  // No side effects
    });
});
```

**Key points:**
- Always verify pre-condition AND post-condition
- Always check for absence of side effects on unaffected lines
- Give each `useTempPlanFile` a unique filename to prevent collisions

## Async Patterns

### waitFor (assertion-retry polling) — ALWAYS use for assertions

```typescript
// Wait for initial render
await waitFor(() => expect(lastFrame()).toContain('Line 1'), 10000);

// Wait for state change after input — combines waiting and asserting
stdin.write('c');
await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

// Multiple assertions in one waitFor
stdin.write('x');
await waitFor(() => {
    expect(isLineDeleted(lastFrame()!, 'Line 1')).toBe(true);
    expect(isLineNotDeleted(lastFrame()!, 'Line 2')).toBe(true);
});
```

Default timeout is 5000ms. Pass explicit timeout for longer waits: `waitFor(assertion, 20000)`.

### waitForRender (fixed delay) — only for mechanical timing

```typescript
// Between rapid keystrokes where you don't need to verify intermediate state
stdin.write(Keys.DOWN_ARROW);
await waitForRender(20);
stdin.write(Keys.DOWN_ARROW);
await waitForRender(20);
```

**Rule:** Use `waitFor` when you have something to assert. Use `waitForRender` only for mechanical spacing between inputs where there's nothing to assert.

### Repeating Key Presses

**Use `typeKeys` for repeating the same key multiple times:**

```typescript
// GOOD: Use typeKeys helper for repeated keys
await typeKeys(stdin, Keys.DOWN_ARROW, 10);
await typeKeys(stdin, Keys.BACKSPACE, 20);
await typeKeys(stdin, Keys.SHIFT_DOWN, 5);

// BAD: Manual loops (ESLint no-restricted-syntax rule forbids for loops)
for (let i = 0; i < 10; i++) {
    await typeKey(stdin, Keys.DOWN_ARROW);  // ESLint error
}

// BAD: forEach doesn't wait for promises (runs in parallel)
Array.from({ length: 10 }).forEach(async () => {
    await typeKey(stdin, Keys.DOWN_ARROW);  // These run in parallel, not sequentially!
});
```

**When you need custom logic between iterations, use async reduce pattern:**

```typescript
await Array.from({ length: 3 }).reduce(async (promise) => {
    await typeKey(stdin, Keys.DOWN_ARROW);
    const frame = lastFrame()!;
    if (someCondition(frame)) {
        await typeText(stdin, 'x');
    }
    await promise;
}, Promise.resolve());
```

**Order matters:** Execute action first, THEN await chain (`await promise`).

## Assertion Helpers

Use semantic helpers, never raw ANSI codes.

**Visual state** (`app/test-utils/visual-assertions.ts`):
- `isLineDeleted(frame, text)` / `isLineNotDeleted(frame, text)`
- `areLinesDeleted(frame, texts[])` / `areLinesNotDeleted(frame, texts[])`
- `getCursorLine(frame)` / `hasCursorHighlight(frame, text)`
- `hasStrikethrough(frame, text)` / `countDeletedLines(frame)`

**Feedback** (`app/test-utils/feedback-assertions.ts`):
- `hasComment(frame, text)` / `hasQuestion(frame, text)`
- `isInCommentMode(frame)` / `isInQuestionMode(frame)`
- `countComments(frame)` / `countQuestions(frame)`

**View state** (`app/test-utils/view-assertions.ts`):
- `isInPlanView(frame)` / `isInHelpView(frame)`
- `isInCommandMode(frame)` / `isInConfirmationView(frame)`

**Keyboard constants** (`app/test-utils/ink-helpers.ts`):
- `Keys.UP_ARROW`, `Keys.DOWN_ARROW`, `Keys.ENTER`, `Keys.ESCAPE`
- `Keys.SHIFT_UP`, `Keys.SHIFT_DOWN`, `Keys.DELETE`, `Keys.BACKSPACE`

## Anti-Patterns

| Anti-Pattern | Do This Instead |
|---|---|
| Raw ANSI in assertions: `expect(f).toContain('\x1B[9m')` | `isLineDeleted(f, 'Line 1')` |
| `sleep(200)` or arbitrary delays | `waitFor(() => expect(lastFrame()).toContain(...))` |
| No pre-condition check (only check result) | Verify state BEFORE and AFTER the action |
| Snapshot as sole assertion in integration test | Semantic assertions; snapshots only in snapshot tests |
| Missing `cleanup()` in `afterEach` | Always include — Bun single-process model requires it |
| Testing state via dispatch in integration test | That's a unit test — use `renderHook` + `dispatch` instead |
| Pure function calls with no `stdin.write` | That's a unit test — move to `src/**/*.test.ts` |
| Monolith test file (400+ lines, mixed features) | Split by feature into focused files |
| Module-level `let` for shared mutable state | Auto-scoped fixtures (`useTempPlanFile()`) |
| `console.log` debugging left in tests | Remove before committing |
| Testing dead code or reimplemented fakes | Delete the dead code; test the real function |
| `expect(true).toBe(true)` | Every assertion must test observable behavior |
| React error logs in tests that trigger errors | Suppress with `beforeEach/afterEach` console.error mocking (see §3) |
| `stdin.write('c')` for text input | Use `typeText(stdin, 'c')` (see §5) |
| `stdin.write(Keys.*); await waitForRender()` | Use `typeKey(stdin, Keys.*, { delayMs })` (see §5) |
| Nullish coalescing with lastFrame() | Use non-null assertion operator (see §7) |
| `for (let i = 0; i < n; i++) { await ... }` | Use `typeKeys(stdin, key, n)` — ESLint forbids for loops |
| `Array.from().forEach(async () => { await ... })` | Use `typeKeys(stdin, key, n)` — forEach doesn't wait for promises |
| Async reduce for simple repetition | Use `typeKeys(stdin, key, n)` — reduce only for custom logic between iterations |
| `spawn('bun', [HOOK_PATH], { env: { ...process.env } })` in hook tests | Use `spawnHook(extraEnv)` — direct spawn reads real `~/.planderson/settings.json` (see §6) |
| Module-level `let logBase` + manual `afterEach` for log dirs | `const base = useTempDir('planderson-test-log-')` — auto-scoped cleanup (see §6) |
| `useTestSettings()` | Removed — writes to real `~/.planderson/settings.json`; unit tests mock `os.homedir()` instead |

## Running Tests

```bash
# All integration tests
bun run test:integration 2>&1

# Specific test file (more reliable for timing-sensitive tests)
bun test app/tests/integration/ui/feedback/delete-behavior.integration.test.tsx 2>&1
```

## Quick Reference

| Convention | Rule |
|---|---|
| Location | `app/tests/integration/<category>/<feature>.integration.test.tsx` |
| Root describe | ONE per file: `'subdirectory feature-name integration'` |
| Test names | User-visible behavior: `'press x -> line deleted'` |
| Cleanup | `afterEach(() => { cleanup(); })` in every file |
| Initial wait | `waitFor(() => expect(lastFrame()).toContain(...), 10000)` |
| After input | `waitFor` for assertions, `waitForRender` for mechanical timing |
| Assertions | Semantic helpers from `app/test-utils/*-assertions.ts` |
| Keys | `Keys.*` constants from `app/test-utils/ink-helpers.ts` |
| Fixtures | `useTempPlanFile(content, uniqueName)` — auto-cleanup |
| Pre/post | Always verify state before AND after the action |
| File size | One feature per file; consider split if exceeding 1000 lines |

## Deep Reference

See [research](references/research.md) for the full research behind these guidelines — code change analysis, session learnings, and industry best practices with sources.
