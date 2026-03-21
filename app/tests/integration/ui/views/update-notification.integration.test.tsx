import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { AppInner } from '~/App';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { typeKey, waitFor } from '~/test-utils/ink-helpers';
import { isInCommandMode } from '~/test-utils/view-assertions';
import { hasUpdateNotification } from '~/test-utils/view-assertions';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

/**
 * Integration tests for background update check and TUI notification.
 *
 * Uses AppInner with injected planLoader so tests don't require real socket connections.
 * Mocks fetchLatestVersion to control whether an update is "available".
 */
describe('views update-notification integration', () => {
    let mockExit: ReturnType<typeof mock>;

    beforeEach(() => {
        mockExit = mock(() => {});
    });

    afterEach(() => {
        cleanup();
        mock.restore();
    });

    const renderWithUpdate = (latestVersion: string | null) => {
        mock.module('~/commands/upgrade', () => ({
            fetchLatestVersion: () => Promise.resolve(latestVersion),
            stripVersionPrefix: (tag: string) => tag.replace(/^v/, ''),
            runUpgrade: mock(() => Promise.resolve()),
        }));

        return render(
            <TerminalProvider terminalWidth={80} terminalHeight={24}>
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <AppInner
                        sessionId="test-update"
                        mode="file"
                        filepath={null}
                        settings={DEFAULT_SETTINGS}
                        error={null}
                        registryId={null}
                        exit={mockExit}
                        planLoader={{ content: 'Line 1\nLine 2', error: null, isLoading: false, socketClient: null }}
                    />
                </SettingsProvider>
            </TerminalProvider>,
        );
    };

    test('shows update notification when newer version available', async () => {
        const { lastFrame } = renderWithUpdate('9.9.9');
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitFor(() => expect(hasUpdateNotification(lastFrame()!)).toBe(true));
    });

    test('no notification when already on latest version (null returned)', async () => {
        const { lastFrame } = renderWithUpdate(null);
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        // Wait a tick to let any async effect settle
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(hasUpdateNotification(lastFrame()!)).toBe(false);
    });

    test('notification replaced by command input when : pressed', async () => {
        const { stdin, lastFrame } = renderWithUpdate('9.9.9');
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));
        await waitFor(() => expect(hasUpdateNotification(lastFrame()!)).toBe(true));

        // Press : to enter command mode
        await typeKey(stdin, ':');
        await waitFor(() => expect(isInCommandMode(lastFrame()!)).toBe(true));

        // Notification must not appear while in command mode
        expect(hasUpdateNotification(lastFrame()!)).toBe(false);
    });
});
