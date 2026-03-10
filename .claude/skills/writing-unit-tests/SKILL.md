---
name: writing-unit-tests
description: Use when writing, creating, or modifying unit tests (.test.ts/.test.tsx files). Use when asked to "add tests", "write tests", "test this", or when implementing features that need test coverage. Also use when unit tests fail and need fixing.
---

# Writing Unit Tests

Test **behavior, not implementation**. Every test answers: "Given this input, does the right thing happen?"

The testing rule has already dispatched you here and loaded shared conventions (describe naming, fixture scoping, `mock.module()` prohibition, Bun quirks). This skill is the deep reference for patterns, anti-patterns, and mocking nuances.

## Test File Structure

```typescript
import { describe, expect, test } from 'bun:test';

// ===== Mock Helpers ===== (if needed)
const createMockThing = (): Thing => { ... };

// ===== Tests =====
describe('module-name', () => {
    describe('functionName', () => {
        test('returns X when given Y', () => {
            // Arrange
            const input = createInput();

            // Act
            const result = functionName(input);

            // Assert
            expect(result).toBe(expected);
        });
    });
});
```

## Descriptive Test Names

```typescript
// BAD
test('singular', () => { ... });
test('works correctly', () => { ... });

// GOOD
test('formats single comment with singular form', () => { ... });
test('returns empty array when no feedback exists', () => { ... });
```

## Arrange-Act-Assert

Every test has three clear phases separated by blank lines.

## What to Test / Not Test

**Test:** Pure function I/O, state transitions, conditional rendering, edge cases (empty, boundaries, errors), immutability.

**Don't test:** Internal state variables (test observable result), third-party library behavior, dead code paths (remove them instead), implementation details.

## Hook Testing

Ink's `useInput` returns no-op in test environments. Unit test hooks via **dispatch**, not keyboard input.

**Include this header comment** in every hook test file:
```typescript
/**
 * TESTING APPROACH: Reducer Logic via Dispatch
 *
 * These tests validate state transitions by manually dispatching actions.
 * We cannot test keyboard input at the unit level because Ink's useInput
 * hook returns no-op values in test environments (no terminal session).
 */
```

**Wrapper factory pattern:**
```typescript
const createWrapper = (props = createDefaultProps()) => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <TerminalProvider terminalWidth={80} terminalHeight={24}>
            <PlanViewProvider {...props}>{children}</PlanViewProvider>
        </TerminalProvider>
    );
    Wrapper.displayName = 'TestWrapper';
    return Wrapper;
};
```

## Visual Assertions for Terminal Output

When testing terminal UI (Ink), test **what users see**, not how it's rendered.

### General Principles

**1. Test existence vs positioning vs styling**

Different visual aspects require different approaches:

- **Existence**: Is the element present? → `expect(output).toContain('text')`
- **Positioning**: Where is it relative to other elements? → Test ordering/location
- **Styling**: What color/formatting? → Check ANSI codes or use helpers

**2. When to test positioning/ordering**

Test positioning when the **order matters semantically**:
- Cursor must follow text (not just exist somewhere)
- Error message must appear above the error line
- Selected items must appear in correct sequence

Don't test positioning for:
- Layout details (padding, alignment) - snapshot tests handle this
- Visual grouping that doesn't affect meaning

**3. When to test colors/styling**

Test colors/styling when they **convey semantic meaning**:
- Deleted lines shown with strikethrough
- Cursor character shown with inverted colors
- Error text shown in red

Don't test colors for:
- Decorative styling (borders, themes)
- Exact color values (test semantic meaning, not hex codes)

**4. Use helpers for patterns, inline checks for one-offs**

**When to create a helper:**
- Testing the same visual pattern 3+ times
- Complex ANSI code combinations
- Pattern has semantic meaning ("deleted", "highlighted", "cursor at end")

**When to use inline checks:**
- One-off assertion specific to single test
- Simple existence check: `expect(output).toContain('text')`

### Common Mistakes

```typescript
// BAD - Tests existence without position
test('renders text and cursor', () => {
    const output = render(<Input text="hello" />);
    expect(output).toContain('hello');
    expect(output).toContain('█'); // Cursor could be anywhere!
});

// GOOD - Tests positioning
test('renders cursor at end of text', () => {
    const output = render(<Input text="hello" />);
    expect(stripAnsi(output)).toContain('hello█'); // Verifies order
});

// ---

// BAD - Tests structure after stripping visual info
test('cursor on character', () => {
    const output = render(<Input text="hello" cursor={2} />);
    const stripped = stripAnsi(output);
    expect(stripped[2]).toBe('l'); // Lost cursor info!
});

// GOOD - Tests visual rendering with ANSI codes
test('cursor on character', () => {
    const output = render(<Input text="hello" cursor={2} />);
    // Check for pattern: text before + inverted 'l' + text after
    expect(hasCursorOnChar(output, 'he', 'l')).toBe(true);
});

// ---

// BAD - Checks for ANSI code anywhere
test('has white background', () => {
    const output = render(<Input />);
    expect(output).toContain('\x1b[47m'); // Doesn't verify WHICH char
});

// GOOD - Checks ANSI code on specific element
test('cursor character has white background', () => {
    const output = render(<Input text="hello" cursor={2} />);
    // Pattern verifies: 'he' + white_bg + 'l'
    expect(hasCursorOnChar(output, 'he', 'l')).toBe(true);
});
```

### Adding New Visual Helpers

**Before writing raw ANSI checks, ask:**
1. Does a helper already exist in `app/test-utils/visual-assertions.ts`?
2. Will I test this pattern again? (If yes, make a helper)
3. Is this a one-off edge case? (If yes, inline is fine)

**When creating helpers:**
- Add ANSI constants to `ansi-assertions.ts` first
- Add semantic helper functions to `visual-assertions.ts`
- Name helpers by **what they verify**, not how: `hasCursorAtEnd()` not `hasBlockCharAfterText()`
- Update existing tests to use the new helper

## Testing Shell Scripts and Config Files

Shell scripts and config files require a different approach than TypeScript code.

### Prefer Behavioral Tests

**Bad (implementation-focused):**
```typescript
test('script has error handling', () => {
    const content = readFileSync('script.sh', 'utf-8');
    expect(content).toContain('set -e');  // Tests HOW
});
```

**Good (behavior-focused):**
```typescript
test('exits with error when required argument missing', async () => {
    const proc = spawn({ cmd: ['/bin/bash', 'script.sh'] });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);  // Tests WHAT
    expect(stderr).toContain('Missing required argument');
});
```

### What to Test for Scripts

**Test (behavioral):**
- Script exits with correct code on success/failure
- Error messages contain expected content
- Files/directories created with correct permissions
- Script works from different working directories

**Don't test (implementation):**
- Specific variable names in the script
- Exact bash command syntax (`tmux swap-pane -s -t`)
- Order of internal operations
- Presence of specific strings like `set -e` or `command -v`

### When Implementation Tests Are Acceptable

Structural prerequisites only:
- Script exists and is executable
- Script has proper shebang (`#!/bin/bash`)
- Required external scripts exist

Everything else should be behavioral.

## Mocking Rules

1. **Mock only at boundaries** — filesystem, network, time.
2. **Before adding any mock, ask: is it actually needed?**
3. Use `beforeEach`/`afterEach` for mock setup/teardown with direct property assignment.
4. **Match import style when using `spyOn`** — In Bun, `import os from 'os'` (default) and `import * as os from 'os'` (namespace) are different objects. `spyOn(os, 'homedir')` only intercepts calls made through the same object. If the module under test uses `import * as os from 'os'`, the test must too — otherwise the spy silently has no effect and the real function runs.

```typescript
// settings.ts uses:  import * as os from 'os';

// BAD - default import in test; spy won't reach settings.ts
import os from 'os';
spyOn(os, 'homedir').mockReturnValue('/tmp/fake'); // no effect on settings.ts!

// GOOD - namespace import matches; spy intercepts correctly
import * as os from 'os';
spyOn(os, 'homedir').mockReturnValue('/tmp/fake'); // works
```

## Fixtures

Use auto-scoped fixtures from `app/test-utils/fixtures/`: `useTempDir()`, `useTempPlanFile()`, `useTestSocket()`. Auto-cleanup via `afterEach`. Always use `os.tmpdir()` — never create temp files under project root.

### Never Write to Real User Directories

Tests must never read from or write to real user config paths. If the code under test uses `os.homedir()` or `process.cwd()` to locate files, mock both in `beforeEach` and point them at a temp dir:

```typescript
import * as os from 'os'; // namespace import — must match what the module under test uses

beforeEach(() => {
    const tempDir = useTempDir();
    spyOn(os, 'homedir').mockReturnValue(tempDir);  // redirects ~/.planderson/... writes
    spyOn(process, 'cwd').mockReturnValue(tempDir); // redirects ./settings.json writes
    // pre-create any subdirs the code expects
    fs.mkdirSync(path.join(tempDir, '.planderson'), { recursive: true });
});

afterEach(() => {
    mock.restore();
});
```

If the module also calls a logger or other utility that uses `process.cwd()` for its own paths, silence it too to avoid noise:

```typescript
import { resetWriteFunction, setWriteFunction } from '~/utils/io/logger';

beforeEach(() => { setWriteFunction(() => {}); });
afterEach(() => { resetWriteFunction(); });
```

## Anti-Patterns (Mistakes We've Fixed Before)

**Never do these.** Each was found in this codebase and fixed.

| Anti-Pattern | Why It's Bad | What To Do Instead |
|---|---|---|
| Testing a reimplemented fake of a real function | Tests validate the copy, not the real code. False confidence. | Test the real function directly. |
| Testing dead code paths | Illusion of coverage for code that can never execute. | Remove the dead code and its tests. |
| `mock.module()` for anything | Bun #12823: leaks between files, caused 73/76 test failures from one file. | Direct property assignment (`fs.appendFileSync = () => {}`). |
| Mocks that are never triggered | Unnecessary mocks contaminate other test files for no benefit. | Before adding a mock, ask: does any test actually need this? |
| `expect(true).toBe(true)` or no real assertions | Gives green checkmark without testing anything. | Every test must assert observable behavior. |
| Giant snapshots (100+ lines) for behavior tests | Break on any cosmetic change, nobody reviews them. | Semantic assertions (`isLineDeleted()`, `getCursorLine()`). |
| Raw ANSI escape codes in assertions | Unreadable, fragile: `expect(frame).toContain('\x1B[9m')`. | Use helpers from `app/test-utils/*-assertions.ts`. |
| Manual cleanup in `afterAll` | Leaks resources if a test fails before reaching cleanup. | Auto-scoped fixtures (`useTempDir()`) with `afterEach`. |
| Temp files under project root | Pollutes working tree, gitignore issues. | `os.tmpdir()` or `useTempDir()` fixture. |
| Not mocking `os.homedir()`/`process.cwd()` when code uses them | Tests silently read/write real user files (`~/.planderson/settings.json`, `./settings.json`). Passes on developer machines, corrupts real config. | Mock both in `beforeEach`, point at `useTempDir()`. Use namespace import `import * as os from 'os'` to match the module under test. |
| Unused test utility functions | Maintenance burden, can mask real coverage gaps. | Delete helpers that no actual test imports. YAGNI. |
| Monolith test files (400+ lines, mixed concerns) | Hard to find tests, hard to understand coverage. | Split by concern into focused files. |
| Snapshots testing third-party output | Tests lowlight/remark behavior, not our code. | Only snapshot our rendering logic. |
| Testing script/config file content for specific strings | Brittle: breaks on harmless refactors. Tests HOW, not WHAT. | Run the script/code and test observable behavior (exit codes, error messages, side effects). |
| Redirecting to temp dir without creating all subdirectories | Code under test calls utilities (logger, registry, etc.) that write to their own subdirs. Missing dirs → ENOENT errors in stderr every test run. Tests still pass but output is noisy and hides real failures. | In `beforeEach`, create every subdirectory the module *and its dependencies* may write to (e.g. `sockets/`, `registry/`, `logs/`). |
| Testing existence without position/ordering | Two separate `.toContain()` checks verify both exist but not their order or relationship. | When order matters, check the pattern: `expect(output).toContain('text█')` or create helper. |
| Testing structure after stripping visual info | Checking character positions after `stripAnsi()` loses styling/cursor information. | Keep ANSI codes when testing visual elements; use helpers for complex patterns. |
| Checking for ANSI codes anywhere in output | `expect(output).toContain('\x1b[47m')` doesn't verify which element has that styling. | Test the full pattern (element + ANSI + content) using regex or semantic helper. |
| `spyOn` with mismatched import style | `import os from 'os'` and `import * as os from 'os'` are different objects in Bun. Spy on the default import when module uses namespace import → spy silently has no effect, real function runs. Tests pass but don't actually isolate anything. | Match the import style: if the module under test uses `import * as X`, the test must too. |

## Quick Reference

| Convention | Rule |
|-----------|------|
| Test names | Describe behavior: `'formats single comment with singular form'` |
| Structure | Arrange-Act-Assert with blank line separation |
| Assertions | Specific matchers (`toBe`, `toContain`), not `=== true` |
| Visual output | Test positioning when order matters; use helpers for repeated patterns |
| Styling/colors | Only test when it conveys semantic meaning (deleted, highlighted, etc) |
| Mocking | Mock only boundaries; match import style for `spyOn` |
| Fixtures | Auto-scoped `useTempDir()` etc.; `os.tmpdir()` always |
| Hook tests | Dispatch-based with header comment explaining approach |
| Co-location | Test file next to source file |

## Reference

See [research.md](references/research.md) for detailed research: code changes analysis, session learnings, and industry best practices.
