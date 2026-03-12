import { useApp } from 'ink';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ErrorView } from '~/components/ErrorView';
import { LoadingView } from '~/components/LoadingView';
import { PlanView } from '~/components/PlanView';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { usePlanLoader } from '~/hooks/usePlanLoader';
import { PlandersonSocketClient } from '~/lib/socket-ipc';
import { PlandersonMode } from '~/utils/config/constants';
import { Settings } from '~/utils/config/settings';
import { sendDecisionViaSocket } from '~/utils/feedback/decision';
import { logError, logEvent } from '~/utils/io/logger';
import { cleanupRegistry } from '~/utils/io/sockets';

export interface AppProps {
    sessionId: string;
    mode: PlandersonMode;
    filepath: string | null;
    settings: Settings;
    error?: Error | null;
    registryId?: string | null;
    terminalWidth?: number;
    terminalHeight?: number;
}

/**
 * AppInner contains all App logic, with dependencies injected as props.
 * This enables testing without mock.module() -- tests can provide mock
 * exit/planLoader values directly.
 */
export interface AppInnerProps extends AppProps {
    exit: () => void;
    planLoader: {
        content: string;
        error: string | null;
        isLoading: boolean;
        socketClient: PlandersonSocketClient | null;
    };
}

type AppView = 'loading' | 'error' | 'help' | 'plan';

export const AppInner: React.FC<AppInnerProps> = ({
    sessionId,
    mode,
    filepath,
    error = null,
    registryId = null,
    exit,
    planLoader,
}) => {
    const { content, error: planError, isLoading, socketClient } = planLoader;

    const [currentView, setCurrentView] = useState<AppView>('loading');

    // Track startup logging state
    const hasLoggedStartup = useRef(false);

    // Lifecycle: Startup logging (log once after loading completes)
    useEffect(() => {
        if (!isLoading && !hasLoggedStartup.current) {
            logEvent(__filename, sessionId, 'tui.process.loaded');
            hasLoggedStartup.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading]);

    // Lifecycle: Cleanup logging (run on unmount)
    useEffect(() => {
        return () => {
            // Only log exit if we logged startup
            if (hasLoggedStartup.current) {
                logEvent(__filename, sessionId, 'tui.process.exited');
            }
        };
        // Empty deps = cleanup only runs on unmount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Signal handlers: Clean shutdown on Ctrl+C (SIGINT) or SIGTERM
    useEffect(() => {
        const handleSignal = (signal: string): void => {
            logEvent(__filename, sessionId, 'process.signal', signal);
            exit();
        };

        // Register signal handlers
        const sigintHandler = (): void => {
            void handleSignal('SIGINT');
        };
        const sigtermHandler = (): void => {
            void handleSignal('SIGTERM');
        };

        process.on('SIGINT', sigintHandler);
        process.on('SIGTERM', sigtermHandler);

        return () => {
            process.off('SIGINT', sigintHandler);
            process.off('SIGTERM', sigtermHandler);
        };
    }, [sessionId, socketClient, mode, exit]);

    // Update view based on loading/error state
    useEffect(() => {
        const prevView = currentView;
        let newView: AppView;

        if (isLoading) {
            newView = 'loading';
        } else if (error || planError) {
            newView = 'error';
        } else {
            newView = 'plan';
        }

        if (prevView !== newView) {
            logEvent(
                __filename,
                sessionId,
                'view.changed',
                `from:${prevView} to:${newView} error:${error ? 'parent' : planError ? 'plan' : 'none'}`,
            );
            setCurrentView(newView);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, error, planError, currentView]);

    // Navigation handlers
    const handleShowHelp = useCallback((): void => {
        logEvent(__filename, sessionId, 'view.changed', 'from:plan to:help');
        setCurrentView('help');
    }, [sessionId]);

    // Decision handlers
    const handlePlanDecision = useCallback(
        (decision: 'accept' | 'deny', message?: string, logMetadata?: string): void => {
            try {
                // 1. Send decision first
                sendDecisionViaSocket(sessionId, socketClient, mode, decision, message);

                // 2. Log decision
                logEvent(__filename, sessionId, decision === 'accept' ? 'plan.accepted' : 'plan.denied', logMetadata);

                // 3. Clean up registry after decision sent
                if (registryId) {
                    cleanupRegistry(registryId);
                    logEvent(__filename, sessionId, 'socket.registry.cleaned', `registry=${registryId}`);
                }

                // 4. Exit
                exit();
            } catch (err) {
                logError(__filename, sessionId, 'decision.errored', err as Error);
                // Still try to clean up registry on error
                if (registryId) {
                    cleanupRegistry(registryId);
                }
                exit();
            }
        },
        [sessionId, socketClient, mode, registryId, exit],
    );

    const handleCancel = useCallback((): void => {
        // Don't log process.exited here - let cleanup function handle it (will include no metadata)
        exit();
    }, [exit]);

    // Memoized wrapper handlers for PlanView to avoid JSX bind violations
    const handleApprove = useCallback(
        (message: string | undefined, logMetadata: string | undefined): void => {
            void handlePlanDecision('accept', message, logMetadata);
        },
        [handlePlanDecision],
    );

    const handleDeny = useCallback(
        (message: string | undefined, logMetadata: string | undefined): void => {
            void handlePlanDecision('deny', message, logMetadata);
        },
        [handlePlanDecision],
    );

    switch (currentView) {
        case 'loading':
            return <LoadingView mode={mode} filepath={filepath} />;

        case 'error': {
            const errorToDisplay = error || planError;
            const errorMessage =
                typeof errorToDisplay === 'string' ? errorToDisplay : errorToDisplay?.message || 'Unknown error';
            return <ErrorView error={errorMessage} />;
        }

        case 'plan':
        case 'help':
            return (
                <PlanView
                    sessionId={sessionId}
                    content={content}
                    onShowHelp={handleShowHelp}
                    onApprove={handleApprove}
                    onDeny={handleDeny}
                    onCancel={handleCancel}
                />
            );
    }
};

/**
 * App is the top-level component that wires real infrastructure (useApp, usePlanLoader)
 * into AppInner. This thin shell is not directly unit-tested; AppInner is tested instead.
 */
export const App: React.FC<AppProps> = ({
    sessionId,
    mode,
    filepath,
    settings,
    error = null,
    registryId = null,
    terminalWidth,
    terminalHeight,
}) => {
    const { exit } = useApp();

    logEvent(__filename, sessionId, 'foobar', registryId ? `registry=${registryId}` : 'no registry');

    // Infrastructure: Socket connection & plan loading
    const planLoader = usePlanLoader(sessionId, registryId, mode, filepath);

    useEffect(() => {
        logEvent(__filename, sessionId, 'tui.app.started');
        return () => {
            logEvent(__filename, sessionId, 'tui.app.ended');
        };
        // only run on mount/dismount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TerminalProvider sessionId={sessionId} terminalWidth={terminalWidth} terminalHeight={terminalHeight}>
            <SettingsProvider settings={settings}>
                <AppInner
                    sessionId={sessionId}
                    mode={mode}
                    filepath={filepath}
                    settings={settings}
                    error={error}
                    registryId={registryId}
                    exit={exit}
                    planLoader={planLoader}
                />
            </SettingsProvider>
        </TerminalProvider>
    );
};
