import { describe, expect, test } from 'bun:test';
import { render as inkRender } from 'ink-testing-library';
import React from 'react';

import { PlanViewProvider } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { normalizeSnapshot } from '~/test-utils/snapshot-helpers';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

import { ErrorView } from './ErrorView';

describe('ErrorView snapshots', () => {
    // Helper factory to create width-aware render function
    const createRenderWithWidth = (width: number) => (component: React.ReactElement) =>
        inkRender(
            <TerminalProvider terminalWidth={width} terminalHeight={24}>
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <PlanViewProvider
                        sessionId="test-session"
                        content=""
                        onShowHelp={() => {}}
                        onApprove={() => {}}
                        onDeny={() => {}}
                        onCancel={() => {}}
                    >
                        {component}
                    </PlanViewProvider>
                </SettingsProvider>
            </TerminalProvider>,
        );

    // Default render for non-width-specific tests
    const render = createRenderWithWidth(80);

    test('snapshot: simple error message', () => {
        const { lastFrame } = render(<ErrorView error="Connection failed" />);
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: multi-line error message', () => {
        const errorMessage = `Socket connection failed
Reason: ECONNREFUSED
Port: 8080`;
        const { lastFrame } = render(<ErrorView error={errorMessage} />);
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: error with special characters', () => {
        const errorMessage = `Parsing failed: unexpected characters "~!@#$%^&*()[]{}|\\/<>?'" 你好 🚀✨❌`;
        const { lastFrame } = render(<ErrorView error={errorMessage} />);
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: empty error message', () => {
        const { lastFrame } = render(<ErrorView error="" />);
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });
});
