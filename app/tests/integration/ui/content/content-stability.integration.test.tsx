import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeKeys, typeText, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import { isInCommandMode, isInPlanView } from '~/test-utils/view-assertions';
import { isInCommentMode, isInQuestionMode } from '~/test-utils/visual-assertions';

/**
 * Integration tests for content position stability when entering modes
 *
 * These tests verify that entering different modes (command, comment, question, delete,
 * approve/deny) does NOT cause the plan content to shift position or scroll.
 *
 * Critical requirement: Users expect the content to stay static when entering modes.
 * If content shifts, it's disorienting and makes the UI feel unstable.
 */
describe('content content-stability integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    /**
     * Helper function to extract the first visible content line from a frame.
     * This helps verify that content position hasn't changed.
     */
    const getFirstContentLine = (frame: string): string => {
        // Skip any UI chrome (mode indicators, etc.) and get first content line
        const lines = frame.split('\n');
        // Find first line that contains "Line " (our test content marker)
        return lines.find((line) => line.includes('Line ')) ?? '';
    };

    /**
     * Helper function to get the first line of the frame (should be the top border).
     * This helps verify that the header hasn't been pushed off-screen.
     */
    const getFirstLine = (frame: string): string => {
        return frame.split('\n')[0];
    };

    /**
     * Helper function to count total lines in the frame.
     * This helps verify that entering a mode doesn't add/remove lines.
     */
    const getLineCount = (frame: string): number => {
        return frame.split('\n').length;
    };

    /**
     * Helper function to check if header is visible in the frame.
     * The header includes the top border and "Review plan" text.
     */
    const hasVisibleHeader = (frame: string): boolean => {
        return frame.includes('─') && frame.includes('Review plan');
    };

    describe('Command Mode (:)', () => {
        test('entering command mode does not shift plan content', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'cmd-stability-1.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture state before entering command mode
            const beforeFrame = lastFrame()!;
            const firstLineBefore = getFirstContentLine(beforeFrame);
            const topLineBefore = getFirstLine(beforeFrame);
            const lineCountBefore = getLineCount(beforeFrame);

            expect(firstLineBefore).toContain('Line 1');
            expect(hasVisibleHeader(beforeFrame)).toBe(true);

            // Enter command mode
            await typeKey(stdin, ':');
            await waitFor(() => expect(isInCommandMode(lastFrame()!)).toBe(true));

            // Verify nothing shifted
            const afterFrame = lastFrame()!;
            const firstLineAfter = getFirstContentLine(afterFrame);
            const topLineAfter = getFirstLine(afterFrame);
            const lineCountAfter = getLineCount(afterFrame);

            // Content position unchanged
            expect(firstLineAfter).toBe(firstLineBefore);
            expect(firstLineAfter).toContain('Line 1');

            // Header still visible and in same position
            expect(topLineAfter).toBe(topLineBefore); // Top line unchanged
            expect(hasVisibleHeader(afterFrame)).toBe(true);
            expect(topLineAfter).toContain('─'); // Top border still first line

            // Frame height unchanged (command prompt adds a line, but viewport should stay same)
            // Allow for +1 line for command prompt at bottom
            expect(lineCountAfter).toBeLessThanOrEqual(lineCountBefore + 1);
        });

        test('exiting command mode restores original content position', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'cmd-stability-2.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture original state
            const originalFrame = lastFrame()!;
            const originalFirstLine = getFirstContentLine(originalFrame);
            const originalTopLine = getFirstLine(originalFrame);
            const originalLineCount = getLineCount(originalFrame);

            // Enter and exit command mode
            await typeKey(stdin, ':');
            await waitFor(() => expect(isInCommandMode(lastFrame()!)).toBe(true));
            await typeKey(stdin, Keys.ESCAPE);
            await waitFor(() => expect(isInPlanView(lastFrame()!)).toBe(true));

            // Verify complete restoration
            const restoredFrame = lastFrame()!;
            const restoredFirstLine = getFirstContentLine(restoredFrame);
            const restoredTopLine = getFirstLine(restoredFrame);
            const restoredLineCount = getLineCount(restoredFrame);

            expect(restoredFirstLine).toBe(originalFirstLine);
            expect(restoredTopLine).toBe(originalTopLine);
            expect(restoredLineCount).toBe(originalLineCount);
            expect(hasVisibleHeader(restoredFrame)).toBe(true);
        });
    });

    describe('Comment Mode (c)', () => {
        test('entering comment mode does not shift plan content', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'comment-stability-1.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture state before entering comment mode
            const beforeFrame = lastFrame()!;
            const firstLineBefore = getFirstContentLine(beforeFrame);
            const topLineBefore = getFirstLine(beforeFrame);

            expect(firstLineBefore).toContain('Line 1');
            expect(hasVisibleHeader(beforeFrame)).toBe(true);

            // Enter comment mode
            await typeText(stdin, 'c', { delayMs: 50 });
            await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

            // Verify nothing shifted
            const afterFrame = lastFrame()!;
            const firstLineAfter = getFirstContentLine(afterFrame);
            const topLineAfter = getFirstLine(afterFrame);

            expect(firstLineAfter).toBe(firstLineBefore);
            expect(firstLineAfter).toContain('Line 1');
            expect(topLineAfter).toBe(topLineBefore); // Top line unchanged
            expect(hasVisibleHeader(afterFrame)).toBe(true);
            expect(topLineAfter).toContain('─'); // Top border still first line
        });

        test('exiting comment mode restores original content position', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'comment-stability-2.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture original state
            const originalFrame = lastFrame()!;
            const originalFirstLine = getFirstContentLine(originalFrame);
            const originalTopLine = getFirstLine(originalFrame);
            const originalLineCount = getLineCount(originalFrame);

            // Enter and exit comment mode
            await typeText(stdin, 'c', { delayMs: 50 });
            await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));
            await typeKey(stdin, Keys.ESCAPE);
            await waitFor(() => expect(isInPlanView(lastFrame()!)).toBe(true));

            // Verify complete restoration
            const restoredFrame = lastFrame()!;
            const restoredFirstLine = getFirstContentLine(restoredFrame);
            const restoredTopLine = getFirstLine(restoredFrame);
            const restoredLineCount = getLineCount(restoredFrame);

            expect(restoredFirstLine).toBe(originalFirstLine);
            expect(restoredTopLine).toBe(originalTopLine);
            expect(restoredLineCount).toBe(originalLineCount);
            expect(hasVisibleHeader(restoredFrame)).toBe(true);
        });
    });

    describe('Question Mode (q)', () => {
        test('entering question mode does not shift plan content', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'question-stability-1.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture state before entering question mode
            const beforeFrame = lastFrame()!;
            const firstLineBefore = getFirstContentLine(beforeFrame);
            const topLineBefore = getFirstLine(beforeFrame);

            expect(firstLineBefore).toContain('Line 1');
            expect(hasVisibleHeader(beforeFrame)).toBe(true);

            // Enter question mode
            await typeText(stdin, 'q', { delayMs: 50 });
            await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

            // Verify nothing shifted
            const afterFrame = lastFrame()!;
            const firstLineAfter = getFirstContentLine(afterFrame);
            const topLineAfter = getFirstLine(afterFrame);

            expect(firstLineAfter).toBe(firstLineBefore);
            expect(firstLineAfter).toContain('Line 1');
            expect(topLineAfter).toBe(topLineBefore); // Top line unchanged
            expect(hasVisibleHeader(afterFrame)).toBe(true);
            expect(topLineAfter).toContain('─'); // Top border still first line
        });

        test('exiting question mode restores original content position', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'question-stability-2.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture original state
            const originalFrame = lastFrame()!;
            const originalFirstLine = getFirstContentLine(originalFrame);
            const originalTopLine = getFirstLine(originalFrame);
            const originalLineCount = getLineCount(originalFrame);

            // Enter and exit question mode
            await typeText(stdin, 'q', { delayMs: 50 });
            await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));
            await typeKey(stdin, Keys.ESCAPE);
            await waitFor(() => expect(isInPlanView(lastFrame()!)).toBe(true));

            // Verify complete restoration
            const restoredFrame = lastFrame()!;
            const restoredFirstLine = getFirstContentLine(restoredFrame);
            const restoredTopLine = getFirstLine(restoredFrame);
            const restoredLineCount = getLineCount(restoredFrame);

            expect(restoredFirstLine).toBe(originalFirstLine);
            expect(restoredTopLine).toBe(originalTopLine);
            expect(restoredLineCount).toBe(originalLineCount);
            expect(hasVisibleHeader(restoredFrame)).toBe(true);
        });
    });

    describe('Delete Mode (x)', () => {
        test('toggling delete does not shift plan content', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'delete-stability-1.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture state before deleting
            const beforeFrame = lastFrame()!;
            const firstLineBefore = getFirstContentLine(beforeFrame);
            const topLineBefore = getFirstLine(beforeFrame);

            expect(firstLineBefore).toContain('Line 1');
            expect(hasVisibleHeader(beforeFrame)).toBe(true);

            // Toggle delete
            await typeText(stdin, 'x', { delayMs: 50 });
            await waitFor(() => {
                const frame = lastFrame()!;
                // Wait for the visual change (strikethrough) to appear
                expect(frame).toContain('Line 1');
            });

            // Verify nothing shifted (same first line visible, header still visible)
            const afterFrame = lastFrame()!;
            const firstLineAfter = getFirstContentLine(afterFrame);
            const topLineAfter = getFirstLine(afterFrame);

            expect(firstLineAfter).toContain('Line 1'); // Still the first visible line
            expect(topLineAfter).toBe(topLineBefore); // Top line unchanged
            expect(hasVisibleHeader(afterFrame)).toBe(true);
            expect(topLineAfter).toContain('─'); // Top border still first line
        });
    });

    describe('Approve Confirmation (Enter)', () => {
        test('entering approve confirmation does not shift plan content', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'approve-stability-1.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture state before entering confirmation
            const beforeFrame = lastFrame()!;
            const firstLineBefore = getFirstContentLine(beforeFrame);
            const topLineBefore = getFirstLine(beforeFrame);

            expect(firstLineBefore).toContain('Line 1');
            expect(hasVisibleHeader(beforeFrame)).toBe(true);

            // Enter approve confirmation
            await typeKey(stdin, Keys.ENTER);
            await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('approve plan'));

            // Verify content still visible and header not pushed off-screen
            const afterFrame = lastFrame()!;
            const topLineAfter = getFirstLine(afterFrame);

            expect(afterFrame).toContain('Line 1');
            expect(topLineAfter).toBe(topLineBefore); // Top line unchanged
            expect(topLineAfter).toContain('─'); // Top border still first line
        });

        test('exiting approve confirmation restores original content position', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'approve-stability-2.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Capture original state
            const originalFrame = lastFrame()!;
            const originalFirstLine = getFirstContentLine(originalFrame);
            const originalTopLine = getFirstLine(originalFrame);
            const originalLineCount = getLineCount(originalFrame);

            // Enter and exit approve confirmation
            await typeKey(stdin, Keys.ENTER);
            await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('approve plan'));
            await typeKey(stdin, Keys.ESCAPE);
            await waitFor(() => expect(isInPlanView(lastFrame()!)).toBe(true));

            // Verify complete restoration
            const restoredFrame = lastFrame()!;
            const restoredFirstLine = getFirstContentLine(restoredFrame);
            const restoredTopLine = getFirstLine(restoredFrame);
            const restoredLineCount = getLineCount(restoredFrame);

            expect(restoredFirstLine).toBe(originalFirstLine);
            expect(restoredTopLine).toBe(originalTopLine);
            expect(restoredLineCount).toBe(originalLineCount);
            expect(hasVisibleHeader(restoredFrame)).toBe(true);
        });
    });

    describe('Content Position After Scrolling', () => {
        test('entering command mode after scrolling maintains scroll position', async () => {
            const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n');
            const file = useTempPlanFile(lines, 'scroll-cmd-stability.md');
            const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
            await waitFor(() => expect(lastFrame()).toContain('Line 1'));

            // Scroll down to middle of content
            await typeKeys(stdin, Keys.DOWN_ARROW, 20);

            await waitFor(() => {
                const frame = lastFrame()!;
                expect(frame).toContain('Line 21');
            }, 15000);

            // Capture position after scrolling
            const scrolledFrame = lastFrame()!;
            const firstLineAfterScroll = getFirstContentLine(scrolledFrame);
            const topLineAfterScroll = getFirstLine(scrolledFrame);

            expect(firstLineAfterScroll).not.toContain('Line 1'); // Not at top anymore
            expect(hasVisibleHeader(scrolledFrame)).toBe(true); // Header still visible

            // Enter command mode
            await typeKey(stdin, ':');
            await waitFor(() => expect(isInCommandMode(lastFrame()!)).toBe(true));

            // Verify scroll position maintained AND header still visible
            const afterCommandFrame = lastFrame()!;
            const firstLineAfterCommand = getFirstContentLine(afterCommandFrame);
            const topLineAfterCommand = getFirstLine(afterCommandFrame);

            expect(firstLineAfterCommand).toBe(firstLineAfterScroll);
            expect(topLineAfterCommand).toBe(topLineAfterScroll);
            expect(hasVisibleHeader(afterCommandFrame)).toBe(true);
            expect(topLineAfterCommand).toContain('─'); // Top border still first line
        });
    });
});
