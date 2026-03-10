import { describe, expect, test } from 'bun:test';
import { Text } from 'ink';
import React from 'react';

import { renderWithProviders } from '~/test-utils/render-helpers';

import { InlinePane } from './InlinePane';

describe('InlinePane', () => {
    test('renders title', () => {
        const { lastFrame } = renderWithProviders(
            <InlinePane title="My pane">
                <Text>content</Text>
            </InlinePane>,
        );

        expect(lastFrame()).toContain('My pane');
    });

    test('renders children', () => {
        const { lastFrame } = renderWithProviders(
            <InlinePane title="My pane">
                <Text>child content</Text>
            </InlinePane>,
        );

        expect(lastFrame()).toContain('child content');
    });
});
