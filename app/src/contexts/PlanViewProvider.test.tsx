import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import React from 'react';

import * as upgradeModule from '~/commands/upgrade';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import type { Settings } from '~/utils/config/settings';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

import { PlanViewProvider, usePlanViewDynamicContext, usePlanViewStaticContext } from './PlanViewProvider';

describe('PlanViewProvider', () => {
    const defaultProps = {
        content: 'Line 1\nLine 2\nLine 3',
        sessionId: 'abc123',
        showHelp: false,
        onShowHelp: () => {},
        onExitHelp: () => {},
        onApprove: () => {},
        onDeny: () => {},
        onCancel: () => {},
    };

    const makeWrapper =
        (overrides?: { props?: Partial<typeof defaultProps>; settings?: Partial<Settings>; terminalWidth?: number }) =>
        ({ children }: { children: React.ReactNode }) => (
            <TerminalProvider terminalWidth={overrides?.terminalWidth ?? 80} terminalHeight={24}>
                <SettingsProvider settings={{ ...DEFAULT_SETTINGS, ...overrides?.settings }}>
                    <PlanViewProvider {...defaultProps} {...overrides?.props}>
                        {children}
                    </PlanViewProvider>
                </SettingsProvider>
            </TerminalProvider>
        );

    describe('error cases', () => {
        // Suppress React's "error boundary" warnings. These tests intentionally render
        // hooks outside their providers, which throws during render. React always logs
        // an error boundary suggestion when this happens, even though the throw is expected.
        let originalConsoleError: typeof console.error;
        beforeEach(() => {
            originalConsoleError = console.error;
            console.error = () => {};
        });
        afterEach(() => {
            console.error = originalConsoleError;
        });

        test('throws error when static context hook used outside provider', () => {
            expect(() => {
                renderHook(() => usePlanViewStaticContext());
            }).toThrow('usePlanViewStaticContext must be used within PlanViewProvider');
        });

        test('throws error when dynamic context hook used outside provider', () => {
            expect(() => {
                renderHook(() => usePlanViewDynamicContext());
            }).toThrow('usePlanViewDynamicContext must be used within PlanViewProvider');
        });
    });

    describe('static context', () => {
        test('provides static context values', () => {
            const { result } = renderHook(() => usePlanViewStaticContext(), { wrapper: makeWrapper() });

            expect(result.current.contentLines).toEqual(['Line 1', 'Line 2', 'Line 3']);
            expect(result.current.sessionId).toBe('abc123');
        });

        test('contentLines splits content correctly', () => {
            const { result } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: makeWrapper({ props: { content: 'A\nB\nC\n' } }),
            });

            // Trailing \n is stripped before splitting so files ending with a newline
            // (standard for editor-created files) don't produce a ghost empty line.
            expect(result.current.contentLines).toEqual(['A', 'B', 'C']);
            expect(result.current.contentLines.length).toBe(3);
        });

        test('provides wrappedLines from markdown parsing and line wrapping', () => {
            const { result } = renderHook(() => usePlanViewStaticContext(), { wrapper: makeWrapper() });

            // Verify wrappedLines exist (integration with markdown parser and line wrapper)
            expect(result.current.wrappedLines).toBeDefined();
            expect(result.current.wrappedLines).toHaveLength(3);
        });
    });

    describe('dynamic context', () => {
        test('provides dynamic context with initial state', () => {
            const { result } = renderHook(() => usePlanViewDynamicContext(), { wrapper: makeWrapper() });

            expect(result.current.state.cursorLine).toBe(0);
            expect(result.current.state.selectionAnchor).toBe(null);
            expect(result.current.state.mode).toBe('plan');
            expect(result.current.state.comments.size).toBe(0);
            expect(result.current.state.deletedLines.size).toBe(0);
        });

        test('initial viewportHeight is calculated from terminal height', () => {
            const { result } = renderHook(() => usePlanViewDynamicContext(), { wrapper: makeWrapper() });

            // calculateViewportHeight('plan', 24) = 24 - 3 (header) - 1 (footer) = 20
            expect(result.current.state.viewportHeight).toBe(20);
        });

        test('dispatch function is provided', () => {
            const { result } = renderHook(() => usePlanViewDynamicContext(), { wrapper: makeWrapper() });

            expect(typeof result.current.dispatch).toBe('function');
        });
    });

    describe('callbacks', () => {
        test('callbacks are accessible from static context', () => {
            const onShowHelp = () => 'help';
            const onApprove = () => 'approve';
            const onDeny = () => 'deny';
            const onCancel = () => 'cancel';

            const { result } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: makeWrapper({ props: { onShowHelp, onApprove, onDeny, onCancel } }),
            });

            expect(result.current.onShowHelp).toBe(onShowHelp);
            expect(result.current.onApprove).toBe(onApprove);
            expect(result.current.onDeny).toBe(onDeny);
            expect(result.current.onCancel).toBe(onCancel);
        });

        test('callbacks can be invoked', () => {
            let showHelpCalled = false;
            let approveCalled = false;
            let denyCalled = false;
            let cancelCalled = false;

            const onShowHelp = () => {
                showHelpCalled = true;
            };
            const onApprove = () => {
                approveCalled = true;
            };
            const onDeny = () => {
                denyCalled = true;
            };
            const onCancel = () => {
                cancelCalled = true;
            };

            const { result } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: makeWrapper({ props: { onShowHelp, onApprove, onDeny, onCancel } }),
            });

            result.current.onShowHelp();
            result.current.onApprove();
            result.current.onDeny();
            result.current.onCancel();

            expect(showHelpCalled).toBe(true);
            expect(approveCalled).toBe(true);
            expect(denyCalled).toBe(true);
            expect(cancelCalled).toBe(true);
        });
    });

    describe('memoization', () => {
        test('static context memoizes when dependencies unchanged', () => {
            const { result, rerender } = renderHook(() => usePlanViewStaticContext(), { wrapper: makeWrapper() });

            const firstValue = result.current;

            // Rerender without changing props
            rerender();

            // Should be same object reference (memoized)
            expect(result.current).toBe(firstValue);
        });

        test('static context recalculates when content changes', () => {
            let content = 'Short';

            const WrapperWithContent = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <SettingsProvider settings={DEFAULT_SETTINGS}>
                        <PlanViewProvider {...defaultProps} content={content}>
                            {children}
                        </PlanViewProvider>
                    </SettingsProvider>
                </TerminalProvider>
            );

            const { result, rerender } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: WrapperWithContent,
            });

            const firstValue = result.current;
            expect(firstValue.wrappedLines).toHaveLength(1);

            // Change content and rerender
            content = 'Line 1\nLine 2';
            rerender();

            // Should be different object reference (recalculated)
            expect(result.current).not.toBe(firstValue);
            expect(result.current.wrappedLines).toHaveLength(2);
        });

        test('static context recalculates when terminal width changes', () => {
            const { result: result1, unmount } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: makeWrapper({ terminalWidth: 80 }),
            });

            const firstValue = result1.current;
            unmount();

            const { result: result2 } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: makeWrapper({ terminalWidth: 120 }),
            });

            // Should be different object reference (recalculated)
            expect(result2.current).not.toBe(firstValue);
        });

        test('dynamic context memoizes when state and dispatch unchanged', () => {
            const { result, rerender } = renderHook(() => usePlanViewDynamicContext(), { wrapper: makeWrapper() });

            const firstValue = result.current;

            // Rerender without changing state
            rerender();

            // Should be same object reference (memoized)
            expect(result.current).toBe(firstValue);
        });
    });

    describe('auto-upgrade behavior', () => {
        afterEach(() => {
            mock.restore();
        });

        test('when autoUpgrade is never: latestVersion is set, upgradedVersion is null', async () => {
            spyOn(upgradeModule, 'fetchLatestVersion').mockResolvedValue('9.9.9');

            const { result } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: makeWrapper({ settings: { autoUpgrade: 'never' } }),
            });

            await waitFor(() => expect(result.current.latestVersion).toBe('9.9.9'));
            expect(result.current.upgradedVersion).toBeNull();
        });

        test('when autoUpgrade is always and newer version available: upgradedVersion is set, latestVersion is null', async () => {
            spyOn(upgradeModule, 'fetchLatestVersion').mockResolvedValue('9.9.9');
            spyOn(upgradeModule, 'runSilentUpgrade').mockResolvedValue('success');

            const { result } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: makeWrapper({ settings: { autoUpgrade: 'always' } }),
            });

            await waitFor(() => expect(result.current.upgradedVersion).toBe('9.9.9'));
            expect(result.current.latestVersion).toBeNull();
        });

        test('when autoUpgrade is patch and bump is minor: both latestVersion and upgradedVersion are null', async () => {
            const fetchSpy = spyOn(upgradeModule, 'fetchLatestVersion').mockResolvedValue('9.9.9');

            const { result } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: makeWrapper({ settings: { autoUpgrade: 'patch' } }),
            });

            await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
            expect(result.current.latestVersion).toBeNull();
            expect(result.current.upgradedVersion).toBeNull();
        });
    });
});
