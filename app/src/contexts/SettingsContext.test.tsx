import { describe, expect, test } from 'bun:test';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import React from 'react';

import { TEST_DEFAULT_SETTINGS } from '~/test-utils/fixtures/settings';
import { Settings } from '~/utils/config/settings';

import { SettingsProvider, useSettings } from './SettingsContext';

// Test component that uses the hook
const TestComponent: React.FC = () => {
    const { settings } = useSettings();
    return <Text>approveAction: {settings.approveAction}</Text>;
};

describe('SettingsContext', () => {
    describe('SettingsProvider', () => {
        test('provides settings to child components', () => {
            const testSettings: Settings = {
                ...TEST_DEFAULT_SETTINGS,
                approveAction: 'exit',
            };

            const { lastFrame } = render(
                <SettingsProvider settings={testSettings}>
                    <TestComponent />
                </SettingsProvider>,
            );

            expect(lastFrame()).toContain('approveAction: exit');
        });
    });

    // Note: Testing that useSettings throws outside provider is not included
    // because Ink's error boundaries make it difficult to test.
    // The error is tested implicitly by other component tests that fail
    // when components using ConfirmApprove are not wrapped in SettingsProvider.
});
