import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';

/**
 * Integration tests verifying that the rendered frame fills exactly terminalHeight lines.
 *
 * These catch the off-by-one height bug (issue #5) where viewportHeight starts at 1
 * instead of the correct value, causing the plan content to overflow and push the
 * header off-screen on the first frame.
 *
 * Passing terminalHeight explicitly to App gives ink-testing-library the same
 * dimensions the real TUI uses, so lastFrame().split('\n').length is deterministic.
 */
describe('layout frame-height integration', () => {
    afterEach(() => {
        cleanup();
    });

    test.each([20, 24, 30])('initial frame fills terminal height %d exactly', async (terminalHeight) => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3', `height-test-${terminalHeight}.md`);
        const { lastFrame } = render(
            <App {...DEFAULT_APP_PROPS} terminalHeight={terminalHeight} terminalWidth={80} filepath={file} />,
        );

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        const frame = lastFrame()!;
        // Frame must fill exactly terminalHeight lines
        expect(frame.split('\n').length).toBe(terminalHeight);
        // Top border must be visible — if blank, header was scrolled off (regression: issue #5)
        expect(frame.split('\n')[0]).toContain('─');
    });
});
