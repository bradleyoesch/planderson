#!/usr/bin/env bun
/**
 * Integration tests for scrolling behavior
 *
 * These tests validate the complete scrolling workflow:
 * - Initial viewport positioning (should show lines 1-N)
 * - Cursor movement within viewport (no scrolling)
 * - Scrolling at viewport edges
 * - Boundary conditions (top/bottom)
 * - Short content handling
 * - Viewport limiting (only render visible content)
 *
 * Run with: bun run test:integration
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeKeys, typeText, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import { getCursorLine, hasCursorHighlight } from '~/test-utils/visual-assertions';

describe('navigation page-scrolling integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    /**
     * Scenario 1: Long Plan, Initial Open
     * REQUIREMENT: Lines 1-25 visible, cursor on line 1
     */
    test('opens long plan at top with cursor on line 1', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-initial-open.md');

        const { lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        const output = lastFrame()!;

        // CRITICAL: Should show Line 1 at the top (requirement 1.1)
        expect(output).toContain('Content Line 1');

        // CRITICAL: Should NOT show lines from middle or bottom on initial load
        // This is the main bug: plan may open showing bottom instead of top
        expect(output).not.toContain('Content Line 50');
        expect(output).not.toContain('Content Line 75');
        expect(output).not.toContain('Content Line 100');
    });

    /**
     * Scenario 2: Navigate Down Within Viewport
     * REQUIREMENT: Cursor moves, viewport stays fixed (no scrolling)
     */
    test('cursor moves within viewport without scrolling', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-within-viewport.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Move cursor down 10 times (should stay within initial viewport)
        await typeKeys(stdin, Keys.DOWN_ARROW, 10);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 1');
            expect(output).toContain('Content Line 5');
            expect(output).toContain('Content Line 10');
        });
    });

    /**
     * Scenario 3: Scroll Down at Edge
     * REQUIREMENT: When cursor at bottom of viewport, pressing down scrolls by 1 line
     */
    test('scrolls down by 1 line when cursor reaches bottom edge', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-down-edge.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Navigate down many times to reach bottom of viewport and trigger scrolling
        // Assuming ~25 lines visible in viewport, press down 30 times to scroll
        await typeKeys(stdin, Keys.DOWN_ARROW, 30);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).not.toMatch(/Content Line 1\n/);
            expect(output).toMatch(/Content Line 13\n/);
            expect(output).toContain('Content Line 31');
        });
    });

    /**
     * Scenario 4: Hit Top Boundary
     * REQUIREMENT: Cannot scroll above line 1
     */
    test('cannot scroll above line 1', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-top-boundary.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Try to move up multiple times from first line
        await typeKeys(stdin, Keys.UP_ARROW, 5);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 1');
            expect(output).toContain('Content Line 2');
        });
    });

    /**
     * Scenario 5: Hit Bottom Boundary
     * REQUIREMENT: Cannot scroll below last line
     */
    test('cannot scroll below last line', async () => {
        const lines = Array.from({ length: 20 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-bottom-boundary.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Navigate to bottom and try to go past
        await typeKeys(stdin, Keys.DOWN_ARROW, 25);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 20');
            expect(output).not.toContain('Content Line 21');
        });
    });

    /**
     * Scenario 6: Short Plan (Content Fits in Viewport)
     * REQUIREMENT: Shows all content at top with no scrolling
     */
    test('displays short plan at top with no scrolling', async () => {
        const lines = Array.from({ length: 10 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-short-plan.md');

        const { lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        const output = lastFrame()!;

        // Should show all 10 lines starting at top
        // Bug: may center content or have weird positioning
        expect(output).toContain('Content Line 1');
        expect(output).toContain('Content Line 5');
        expect(output).toContain('Content Line 10');
    });

    /**
     * Scenario 7: Navigate Short Plan (No Scrolling Should Occur)
     * REQUIREMENT: Cursor moves through all lines, no scrolling occurs
     */
    test('navigates short plan without scrolling', async () => {
        const lines = Array.from({ length: 10 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-short-navigate.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Navigate to bottom
        await typeKeys(stdin, Keys.DOWN_ARROW, 9);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 1');
            expect(output).toContain('Content Line 10');
        });
    });

    /**
     * Scenario 8: Viewport Consistency During Navigation
     * REQUIREMENT: Scrolling is smooth (1 line at a time), no jumping
     */
    test('scrolls smoothly by 1 line at a time', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-smooth.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Capture initial state
        const before = lastFrame()!;
        expect(before).toContain('Content Line 1');

        // Navigate down to trigger scrolling (past bottom of viewport)
        await typeKeys(stdin, Keys.DOWN_ARROW, 26);

        await waitFor(() => {
            const after = lastFrame()!;
            expect(after).not.toMatch(/Content Line 1\n/);
            expect(after).toMatch(/Content Line 9\n/);
        });
    });

    /**
     * Scenario 9: Viewport Limits Rendered Content (Explicit Count Check)
     * REQUIREMENT: Only viewport-sized content should be rendered, not all lines
     *
     * This test explicitly counts visible lines to ensure viewport limiting works
     */
    test('renders only viewport-sized content, not all lines', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-viewport-limit.md');

        const { lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        const output = lastFrame()!;

        // Count how many "Content Line" entries appear in output
        const lineMatches = output.match(/Content Line \d+/g) || [];
        const visibleLineCount = lineMatches.length;

        // Should render ~25-30 lines (viewport size), not all 100
        expect(visibleLineCount).toBeLessThan(40); // Should be roughly viewport height
        expect(visibleLineCount).toBeGreaterThan(15); // But more than a few lines

        // Should NOT render all 100 lines
        expect(visibleLineCount).not.toBe(100);
    });

    /**
     * Scenario 10: After Scrolling, Old Lines Not in Output
     * REQUIREMENT: Lines scrolled off viewport should not be in rendered output
     *
     * This test verifies that scrolling actually removes lines from rendered output
     */
    test('after scrolling down, top lines are not in rendered output', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-output-check.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Scroll down significantly (40 times)
        await typeKeys(stdin, Keys.DOWN_ARROW, 40);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).not.toMatch(/Content Line 1\n/);
            expect(output).not.toMatch(/Content Line 2\n/);
            expect(output).not.toMatch(/Content Line 3\n/);
            expect(output).not.toMatch(/Content Line 5\n/);
            expect(output).not.toMatch(/Content Line 10\n/);
            expect(output).toMatch(/Content Line 40\n/);
            expect(output).toContain('Content Line 41');
        });
    });

    /**
     * Scenario 11: Long Wrapped Line - Initial Display
     * REQUIREMENT: Very long line that wraps should display from the start
     *
     * A line with 500 characters should wrap across multiple display lines.
     * The cursor should be on line 1, and the beginning of the line should be visible.
     */
    test('displays long wrapped line starting from beginning', async () => {
        // Create a very long line (500 chars) that will wrap across multiple display lines
        const longLine = 'A'.repeat(500);
        const content = `Short Line 1\n${longLine}\nShort Line 3`;
        const file = useTempPlanFile(content, 'scrolling-long-wrapped-initial.md');

        const { lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Short Line 1'));

        const output = lastFrame()!;

        // Should show beginning of long line (multiple A's)
        expect(output).toContain('AAAA');

        // Should show other lines
        expect(output).toContain('Short Line 1');
        expect(output).toContain('Short Line 3');
    });

    /**
     * Scenario 12: Scrolling Down Into Long Wrapped Line
     * REQUIREMENT: When scrolling down into a long wrapped line, cursor should move to that line
     *
     * Tests behavior when navigating from a short line down into a long wrapped line.
     */
    test('scrolls down into long wrapped line correctly', async () => {
        // Create content with a very long line in the middle
        const longLine = 'B'.repeat(500);
        const lines = [
            ...Array.from({ length: 30 }, (_, i) => `Short Line ${i + 1}`),
            longLine,
            ...Array.from({ length: 20 }, (_, i) => `Short Line ${i + 32}`),
        ].join('\n');
        const file = useTempPlanFile(lines, 'scrolling-into-wrapped.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Short Line 1'));

        // Navigate down 30 times to reach the long wrapped line
        await typeKeys(stdin, Keys.DOWN_ARROW, 30);

        await waitFor(() => {
            const output = lastFrame()!;
            // Should show the long line (multiple B's)
            expect(output).toContain('BBBB');
        });
    });

    /**
     * Scenario 13: Scrolling Up Into Long Wrapped Line
     * REQUIREMENT: When scrolling up into a long wrapped line from below, cursor should move to that line
     *
     * Tests behavior when navigating from a short line up into a long wrapped line.
     */
    test('scrolls up into long wrapped line correctly', async () => {
        // Create content with a very long line in the middle
        const longLine = 'C'.repeat(500);
        const lines = [
            ...Array.from({ length: 20 }, (_, i) => `Short Line ${i + 1}`),
            longLine,
            ...Array.from({ length: 30 }, (_, i) => `Short Line ${i + 22}`),
        ].join('\n');
        const file = useTempPlanFile(lines, 'scrolling-up-into-wrapped.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Short Line 1'));

        // Navigate down past the long line
        await typeKeys(stdin, Keys.DOWN_ARROW, 25);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Short Line 22');
        });

        // Navigate back up into the long line
        await typeKeys(stdin, Keys.UP_ARROW, 5);

        await waitFor(() => {
            const output = lastFrame()!;
            // Should show the long line (multiple C's)
            expect(output).toContain('CCCC');
        });
    });

    /**
     * Scenario 14: Long Wrapped Line Partially Off Screen
     * REQUIREMENT: When a long wrapped line extends beyond viewport, it should be partially visible
     *
     * Tests behavior when a wrapped line is too long to fit entirely in the viewport.
     */
    test('handles long wrapped line that extends beyond viewport', async () => {
        // Create a long line that will wrap across several display lines
        const veryLongLine = 'D'.repeat(800);
        const lines = [
            ...Array.from({ length: 5 }, (_, i) => `Short Line ${i + 1}`),
            veryLongLine,
            ...Array.from({ length: 5 }, (_, i) => `Short Line ${i + 7}`),
        ].join('\n');
        const file = useTempPlanFile(lines, 'scrolling-wrapped-beyond-viewport.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Short Line 1'));

        // Navigate to the very long line
        await typeKeys(stdin, Keys.DOWN_ARROW, 5);

        await waitFor(() => {
            const output = lastFrame()!;
            // Should show beginning of the very long line
            expect(output).toContain('DDDD');

            // The line is so long that lines after it might not be visible
            // (depending on how much of the wrapped line fits in viewport)
        });

        // Navigate past the long line to verify we can move beyond it
        await typeKeys(stdin, Keys.DOWN_ARROW, 1);

        await waitFor(() => {
            const output = lastFrame()!;
            // Should eventually show lines after the long line
            expect(output).toContain('Short Line 7');
        });
    });

    /**
     * Scenario 15: Multiple Consecutive Long Wrapped Lines
     * REQUIREMENT: Should handle multiple wrapped lines in sequence correctly
     *
     * Tests scrolling through multiple consecutive long lines that each wrap.
     */
    test('handles multiple consecutive long wrapped lines', async () => {
        // Use shorter wrapped lines and add separating short lines for clarity
        const longLine1 = 'E'.repeat(300);
        const longLine2 = 'F'.repeat(300);
        const lines = [
            'Short Line 1',
            'Short Line 2',
            longLine1,
            'Short Line 4',
            longLine2,
            'Short Line 6',
            'Short Line 7',
        ].join('\n');
        const file = useTempPlanFile(lines, 'scrolling-multiple-wrapped.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Short Line 1'));

        // Navigate to first long line
        await typeKeys(stdin, Keys.DOWN_ARROW, 2);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('EEEE');
        });

        // Navigate past first long line to Short Line 4
        await typeKeys(stdin, Keys.DOWN_ARROW, 1);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Short Line 4');
        });

        // Navigate to second long line
        await typeKeys(stdin, Keys.DOWN_ARROW, 1);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('FFFF');
        });

        // Navigate past the long lines to end
        await typeKeys(stdin, Keys.DOWN_ARROW, 2);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Short Line 7');
        });
    });

    /**
     * Scenario 16: Scrolling With Feedback Lines
     * REQUIREMENT: Cursor scrolls correctly accounting for feedback lines
     *
     * When feedback (comments, questions) is added, viewport calculations should account for
     * the extra display lines and maintain correct scrolling behavior.
     */
    test('cursor scrolls correctly accounting for feedback lines', async () => {
        const testContent = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(testContent, 'scroll-feedback-1.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial content to load
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Navigate to line 10 and add a comment there.
        // After the unavoidable premature scroll at viewportHeight=1 (press 1 sets scrollOffset=1),
        // line 10 is inside the viewport (indices 1-20 are visible). The comment stays visible
        // as we navigate toward the scroll boundary, so it counts against the viewport.
        await typeKeys(stdin, Keys.DOWN_ARROW, 10);
        await typeKey(stdin, 'c'); // Enter comment mode
        await typeText(stdin, 'Test comment', { enter: true }); // Type and submit comment

        // Verify comment was added
        await waitFor(() => expect(lastFrame()).toContain('Test comment'));

        // Move cursor to line 19 (Line 20 in display) — 9 more presses from current position (line 10)
        await typeKeys(stdin, Keys.DOWN_ARROW, 9);

        // Verify cursor is at line 19 (Line 20 in display): no scroll yet
        // count(1, 19)=19 + feedbackLines(1, 20)=1 (comment on line 10) = 20, not > 20
        const beforeFinalScroll = lastFrame();
        expect(beforeFinalScroll).toMatch(/Line 20.*\n/); // Cursor on Line 20 (index 19)

        // Press down once more to move cursor to line 20 (Line 21 in display).
        // count(1, 20)=20 + feedbackLines(1, 21)=1 (comment on line 10) = 21 > 20 → scroll!
        // Without feedback, scroll would only trigger at cursor=21 (count=21 > 20).
        await typeKey(stdin, Keys.DOWN_ARROW);

        const afterFinalScroll = lastFrame();
        // Verify scrolling occurred: Line 2 should no longer be visible (scrollOffset=2)
        expect(afterFinalScroll).not.toMatch(/^\s*Line 2\s*$/m);
        // Verify cursor moved to line 20 (Line 21 in display)
        expect(afterFinalScroll).toContain('Line 21');
    });

    /**
     * Scenario 18: Single-Line Document - DOWN Arrow Cursor Boundary
     * BUG: DOWN_ARROW in a single-line document moves cursor to a ghost trailing empty line.
     * REQUIREMENT: Cursor must stay on the only content line; DOWN is a no-op at document end.
     *
     * Confirmed via render-tui: after DOWN_ARROW the content line loses cursor highlight and
     * a highlighted blank space appears below it (the ghost trailing line from the document parser).
     */
    test('cursor stays on content line when pressing DOWN in single-line document', async () => {
        // File ends with \n — standard for any editor-created file.
        // Without the fix, content.split('\n') yields ['This is the only line', ''],
        // so contentLines.length === 2 and DOWN_ARROW moves cursor to the ghost empty line.
        const lineText = 'This is the only line';
        const file = useTempPlanFile(`${lineText}\n`, 'single-line-down.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(hasCursorHighlight(lastFrame()!, lineText)).toBe(true));

        // Press DOWN — should be a no-op at the end of a single-line document
        await typeKey(stdin, Keys.DOWN_ARROW);

        await waitFor(() => {
            const frame = lastFrame()!;
            // EXPECTED: cursor remains on the content line
            // BUG: cursor moves to ghost trailing empty line; content line loses highlight
            expect(hasCursorHighlight(frame, lineText)).toBe(true);
            // The cursor line text should be the content, not an empty string
            expect(getCursorLine(frame)).toBe(lineText);
        });
    });

    /**
     * Scenario 17: Cursor Reaches Bottom Line Before Scrolling (issue #188)
     * REQUIREMENT: Cursor must reach the last visible line before scrolling begins
     *
     * Scrolling should only trigger when cursor moves PAST the last visible line,
     * not when it arrives AT the last visible line.
     */
    test('cursor reaches bottom of viewport before scrolling starts', async () => {
        // Create a 50-line plan (well more than viewport height)
        const lines = Array.from({ length: 50 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'scrolling-bottom-before-scroll.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // viewportHeight starts at 1 before the layout effect fires, causing an unavoidable
        // premature scroll on the first key press in both bug and fix (constant offset).
        // The off-by-one manifests as a difference in the SECOND scroll:
        //   BUG (>=): count(scrollOffset=1, cursor=20) = 20 >= 20 → second scroll → Content Line 2 gone
        //   FIX (>):  count(scrollOffset=1, cursor=20) = 20 > 20? No → no second scroll → Content Line 2 visible
        await typeKeys(stdin, Keys.DOWN_ARROW, 20);

        // With the fix, Content Line 2 must still be visible after 20 presses
        await waitFor(() => expect(lastFrame()!).toMatch(/Content Line 2\n/));
    });

    /**
     * Scenario 18: Initial Load With Wrapped Lines Fills Viewport
     * REQUIREMENT: When a plan opens with a long wrapped line at the top, short lines
     * that follow it should be visible — viewport must be filled, not just show 1 line.
     *
     * Regression test for the endLine overcorrection bug: the old backward-subtract
     * set endLine = 1 when a long wrapped line consumed many terminal rows, hiding
     * all subsequent lines even though they easily fit in the remaining space.
     */
    test('initial load with wrapped lines fills viewport correctly (regression for endLine overcorrection)', async () => {
        // 5 short lines (1 row each) followed by 15 long lines (3 rows each at 78-col effective width).
        // Total logical lines = 20, total terminal rows = 5 + 45 = 50 >> viewportHeight(20).
        //
        // Bug (backward-subtract): initial endLine=20, excess=50-20=30, endLine=max(1,20-30)=1
        //   → only 'Short 1' visible; 'Short 2'-'Short 5' cut off even though they fit.
        // Fix (forward scan): endLine advances to 10 (5 short + 5 long = 20 rows = viewport)
        //   → 'Short 1'-'Short 5' all visible.
        const shortLines = Array.from({ length: 5 }, (_, i) => `Short ${i + 1}`);
        const longLines = Array.from({ length: 15 }, () => 'W'.repeat(200));
        const content = [...shortLines, ...longLines].join('\n');
        const file = useTempPlanFile(content, 'scrolling-wrapped-fills-viewport.md');

        const { lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render — first short line is present
        await waitFor(() => expect(lastFrame()!).toContain('Short 1'));

        // All 5 short lines must be visible on initial load.
        // They each take 1 terminal row; 5 rows easily fit alongside the first 5 long lines.
        // Bug: endLine overcorrection sets endLine=1, hiding Short 2-5.
        expect(lastFrame()!).toContain('Short 2');
        expect(lastFrame()!).toContain('Short 3');
        expect(lastFrame()!).toContain('Short 4');
        expect(lastFrame()!).toContain('Short 5');
    });
});
