# Writing Snapshot Tests: Research & Findings

Research compiled from three sources to inform the `/writing-snapshot-tests` skill:
1. **Code changes** -- Analysis of snapshot test improvements since commit 527cfcc
2. **Session learnings** -- Lessons from today's snapshot refactoring sessions
3. **Industry best practices** -- Web research on TypeScript/React/Ink snapshot testing

---

## Table of Contents

1. [Core Principle: When to Use Snapshots](#1-core-principle-when-to-use-snapshots)
2. [Anti-Patterns We Fixed](#2-anti-patterns-we-fixed)
3. [Anti-Patterns from Industry](#3-anti-patterns-from-industry)
4. [Organization & Structure Patterns](#4-organization--structure-patterns)
5. [Size & Granularity](#5-size--granularity)
6. [Ink/Terminal-Specific Patterns](#6-inkterminal-specific-patterns)
7. [Maintenance & Review](#7-maintenance--review)
8. [Semantic Assertions vs Snapshots](#8-semantic-assertions-vs-snapshots)
9. [Decision Framework](#9-decision-framework)
10. [Sources](#10-sources)

---

## 1. Core Principle: When to Use Snapshots

**Snapshots are appropriate when visual layout IS the behavior being tested.**

Snapshots verify "same as before" -- not "correct." They catch regressions but don't validate correctness. Use them only when the precise arrangement of visual elements (colors, positions, ANSI codes, wrapping) constitutes the actual feature being verified.

The litmus test: **"If I change a border style, should this test break?"** If no, use semantic assertions instead.

### Good snapshot candidates (from our codebase)

- `Plan` component -- multi-line selection highlighting, delete visual states, feedback rendering with wrapping
- `InlineView` component -- command mode cursor, comment input layout, confirm/deny dialogs at different widths
- `WrappedLine` component -- horizontal rules, blockquote formatting, heading styles, wrapped feedback

### Bad snapshot candidates (removed from our codebase)

- `ErrorView` -- simple static text, already covered by `toContain()` assertions
- `LoadingView` -- two modes fully covered by behavioral unit tests
- `HelpView` -- static text layout, alignment test with `stripAnsi()` already covered it
- `syntax-highlighter` -- tested third-party `lowlight` output, not our rendering logic

---

## 2. Anti-Patterns We Fixed

These anti-patterns were found and fixed in our codebase during the snapshot refactoring.

### Anti-pattern 1: Width-invariant snapshot duplication

ErrorView was tested at 4 widths (40, 60, 80, 120) but produced **identical output at all widths** because it doesn't use terminal width for layout. Same for HelpView and LoadingView. 12 snapshots each, pure duplication.

**Fix:** Removed snapshot tests entirely for these static views. Unit tests with explicit assertions already covered the behavior.

### Anti-pattern 2: Excessive width matrix

The width matrix tested 4 widths (40, 60, 80, 120) but meaningful differences only appeared between narrow and standard widths. The 60-column and 120-column tests never caught unique bugs.

**Fix:** Reduced from 4 widths to 2: `NARROW: 40` and `STANDARD: 80`.

### Anti-pattern 3: Giant integration test snapshots

Integration tests captured the **entire rendered frame** including headers, borders, separators, and all ANSI codes. Any cosmetic change broke these tests even when the behavior under test was unaffected.

**Fix:** Replaced with semantic assertion helpers (`isLineDeleted()`, `getCursorLine()`, `countDeletedLines()`). Went from 5 opaque snapshot checks to 26 explicit assertions, each documenting a specific behavior.

### Anti-pattern 4: Snapshotting third-party library output

`syntax-highlighter.test.ts.snap` was **3,979 lines** of serialized `lowlight` token output. These validated lowlight's behavior, not ours. When lowlight updated, snapshots broke without any actual regression.

**Fix:** Deleted entirely. Unit tests checking specific tokens and colors cover our custom logic.

### Anti-pattern 5: Snapshots for static views covered by unit tests

ErrorView (97 lines), LoadingView (25 lines), HelpView (493 lines) all had snapshot files for components that just render static text. Unit tests with `toContain()` already verified the same content.

**Fix:** Removed all three snapshot files.

### Anti-pattern 6: Over-engineered snapshot helpers

Original `snapshot-helpers.ts` (90 lines) had `normalizeSnapshot()` with `stripSessionIds` option (never used), `assertLayoutInvariants()` (used once), `MEDIUM: 60` and `WIDE: 120` (removed), `options?: { skip?: number[] }` (never used).

**Fix:** Simplified to 29 lines -- three exports, zero options. YAGNI.

### Anti-pattern 7: Stale snapshot files

PlanView had a 410-line snapshot file referencing an outdated component structure after reorganization.

**Fix:** Deleted. Snapshots must match the current component structure.

### Results

- **77 snapshots → 44 snapshots** (43% reduction)
- **~4,400 lines of snapshot files removed**
- Higher signal-to-noise ratio in remaining snapshots

---

## 3. Anti-Patterns from Industry

From web research across multiple sources.

| Anti-Pattern | Why It's Bad | Fix |
|---|---|---|
| **Huge snapshots (100+ lines)** | Nobody reviews a 500-line diff carefully. Developers blindly update. | Keep under 50 lines. Use inline for <6 lines. |
| **Blind `--update-snapshots`** | Commits bugs and locks them into the golden master. | Always inspect diff before updating. |
| **Vague test names** ("renders correctly") | No guidance on what behavior broke when test fails. | Use behavior-oriented names: "renders comment indicator above annotated line" |
| **Testing implementation details** | A change in a shared child component breaks hundreds of unrelated tests. | Mock child components. Test only the component under test. |
| **Snapshots as the only test** | Verifies "same as before" not "correct." First run can lock in wrong output. | Use snapshots as complement to behavioral assertions. |
| **Not handling dynamic values** | Timestamps, IDs, paths cause constant false failures. | Use property matchers (`expect.any(Date)`), custom serializers, or normalize. |
| **No cleanup between tests** | Ink render instances accumulate signal handlers, causing flaky failures. | Always `afterEach(() => { cleanup(); })`. |

---

## 4. Organization & Structure Patterns

### Conventions established in our codebase

1. **Snapshot tests go in `describe('Visual Snapshots', ...)` blocks** at the end of the test file, after all behavioral tests.

2. **Snapshot test names use `snapshot:` prefix** for identification in test output (e.g., `'snapshot: multi-line selection with comment on selected lines'`).

3. **Width matrix is exactly 2:** `NARROW: 40` and `STANDARD: 80`. No exceptions unless a bug requires a specific width to reproduce.

4. **Width-invariant modes get single-width snapshots.** InlineView command mode renders `:a▊` regardless of width -- no need for multi-width snapshots.

5. **Co-located `__snapshots__/` directories** follow standard convention, adjacent to test files.

6. **Centralized snapshot fixtures** in `test-utils/snapshot-fixtures.ts` provide stable test data so snapshots only change due to rendering changes, not test data variations.

### Industry conventions

- **Inline snapshots (`toMatchInlineSnapshot()`)** for small outputs (<6 lines) -- self-limiting, visible in code review
- **External snapshots** for larger structural outputs -- standard `__snapshots__/` convention
- **Hybrid approach** recommended: inline for small, external for larger, semantic assertions for behavior
- **One snapshot per test, one component per snapshot** -- test one thing at a time

---

## 5. Size & Granularity

### Quantitative guidelines

| Metric | Recommendation | Source |
|--------|---------------|--------|
| External snapshot max lines | 50 lines | eslint-plugin-jest `no-large-snapshots` default |
| Inline snapshot max lines | 6-10 lines | Community consensus |
| Snapshots per test | 1 | One setup, one snapshot |
| Components per snapshot | 1 (mock others) | Jest docs, community best practices |

### When a snapshot is too big

- A reviewer would not read the entire diff line by line
- It takes more than a few seconds to understand what it verifies
- Changes in unrelated child components cause it to fail
- The snapshot file is longer than the source file it tests

### ESLint enforcement

```json
{
    "rules": {
        "jest/no-large-snapshots": ["warn", { "maxSize": 50, "inlineMaxSize": 6 }]
    }
}
```

---

## 6. Ink/Terminal-Specific Patterns

### Terminal dimensions must be pinned

In test setup, pin dimensions to prevent environment-dependent snapshot drift:

```typescript
process.stdout.columns = 80;
process.stdout.rows = 24;
```

Combined with `FORCE_COLOR=3` and `stdout.isTTY = true` for consistent ANSI output across CI and local.

### ANSI escape codes in snapshots

Terminal output contains ANSI sequences for colors, bold, underline, strikethrough. These appear verbatim in snapshots.

**Strategies:**
- **Accept ANSI codes** when styling IS the feature (deletion strikethrough, cursor highlight)
- **Strip ANSI** when testing content only (use `strip-ansi` or `stripAnsi()`)
- **Semantic assertion helpers** for ANSI-aware checks without coupling to exact sequences

### Cleanup is mandatory

```typescript
import { cleanup } from 'ink-testing-library';
afterEach(() => { cleanup(); });
```

Ink render instances accumulate signal handlers across tests (Bun runs all files in one process).

### ink-testing-library API

| Method | Use for snapshots |
|--------|-------------------|
| `lastFrame()` | Primary -- returns most recent rendered terminal output as a string |
| `frames` | Rarely -- captures every intermediate render, creates noise |
| `rerender(tree)` | State transitions -- re-render with new props then snapshot again |

---

## 7. Maintenance & Review

### Code review discipline

1. Review snapshot diffs with the same rigor as code changes
2. Question large snapshot diffs -- is it a legitimate refactor or over-coupling?
3. Verify intent before updating -- "Is this change intentional?"
4. Use snapshot hints for context: `toMatchSnapshot('header with 3 feedback items')`

### Update workflow

```bash
# 1. Review what changed first
bun run test:snapshots 2>&1

# 2. Update only after confirming changes are intentional
bun run test:snapshots:update

# 3. Verify the updated snapshots
git diff __snapshots__/
```

**Never** run `--update-snapshots` as a first reaction to failures.

### Staleness detection

Periodically audit: Can each snapshot test be explained by its name alone? If not, replace with a semantic assertion or remove it.

---

## 8. Semantic Assertions vs Snapshots

### When to use semantic assertions (always preferred when practical)

| Scenario | Example |
|----------|---------|
| Specific behavior verification | `expect(isLineDeleted(frame, 'Line 1')).toBe(true)` |
| Conditional rendering | "when X, show Y" |
| User interaction outcomes | After keypress, verify cursor position |
| Static text content | `expect(frame).toContain('Error: ...')` |

### When to use snapshots

| Scenario | Example |
|----------|---------|
| Visual layout IS the behavior | Multi-line selection with syntax highlighting, wrapped feedback |
| Complex rendering pipeline | Markdown → AST → Ink components at specific width |
| Regression detection for visual output | Catch unintended changes in ANSI formatting |

### Our semantic assertion helpers

Created in `test-utils/` to replace snapshot-based integration tests:

- `visual-assertions.ts` -- `isLineDeleted()`, `getCursorLine()`, `hasCursorHighlight()`, `hasStrikethrough()`
- `feedback-assertions.ts` -- Feedback-specific checks
- `view-assertions.ts` -- `isInHelpView()`, view state checks

**Comparison:**
```typescript
// BEFORE (anti-pattern): opaque snapshot
expect(lastFrame()).toMatchSnapshot(); // 30+ lines of ANSI codes

// AFTER (clear intent): 26 explicit assertions
expect(isLineDeleted(frame, 'Line 1')).toBe(true);
expect(getCursorLine(frame)).toBe('Line 1');
expect(countDeletedLines(frame)).toBe(3);
```

---

## 9. Decision Framework

### Should I use a snapshot here?

```
Is the output complex and serializable?
  No  --> Use semantic assertion
  Yes --> Is visual layout the actual behavior being tested?
            No  --> Use semantic assertion
            Yes --> Is the output small (< 6 lines)?
                      Yes --> Use toMatchInlineSnapshot()
                      No  --> Is it under 50 lines?
                                Yes --> Use toMatchSnapshot() with descriptive name
                                No  --> Break into smaller, focused tests
```

### Quick litmus tests

1. **"If I change a border style, should this test break?"** -- If no, use semantic assertions.
2. **"Can a reviewer read the entire snapshot diff?"** -- If no, it's too big.
3. **"Does this test third-party library output?"** -- If yes, don't snapshot it.
4. **"Is this static text already covered by `toContain()` assertions?"** -- If yes, no snapshot needed.
5. **"Does this output vary by terminal width?"** -- If no, don't test at multiple widths.

---

## 10. Sources

### Our codebase

- Commit `e967b0a` -- Main snapshot trim (77→44 snapshots, -4,400 lines)
- Commit `59e44b0` -- Replaced integration snapshots with semantic assertion helpers
- Commit `0ab2884` -- Created feedback/view/visual assertion helpers
- `test-utils/snapshot-helpers.ts` -- Width matrix and normalization
- `test-utils/snapshot-fixtures.ts` -- Centralized test data
- `test-utils/visual-assertions.ts` -- ANSI-aware semantic helpers

### Industry

- [Jest: Snapshot Testing](https://jestjs.io/docs/snapshot-testing)
- [Kent C. Dodds: Effective Snapshot Testing](https://kentcdodds.com/blog/effective-snapshot-testing)
- [Artem Sapegin: What's Wrong with Snapshot Tests](https://sapegin.me/blog/snapshot-tests/)
- [ezCater: The Case Against React Snapshot Testing](https://engineering.ezcater.com/the-case-against-react-snapshot-testing)
- [SitePen: Snapshot Testing Benefits and Drawbacks](https://www.sitepen.com/blog/snapshot-testing-benefits-and-drawbacks)
- [TSH.io: Pros and Cons of Jest Snapshot Tests](https://tsh.io/blog/pros-and-cons-of-jest-snapshot-tests)
- [Sam Hogarth: Making the Most of Snapshot Testing](https://samhogy.co.uk/2022/03/making-the-most-of-snapshot-testing/)
- [Bun: Snapshots](https://bun.com/docs/test/snapshots)
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library)
- [eslint-plugin-jest: no-large-snapshots](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-large-snapshots.md)
- [snapshot-diff](https://github.com/jest-community/snapshot-diff)
- [Vitest: Snapshot Guide](https://vitest.dev/guide/snapshot)
