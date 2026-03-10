import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeText, waitFor, waitForRender } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import { hasDeletion, hasFeedback } from '~/test-utils/visual-assertions';

/**
 * Integration tests for exit decision flows
 * Tests approve, deny, and cancel confirmation flows via:
 * - Keyboard keys (Enter, Escape)
 * - Command mode (:wq, :wq!, :q, :q!)
 */
describe('decision exit-decisions integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    const addComment = async function (stdin: { write: (data: string) => void }, text = 'comment'): Promise<void> {
        await typeKey(stdin, 'c');
        await typeText(stdin, text, { enter: true });
    };

    const addQuestion = async function (stdin: { write: (data: string) => void }, text = 'question'): Promise<void> {
        await typeKey(stdin, 'q');
        await typeText(stdin, text, { enter: true });
    };

    const deleteLine = async function (stdin: { write: (data: string) => void }): Promise<void> {
        await typeKey(stdin, 'x');
    };

    // --- Approve flow (no feedback) ---

    test('Enter shows approve confirmation', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'decision-1.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('approve plan'));
    });

    test('Escape from confirmation returns to plan', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'decision-2.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, Keys.ENTER);

        await typeKey(stdin, Keys.ESCAPE);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Line 1');
            expect(output.toLowerCase()).not.toContain('approve');
        });
    });

    // --- Deny flow (with feedback) ---

    test('Enter shows deny confirmation with comment', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'decision-3.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await addComment(stdin);
        await waitFor(() => expect(hasFeedback(lastFrame()!)).toBe(true));

        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => {
            const output = lastFrame()!.toLowerCase();
            expect(output).toContain('send feedback');
            expect(output).toContain('1 comment');
        });
    });

    test('Enter shows deny confirmation with question', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'decision-3.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await addQuestion(stdin);
        await waitFor(() => expect(hasFeedback(lastFrame()!)).toBe(true));

        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => {
            const output = lastFrame()!.toLowerCase();
            expect(output).toContain('send feedback');
            expect(output).toContain('1 question');
        });
    });

    test('Enter shows deny confirmation with deletion', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'decision-3.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await deleteLine(stdin);
        await waitFor(() => expect(hasDeletion(lastFrame()!)).toBe(true));

        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => {
            const output = lastFrame()!.toLowerCase();
            expect(output).toContain('send feedback');
            expect(output).toContain('1 deletion');
        });
    });

    // --- Cancel flow ---

    test('Escape exits immediately without feedback', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'decision-4.md');

        const { stdin, lastFrame, unmount } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Press Escape - should exit immediately (no confirmation dialog)
        await typeKey(stdin, Keys.ESCAPE);

        // Verify no confirmation dialog appears (exit happens immediately)
        await waitForRender(300);
        const output = lastFrame()?.toLowerCase() || '';
        expect(output).not.toContain('exit plan');
        expect(output).not.toContain('discard feedback');

        unmount();
    });

    test('Escape shows cancel confirmation with feedback', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'decision-5.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await addComment(stdin);
        await waitFor(() => expect(hasFeedback(lastFrame()!)).toBe(true));

        await waitForRender(200);

        await typeKey(stdin, Keys.ESCAPE);

        await waitFor(() => {
            const output = lastFrame()!.toLowerCase();
            expect(output).toContain('exit plan');
            expect(output).toContain('discard feedback and exit?');
        });
    });

    // --- Confirmation escape behavior (applies to all confirmations) ---

    test('Escape from confirmation returns to plan with feedback preserved', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'decision-6.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await addComment(stdin);
        await waitFor(() => expect(hasFeedback(lastFrame()!)).toBe(true));

        await waitForRender(200);

        // Trigger cancel confirmation
        await typeKey(stdin, Keys.ESCAPE);

        // Escape from confirmation
        await typeKey(stdin, Keys.ESCAPE);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Line 1');
            expect(hasFeedback(output)).toBe(true);
        });
    });

    // --- Command mode exits (:wq, :q, etc) ---

    test(':wq shows approve confirmation when no feedback', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-1.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Enter command mode and type :wq
        await typeKey(stdin, ':');
        await typeText(stdin, 'wq', { enter: true });

        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('approve'));
    });

    test(':wq shows deny confirmation when feedback exists', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-2.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Add a comment first to create feedback
        await typeKey(stdin, 'c');
        await typeText(stdin, 'test', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('\u{1F4AC}'));
        await waitForRender(100);

        // Enter command mode and type :wq
        await typeKey(stdin, ':');
        await typeText(stdin, 'wq', { enter: true });

        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('send feedback'));
    });

    test(':q exits immediately when no feedback', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-3.md');

        const { stdin, lastFrame, unmount } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Enter command mode and type :q - should exit immediately (no confirmation)
        await typeKey(stdin, ':');
        await typeText(stdin, 'q', { enter: true });

        // Verify no confirmation dialog appears (exit happens immediately)
        await waitForRender(300);
        const output = lastFrame()?.toLowerCase() || '';
        expect(output).not.toContain('exit plan');
        expect(output).not.toContain('discard feedback');

        unmount();
    });

    test(':q shows cancel confirmation when feedback exists', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-4.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Add a comment first to create feedback
        await typeKey(stdin, 'c');
        await typeText(stdin, 'test', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('\u{1F4AC}'));
        await waitForRender(100);

        // Enter command mode and type :q
        await typeKey(stdin, ':');
        await typeText(stdin, 'q', { enter: true });

        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('discard'));
    });

    test(':wq! exits immediately without feedback (no confirmation)', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-5.md');

        const { stdin, lastFrame, unmount } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Enter command mode and type :wq! - should exit immediately (no confirmation)
        await typeKey(stdin, ':');
        await typeText(stdin, 'wq!', { enter: true });

        // Verify no confirmation dialog appears (exit happens immediately)
        await waitForRender(300);
        const output = lastFrame()?.toLowerCase() || '';
        expect(output).not.toContain('confirmation');
        expect(output).not.toContain('discard feedback');

        unmount();
    });

    test(':wq! exits immediately with feedback (no confirmation)', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-6.md');

        const { stdin, lastFrame, unmount } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Add a comment first to create feedback
        await typeKey(stdin, 'c');
        await typeText(stdin, 'test', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('\u{1F4AC}'));

        // Enter command mode and type :wq! - should exit immediately (no confirmation)
        await typeKey(stdin, ':');
        await typeText(stdin, 'wq!', { enter: true });

        // Verify no confirmation dialog appears (exit happens immediately)
        await waitForRender(300);
        const output = lastFrame()?.toLowerCase() || '';
        expect(output).not.toContain('confirmation');
        expect(output).not.toContain('discard feedback');

        unmount();
    });

    test(':q! exits immediately without feedback (no confirmation)', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-7.md');

        const { stdin, lastFrame, unmount } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Enter command mode and type :q! - should exit immediately (no confirmation)
        await typeKey(stdin, ':');
        await typeText(stdin, 'q!', { enter: true });

        // Verify no confirmation dialog appears (exit happens immediately)
        await waitForRender(300);
        const output = lastFrame()?.toLowerCase() || '';
        expect(output).not.toContain('confirmation');
        expect(output).not.toContain('discard feedback');

        unmount();
    });

    test(':q! exits immediately with feedback (no confirmation)', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-8.md');

        const { stdin, lastFrame, unmount } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Add a comment first to create feedback
        await typeKey(stdin, 'c');
        await typeText(stdin, 'test', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('\u{1F4AC}'));

        // Enter command mode and type :q! - should exit immediately (no confirmation)
        await typeKey(stdin, ':');
        await typeText(stdin, 'q!', { enter: true });

        // Verify no confirmation dialog appears (exit happens immediately)
        await waitForRender(300);
        const output = lastFrame()?.toLowerCase() || '';
        expect(output).not.toContain('confirmation');
        expect(output).not.toContain('discard feedback');

        unmount();
    });

    test('Escape from :wq confirmation returns to plan', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'decision-cmd-9.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Enter command mode and type :wq to show approve confirmation
        await typeKey(stdin, ':');
        await typeText(stdin, 'wq', { enter: true });

        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('approve'));

        // Cancel with Escape
        await typeKey(stdin, Keys.ESCAPE);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Line 1');
            expect(output.toLowerCase()).not.toContain('approve');
            expect(output.toLowerCase()).not.toContain('deny');
        });
    });
});
