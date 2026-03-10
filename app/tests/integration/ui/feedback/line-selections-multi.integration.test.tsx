import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeKeys, typeText, waitFor, waitForRender } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import {
    areLinesSelected,
    countSelectedLines,
    hasSelection,
    isInCommentMode,
    isInQuestionMode,
} from '~/test-utils/visual-assertions';

/**
 * KNOWN ISSUE: Escape should cancel multi-line selection
 * GitHub Issue: #87
 *
 * Expected behavior: When user has multi-line selection and presses Escape,
 * it should clear the selection back to single-line (cursor position only).
 *
 * Current behavior: Escape does not cancel multi-line selection.
 */

/**
 * Integration tests for multi-line selection behavior
 *
 * Tests keyboard-driven multi-line selection including:
 * - Selection highlight persistence during feedback input (Issue #68)
 * - Shift+Up/Down extending and reducing selection
 * - Arrow keys resetting to single selection
 * - Complex selection sequences
 * - Selection with scrolling
 * - Selection maintenance during page navigation
 * - Escape canceling selection (Issue #87)
 */
describe('feedback line-selections-multi integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    // Selection highlight persistence during feedback input (Issue #68)
    test('selection highlight persists during comment input', async () => {
        const content = '# Test Plan\n\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
        const file = useTempPlanFile(content, 'selection-comment.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for content to load
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to line 2 (skip heading and blank line)
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Select 3 lines (Line 1, Line 2, Line 3) with Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        const frameBeforeComment = lastFrame()!;

        // Verify selection is active before entering comment mode
        expect(frameBeforeComment).toContain('Line 1');
        expect(hasSelection(frameBeforeComment)).toBe(true);
        expect(countSelectedLines(frameBeforeComment)).toBe(3);
        expect(areLinesSelected(frameBeforeComment, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);

        // Press 'c' to add comment - selection highlight should persist
        await typeText(stdin, 'c');
        await waitFor(() => {
            const frameDuringComment = lastFrame()!;
            // Verify we're in comment mode
            expect(isInCommentMode(frameDuringComment)).toBe(true);
            // CRITICAL: Selection highlight should still be visible during comment input
            expect(hasSelection(frameDuringComment)).toBe(true);
            expect(countSelectedLines(frameDuringComment)).toBe(3);
            expect(areLinesSelected(frameDuringComment, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);
        });
    });

    test('selection highlight persists during question input', async () => {
        const content = '# Test Plan\n\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
        const file = useTempPlanFile(content, 'selection-question.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for content to load
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 1 (skip heading and blank line)
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Select 2 lines with Shift+Down (Line 1 and Line 2)
        await typeKey(stdin, Keys.SHIFT_DOWN);

        const frameBeforeQuestion = lastFrame()!;

        // Verify selection is active (at least 1 line selected)
        expect(hasSelection(frameBeforeQuestion)).toBe(true);
        expect(countSelectedLines(frameBeforeQuestion)).toBeGreaterThan(0);

        // Press 'q' to add question - selection highlight should persist
        await typeText(stdin, 'q');
        await waitFor(() => {
            const frameDuringQuestion = lastFrame()!;
            // Verify we're in question mode
            expect(isInQuestionMode(frameDuringQuestion)).toBe(true);
            // CRITICAL: Selection highlight should still be visible during question input
            expect(hasSelection(frameDuringQuestion)).toBe(true);
            expect(countSelectedLines(frameDuringQuestion)).toBeGreaterThan(0);
        });
    });

    // Selection highlight persistence after submitting feedback (Issue #136)
    test('selection highlight persists after submitting comment on multiple lines', async () => {
        const content = '# Test Plan\n\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
        const file = useTempPlanFile(content, 'selection-comment-submit.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for content to load
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 1 (skip heading and blank line)
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Select 3 lines (Line 1, Line 2, Line 3) with Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Press 'c' to add comment, type text, press Enter to submit
        await typeText(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));
        await typeText(stdin, 'my comment');
        await typeKey(stdin, Keys.ENTER);

        // CRITICAL (Issue #136): Selection should still cover all 3 lines after submitting
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(isInCommentMode(frame)).toBe(false);
            expect(hasSelection(frame)).toBe(true);
            expect(countSelectedLines(frame)).toBe(3);
            expect(areLinesSelected(frame, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);
        });
    });

    test('selection highlight persists after submitting question on multiple lines', async () => {
        const content = '# Test Plan\n\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
        const file = useTempPlanFile(content, 'selection-question-submit.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for content to load
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 1 (skip heading and blank line)
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Select 2 lines (Line 1, Line 2) with Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);

        expect(countSelectedLines(lastFrame()!)).toBe(2);

        // Press 'q' to add question, type text, press Enter to submit
        await typeText(stdin, 'q');
        await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));
        await typeText(stdin, 'why this?');
        await typeKey(stdin, Keys.ENTER);

        // CRITICAL (Issue #136): Selection should still cover both lines after submitting
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(isInQuestionMode(frame)).toBe(false);
            expect(hasSelection(frame)).toBe(true);
            expect(countSelectedLines(frame)).toBe(2);
            expect(areLinesSelected(frame, ['Line 1', 'Line 2'])).toBe(true);
        });
    });

    test('Up and Down after submitting comment on upward selection use original cursor position', async () => {
        // Reproduces the user requirement: select upward (lines 5→4→3), submit feedback,
        // then Up→line 2 and Down→line 4 (cursor was at top of selection)
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
        const file = useTempPlanFile(content, 'up-down-after-upward-submit.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 5 (index 4)
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);
        expect(areLinesSelected(lastFrame()!, ['Line 5'])).toBe(true);

        // Select Lines 3-5 upward (cursor moves to Line 3, anchor stays at Line 5)
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);
        expect(countSelectedLines(lastFrame()!)).toBe(3);
        expect(areLinesSelected(lastFrame()!, ['Line 3', 'Line 4', 'Line 5'])).toBe(true);

        // Add comment and submit
        await typeText(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));
        await typeText(stdin, 'my comment');
        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(false));

        // Selection preserved (Lines 3-5 still selected)
        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(3);
            expect(areLinesSelected(lastFrame()!, ['Line 3', 'Line 4', 'Line 5'])).toBe(true);
        });

        // Up from cursor (Line 3) → Line 2
        await typeKey(stdin, Keys.UP_ARROW);
        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 2'])).toBe(true);
        });
    });

    test('Down after submitting comment on upward selection moves into selection', async () => {
        // After upward selection submit, cursor is at top — Down moves into the selection
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
        const file = useTempPlanFile(content, 'down-after-upward-submit.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 5
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Select Lines 3-5 upward
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);
        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Add comment and submit
        await typeText(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));
        await typeText(stdin, 'my comment');
        await typeKey(stdin, Keys.ENTER);
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(false));

        // Down from cursor (Line 3) → Line 4 (into the selection)
        await typeKey(stdin, Keys.DOWN_ARROW);
        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 4'])).toBe(true);
        });
    });

    test('Down after submitting comment on multiple lines moves past selection', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'down-after-comment-submit.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Select Lines 1-3 with Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Add comment and submit
        await typeText(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));
        await typeText(stdin, 'my comment');
        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(false));

        // Press Down — should move past the selection to Line 4, not into Line 2
        await typeKey(stdin, Keys.DOWN_ARROW);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 4'])).toBe(true);
        });
    });

    // Basic shift-selection behavior
    test('Shift+Down highlights multiple lines', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'shift-down-multi.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Pre-condition: single line selected (Line 1)
        expect(countSelectedLines(lastFrame()!)).toBe(1);
        expect(areLinesSelected(lastFrame()!, ['Line 1'])).toBe(true);

        // Press Shift+Down twice to select 3 lines total
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(3);
            expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);
        });
    });

    test('Shift+Up highlights multiple lines', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'shift-up-multi.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 3 first
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Pre-condition: single line selected (Line 3)
        expect(countSelectedLines(lastFrame()!)).toBe(1);
        expect(areLinesSelected(lastFrame()!, ['Line 3'])).toBe(true);

        // Press Shift+Up twice to select 3 lines total
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(3);
            expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);
        });
    });

    test('Shift+Up from bottom of selection unhighlights', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'shift-up-unhighlight.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Create selection: Line 1, Line 2, Line 3 (cursor at Line 3)
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Press Shift+Up to reduce selection
        await typeKey(stdin, Keys.SHIFT_UP);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(2);
            expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2'])).toBe(true);
        });
    });

    test('Shift+Down from top of selection unhighlights', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'shift-down-unhighlight.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 3
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Create selection upward: Line 1, Line 2, Line 3 (cursor at Line 1)
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);

        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Press Shift+Down to reduce selection
        await typeKey(stdin, Keys.SHIFT_DOWN);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(2);
            expect(areLinesSelected(lastFrame()!, ['Line 2', 'Line 3'])).toBe(true);
        });
    });

    test('Down from bottom of selection resets to single line', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'down-reset-bottom.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Create selection: Line 1, Line 2, Line 3
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Press Down (no shift) to move and reset selection
        await typeKey(stdin, Keys.DOWN_ARROW);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 4'])).toBe(true);
        });
    });

    test('Up from top of selection resets to single line', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'up-reset-top.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 4
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Create selection upward: Line 2, Line 3, Line 4
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);

        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Press Up (no shift) to move and reset selection
        await typeKey(stdin, Keys.UP_ARROW);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 1'])).toBe(true);
        });
    });

    test('Up from bottom of selection resets to single line', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'up-reset-bottom.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Create selection: Line 1, Line 2, Line 3 (cursor at Line 3)
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Press Up (no shift) to move and reset selection
        await typeKey(stdin, Keys.UP_ARROW);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 2'])).toBe(true);
        });
    });

    test('Down from top of selection resets to single line', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'down-reset-top.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 3
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Create selection upward: Line 1, Line 2, Line 3 (cursor at Line 1)
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);

        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Press Down (no shift) to move and reset selection
        await typeKey(stdin, Keys.DOWN_ARROW);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 2'])).toBe(true);
        });
    });

    test('Shift+Down twice then Shift+Up three times selects correct lines', async () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'complex-sequence.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 2
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Pre-condition: on Line 2
        expect(areLinesSelected(lastFrame()!, ['Line 2'])).toBe(true);

        // Shift+Down twice: selects Line 2, Line 3, Line 4
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        expect(countSelectedLines(lastFrame()!)).toBe(3);

        // Shift+Up three times: reduces selection, then extends upward
        // After 1st Shift+Up: Line 2, Line 3
        // After 2nd Shift+Up: Line 2
        // After 3rd Shift+Up: Line 1, Line 2
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);

        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(2);
            expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2'])).toBe(true);
        });
    });

    // Selection with scrolling
    test('Shift+Up extends selection upward in scrollable content', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'shift-up-scroll.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move down 10 lines to get some distance from top
        await typeKeys(stdin, Keys.DOWN_ARROW, 10);

        // Wait for navigation
        await waitForRender(100);

        // Pre-condition: single line selected
        const beforeCount = countSelectedLines(lastFrame()!);
        expect(beforeCount).toBe(1);

        // Shift+Up 3 times to extend selection upward
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);

        await waitFor(() => {
            // Should have 4 lines selected (start line + 3 shift-ups)
            expect(countSelectedLines(lastFrame()!)).toBe(4);
        });
    });

    test('Shift+Down extends selection downward in scrollable content', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'shift-down-scroll.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Pre-condition: on Line 1
        expect(countSelectedLines(lastFrame()!)).toBe(1);

        // Shift+Down 5 times to extend selection downward
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        await waitFor(() => {
            // Should have 6 lines selected (Line 1 + 5 shift-downs)
            expect(countSelectedLines(lastFrame()!)).toBe(6);
        });
    });

    // Escape canceling multi-line selection (Issue #87)
    test('Escape cancels multi-line selection when selecting downward', async () => {
        // GitHub Issue #87: Escape key should cancel multi-line selection
        // Test canceling selection created by moving DOWN with Shift+Down
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const file = useTempPlanFile(content, 'escape-cancel-downward.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Create multi-line selection downward: Line 1, Line 2, Line 3
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Pre-condition: 3 lines selected (cursor at bottom - Line 3)
        expect(countSelectedLines(lastFrame()!)).toBe(3);
        expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);

        // Press Escape to cancel selection
        await typeKey(stdin, Keys.ESCAPE);

        // Expected: selection canceled to single line at cursor position (Line 3)
        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 3'])).toBe(true);
        });
    });

    test('Escape cancels multi-line selection when selecting upward', async () => {
        // Test canceling selection created by moving UP with Shift+Up
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7';
        const file = useTempPlanFile(content, 'escape-cancel-upward.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Move to Line 5
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Pre-condition: on Line 5
        expect(countSelectedLines(lastFrame()!)).toBe(1);
        expect(areLinesSelected(lastFrame()!, ['Line 5'])).toBe(true);

        // Create multi-line selection upward: Line 2, Line 3, Line 4, Line 5
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);

        // Verify 4 lines selected (cursor at top - Line 2)
        expect(countSelectedLines(lastFrame()!)).toBe(4);
        expect(areLinesSelected(lastFrame()!, ['Line 2', 'Line 3', 'Line 4', 'Line 5'])).toBe(true);

        // Press Escape to cancel selection
        await typeKey(stdin, Keys.ESCAPE);

        // Expected: selection canceled to single line at cursor position (Line 2)
        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBe(1);
            expect(areLinesSelected(lastFrame()!, ['Line 2'])).toBe(true);
        });
    });

    // Selection maintenance during page navigation actions
    // Tests that certain keys maintain multi-line selection instead of clearing it.
    // These tests focus on selection state, complementing page-navigation tests
    // (tests/integration/ui/navigation/page-navigation.integration.test.tsx)
    // that focus on page position.
    //
    // NOTE: Space test not included - Node.js readline cannot distinguish Shift+Space
    // from regular Space, so we can't test that behavior. See page-navigation tests
    // for Space behavior with multi-line selection.
    //
    // NOTE: No Space test here because we can't distinguish Shift+Space from Space
    // at the readline level (CSI u limitation). Capital B test below verifies
    // that shift-modified keys can maintain selection.
    test('Capital B maintains multi-line selection', async () => {
        // This test focuses on SELECTION maintenance.
        // See page-navigation.integration.test.tsx "Capital B does not change page position"
        // for the complementary test that focuses on PAGE POSITION.
        const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'capital-b-maintains-selection.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitForRender(100);

        // Page down first
        await typeText(stdin, ' ');

        await waitFor(() => {
            expect(lastFrame()).toContain('Line 30');
        });

        // Create multi-line selection with Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Pre-condition: multi-line selection exists
        const beforeCount = countSelectedLines(lastFrame()!);
        expect(beforeCount).toBe(3);

        // Press capital B (Shift+b) - focus on selection being maintained
        await typeText(stdin, 'B');

        // Post-condition: selection maintained
        await waitFor(() => {
            expect(countSelectedLines(lastFrame()!)).toBeGreaterThanOrEqual(3);
        });
    });
});
