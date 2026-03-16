import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { AppInner } from '~/App';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import type { PlandersonSocketClient } from '~/lib/socket-ipc';
import { Keys, typeKey, typeText, waitFor } from '~/test-utils/ink-helpers';
import { hasComment, hasDeletion, isLineDeleted } from '~/test-utils/visual-assertions';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

/**
 * Integration tests verifying the content of the message sent to the socket
 * when the user confirms a deny decision with different feedback types.
 *
 * These tests cover the seam between UI feedback (comments/questions/deletions)
 * and the formatted message written to the socket client.
 */
describe('decision decision-socket-send integration', () => {
    let mockExit: ReturnType<typeof mock>;
    let sendDecisionSpy: ReturnType<typeof mock>;
    let mockSocketClient: PlandersonSocketClient;

    beforeEach(() => {
        mockExit = mock(() => {});
        sendDecisionSpy = mock(() => {});
        mockSocketClient = { sendDecision: sendDecisionSpy } as unknown as PlandersonSocketClient;
    });

    afterEach(() => {
        cleanup();
    });

    const renderWithContent = (content: string) =>
        render(
            <TerminalProvider terminalWidth={80} terminalHeight={24}>
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <AppInner
                        sessionId="test123"
                        mode="socket"
                        filepath={null}
                        settings={DEFAULT_SETTINGS}
                        error={null}
                        registryId={null}
                        exit={mockExit}
                        planLoader={{ content, error: null, isLoading: false, socketClient: mockSocketClient }}
                    />
                </SettingsProvider>
            </TerminalProvider>,
        );

    test('deny with comment -> sendDecision called with formatted comments section', async () => {
        const { stdin, lastFrame } = renderWithContent('Line 1\nLine 2\nLine 3');
        await waitFor(() => expect(lastFrame()).toContain('Line 1'), 10000);

        await typeKey(stdin, 'c');
        await typeText(stdin, 'needs more detail', { enter: true });
        await waitFor(() => expect(hasComment(lastFrame()!, 'Line 1')).toBe(true));

        await typeKey(stdin, Keys.ENTER);
        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('send feedback'));
        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => expect(sendDecisionSpy).toHaveBeenCalled());

        const decision = sendDecisionSpy.mock.calls[0][0] as string;
        const message = sendDecisionSpy.mock.calls[0][1] as string;
        expect(decision).toBe('deny');
        expect(message).toContain('Comments on the plan:');
        expect(message).toContain('Line 1: "Line 1"');
        expect(message).toContain('needs more detail');
    });

    test('deny with question -> sendDecision called with formatted questions section and LLM instructions', async () => {
        const { stdin, lastFrame } = renderWithContent('Step 1\nStep 2\nStep 3');
        await waitFor(() => expect(lastFrame()).toContain('Step 1'), 10000);

        await typeKey(stdin, 'q');
        await typeText(stdin, 'what is the timeline?', { enter: true });
        await waitFor(() => expect(lastFrame()).toContain('❓'));

        await typeKey(stdin, Keys.ENTER);
        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('send feedback'));
        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => expect(sendDecisionSpy).toHaveBeenCalled());

        const decision = sendDecisionSpy.mock.calls[0][0] as string;
        const message = sendDecisionSpy.mock.calls[0][1] as string;
        expect(decision).toBe('deny');
        expect(message).toContain('Questions about the plan:');
        expect(message).toContain('Line 1: "Step 1"');
        expect(message).toContain('what is the timeline?');
        expect(message).toContain('Please answer these questions');
        expect(message).toContain('Do NOT call ExitPlanMode');
    });

    test('deny with deletion -> sendDecision called with formatted deletions section', async () => {
        const { stdin, lastFrame } = renderWithContent('Line 1\nLine 2\nLine 3');
        await waitFor(() => expect(lastFrame()).toContain('Line 1'), 10000);

        await typeKey(stdin, 'x');
        await waitFor(() => expect(isLineDeleted(lastFrame()!, 'Line 1')).toBe(true));

        await typeKey(stdin, Keys.ENTER);
        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('send feedback'));
        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => expect(sendDecisionSpy).toHaveBeenCalled());

        const decision = sendDecisionSpy.mock.calls[0][0] as string;
        const message = sendDecisionSpy.mock.calls[0][1] as string;
        expect(decision).toBe('deny');
        expect(message).toContain('Delete lines:');
        expect(message).toContain('Line 1: "Line 1"');
    });

    test('deny with comment and deletion -> sendDecision message contains both sections', async () => {
        const { stdin, lastFrame } = renderWithContent('Line 1\nLine 2\nLine 3');
        await waitFor(() => expect(lastFrame()).toContain('Line 1'), 10000);

        await typeKey(stdin, 'c');
        await typeText(stdin, 'important note', { enter: true });
        await waitFor(() => expect(hasComment(lastFrame()!, 'Line 1')).toBe(true));

        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, 'x');
        await waitFor(() => expect(hasDeletion(lastFrame()!)).toBe(true));

        await typeKey(stdin, Keys.ENTER);
        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('send feedback'));
        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => expect(sendDecisionSpy).toHaveBeenCalled());

        const decision = sendDecisionSpy.mock.calls[0][0] as string;
        const message = sendDecisionSpy.mock.calls[0][1] as string;
        expect(decision).toBe('deny');
        expect(message).toContain('Comments on the plan:');
        expect(message).toContain('important note');
        expect(message).toContain('Delete lines:');
        expect(message).toContain('Line 2: "Line 2"');
    });
});
