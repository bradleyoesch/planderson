# Writing Integration Tests: Research Summary

Research compiled 2026-02-18 from three sources:
1. **Code changes analysis** — git diff 527cfcc..HEAD covering 52 commits of integration test improvements
2. **Claude session analysis** — 16 sessions from today focused on integration test quality
3. **Industry best practices** — TypeScript, React, and Ink testing standards

---

## Table of Contents

1. [TL;DR](#tldr)
2. [Philosophy](#philosophy)
3. [What We Changed and Why](#what-we-changed-and-why)
4. [Anti-Patterns Identified and Removed](#anti-patterns-identified-and-removed)
5. [Best Practices Established](#best-practices-established)
6. [Ink-Specific Patterns](#ink-specific-patterns)
7. [Test Organization](#test-organization)
8. [Assertions and Readability](#assertions-and-readability)
9. [Async Patterns](#async-patterns)
10. [Snapshot Guidelines](#snapshot-guidelines)
11. [Test Isolation and Cleanup](#test-isolation-and-cleanup)
12. [Sources](#sources)

---

## TL;DR

- **Test behavior, not implementation** — assert what the user sees, not internal state or ANSI codes
- **Feature-based directory structure** — organize by what's tested (navigation/, feedback/, views/), not by layer
- **One root `describe` per file** matching the filename (enforced by ESLint rule)
- **Auto-scoped fixtures** — `useTempDir()`, `useTestSocket()`, `useTempPlanFile()` register cleanup at creation; no manual `afterEach` needed
- **Semantic assertion helpers** — `isLineDeleted(frame, 'Line 1')` not `expect(frame).toContain('\x1B[9m')`
- **`cleanup()` in every integration test file** — Bun runs all files in one process; Ink handlers accumulate without it
- **`waitFor()` over `sleep()`** — retry assertions, don't guess timing
- **Pin terminal dimensions** — `columns=80, rows=24` with no-op setters prevents flaky rendering
- **Delete tests that test nothing** — `expect(true).toBe(true)`, tests of reimplemented fakes, tests of dead code
- **Avoid `mock.module()` in Bun** — leaks between files (Bun bug #12823); prefer boundary mocking
- **Snapshots only where visual layout IS the behavior** — pair with explicit assertions, keep small, review changes carefully
- **Two-tier strategy** — unit tests for state via `dispatch()`, integration tests for keyboard via `stdin.write()`

---

## Philosophy

### "Write Tests. Not Too Many. Mostly Integration."

Kent C. Dodds' Testing Trophy model: integration tests provide the best confidence-to-cost ratio because they verify components work together with minimal mocking.

> "The more your tests resemble the way your software is used, the more confidence they can give you."

### The Five Quality Questions

Applied to every test during our audit:

1. **What is this test actually testing?** — Exposed tests validating fakes instead of real code
2. **Does this duplicate coverage from another test?** — Found overlap between integration and unit tiers
3. **Is this testing behavior or implementation details?** — Tests asserting internal state were removed
4. **Does this test have meaningful assertions?** — Caught `expect(true).toBe(true)` patterns
5. **Is this test in the right tier?** — Pure function calls with no I/O moved from integration to unit

### Core Testing Principle

**"Test the real thing, test behavior, test in the right place."**

- **Test the real thing** — never test a reimplemented copy of a function; never test dead code paths
- **Test behavior** — assert what the user sees, not how it's implemented internally
- **Test in the right place** — pure logic in unit tests, keyboard workflows in integration tests

---

## What We Changed and Why

### Structural Reorganization

**Before:** 9 flat files in `tests/integration/` including a 642-line monolith.

**After:** 20 files organized by feature:

```
tests/integration/
  e2e/                          # Multi-feature workflows
  ui/
    decision/                   # Approve/deny flows
    feedback/                   # Comments, questions, deletions
    markdown/                   # Code blocks, syntax highlighting
    navigation/                 # Scrolling, jumping, paging, command mode
    views/                      # Help view, error view
  claude-hook/                  # Hook behavior split by concern
    hook-happy-path.integration.test.ts
    hook-infrastructure.integration.test.ts
    hook-security.integration.test.ts
    hook-socket-errors.integration.test.ts
    hook-validation.integration.test.ts
  infrastructure/               # Socket IPC
```

### Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Integration test files | 9 (flat) | 20 (organized) |
| Feature directories | 0 | 4 top-level, 5 UI subdirs |
| Assertion helper modules | 0 | 3 |
| Auto-scoped fixture modules | 0 | 3 |
| Snapshot count | 77 | 44 |
| Module-level mutable state | Multiple `let` declarations | 0 |
| ESLint test structure rules | 0 | 1 (auto-fixable) |

---

## Anti-Patterns Identified and Removed

### 1. Testing a Reimplemented Fake

`settings.integration.test.ts` had a local `loadTestSettings()` that cloned `loadSettings()` with a custom path parameter. All 13+ tests validated this copy, not the actual function. Deleted entirely — unit tests already covered the real function.

### 2. `mock.module()` in Bun

Bun bug #12823: module mocks leak between files in a single process with no `mock.restore()`. One file's mocks caused 73/76 test failures across unrelated files. **Avoid `mock.module()` unless absolutely necessary.** Prefer direct property assignment with teardown.

### 3. `expect(true).toBe(true)`

Three of eight tests in `page-navigation.integration.test.tsx` had no real assertions. Green checkmarks without testing anything. Replaced with meaningful behavioral assertions.

### 4. Unit Tests in Integration Directory

`viewport-wrapping.integration.test.tsx` tested pure `wrapContent()` function calls — no rendering, no keyboard input. Already covered by `line-wrapping.test.ts`. Deleted.

### 5. Raw ANSI Escape Codes in Assertions

```typescript
// Anti-pattern
expect(frame).toContain('\x1B[9m');  // What does this even check?

// Replaced with
expect(isLineDeleted(frame, 'Line 1')).toBe(true);  // Clear intent
```

### 6. Module-Level Shared Mutable State

```typescript
// Anti-pattern: shared across all tests
const createdDirs = new Set<string>();  // Race conditions in parallel tests

// Replaced with auto-scoped fixtures
const dir = useTempDir();  // Unique per test, auto-cleanup
```

### 7. Opaque Snapshot Assertions

Snapshots of 4,400+ lines of raw ANSI codes that nobody reviewed. Replaced with semantic assertions where behavior verification was the intent; kept snapshots only where visual layout IS the behavior.

### 8. Manual Cleanup in `afterAll`

Leaked resources when tests failed before reaching cleanup. Replaced with `afterEach`-based auto-scoped fixtures that cleanup even on failure.

### 9. Excessive Snapshot Coverage

77 snapshots including static views (ErrorView, LoadingView) and third-party output (lowlight syntax highlighting). Trimmed to 44 — removed what was already covered by unit tests or tested third-party behavior.

### 10. Giant Monolith Test Files

642-line file mixing e2e with basic feature tests. Split into focused, single-feature files.

### 11. Console.log Debugging Artifacts

7 occurrences of `console.log` left from debugging in `code-block-spacing.integration.test.tsx`. Cleaned up.

### 12. Testing Dead Code Paths

`WrappedLine.tsx` had a legacy rendering fallback that could never execute. Tests for unreachable code create false confidence. Removed both the dead code and its tests.

---

## Best Practices Established

### Auto-Scoped Fixtures

Register cleanup at creation time. No manual teardown. Cleanup guaranteed even on test failure.

```typescript
// test-utils/fixtures/temp-dirs.ts
export const useTempDir = (prefix = 'planderson-test-'): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    afterEach(() => {
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    });
    return dir;
};

// Usage — zero boilerplate cleanup
test('my test', () => {
    const file = useTempPlanFile('# Plan content');
    const socket = useTestSocket('my-test');
    // Both auto-cleanup after test
});
```

### Semantic Assertion Helpers

Three modules replace raw ANSI string matching:

- **`visual-assertions.ts`** — `isLineDeleted()`, `getCursorLine()`, `hasCursorHighlight()`, `hasStrikethrough()`
- **`feedback-assertions.ts`** — `hasComment()`, `hasQuestion()`, `isInCommentMode()`, `countComments()`
- **`view-assertions.ts`** — `isInPlanView()`, `isInHelpView()`, `isInCommandMode()`, `isInConfirmationView()`

### Test Utility YAGNI

If a helper is only tested by its own self-tests but never imported by actual test files, delete it. Two entire assertion files and multiple exports were removed.

### Mock at Boundaries, Not Internals

**Mock:** external services, file system I/O, time/dates, non-deterministic behavior, environment features (terminal dimensions)

**Don't mock:** internal components, state management, rendering pipeline, sibling component interactions

**Guiding question:** "Would a user notice if this were mocked?" If yes, don't mock it.

---

## Ink-Specific Patterns

### Two-Tier Testing Strategy

Ink's `useInput` hook returns no-op values in unit test environments (no terminal session). This forces a natural split:

| Tier | What | How |
|------|------|-----|
| **Unit** | State transitions, reducer logic, pure functions | `renderHook()` + `dispatch()` |
| **Integration** | Keyboard input, user flows, mode transitions | `render()` + `stdin.write()` + `lastFrame()` |

### Required Cleanup

Every integration test file using `render()` MUST include:

```typescript
import { cleanup, render } from 'ink-testing-library';

afterEach(() => {
    // Ink rendering accumulates handlers across tests, must cleanup for test isolation
    cleanup();
});
```

Bun runs all test files in a single process. Without `cleanup()`, Ink instances accumulate signal handlers (60+ across the suite), causing resource contention and flaky failures.

### Keyboard Input via ANSI Escape Sequences

```typescript
// Use shared key constants, not raw escape codes
import { Keys } from '~/test-utils/ink-helpers';

stdin.write(Keys.DOWN_ARROW);    // '\x1B[B'
stdin.write(Keys.UP_ARROW);      // '\x1B[A'
stdin.write(Keys.ENTER);         // '\r'
stdin.write(Keys.ESCAPE);        // '\x1B'
stdin.write(Keys.SHIFT_DOWN);    // '\x1B[1;2B'
```

### Pinned Terminal Dimensions

```typescript
// test-utils/test-setup.ts — ensures deterministic rendering
Object.defineProperty(process.stdout, 'columns', {
    get: () => 80, set: () => {}, configurable: true,
});
Object.defineProperty(process.stdout, 'rows', {
    get: () => 24, set: () => {}, configurable: true,
});
```

The no-op setters prevent flaky failures from color detection libraries writing to `columns`/`rows`.

---

## Test Organization

### Feature-Based Directory Structure

Organize by what's being tested, not by architectural layer. When a feature changes, all related tests are in one place.

### One Root `describe` Per File

Enforced by ESLint rule `test-describe-matches-filename`. The describe name encodes location:

```typescript
// tests/integration/ui/feedback/delete-behavior.integration.test.tsx
describe('feedback delete-behavior integration', () => { ... });

// tests/integration/claude-hook/hook-happy-path.integration.test.ts
describe('claude-hook hook-happy-path integration', () => { ... });
```

### Test Naming: Describe Behavior

```typescript
// Good: describes what the user sees
test('opens long plan at top with cursor on line 1', ...);
test('marks line as deleted with strikethrough styling', ...);

// Bad: describes implementation
test('sets scrollOffset to 0 on initial render', ...);
test('adds entry to deletedLines Set', ...);
```

### Arrange-Act-Assert Pattern

```typescript
test('adds comment to selected line', async () => {
    // Arrange
    const file = useTempPlanFile('Line 1\nLine 2\nLine 3');
    const { stdin, lastFrame } = render(<App mode="file" filepath={file} />);
    await waitFor(() => expect(lastFrame()).toContain('Line 1'));

    // Act
    stdin.write(Keys.DOWN_ARROW);
    stdin.write('c');
    await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

    // Assert
    expect(isInCommentMode(lastFrame()!)).toBe(true);
});
```

---

## Assertions and Readability

### Semantic Over Structural

```typescript
// Bad: tests ANSI implementation
expect(frame).toContain('\x1B[9m');
expect(frame).toContain('\x1B[48;2;80;80;80m');

// Good: tests observable behavior
expect(isLineDeleted(frame, 'Line 1')).toBe(true);
expect(hasCursorHighlight(frame, 'Line 2')).toBe(true);
```

### Explicit State Verification

```typescript
// Bad: only checks end state
stdin.write('x');
expect(isLineDeleted(lastFrame()!, 'Line 1')).toBe(true);

// Good: verifies before AND after
const frameBefore = lastFrame()!;
expect(isLineNotDeleted(frameBefore, 'Line 1')).toBe(true);  // Pre-condition

stdin.write('x');
await waitFor(() => expect(isLineDeleted(lastFrame()!, 'Line 1')).toBe(true));

const frameAfter = lastFrame()!;
expect(isLineDeleted(frameAfter, 'Line 1')).toBe(true);      // Post-condition
expect(isLineNotDeleted(frameAfter, 'Line 2')).toBe(true);   // No side effects
```

---

## Async Patterns

### `waitFor()` Over `sleep()`

```typescript
// Anti-pattern: arbitrary sleep
stdin.write(Keys.DOWN_ARROW);
await new Promise((resolve) => setTimeout(resolve, 200));
expect(lastFrame()).toContain('Line 2');  // Fragile — may need 300ms in CI

// Correct: assertion-retry polling
stdin.write(Keys.DOWN_ARROW);
await waitFor(() => expect(lastFrame()).toContain('Line 2'));
```

### When Small Delays Are Acceptable

Use delays only for **mechanical timing** (allowing event loops to process), not for **waiting for business logic**:

- Between rapid `stdin.write()` calls to prevent input buffering
- After initial render to allow component tree mounting

---

## Snapshot Guidelines

### When to Use Snapshots

- Where **visual layout IS the behavior** being tested (deletion strikethrough, selection highlighting)
- As a **safety net supplement** to explicit assertions, not a replacement
- For **stable, deterministic output** only

### When NOT to Use Snapshots

- As the **sole assertion** in a test
- For **large outputs** (more than a few dozen lines)
- For **static views** already covered by unit tests
- For **third-party library output** (e.g., lowlight syntax highlighting)
- For outputs that **vary by environment** (terminal width, colors)

### Snapshot Best Practices

- Keep small and focused — one specific output, not an entire component tree
- Always pair with explicit assertions
- Review updates with the same scrutiny as production code
- Normalize volatile data (timestamps, paths)
- Minimal width matrix (2 widths, not 4) — only test widths where behavior actually differs

---

## Test Isolation and Cleanup

### What Must Be Cleaned Up

| Resource | Method | Risk if Skipped |
|----------|--------|-----------------|
| Ink render instances | `cleanup()` in `afterEach` | Signal handler accumulation |
| Temp files/directories | Auto-scoped `useTempDir()` | Disk space, test interference |
| Unix sockets | Auto-scoped `useTestSocket()` | Path collisions, connection errors |
| Mocks/spies | `mockRestore()` in `afterEach` | Stale mock data |
| Global state | Restore originals in `afterEach` | Modified globals leak |

### Detecting Isolation Failures

**Symptoms:** test passes alone but fails with others, tests fail in different order, flaky results, skipping one test breaks another.

**Diagnosis:** Run failing test in isolation → if it passes, shared state is the issue → bisect to find the interfering test → check for global mutations, unreset mocks, uncleaned resources.

---

## Sources

### Testing Philosophy
- [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests) — Kent C. Dodds
- [The Testing Trophy and Testing Classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) — Kent C. Dodds

### React Testing
- [React Testing Library Introduction](https://testing-library.com/docs/react-testing-library/intro/)
- [Common Mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) — Kent C. Dodds

### Ink Testing
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library) — Vadim Demedes
- [Ink Repository](https://github.com/vadimdemedes/ink)

### Anti-Patterns
- [Software Testing Anti-patterns](https://blog.codepipes.com/testing/software-testing-antipatterns.html) — Kostis Kapelonis
- [Unit Testing Anti-Patterns Full List](https://dzone.com/articles/unit-testing-anti-patterns-full-list)

### Snapshot Testing
- [Effective Snapshot Testing](https://kentcdodds.com/blog/effective-snapshot-testing) — Kent C. Dodds
- [The Case Against React Snapshot Testing](https://engineering.ezcater.com/the-case-against-react-snapshot-testing) — ezCater Engineering

### Async Testing
- [Testing Library Async Methods](https://testing-library.com/docs/dom-testing-library/api-async/)
- [JavaScript waitFor Polling](https://davidwalsh.name/waitfor) — David Walsh

### Organization
- [Arrange-Act-Assert Pattern](https://automationpanda.com/2020/07/07/arrange-act-assert-a-pattern-for-writing-good-tests/) — Automation Panda
