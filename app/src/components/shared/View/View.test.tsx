import { describe, expect, test } from 'bun:test';
import { Text } from 'ink';
import React from 'react';

import { renderWithProviders } from '~/test-utils/render-helpers';

import { View } from './View';
describe('View', () => {
    test('renders children', () => {
        const { lastFrame } = renderWithProviders(
            <View title="Test title">
                <Text>Main content</Text>
            </View>,
        );

        expect(lastFrame()).toContain('Main content');
    });

    test('renders with title', () => {
        const { lastFrame } = renderWithProviders(
            <View title="Header content">
                <Text>Main content</Text>
            </View>,
        );

        const output = lastFrame();
        expect(output).toContain('Header content');
        expect(output).toContain('Main content');
    });

    test('renders with footer', () => {
        const { lastFrame } = renderWithProviders(
            <View title="Test title" footer={<Text>Footer content</Text>}>
                <Text>Main content</Text>
            </View>,
        );

        const output = lastFrame();
        expect(output).toContain('Main content');
        expect(output).toContain('Footer content');
    });

    test('renders with title, children, and footer', () => {
        const { lastFrame } = renderWithProviders(
            <View title="Top" footer={<Text>Bottom</Text>}>
                <Text>Middle</Text>
            </View>,
        );

        const output = lastFrame();
        expect(output).toContain('Top');
        expect(output).toContain('Middle');
        expect(output).toContain('Bottom');
    });
});
