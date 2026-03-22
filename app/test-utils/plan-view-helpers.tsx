import { mock } from 'bun:test';
import React, { useEffect } from 'react';

import { PlanViewProvider, usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

type PlanViewProviderProps = Omit<React.ComponentProps<typeof PlanViewProvider>, 'children'>;

/**
 * Factory for PlanViewProviderProps (minus children).
 * Creates fresh mock functions on each call.
 */
export const createPlanViewProps = (overrides?: Partial<PlanViewProviderProps>): PlanViewProviderProps => ({
    content: Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n'),
    sessionId: 'test123',
    onShowHelp: mock(() => {}),
    onApprove: mock(() => {}),
    onDeny: mock(() => {}),
    onCancel: mock(() => {}),
    ...overrides,
});

/**
 * Creates a wrapper component for renderHook that sets up:
 * TerminalProvider > PlanViewProvider > ViewportHeightSetter
 *
 * Terminal dimensions are optional - if not provided in viewport config,
 * TerminalProvider will use process.stdout dimensions or default to 80x24.
 */
export const createPlanViewWrapper = (
    props = createPlanViewProps(),
    viewport: { viewportHeight: number; terminalHeight?: number } = { viewportHeight: 20 },
) => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => {
        const ViewportHeightSetter = ({ children: c }: { children: React.ReactNode }) => {
            const { state, dispatch } = usePlanViewDynamicContext();

            useEffect(() => {
                if (state.viewportHeight !== viewport.viewportHeight) {
                    dispatch({ type: 'SET_VIEWPORT_HEIGHT', height: viewport.viewportHeight });
                }
            }, [state.viewportHeight, dispatch]);

            return <>{c}</>;
        };

        return (
            <TerminalProvider terminalHeight={viewport.terminalHeight}>
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <PlanViewProvider {...props}>
                        <ViewportHeightSetter>{children}</ViewportHeightSetter>
                    </PlanViewProvider>
                </SettingsProvider>
            </TerminalProvider>
        );
    };
    Wrapper.displayName = 'TestWrapper';
    return Wrapper;
};

/**
 * Creates a test hook that combines a hook with PlanView context access.
 * Returns state, dispatch, and all static context values.
 */
export const createPlanViewTestHook = (hook: () => void) => () => {
    const { state, dispatch } = usePlanViewDynamicContext();
    const staticContext = usePlanViewStaticContext();
    hook();
    return { state, dispatch, ...staticContext };
};
