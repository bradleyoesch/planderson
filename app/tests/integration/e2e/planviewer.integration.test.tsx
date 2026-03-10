import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeText, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';

/**
 * End-to-end integration tests for Planderson
 *
 * These tests verify complete user workflows that combine multiple features.
 * For focused feature tests, see tests/integration/ui/
 */
describe('e2e planviewer integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test('navigate, add comment, and mark deletion in one session', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'workflow-1.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Allow time for useEffect hooks to execute and state to update
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Navigate to line 2
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Add comment
        await typeKey(stdin, 'c');
        await typeText(stdin, 'Test2', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('💬'));

        // Navigate to line 3
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Mark for deletion
        await typeKey(stdin, 'x');

        // Navigate to line 4
        await typeKey(stdin, Keys.DOWN_ARROW);

        // Add another comment
        await typeKey(stdin, 'c');
        await typeText(stdin, 'Test4', { enter: true });

        // Verify comments are visible (they should show with emoji)
        await waitFor(() => expect(lastFrame()).toContain('💬'));
    });
});
