---
name: writing-snapshot-tests
description: Use when writing, creating, or modifying snapshot tests (.snapshot.test.ts/.snapshot.test.tsx files). Use when asked to "add snapshot tests", "test visual output", or when a component's visual layout is the behavior under test. Also use when snapshot tests fail and need investigation.
---

# Writing Snapshot Tests

> The testing rule has already dispatched you here. Shared conventions (describe naming, fixture scoping, mock.module() prohibition, Bun quirks) are in the rule — this skill covers snapshot-specific patterns only.

**Use snapshots only when visual layout IS the behavior being tested.** Snapshots verify "same as before" — not "correct." Prefer semantic assertions for everything else.

## Snapshots lock in decisions made with render-tui

Snapshots are regression guards: once you've verified in render-tui that the layout, colors, and structure look right, you add a snapshot to make sure future changes don't accidentally break those decisions.

**The workflow:**

1. Use render-tui during development until the output looks correct
2. Read the render-tui output file — copy exact ANSI sequences from it
3. Add the snapshot from that output

Snapshot content must come from render-tui output, not from memory. Mental-model snapshots silently lock in wrong color codes, wrong column positions, or wrong cursor characters.

```bash
bun run render-tui -- dev/plan-test.md --keys <sequence> --output /tmp/snapshot-check.txt
```

Then Read `/tmp/snapshot-check.txt`. Use those exact escape sequences. Verify specifically:
- **Exact ANSI** — color codes, cursor chars, escape sequences (copy directly, never construct from memory)
- **Column positions** — count leading bytes to confirm col 0 vs col 1 (do not infer from component code)
- **Color constants** — confirm e.g. `COLORS.SUBTLE` produces `\x1b[38;2;96;96;96m`, not a different shade

## The Litmus Test

Before writing a snapshot, ask: **"If I change a border style, should this test break?"**

- **Yes** → snapshot is appropriate (visual layout is the feature)
- **No** → use semantic assertions (`toContain()`, `toBe()`, assertion helpers)

## When to Use Snapshots

| Use snapshots for | Use semantic assertions for |
|---|---|
| Multi-line selection highlighting with ANSI codes | Static text content (`toContain('Error: ...')`) |
| Wrapped feedback rendering at different widths | Behavioral verification (`isLineDeleted()`, `getCursorLine()`) |
| Complex formatting combinations (bold + italic + code) | Conditional rendering ("when X, show Y") |
| Visual state transitions (deleted vs not deleted) | User interaction outcomes |
| Layout where ANSI arrangement IS the feature | Anything a simple view already covers with assertions |

**Never snapshot:** Third-party library output, static views already covered by unit tests, entire app frames in integration tests.

## Project Conventions

### 1. Separate Snapshot Files

Snapshot tests live in dedicated `*.snapshot.test.tsx` files, **separate from unit tests** (`*.test.tsx`):

```
app/src/components/PlanView/Plan/
  Plan.tsx                   # Component
  Plan.test.tsx              # Unit tests (semantic assertions)
  Plan.snapshot.test.tsx     # Snapshot tests (visual layout)
  __snapshots__/
    Plan.snapshot.test.tsx.snap
```

Root describe block must be suffixed with `snapshots` (enforced by ESLint). See the testing rule for the full naming pattern.

### 2. Required Boilerplate

Every snapshot test file MUST have:

```typescript
import { afterEach, describe, test, expect } from 'bun:test';
import { cleanup } from 'ink-testing-library';
import { render as inkRender } from 'ink-testing-library';
import React from 'react';

import { SNAPSHOT_FIXTURES } from '~/test-utils/snapshot-fixtures';
import { TERMINAL_WIDTHS, testAtAllWidths, normalizeSnapshot } from '~/test-utils/snapshot-helpers';

const render = (element: React.ReactElement, terminalWidth: number = 80) => {
    return inkRender(
        <TerminalProvider terminalWidth={terminalWidth} terminalHeight={24}>
            {element}
        </TerminalProvider>,
    );
};

describe('ComponentName snapshots', () => {
    afterEach(() => {
        cleanup();
    });

    // tests go here
});
```

**Critical:** `cleanup()` is mandatory — Bun runs all test files in a single process, Ink signal handlers accumulate without it.

### 3. Test Naming

Prefix snapshot test names with `snapshot:` for descriptive identification:

```typescript
// GOOD
test('snapshot: multi-line selection with comment on selected lines', () => { ... });
test('snapshot: single line deleted', () => { ... });

// BAD
test('renders correctly', () => { ... });
test('test 1', () => { ... });
```

### 4. Width Testing

Use exactly 2 widths: `NARROW: 40` and `STANDARD: 80`. No more.

```typescript
import { ALL_WIDTHS, TERMINAL_WIDTHS, testAtAllWidths, normalizeSnapshot } from '~/test-utils/snapshot-helpers';

// For width-sensitive components (wrapping, layout)
testAtAllWidths('renders with feedback', (width) => {
    const { lastFrame } = render(<Component />, width);
    return normalizeSnapshot(lastFrame());
});

// For width-invariant output, use a single width
test('snapshot: command mode cursor', () => {
    const { lastFrame } = render(<Component />, TERMINAL_WIDTHS.STANDARD);
    expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
});
```

**Rule:** If the output is identical across widths (e.g., command mode `:a▊`), use one width only. Don't duplicate identical snapshots.

### 5. Fixtures and Normalization

Always use centralized fixtures and normalize output:

```typescript
import { SNAPSHOT_FIXTURES } from '~/test-utils/snapshot-fixtures';
import { normalizeSnapshot } from '~/test-utils/snapshot-helpers';

// Use fixtures for stable test data
const props = { lines: SNAPSHOT_FIXTURES.simple.lines };

// Always normalize before matching
expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
```

## Size Limits

| Type | Max lines |
|------|-----------|
| External snapshot (`.snap` file) | 50 lines per snapshot |
| Inline snapshot (`toMatchInlineSnapshot`) | 6 lines |
| Snapshots per test | 1 |

If a snapshot exceeds 50 lines, break the test into smaller, focused tests.

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do This Instead |
|---|---|---|
| Giant snapshots (100+ lines) for behavior tests | Nobody reviews them, break on cosmetic changes | Semantic assertions (`isLineDeleted()`, `getCursorLine()`) |
| Snapshotting third-party output (lowlight, remark) | Tests their code, not ours — breaks on their updates | Only snapshot what our rendering produces |
| Snapshots for static views (ErrorView, LoadingView) | Redundant — `toContain()` assertions already cover it | Remove the snapshot, keep the assertion |
| Testing at 4+ terminal widths | Diminishing returns, 60 and 120 never caught unique bugs | 2 widths only: 40 and 80 |
| Width-invariant snapshot duplication | Identical output at all widths = pure waste | Single-width snapshot for width-invariant output |
| Blind `--update-snapshots` | Locks bugs into golden master | Always inspect diff first: `bun run test:snapshots 2>&1` |
| Writing snapshot without running render-tui first | Mental model snapshots lock in wrong column positions, colors, or ANSI — fail silently when reviewed | Always run render-tui, read raw output, then write assertions from what you see |
| Writing a snapshot before verifying in render-tui | Locks in wrong colors, column positions, or ANSI silently — you won't know until someone reads the snap file | Use render-tui first, get the output right, then snapshot to lock it |
| Vague test names ("renders correctly") | No guidance when test fails | Behavior-oriented: "snapshot: multi-line selection with deletions" |
| Over-engineered snapshot helpers | YAGNI — unused options add maintenance burden | Keep helpers minimal (currently 29 lines, 3 exports) |
| Stale snapshots referencing old component structure | False confidence from outdated baselines | Delete and regenerate after component reorganization |

## Snapshot Update Workflow

```bash
# 1. Review failures first
bun run test:snapshots 2>&1

# 2. Update ONLY after confirming changes are intentional
bun run test:snapshots:update

# 3. Verify the diff
git diff __snapshots__/

# 4. Update specific file only
bun test --update-snapshots app/src/components/PlanView/Plan/Plan.snapshot.test.tsx
```

## Quick Reference

| Convention | Rule |
|---|---|
| Snapshot file | Separate `*.snapshot.test.tsx` file alongside unit test |
| Test names | Prefix with `snapshot:` |
| Widths | 2 only: NARROW (40), STANDARD (80) |
| Normalization | Always use `normalizeSnapshot(lastFrame())` |
| Fixtures | Import from `app/test-utils/snapshot-fixtures.ts` |
| Helpers | `testAtAllWidths()`, `normalizeSnapshot()` from `app/test-utils/snapshot-helpers.ts` |
| Assertions | Semantic helpers in `app/test-utils/visual-assertions.ts` for non-snapshot tests |
| Cleanup | `afterEach(() => { cleanup(); })` — required whenever `render` is called |
| Terminal setup | Pinned to 80x24 in `app/test-utils/test-setup.ts` |
| Max size | 50 lines per external snapshot, 6 per inline |

## Decision Flowchart

```
Is visual layout the actual behavior being tested?
  No  → Use semantic assertions (toContain, assertion helpers)
  Yes → Does the output vary by terminal width?
          No  → Single-width snapshot at STANDARD (80)
          Yes → Use testAtAllWidths() with NARROW (40) + STANDARD (80)
                → Is the snapshot under 50 lines?
                    No  → Break into smaller focused tests
                    Yes → ✅ Use toMatchSnapshot() with snapshot: prefix
```
