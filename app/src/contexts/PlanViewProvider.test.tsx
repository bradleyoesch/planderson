import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React from 'react';

import { TerminalProvider } from '~/contexts/TerminalContext';

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
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps}>{children}</PlanViewProvider>
                </TerminalProvider>
            );

            const { result } = renderHook(() => usePlanViewStaticContext(), { wrapper });

            expect(result.current.contentLines).toEqual(['Line 1', 'Line 2', 'Line 3']);
            expect(result.current.sessionId).toBe('abc123');
        });

        test('contentLines splits content correctly', () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps} content={'A\nB\nC\n'}>
                        {children}
                    </PlanViewProvider>
                </TerminalProvider>
            );

            const { result } = renderHook(() => usePlanViewStaticContext(), { wrapper });

            // String.split('\n') on "A\nB\nC\n" produces ['A', 'B', 'C', '']
            expect(result.current.contentLines).toEqual(['A', 'B', 'C', '']);
            expect(result.current.contentLines.length).toBe(4);
        });

        test('provides wrappedLines from markdown parsing and line wrapping', () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps}>{children}</PlanViewProvider>
                </TerminalProvider>
            );

            const { result } = renderHook(() => usePlanViewStaticContext(), { wrapper });

            // Verify wrappedLines exist (integration with markdown parser and line wrapper)
            expect(result.current.wrappedLines).toBeDefined();
            expect(result.current.wrappedLines).toHaveLength(3);
        });
    });

    describe('dynamic context', () => {
        test('provides dynamic context with initial state', () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps}>{children}</PlanViewProvider>
                </TerminalProvider>
            );

            const { result } = renderHook(() => usePlanViewDynamicContext(), { wrapper });

            expect(result.current.state.cursorLine).toBe(0);
            expect(result.current.state.selectionAnchor).toBe(null);
            expect(result.current.state.mode).toBe('plan');
            expect(result.current.state.comments.size).toBe(0);
            expect(result.current.state.deletedLines.size).toBe(0);
        });

        test('dispatch function is provided', () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps}>{children}</PlanViewProvider>
                </TerminalProvider>
            );

            const { result } = renderHook(() => usePlanViewDynamicContext(), { wrapper });

            expect(typeof result.current.dispatch).toBe('function');
        });
    });

    describe('callbacks', () => {
        test('callbacks are accessible from static context', () => {
            const onShowHelp = () => 'help';
            const onApprove = () => 'approve';
            const onDeny = () => 'deny';
            const onCancel = () => 'cancel';

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider
                        {...defaultProps}
                        onShowHelp={onShowHelp}
                        onApprove={onApprove}
                        onDeny={onDeny}
                        onCancel={onCancel}
                    >
                        {children}
                    </PlanViewProvider>
                </TerminalProvider>
            );

            const { result } = renderHook(() => usePlanViewStaticContext(), { wrapper });

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

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider
                        {...defaultProps}
                        onShowHelp={onShowHelp}
                        onApprove={onApprove}
                        onDeny={onDeny}
                        onCancel={onCancel}
                    >
                        {children}
                    </PlanViewProvider>
                </TerminalProvider>
            );

            const { result } = renderHook(() => usePlanViewStaticContext(), { wrapper });

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
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps}>{children}</PlanViewProvider>
                </TerminalProvider>
            );

            const { result, rerender } = renderHook(() => usePlanViewStaticContext(), { wrapper });

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
                    <PlanViewProvider {...defaultProps} content={content}>
                        {children}
                    </PlanViewProvider>
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
            // First render with width=80
            const wrapper1 = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps}>{children}</PlanViewProvider>
                </TerminalProvider>
            );

            const { result: result1, unmount } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: wrapper1,
            });

            const firstValue = result1.current;
            unmount();

            // Second render with width=120 (new instance)
            const wrapper2 = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={120} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps}>{children}</PlanViewProvider>
                </TerminalProvider>
            );

            const { result: result2 } = renderHook(() => usePlanViewStaticContext(), {
                wrapper: wrapper2,
            });

            // Should be different object reference (recalculated)
            expect(result2.current).not.toBe(firstValue);
        });

        test('dynamic context memoizes when state and dispatch unchanged', () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <PlanViewProvider {...defaultProps}>{children}</PlanViewProvider>
                </TerminalProvider>
            );

            const { result, rerender } = renderHook(() => usePlanViewDynamicContext(), { wrapper });

            const firstValue = result.current;

            // Rerender without changing state
            rerender();

            // Should be same object reference (memoized)
            expect(result.current).toBe(firstValue);
        });
    });
});
