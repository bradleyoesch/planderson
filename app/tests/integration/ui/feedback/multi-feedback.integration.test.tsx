import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeText, waitFor, waitForRender } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import { isShowingDenialConfirmation } from '~/test-utils/view-assertions';
import { countComments, countQuestions, hasComment, hasQuestion, isLineDeleted } from '~/test-utils/visual-assertions';

/**
 * Integration tests for multiple feedback types on the same line
 * Tests combining comments, questions, and deletions on a single line
 */
describe('feedback multi-feedback integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test('can add a comment, question, and deletion on the same line, renders correctly, and shows correct counts in denial confirmation', async () => {
        // Bug (#86): Cannot add both a comment and a question on the same line.
        // After adding a comment on Line 1, attempting to add a question with 'q' fails.
        // The question is not added to the line.
        // Expected behavior: Should support multiple feedback types on the same line
        // (comment + question + deletion).
        // See GitHub issue #86 for details.
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'multi-feedback.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Verify pre-condition: no feedback exists
        expect(countComments(lastFrame()!)).toBe(0);
        expect(countQuestions(lastFrame()!)).toBe(0);
        expect(isLineDeleted(lastFrame()!, 'Line 1')).toBe(false);

        // Add comment on Line 1
        await typeKey(stdin, 'c');
        await typeText(stdin, 'Test comment', { enter: true });
        await waitFor(() => expect(hasComment(lastFrame()!, 'Line 1')).toBe(true));

        // Add question on Line 1
        await waitForRender(100);
        await typeKey(stdin, 'q');
        await typeText(stdin, 'Test question', { enter: true });
        await waitFor(() => expect(hasQuestion(lastFrame()!, 'Line 1')).toBe(true));

        // Add deletion on Line 1
        await waitForRender(100);
        await typeKey(stdin, 'x');
        await waitFor(() => expect(isLineDeleted(lastFrame()!, 'Line 1')).toBe(true));

        // Verify all three feedback types are rendered correctly
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(hasComment(frame, 'Line 1')).toBe(true);
            expect(hasQuestion(frame, 'Line 1')).toBe(true);
            expect(isLineDeleted(frame, 'Line 1')).toBe(true);
            expect(countComments(frame)).toBe(1);
            expect(countQuestions(frame)).toBe(1);
        });

        // Press Enter to trigger denial with feedback
        await typeKey(stdin, Keys.ENTER);

        // Verify denial confirmation shows correct counts
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(isShowingDenialConfirmation(frame)).toBe(true);
            expect(frame).toContain('1 comment');
            expect(frame).toContain('1 question');
            expect(frame).toContain('1 deletion');
        }, 10000);
    }, 20000);
});
