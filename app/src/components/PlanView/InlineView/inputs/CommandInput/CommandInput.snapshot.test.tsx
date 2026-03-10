import { describe, expect, test } from 'bun:test';
import React from 'react';

import { renderWithTerminalProvider as render } from '~/test-utils/render-helpers';
import { normalizeSnapshot } from '~/test-utils/snapshot-helpers';

import { CommandInput } from './CommandInput';

describe('CommandInput snapshots', () => {
    test('snapshot: single-line command text', () => {
        const { lastFrame } = render(<CommandInput commandText=":wq" inputCursor={3} />, { terminalWidth: 40 });
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: command text wraps to multiple lines at narrow terminal width', () => {
        // terminalWidth=20, no padding subtraction → effectiveWidth=20
        // ':' is a break char so renders on its own line; 20 'a's fit exactly on the next line
        const longText = `:${'a'.repeat(20)}`;
        const { lastFrame } = render(<CommandInput commandText={longText} inputCursor={longText.length} />, {
            terminalWidth: 20,
        });
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });
});
