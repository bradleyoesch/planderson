import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeKeys, typeText, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import { isInCommandMode } from '~/test-utils/view-assertions';
import {
    getRenderedLines,
    hasInputCursorAtEnd,
    hasInputCursorOnChar,
    isInCommentMode,
    isInQuestionMode,
} from '~/test-utils/visual-assertions';

describe('content input-wrapping integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test('comment input wraps long text across multiple visual lines', async () => {
        // Terminal defaults to 80 cols in test env → effective width = 78 (80 - 2*paddingX)
        // 85 'a's wraps to: line 1 = 78 'a's (no cursor), line 2 = 7 'a's + cursor block
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'comment-wrap.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

        await typeText(stdin, 'a'.repeat(85));
        await waitFor(() => expect(lastFrame()).toContain('a'.repeat(10)));

        const lines = getRenderedLines(lastFrame()!);
        expect(lines).toContain('a'.repeat(78));
        expect(lines).toContain(`${'a'.repeat(7)}█`);
    });

    test('question input wraps long text across multiple visual lines', async () => {
        // Terminal defaults to 80 cols in test env → effective width = 78 (80 - 2*paddingX)
        // 85 'b's wraps to: line 1 = 78 'b's (no cursor), line 2 = 7 'b's + cursor block
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'question-wrap.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, 'q');
        await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

        await typeText(stdin, 'b'.repeat(85));
        await waitFor(() => expect(lastFrame()).toContain('b'.repeat(10)));

        const lines = getRenderedLines(lastFrame()!);
        expect(lines).toContain('b'.repeat(78));
        expect(lines).toContain(`${'b'.repeat(7)}█`);
    });

    test('comment mode up arrow moves cursor from second wrapped line to first', async () => {
        // Terminal defaults to 80 cols → effective width = 78 (80 - 2*paddingX=1)
        // 85 'a's: line 1 = 78 a's (no cursor), line 2 = 7 a's + cursor block
        // After UP: cursor at col 7 of line 1 → inverted 'a' after 7 a's on line 1
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'up-arrow-comment.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

        await typeText(stdin, 'a'.repeat(85));
        await waitFor(() => expect(hasInputCursorAtEnd(lastFrame()!, 'a'.repeat(7))).toBe(true));

        await typeKey(stdin, Keys.UP_ARROW);
        await waitFor(() => expect(hasInputCursorOnChar(lastFrame()!, 'a'.repeat(7), 'a')).toBe(true));
    });

    test('comment mode down arrow moves cursor from first wrapped line back to second', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'down-arrow-comment.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

        await typeText(stdin, 'a'.repeat(85));
        await waitFor(() => expect(hasInputCursorAtEnd(lastFrame()!, 'a'.repeat(7))).toBe(true));

        // Move cursor to line 1 first
        await typeKey(stdin, Keys.UP_ARROW);
        await waitFor(() => expect(hasInputCursorOnChar(lastFrame()!, 'a'.repeat(7), 'a')).toBe(true));

        // Move cursor back down to line 2
        await typeKey(stdin, Keys.DOWN_ARROW);
        await waitFor(() => expect(hasInputCursorAtEnd(lastFrame()!, 'a'.repeat(7))).toBe(true));
    });

    test('question mode up arrow moves cursor from second wrapped line to first', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'up-arrow-question.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, 'q');
        await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

        await typeText(stdin, 'b'.repeat(85));
        await waitFor(() => expect(hasInputCursorAtEnd(lastFrame()!, 'b'.repeat(7))).toBe(true));

        await typeKey(stdin, Keys.UP_ARROW);
        await waitFor(() => expect(hasInputCursorOnChar(lastFrame()!, 'b'.repeat(7), 'b')).toBe(true));
    });

    test('comment mode up arrow on single-line input moves cursor to beginning', async () => {
        // Single-line text: UP moves to position 0 (beginning)
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'up-single-line.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

        await typeText(stdin, 'hello');
        await waitFor(() => expect(hasInputCursorAtEnd(lastFrame()!, 'hello')).toBe(true));

        await typeKey(stdin, Keys.UP_ARROW);
        await waitFor(() => expect(hasInputCursorOnChar(lastFrame()!, '', 'h')).toBe(true));
    });

    test('plan viewport shrinks when comment input wraps to multiple lines', async () => {
        // Build a plan with enough lines to fill the viewport at single-line footer (17 lines)
        const content = Array.from({ length: 25 }, (_, i) => `Plan line ${i + 1}`).join('\n');
        const file = useTempPlanFile(content, 'viewport-shrink.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Plan line 1'));

        // Enter comment mode and capture single-line baseline
        await typeKey(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));
        const singleLinePlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;

        // Type wrapping text and verify viewport shrinks
        await typeText(stdin, 'a'.repeat(85));
        await waitFor(() => expect(lastFrame()).toContain('a'.repeat(10)));
        const wrappedPlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;

        expect(wrappedPlanLines).toBeLessThan(singleLinePlanLines);
    });

    test('plan viewport is immediately reduced when re-opening a previously saved wrapped comment', async () => {
        // Exercises the useFeedbackKeys fix: START_COMMENT with existingText that wraps must
        // compute the correct initial viewportHeight rather than defaulting to 1 input line.
        const content = Array.from({ length: 25 }, (_, i) => `Plan line ${i + 1}`).join('\n');
        const file = useTempPlanFile(content, 'reopen-wrap.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Plan line 1'));

        // Capture single-line comment mode baseline
        await typeKey(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));
        const singleLinePlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;

        // Type wrapping text and save the comment
        await typeText(stdin, 'a'.repeat(85));
        await waitFor(() => expect(lastFrame()).toContain('a'.repeat(10)));
        await typeKey(stdin, Keys.ENTER);
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(false));

        // Re-open the same comment (existingText is the 85-char wrapped string)
        await typeKey(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

        // Viewport must already be reduced upon opening — no flicker frame at full height
        const reopenedPlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;
        expect(reopenedPlanLines).toBeLessThan(singleLinePlanLines);
    });

    test('command input wraps long text across multiple visual lines', async () => {
        // Terminal defaults to 80 cols in test env → effective width = 80 (command mode uses full terminalWidth, no padding)
        // ':' is a break char so renders on its own line; 85 'a's wrap at 80: 80 'a's on line 2, 5 'a's + cursor on line 3
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'command-wrap.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, ':');
        await waitFor(() => expect(isInCommandMode(lastFrame()!)).toBe(true));

        await typeText(stdin, 'a'.repeat(85));
        await waitFor(() => expect(lastFrame()).toContain('a'.repeat(10)));

        const lines = getRenderedLines(lastFrame()!);
        // ':' is a break char in wrapLine, so it renders on its own line
        // then 85 'a's wrap at effectiveWidth=80: 80 'a's on line 2, 5 'a's + cursor on line 3
        expect(lines).toContain(':');
        expect(lines).toContain('a'.repeat(80));
        expect(lines).toContain(`${'a'.repeat(5)}█`);
    });

    test('plan viewport shrinks when command input wraps to multiple lines', async () => {
        // Build a plan with enough lines to fill the viewport
        const content = Array.from({ length: 25 }, (_, i) => `Plan line ${i + 1}`).join('\n');
        const file = useTempPlanFile(content, 'cmd-viewport-shrink.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Plan line 1'));

        // Enter command mode
        await typeKey(stdin, ':');
        await waitFor(() => expect(isInCommandMode(lastFrame()!)).toBe(true));

        const singleLinePlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;

        // Type wrapping text
        await typeText(stdin, 'a'.repeat(85));
        await waitFor(() => expect(lastFrame()).toContain('a'.repeat(10)));

        const wrappedPlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;

        // Viewport should have shrunk (fewer plan lines visible when command wraps)
        expect(wrappedPlanLines).toBeLessThan(singleLinePlanLines);
    });

    test('plan viewport expands when backspace collapses wrapped comment input to single line', async () => {
        // Exercises the BACKSPACE_INPUT atomic viewport update.
        // Terminal: 80 cols, paddingX=1 → effectiveWidth=78
        // 85 'a's → 2 input lines (78 + 7); deleting 8 → 77 'a's → 1 input line → viewport expands
        const content = Array.from({ length: 25 }, (_, i) => `Plan line ${i + 1}`).join('\n');
        const file = useTempPlanFile(content, 'backspace-expand.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Plan line 1'));

        // Enter comment mode and capture single-line baseline
        await typeKey(stdin, 'c');
        await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));
        const singleLinePlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;

        // Type wrapping text
        await typeText(stdin, 'a'.repeat(85));
        await waitFor(() => expect(lastFrame()).toContain('a'.repeat(10)));
        const wrappedPlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;
        expect(wrappedPlanLines).toBeLessThan(singleLinePlanLines);

        // Delete 8 chars: 85 → 77 'a's, which fits in one visual line → viewport must expand back
        await typeKeys(stdin, Keys.BACKSPACE, 8);
        await waitFor(() => expect(hasInputCursorAtEnd(lastFrame()!, 'a'.repeat(77))).toBe(true));
        const expandedPlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;

        expect(expandedPlanLines).toBe(singleLinePlanLines);
    });

    test('plan viewport is immediately reduced when re-opening a previously saved wrapped question', async () => {
        // Exercises the useFeedbackKeys fix for START_QUESTION with existingText that wraps.
        const content = Array.from({ length: 25 }, (_, i) => `Plan line ${i + 1}`).join('\n');
        const file = useTempPlanFile(content, 'reopen-question-wrap.md');
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Plan line 1'));

        // Capture single-line question mode baseline
        await typeKey(stdin, 'q');
        await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));
        const singleLinePlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;

        // Type wrapping text and save the question
        await typeText(stdin, 'b'.repeat(85));
        await waitFor(() => expect(lastFrame()).toContain('b'.repeat(10)));
        await typeKey(stdin, Keys.ENTER);
        await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(false));

        // Re-open the same question (existingText is the 85-char wrapped string)
        await typeKey(stdin, 'q');
        await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

        // Viewport must already be reduced upon opening — no flicker frame at full height
        const reopenedPlanLines = getRenderedLines(lastFrame()!).filter((l) => l.startsWith('Plan line')).length;
        expect(reopenedPlanLines).toBeLessThan(singleLinePlanLines);
    });
});
