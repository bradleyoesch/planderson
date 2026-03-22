import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import React from 'react';

import { PlanViewStaticContext, PlanViewStaticContextValue } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { normalizeSnapshot } from '~/test-utils/snapshot-helpers';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

import { PlanFooter } from './PlanFooter';

const NOOP = () => {};

const BASE_STATIC_CONTEXT: PlanViewStaticContextValue = {
    sessionId: 'test-session',
    contentLines: [],
    wrappedLines: [],
    paddingX: 1,
    latestVersion: null,
    upgradedVersion: null,
    onShowHelp: NOOP,
    onApprove: NOOP,
    onDeny: NOOP,
    onCancel: NOOP,
};

describe('PlanFooter snapshots', () => {
    test('snapshot: update available', () => {
        const { lastFrame } = render(
            <TerminalProvider terminalWidth={80} terminalHeight={24}>
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <PlanViewStaticContext.Provider value={{ ...BASE_STATIC_CONTEXT, latestVersion: '9.9.9' }}>
                        <PlanFooter />
                    </PlanViewStaticContext.Provider>
                </SettingsProvider>
            </TerminalProvider>,
        );
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: upgraded version', () => {
        const { lastFrame } = render(
            <TerminalProvider terminalWidth={80} terminalHeight={24}>
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <PlanViewStaticContext.Provider value={{ ...BASE_STATIC_CONTEXT, upgradedVersion: '9.9.9' }}>
                        <PlanFooter />
                    </PlanViewStaticContext.Provider>
                </SettingsProvider>
            </TerminalProvider>,
        );
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });
});
