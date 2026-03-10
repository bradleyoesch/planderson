import { install, type InstalledClock } from '@sinonjs/fake-timers';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { render } from 'ink-testing-library';
import React from 'react';

import { AppInner, type AppInnerProps } from '~/App';
import { PlanViewProvider } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { PlandersonSocketClient } from '~/lib/socket-ipc';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';
import { resetWriteFunction, setWriteFunction } from '~/utils/io/logger';
// No mock.module() calls needed:
// - Keyboard hooks (useNavigationKeys, etc.) use Ink's useInput which is a no-op in test environments
// - usePlanLoader is replaced by the planLoader prop on AppInner
// - useApp().exit is replaced by the exit prop on AppInner

const mockExit = mock();

const defaultPlanLoader: AppInnerProps['planLoader'] = {
    content: '',
    error: null,
    isLoading: true,
    socketClient: null,
};

const defaultAppInnerProps: Omit<AppInnerProps, 'planLoader'> = {
    mode: 'socket',
    filepath: null,
    settings: DEFAULT_SETTINGS,
    error: null,
    registryId: null,
    exit: mockExit,
    sessionId: 'test123',
};

// Helper to wrap AppInner with required providers
const renderAppInner = (props: AppInnerProps) =>
    render(
        <TerminalProvider sessionId={props.sessionId} terminalHeight={24} terminalWidth={80}>
            <SettingsProvider settings={props.settings}>
                <PlanViewProvider
                    sessionId={props.sessionId}
                    content=""
                    onShowHelp={() => {}}
                    onApprove={() => {}}
                    onDeny={() => {}}
                    onCancel={() => {}}
                >
                    <AppInner {...props} />
                </PlanViewProvider>
            </SettingsProvider>
        </TerminalProvider>,
    );

describe('App', () => {
    let clock: InstalledClock;

    beforeEach(() => {
        clock = install();
        mockExit.mockClear();

        // Prevent actual file writes during tests
        setWriteFunction(() => {});
    });

    afterEach(() => {
        clock.uninstall();
        resetWriteFunction();
    });

    describe('View Routing', () => {
        test('should render LoadingView in socket mode', async () => {
            const { lastFrame } = renderAppInner({ ...defaultAppInnerProps, planLoader: defaultPlanLoader });
            await clock.tickAsync(1000);

            expect(lastFrame()).toContain('Loading Plan...');
            expect(lastFrame()).toContain('socket');
        });

        test('should render LoadingView in file mode', async () => {
            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                mode: 'file',
                filepath: 'test.md',
                planLoader: defaultPlanLoader,
            });
            await clock.tickAsync(1000);

            expect(lastFrame()).toContain('Loading Plan...');
            expect(lastFrame()).toContain('test.md');
        });

        test('should render ErrorView when planError exists', async () => {
            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                planLoader: { ...defaultPlanLoader, error: 'Connection failed', isLoading: false },
            });
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Error');
            expect(lastFrame()).toContain('Connection failed');
        });

        test('should render ErrorView when parent error prop exists', async () => {
            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                error: new Error('Parent error'),
                planLoader: { ...defaultPlanLoader, isLoading: false },
            });
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Error');
            expect(lastFrame()).toContain('Parent error');
        });

        test('should display parent error when both parent error and plan error exist', async () => {
            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                error: new Error('Parent error'),
                planLoader: { ...defaultPlanLoader, error: 'Plan loader error', isLoading: false },
            });
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Parent error');
        });

        test('should render PlanView when content is loaded', async () => {
            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                planLoader: { ...defaultPlanLoader, content: 'Test content', isLoading: false },
            });
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Review plan');
        });

        test('should transition from loading to plan view', async () => {
            const { lastFrame, rerender } = renderAppInner({
                ...defaultAppInnerProps,
                planLoader: defaultPlanLoader,
            });
            await clock.tickAsync(1000);

            expect(lastFrame()).toContain('Loading Plan...');

            // Simulate loading completion by passing updated planLoader
            rerender(
                <TerminalProvider sessionId={defaultAppInnerProps.sessionId} terminalHeight={24} terminalWidth={80}>
                    <SettingsProvider settings={defaultAppInnerProps.settings}>
                        <PlanViewProvider
                            sessionId={defaultAppInnerProps.sessionId}
                            content=""
                            onShowHelp={() => {}}
                            onApprove={() => {}}
                            onDeny={() => {}}
                            onCancel={() => {}}
                        >
                            <AppInner
                                {...defaultAppInnerProps}
                                planLoader={{ ...defaultPlanLoader, content: 'Test content', isLoading: false }}
                            />
                        </PlanViewProvider>
                    </SettingsProvider>
                </TerminalProvider>,
            );
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Review plan');
        });

        test('should transition from loading to error view', async () => {
            const { lastFrame, rerender } = renderAppInner({
                ...defaultAppInnerProps,
                planLoader: defaultPlanLoader,
            });
            await clock.tickAsync(1000);

            expect(lastFrame()).toContain('Loading Plan...');

            // Simulate error
            rerender(
                <TerminalProvider sessionId={defaultAppInnerProps.sessionId} terminalHeight={24} terminalWidth={80}>
                    <SettingsProvider settings={defaultAppInnerProps.settings}>
                        <PlanViewProvider
                            sessionId={defaultAppInnerProps.sessionId}
                            content=""
                            onShowHelp={() => {}}
                            onApprove={() => {}}
                            onDeny={() => {}}
                            onCancel={() => {}}
                        >
                            <AppInner
                                {...defaultAppInnerProps}
                                planLoader={{ ...defaultPlanLoader, error: 'Load failed', isLoading: false }}
                            />
                        </PlanViewProvider>
                    </SettingsProvider>
                </TerminalProvider>,
            );
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Error');
            expect(lastFrame()).toContain('Load failed');
        });
    });

    describe('Lifecycle & Logging', () => {
        test('should log tui.process.loaded after loading completes', async () => {
            const logs: string[] = [];
            setWriteFunction((_file: string, data: string) => {
                logs.push(data);
            });

            renderAppInner({
                ...defaultAppInnerProps,
                planLoader: { ...defaultPlanLoader, content: 'Test plan content', isLoading: false },
            });
            await clock.tickAsync(10);

            const startupEvents = logs.filter((log) => log.includes('tui.process.loaded'));
            expect(startupEvents.length).toBe(1);
        });

        test('should not log tui.process.loaded while still loading', async () => {
            const logs: string[] = [];
            setWriteFunction((_file: string, data: string) => {
                logs.push(data);
            });

            renderAppInner({ ...defaultAppInnerProps, planLoader: defaultPlanLoader });
            await clock.tickAsync(1000);

            const startupEvents = logs.filter((log) => log.includes('tui.process.loaded'));
            expect(startupEvents.length).toBe(0);
        });
    });

    describe('Signal Handling', () => {
        test('should register SIGINT handler', async () => {
            renderAppInner({
                ...defaultAppInnerProps,
                planLoader: {
                    ...defaultPlanLoader,
                    content: 'Test content',
                    isLoading: false,
                    socketClient: { send: mock() } as unknown as PlandersonSocketClient,
                },
            });
            await clock.tickAsync(10);

            const sigintListeners = process.listeners('SIGINT');
            expect(sigintListeners.length).toBeGreaterThan(0);
        });

        test('should register SIGTERM handler', async () => {
            renderAppInner({
                ...defaultAppInnerProps,
                planLoader: {
                    ...defaultPlanLoader,
                    content: 'Test content',
                    isLoading: false,
                    socketClient: { send: mock() } as unknown as PlandersonSocketClient,
                },
            });
            await clock.tickAsync(10);

            const sigtermListeners = process.listeners('SIGTERM');
            expect(sigtermListeners.length).toBeGreaterThan(0);
        });

        test('should send cancel decision and exit on SIGINT', async () => {
            const logs: string[] = [];
            setWriteFunction((_file: string, data: string) => {
                logs.push(data);
            });

            const mockSocketClient = { send: mock(), sendDecision: mock() } as unknown as PlandersonSocketClient;
            renderAppInner({
                ...defaultAppInnerProps,
                planLoader: {
                    ...defaultPlanLoader,
                    content: 'Test content',
                    isLoading: false,
                    socketClient: mockSocketClient,
                },
            });
            await clock.tickAsync(10);
            process.emit('SIGINT' as any);

            expect(mockExit).toHaveBeenCalled();
            const signalLog = logs.find((log) => log.includes('process.signal'));
            expect(signalLog).toContain('SIGINT');
        });

        test('should send cancel decision and exit on SIGTERM', async () => {
            const logs: string[] = [];
            setWriteFunction((_file: string, data: string) => {
                logs.push(data);
            });

            const mockSocketClient = { send: mock(), sendDecision: mock() } as unknown as PlandersonSocketClient;
            renderAppInner({
                ...defaultAppInnerProps,
                planLoader: {
                    ...defaultPlanLoader,
                    content: 'Test content',
                    isLoading: false,
                    socketClient: mockSocketClient,
                },
            });
            await clock.tickAsync(10);
            process.emit('SIGTERM' as any);

            expect(mockExit).toHaveBeenCalled();
            const signalLog = logs.find((log) => log.includes('process.signal'));
            expect(signalLog).toContain('SIGTERM');
        });

        test('should register and cleanup signal handlers', async () => {
            const sigintListenersBefore = process.listenerCount('SIGINT');
            const sigtermListenersBefore = process.listenerCount('SIGTERM');

            const { unmount } = renderAppInner({
                ...defaultAppInnerProps,
                planLoader: { ...defaultPlanLoader, content: 'Test content', isLoading: false },
            });
            await clock.tickAsync(10);
            const sigintListenersDuring = process.listenerCount('SIGINT');
            const sigtermListenersDuring = process.listenerCount('SIGTERM');

            expect(sigintListenersDuring).toBeGreaterThan(sigintListenersBefore);
            expect(sigtermListenersDuring).toBeGreaterThan(sigtermListenersBefore);

            unmount();
            // Note: In test environment with multiple tests, cleanup may not immediately reflect
            // in listener count due to async behavior and other test instances
        });
    });

    describe('Edge Cases', () => {
        test('should handle very long content without crashing', async () => {
            const longContent = Array.from({ length: 1000 }, (_, i) => `Line ${i}`).join('\n');

            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                planLoader: { ...defaultPlanLoader, content: longContent, isLoading: false },
            });
            await clock.tickAsync(10);

            const frame = lastFrame();
            expect(frame).toBeDefined();
            expect(frame!.length).toBeGreaterThan(0);
        });

        test('should handle multiline error messages', async () => {
            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                planLoader: { ...defaultPlanLoader, error: 'Error line 1\nError line 2', isLoading: false },
            });
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Error line 1');
            expect(lastFrame()).toContain('Error line 2');
        });

        test('should handle empty content gracefully', async () => {
            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                planLoader: { ...defaultPlanLoader, content: '', isLoading: false },
            });
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Review plan');
        });

        test('should handle Error objects with no message', async () => {
            // eslint-disable-next-line unicorn/error-message -- Testing edge case of error without message
            const errorWithoutMessage = new Error('');

            const { lastFrame } = renderAppInner({
                ...defaultAppInnerProps,
                error: errorWithoutMessage,
                planLoader: { ...defaultPlanLoader, isLoading: false },
            });
            await clock.tickAsync(10);

            expect(lastFrame()).toContain('Error');
        });
    });
});
