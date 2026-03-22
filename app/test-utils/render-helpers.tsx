import { render as inkRender } from 'ink-testing-library';
import React from 'react';

import { PlanViewProvider } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { DEFAULT_SETTINGS, type Settings } from '~/utils/config/settings';

const NOOP = () => {};

/**
 * Render wrapper that only provides terminal dimensions.
 * Use for components that only need terminal size (no settings).
 *
 * Terminal dimensions are optional - if not provided, TerminalProvider will use
 * process.stdout dimensions or default to 80x24. Only specify dimensions when
 * testing specific terminal sizes.
 */
export const renderWithTerminalProvider = (
    component: React.ReactElement,
    options?: { terminalWidth?: number; terminalHeight?: number },
) => {
    return inkRender(
        <TerminalProvider terminalWidth={options?.terminalWidth} terminalHeight={options?.terminalHeight}>
            <SettingsProvider settings={DEFAULT_SETTINGS}>
                <PlanViewProvider
                    sessionId="test-session"
                    content=""
                    onShowHelp={NOOP}
                    onApprove={NOOP}
                    onDeny={NOOP}
                    onCancel={NOOP}
                >
                    {component}
                </PlanViewProvider>
            </SettingsProvider>
        </TerminalProvider>,
    );
};

/**
 * Render wrapper that provides both settings and terminal dimensions.
 * Use for components that need both settings context and terminal size.
 *
 * Terminal dimensions are optional - if not provided, TerminalProvider will use
 * process.stdout dimensions or default to 80x24. Only specify dimensions when
 * testing specific terminal sizes.
 */
export const renderWithProviders = (
    component: React.ReactElement,
    options?: { terminalWidth?: number; terminalHeight?: number; settings?: Settings },
) => {
    return inkRender(
        <SettingsProvider settings={options?.settings ?? DEFAULT_SETTINGS}>
            <TerminalProvider terminalWidth={options?.terminalWidth} terminalHeight={options?.terminalHeight}>
                <PlanViewProvider
                    sessionId="test-session"
                    content=""
                    onShowHelp={NOOP}
                    onApprove={NOOP}
                    onDeny={NOOP}
                    onCancel={NOOP}
                >
                    {component}
                </PlanViewProvider>
            </TerminalProvider>
        </SettingsProvider>,
    );
};

/**
 * Render wrapper that provides PlanViewProvider for components that need paddingX context.
 * Use for Plan and WrappedLine components that access usePlanViewStaticContext.
 *
 * Provides a minimal test plan content and mock handlers.
 */
export const renderWithPlanViewProvider = (
    component: React.ReactElement,
    options?: {
        terminalWidth?: number;
        terminalHeight?: number;
        content?: string;
        sessionId?: string;
    },
) => {
    const content = options?.content ?? 'Test plan content';
    const sessionId = options?.sessionId ?? 'test-session';

    return inkRender(
        <TerminalProvider terminalWidth={options?.terminalWidth} terminalHeight={options?.terminalHeight}>
            <SettingsProvider settings={DEFAULT_SETTINGS}>
                <PlanViewProvider
                    sessionId={sessionId}
                    content={content}
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
};
