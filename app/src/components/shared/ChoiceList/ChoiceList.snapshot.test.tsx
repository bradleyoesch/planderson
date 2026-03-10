import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import React from 'react';

import { normalizeSnapshot } from '~/test-utils/snapshot-helpers';

import { ChoiceList } from './ChoiceList';

describe('ChoiceList snapshots', () => {
    test('snapshot: selectedIndex=0 shows arrow on first item', () => {
        const { lastFrame } = render(<ChoiceList selectedIndex={0} />);
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: selectedIndex=1 shows arrow on second item', () => {
        const { lastFrame } = render(<ChoiceList selectedIndex={1} />);
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });
});
