import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';

/**
 * Integration tests for error view behavior
 * Tests error display and dismissal
 */
describe('views error-view integration', () => {
    // Suppress React error boundary console output for intentional error tests
    let consoleErrorSpy: typeof console.error;

    beforeEach(() => {
        consoleErrorSpy = console.error;
        console.error = () => {}; // Suppress React error boundary logs
    });

    afterEach(() => {
        console.error = consoleErrorSpy; // Restore console.error
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test('should show error for missing file', async () => {
        const { lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath="/nonexistent/file.md" />);

        await waitFor(() => expect(lastFrame()!.toLowerCase()).toContain('not found'));
    });

    test('should show error for startup error prop', async () => {
        const { lastFrame } = render(
            <App {...DEFAULT_APP_PROPS} filepath="/dummy/file.md" error={new Error('Custom startup error')} />,
        );

        await waitFor(() => expect(lastFrame()).toContain('Custom startup error'));
    });
});
