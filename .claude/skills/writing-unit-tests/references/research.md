# Unit Testing Research: Quality & Organization

Research compiled from: code changes since `527cfcc`, Claude Code session learnings (2026-02-18), and industry best practices for TypeScript/React unit testing.

---

## Part 1: What We Changed (Code Analysis)

44 commits since `527cfcc` systematically improved test quality, organization, and maintainability.

### 1.1 Co-located Tests with Feature-Based Hierarchy

**Before:** Flat `src/components/` with tests alongside unrelated files.

**After:** Nested by feature, tests co-located with source:

```
src/components/PlanView/Plan/CodeLine/CodeLine.test.tsx
src/components/PlanView/InlineView/inputs/CommentInput/CommentInput.test.tsx
src/components/shared/StyledText/StyledText.test.tsx
```

Similarly, `src/utils/` went from flat to categorized (`feedback/`, `config/`, `io/`, `rendering/`).

**Why:** Co-location makes it immediately clear what is tested, encourages writing tests alongside new features, and mirrors the component hierarchy.

### 1.2 Massive Hook Test Expansion

| Metric | Before | After |
|--------|--------|-------|
| Hook test files | 2 (1 substantive) | 8 |
| Hook test lines | ~302 | ~6,877 |

New tests for: `useCommandKeys`, `useCommentKeys`, `useConfirmKeys`, `useFeedbackKeys`, `usePlanLoader`, `useQuestionKeys`. Each follows the dispatch-based pattern since Ink's `useInput` returns no-op in test environments.

### 1.3 Integration Test Reorganization

**Before:** 16 files in flat `tests/integration/` directory.

**After:** 21 files in 4-category hierarchy:

```
tests/integration/
├── claude-hook/     # 5 files (split from 1 monolith)
├── e2e/             # End-to-end workflows
├── infrastructure/  # Socket IPC
└── ui/
    ├── navigation/  # Scrolling, jumping, paging
    ├── feedback/    # Comments, questions, deletions
    ├── markdown/    # Code blocks, syntax highlighting
    ├── decision/    # Approve/deny flows
    └── views/       # Help view, error view
```

### 1.4 Auto-Scoped Test Fixtures

**Before:** Manual `cleanupTempFiles()` in `afterAll` -- error-prone, leaks on failure.

**After:** Auto-cleanup registered at creation time:

```typescript
export function useTempDir(prefix = 'planderson-test-'): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}
```

Three fixture modules: `useTempDir()`/`useTempPlanFile()`, `useTestSocket()`, `useTestSettings()`.

### 1.5 Semantic Test Assertion Helpers

**Before:** Raw ANSI escape code assertions:

```typescript
expect(frame).toContain('\x1B[9m'); // strikethrough?
```

**After:** Named semantic helpers:

```typescript
expect(isLineDeleted(frame, 'Line 1')).toBe(true);
expect(getCursorLine(frame)).toBe('Line 1');
expect(isInHelpView(frame)).toBe(true);
```

Three modules: `visual-assertions.ts`, `feedback-assertions.ts`, `view-assertions.ts`.

### 1.6 Snapshot Rationalization

| Metric | Before | After |
|--------|--------|-------|
| Snapshot files | 7 | 3 |
| Snapshot count | 77 | 44 |
| Width matrix | 4 widths | 2 widths |

Removed snapshots for simple static views (ErrorView, LoadingView, HelpView, syntax-highlighter). Replaced behavior-verification snapshots with semantic assertions. Kept snapshots only where visual layout IS the behavior being tested.

### 1.7 ESLint Rules for Test Structure

Two custom rules enforce consistency:

- **`test-single-describe`** -- Exactly one root `describe` per test file.
- **`test-describe-matches-filename`** -- Root `describe` name matches filename (auto-fixable).

### 1.8 Test Stability Infrastructure

- **Pinned terminal dimensions** (80x24 with no-op setters) prevent flaky snapshots across environments.
- **`FORCE_COLOR=3`** and `stdout.isTTY = true` ensure consistent rendering.
- **Ink `cleanup()` inlined** into each integration test file for visibility.

---

## Part 2: What We Learned (Session Insights)

Learnings extracted from 16 Claude Code sessions on 2026-02-18.

### 2.1 Mock Module Contamination (Bun-Specific)

Bun bug (#12823): `mock.module()` calls leak between test files in a single process. No `mock.restore()` exists for module mocks. One file (`usePlanLoader.test.ts`) mocking 3 modules caused 73/76 failures across unrelated files.

**Principle:** Avoid `mock.module()` unless absolutely necessary. Before adding any mock, ask whether it's actually needed.

### 2.2 Test the Real Thing, Not a Fake

`settings.integration.test.ts` reimplemented `loadSettings()` as a local clone. All tests validated the copy, not the actual function. Deleted entirely since unit tests already covered the real function.

**Principle:** Tests that validate reimplemented fakes of real functions provide zero value and create false confidence.

### 2.3 Dead Code Should Be Removed, Not Tested

`WrappedLine.tsx` had a legacy rendering fallback that could never execute in production. The fallback had a React bug that caused CI failures. Removed the dead code and its tests; made the field required in types.

**Principle:** Tests for dead code paths are worse than no tests -- they create the illusion of coverage.

### 2.4 Systematic Quality Questions

The most insightful questions applied to each test area:

1. **What is this test actually testing?** -- Many tested fakes, not real code.
2. **Does this duplicate coverage from another test?** -- Significant duplication found between integration and unit tests.
3. **Is this testing behavior or implementation details?** -- Tests asserting internal buffer states or exit codes were removed.
4. **Does this test have meaningful assertions?** -- Tests with `expect(true).toBe(true)` were identified and fixed.
5. **Is this test in the right tier?** -- Pure function calls with no I/O moved from integration to unit tests.

### 2.5 Remove Unused Test Utilities Aggressively

Removed: 2 entire unused assertion files, 4 unused exports from `ink-helpers.ts`, unused fixture re-exports, and functions only used by their own self-tests.

**Principle:** Test utilities follow YAGNI. If a helper is only tested to prove it works but never used by actual tests, delete it.

### 2.6 Temp Files Must Use System Temp Directories

`scripts.test.ts` used `tmp/test-fixtures` under the project root, polluting the working tree. Fixed to use `os.tmpdir()`.

---

## Part 3: Industry Best Practices

Research from Kent C. Dodds, Testing Library docs, and TypeScript testing guides.

### 3.1 Core Principle: Test Behavior, Not Implementation

*"The more your tests resemble the way your software is used, the more confidence they can give you."* -- Kent C. Dodds

- **End users** interact with rendered output (text, visual state).
- **Developers** pass props to components.
- Test what they experience, not internal state or method calls.

### 3.2 Arrange-Act-Assert Pattern

Every test should have three clearly distinct phases:

```typescript
test('SAVE_COMMENT removes comment if text is empty', () => {
    // Arrange
    const state = { ...createInitialState(), comments: new Map([[5, 'Old']]), currentCommentText: '' };

    // Act
    const newState = planViewReducer(state, { type: 'SAVE_COMMENT' });

    // Assert
    expect(newState.comments.has(5)).toBe(false);
});
```

### 3.3 FIRST Principles

| Principle | Meaning |
|-----------|---------|
| **Fast** | Milliseconds per test |
| **Isolated** | No test depends on another |
| **Repeatable** | Same result every time |
| **Self-validating** | Pass or fail, no interpretation needed |
| **Timely** | Written close in time to the code |

### 3.4 Hook Testing: `renderHook` + `act()`

```typescript
const { result } = renderHook(() => useTestHook(), { wrapper });
act(() => {
    result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
});
expect(result.current.state.cursorLine).toBe(5);
```

Rules:
- Always wrap state-updating calls in `act()`.
- Batch related updates in a single `act()`.
- Create reusable wrapper factories for provider requirements.

### 3.5 Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **Testing implementation details** | Tests break on refactor | Assert observable behavior |
| **Over-mocking** | Testing mock return values | Mock only boundaries (I/O, time) |
| **Snapshot overuse** | Giant snapshots nobody reviews | Semantic assertions for behavior |
| **Happy path only** | No error/edge coverage | Always test boundaries and failures |
| **Shared mutable state** | Tests pass alone, fail together | Each test creates own state |
| **Generous leftover** | Persistent data between tests | Auto-cleanup fixtures |

### 3.6 Ink/Terminal UI Two-Tier Testing

Ink's `useInput` returns no-op in test environments. This creates a natural split:

- **Unit tests:** State transitions via `dispatch` (reducer logic, hook state).
- **Integration tests:** Keyboard behavior via `stdin.write()` with full Ink render.

Integration tests require:
- `afterEach(() => { cleanup(); })` -- Bun runs all files in one process.
- ANSI escape sequences for key simulation (e.g., `'\x1B[B'` for down arrow).
- `waitFor` helpers for async rendering.

### 3.7 What to Test vs. Not Test

**Test:**
- Rendering based on props
- User interactions and their outcomes
- Conditional rendering
- Edge cases (empty states, error states, boundaries)
- Callback invocations with correct arguments

**Don't test:**
- Internal state variables (test the visual result instead)
- Implementation method names
- Third-party library internals
- CSS/styling details (unless they affect behavior)

---

## Summary: Impact Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Unit test files in `src/` | 38 | 44 | +6 |
| Hook test files | 2 | 8 | +6 |
| Hook test lines | ~302 | ~6,877 | +6,575 |
| Integration test files | 16 (flat) | 21 (hierarchy) | Reorganized |
| Snapshot count | 77 | 44 | -33 |
| Test assertion helpers | 0 | 3 modules | +467 lines |
| Auto-scoped fixtures | 0 | 3 modules | Automatic cleanup |
| Custom ESLint rules | 0 | 2 rules | Structural enforcement |

---

## Sources

### Web Resources
- [Testing Implementation Details - Kent C. Dodds](https://kentcdodds.com/blog/testing-implementation-details)
- [Avoid Nesting When You're Testing - Kent C. Dodds](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing)
- [How to Test Custom React Hooks - Kent C. Dodds](https://kentcdodds.com/blog/how-to-test-custom-react-hooks)
- [Common Mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Effective Snapshot Testing - Kent C. Dodds](https://kentcdodds.com/blog/effective-snapshot-testing)
- [ink-testing-library - GitHub](https://github.com/vadimdemedes/ink-testing-library)
- [Unit Testing Anti-Patterns - DZone](https://dzone.com/articles/unit-testing-anti-patterns-full-list)
- [Software Testing Anti-patterns - Codepipes](https://blog.codepipes.com/testing/software-testing-antipatterns.html)

