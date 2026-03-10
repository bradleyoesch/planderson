import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeText, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import { hasHelpSection, isInHelpView, isInPlanView } from '~/test-utils/view-assertions';

/**
 * Integration tests for help view behavior
 * Tests showing and hiding the help screen via:
 * - ? key (toggle help)
 * - :h and :help commands
 * - Escape key (return to plan view)
 */
describe('views help-view integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test(':h shows help view', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'help-cmd-h.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Enter command mode and type :h
        await typeKey(stdin, ':');
        await typeText(stdin, 'h', { enter: true });

        await waitFor(() => expect(isInHelpView(lastFrame()!)).toBe(true));
    });

    test(':help shows help view', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'help-cmd-help.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Enter command mode and type :help
        await typeKey(stdin, ':');
        await typeText(stdin, 'help', { enter: true });

        await waitFor(() => expect(isInHelpView(lastFrame()!)).toBe(true));
    });

    test('should show help with question mark', async () => {
        const file = useTempPlanFile('Line 1\nLine 2', 'help-1.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Show help
        await typeKey(stdin, '?');

        await waitFor(() => {
            const output = lastFrame()!;
            expect(isInHelpView(output)).toBe(true);
            expect(hasHelpSection(output, 'Navigation')).toBe(true);
        }, 10000);
    });

    test('should return to plan view from help with question mark', async () => {
        const file = useTempPlanFile('Line 1\nLine 2', 'help-2.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Show help
        await typeKey(stdin, '?');

        await waitFor(() => expect(isInHelpView(lastFrame()!)).toBe(true));

        // Hide help
        await typeKey(stdin, '?');

        await waitFor(() => {
            const output = lastFrame()!;
            expect(isInPlanView(output)).toBe(true);
            expect(isInHelpView(output)).toBe(false);
        });
    });

    test('should return to plan view from help with Escape', async () => {
        const file = useTempPlanFile('Line 1\nLine 2', 'help-3.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        await typeKey(stdin, '?');

        await waitFor(() => expect(isInHelpView(lastFrame()!)).toBe(true));

        await typeKey(stdin, Keys.ESCAPE);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Line 1');
            expect(output).not.toContain('Navigation');
        });
    });
});
