import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';

/**
 * Integration tests for approveAction setting
 * Tests that approval confirmation (shown when NO feedback exists) displays different messages
 * based on the setting.
 *
 * Note: When feedback exists, pressing Enter shows confirm-deny mode instead,
 * which doesn't use the approveAction setting.
 */
describe('decision approval-settings integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test('default settings show "approve plan" message', async () => {
        expect(DEFAULT_APP_PROPS.settings.approveAction).toBe('approve');

        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'approval-default.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
        await waitFor(() => expect(lastFrame()).toContain('Line 1'), 10000);

        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => {
            const frame = lastFrame()!;
            expect(frame.toLowerCase()).toContain('approve plan');
            expect(frame.toLowerCase()).toContain('approve plan');
            expect(frame.toLowerCase()).not.toContain('exit (approve manually)');
        });
    });

    test('approveAction exit shows "exit (approve manually)" message', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', 'approval-exit.md');
        const settingsWithExitOnly = {
            ...DEFAULT_APP_PROPS.settings,
            approveAction: 'exit' as const,
        };
        const { lastFrame, stdin } = render(
            <App {...DEFAULT_APP_PROPS} filepath={file} settings={settingsWithExitOnly} />,
        );
        await waitFor(() => expect(lastFrame()).toContain('Line 1'), 10000);

        await typeKey(stdin, Keys.ENTER);

        await waitFor(() => {
            const frame = lastFrame()!;
            expect(frame.toLowerCase()).toContain('approve plan');
            expect(frame.toLowerCase()).toContain('exit (approve manually)');
            expect(frame.toLowerCase()).not.toContain('approve plan as is');
        });
    });
});
