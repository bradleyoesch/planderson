import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeKeys, typeText, waitFor, waitForRender } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import {
    areLinesSelected,
    countComments,
    countQuestions,
    getCursorLine,
    hasComment,
    hasQuestion,
    isInCommentMode,
    isInQuestionMode,
} from '~/test-utils/visual-assertions';

type FeedbackParams = {
    type: string;
    key: string;
    emoji: string;
    has: (frame: string, line: string) => boolean;
    count: (frame: string) => number;
    isInMode: (frame: string) => boolean;
};

describe.each([
    {
        type: 'comment',
        key: 'c',
        emoji: '💬',
        has: hasComment,
        count: countComments,
        isInMode: isInCommentMode,
    },
    {
        type: 'question',
        key: 'q',
        emoji: '❓',
        has: hasQuestion,
        count: countQuestions,
        isInMode: isInQuestionMode,
    },
] as FeedbackParams[])('feedback $type integration', ({ type, key, emoji, has, count, isInMode }) => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test(`should add ${type} with ${key} key`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', `${type}-1.md`);

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Allow time for useEffect hooks to execute and state to update
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Press key to enter feedback mode
        await typeKey(stdin, key);

        // Verify we're in feedback mode
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));

        // Type feedback text and save with Enter
        await typeText(stdin, `Test ${type}`, { enter: true });

        // Verify feedback appears in UI
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(frame).toContain(emoji);
            expect(has(frame, 'Line 1')).toBe(true);
            expect(count(frame)).toBe(1);
        }, 10000);
    });

    test(`should cancel ${type} with Escape`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2', `${type}-2.md`);

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Allow time for useEffect hooks to execute and state to update
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Start feedback
        await typeKey(stdin, key);
        await typeText(stdin, `${type} to cancel`);

        // Cancel with Escape
        await typeKey(stdin, Keys.ESCAPE);

        // Feedback should not appear
        const output = lastFrame();
        expect(output).not.toContain(`${type} to cancel`);
        expect(output).not.toContain(emoji);
    });

    test(`should edit existing ${type}`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2', `${type}-3.md`);

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Allow time for useEffect hooks to execute and state to update
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Add first feedback
        await typeKey(stdin, key);
        await typeText(stdin, 'First', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain(emoji));

        // Edit the same line's feedback
        await typeKey(stdin, key);

        // The existing feedback should be loaded for editing
        // Clear it and type new one
        await typeKeys(stdin, Keys.BACKSPACE, 20);

        await typeText(stdin, 'Edited', { enter: true });

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain(emoji);
            expect(output).toContain('Edited');
            expect(output).not.toContain('First');
        }, 10000);
    }, 15000);

    test(`can add multiple ${type}s on different lines`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', `${type}-multiple.md`);

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Verify pre-condition: no feedback exists
        expect(count(lastFrame()!)).toBe(0);

        // Add feedback on Line 1
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));
        await typeText(stdin, 'First', { enter: true });
        await waitFor(() => {
            expect(has(lastFrame()!, 'Line 1')).toBe(true);
        }, 10000);

        // Verify cursor is on Line 1 after adding first feedback
        expect(getCursorLine(lastFrame()!)).toBe('Line 1');

        // Move to Line 3
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Verify cursor moved to Line 3
        await waitFor(() => {
            const cursorLine = getCursorLine(lastFrame()!);
            expect(cursorLine).toBe('Line 3');
        }, 10000);

        // Add feedback on Line 3
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));
        await typeText(stdin, 'Second', { enter: true });

        // Verify both feedback items exist and only on their respective lines
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(count(frame)).toBe(2);
            expect(has(frame, 'Line 1')).toBe(true);
            expect(has(frame, 'Line 3')).toBe(true);
            expect(has(frame, 'Line 2')).toBe(false);
            expect(has(frame, 'Line 4')).toBe(false);
        }, 10000);
    }, 15000);

    test(`can delete ${type} by erasing all content in an existing ${type} and pressing enter`, async () => {
        // Bug (#85): Feedback editing appears broken. When editing feedback and erasing all content,
        // pressing Enter should delete the feedback (reducer supports this), but the feedback
        // remains. This is related to the existing "should edit existing ${type}" test also failing.
        // The edit flow seems to have issues - sometimes Enter triggers plan approval/denial
        // instead of saving the feedback edit.
        // See GitHub issue #85 for details.
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', `${type}-delete-erase.md`);

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Add feedback first
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));
        await typeText(stdin, `${type} to delete`, { enter: true });

        await waitFor(() => {
            expect(has(lastFrame()!, 'Line 1')).toBe(true);
            expect(count(lastFrame()!)).toBe(1);
        }, 10000);

        // Edit the feedback and erase all content
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));

        // Erase all content (30 backspaces to be sure)
        await typeKeys(stdin, Keys.BACKSPACE, 30);
        await waitForRender(200);

        // Press enter to save empty feedback (should delete it)
        await typeKey(stdin, Keys.ENTER);

        // Verify feedback is deleted
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(has(frame, 'Line 1')).toBe(false);
            expect(count(frame)).toBe(0);
            expect(frame).not.toContain(emoji);
        }, 10000);
    }, 15000);

    test(`can add a ${type} after multi selecting lines, and shows that ${type} above the first line, and only one ${type} total`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', `${type}-multiselect.md`);

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Verify pre-condition: cursor on Line 1, no feedback
        expect(getCursorLine(lastFrame()!)).toBe('Line 1');
        expect(count(lastFrame()!)).toBe(0);

        // Multi-select lines 1-3 using Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Verify selection includes lines 1-3
        await waitFor(() => {
            expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);
        });

        // Add feedback while selection is active
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));
        await typeText(stdin, `Multi-line ${type}`, { enter: true });

        // Verify feedback appears only above first selected line (Line 1)
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(count(frame)).toBe(1);
            expect(has(frame, 'Line 1')).toBe(true);
            expect(has(frame, 'Line 2')).toBe(false);
            expect(has(frame, 'Line 3')).toBe(false);
        }, 10000);
    }, 15000);

    test(`can add a ${type} after multi selecting lines, and can press ${key} on any of those lines to edit the ${type}`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', `${type}-multiselect-edit.md`);

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Multi-select lines 1-2
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await waitFor(() => expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2'])).toBe(true));

        // Add feedback
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));
        await typeText(stdin, `Original ${type}`, { enter: true });

        await waitFor(() => {
            expect(count(lastFrame()!)).toBe(1);
            expect(has(lastFrame()!, 'Line 1')).toBe(true);
        });

        // After save, Lines 1-2 are still selected (Issue #136) — press key directly to edit
        await waitFor(() => expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2'])).toBe(true));

        // Press key to edit the feedback (selection covers Lines 1-2, so editor opens for that range)
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));

        // Clear and type new text
        await typeKeys(stdin, Keys.BACKSPACE, 20);
        await typeText(stdin, `Edited ${type}`, { enter: true });

        // Verify: should still be 1 feedback item, and it should be edited
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(count(frame)).toBe(1); // Still only 1
            expect(has(frame, 'Line 1')).toBe(true); // Still above Line 1
            expect(has(frame, 'Line 2')).toBe(false); // Not above Line 2
            expect(frame).toContain(`Edited ${type}`);
            expect(frame).not.toContain(`Original ${type}`);
        });
    });

    test(`can add a ${type} after multi selecting lines, and reselect those same lines and delete the ${type}`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', `${type}-multiselect-delete.md`);

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Multi-select lines 1-2
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await waitFor(() => expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2'])).toBe(true));

        // Add feedback
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));
        await typeText(stdin, `${type} to delete`, { enter: true });

        await waitFor(() => {
            expect(count(lastFrame()!)).toBe(1);
            expect(has(lastFrame()!, 'Line 1')).toBe(true);
        });

        // Selection is preserved after saving (Issue #136) — Lines 1+2 are still selected
        await waitFor(() => expect(areLinesSelected(lastFrame()!, ['Line 1', 'Line 2'])).toBe(true));

        // Open feedback editor and erase all content
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));

        await typeKeys(stdin, Keys.BACKSPACE, 20);
        await waitForRender(50);

        await typeKey(stdin, Keys.ENTER);

        // Verify feedback is deleted
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(count(frame)).toBe(0);
            expect(has(frame, 'Line 1')).toBe(false);
            expect(has(frame, 'Line 2')).toBe(false);
        });
    });

    test(`selecting overlapping range loads ${type} text from lowest line number`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', `${type}-overlap-load.md`);
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Add feedback on lines 1-3
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, key);
        await typeText(stdin, `Original ${type} on 1-3`, { enter: true });
        await waitFor(() => expect(count(lastFrame()!)).toBe(1));

        // Select overlapping range 2-4 (cursor on line 4, outside original range)
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Press key - should load existing feedback text
        await typeKey(stdin, key);
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(isInMode(frame)).toBe(true);
            expect(frame).toContain(`Original ${type} on 1-3`);
        });
    }, 15000);

    test(`pressing Enter on overlapping range without editing extends ${type} to union of ranges`, async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', `${type}-overlap-extend.md`);
        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Add feedback on lines 1-3
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, key);
        await typeText(stdin, `Original ${type}`, { enter: true });
        await waitFor(() => expect(count(lastFrame()!)).toBe(1));

        // Select overlapping range 2-4 (overlaps at line 2-3)
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Press key and Enter without editing
        await typeKey(stdin, key);
        await waitFor(() => expect(isInMode(lastFrame()!)).toBe(true));
        await typeKey(stdin, Keys.ENTER);

        // Should have 1 feedback item on union of ranges (lines 1-4)
        await waitFor(() => {
            const frame = lastFrame()!;
            expect(count(frame)).toBe(1);
            expect(has(frame, 'Line 1')).toBe(true); // Still has line 1
            expect(frame).toContain(`Original ${type}`);
        });
    }, 15000);
});

/**
 * Question-specific tests (behaviors unique to questions, not shared with comments)
 */
describe('feedback feedback integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test('should add global question with Shift+Q', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'question-global.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Press 'Q' (Shift+q) to enter global question mode
        await typeKey(stdin, 'Q');

        // Type global question with delay between characters and save with Enter
        await typeText(stdin, 'Global question', { enter: true });

        // Verify we return to plan mode and plan content is still visible
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
    });
});
