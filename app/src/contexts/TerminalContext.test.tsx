import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React from 'react';

import { TerminalProvider, useTerminal } from './TerminalContext';

describe('TerminalContext', () => {
    describe('error cases', () => {
        // Suppress React's "error boundary" warnings. These tests intentionally render
        // hooks outside their provider, which throws during render. React always logs
        // an error boundary suggestion when this happens, even though the throw is expected.
        let originalConsoleError: typeof console.error;
        beforeEach(() => {
            originalConsoleError = console.error;
            console.error = () => {};
        });
        afterEach(() => {
            console.error = originalConsoleError;
        });

        test('useTerminal throws error when used outside provider', () => {
            expect(() => {
                renderHook(() => useTerminal());
            }).toThrow('useTerminal must be used within a TerminalProvider');
        });
    });

    describe('TerminalProvider', () => {
        test('provides terminal dimensions from props', () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalHeight={30} terminalWidth={100}>
                    {children}
                </TerminalProvider>
            );

            const { result } = renderHook(() => useTerminal(), { wrapper });

            expect(result.current.terminalHeight).toBe(30);
            expect(result.current.terminalWidth).toBe(100);
        });

        test('falls back to 80x24 when no props provided and stdout unavailable', () => {
            const originalColumns = process.stdout.columns;
            const originalRows = process.stdout.rows;
            Object.defineProperty(process.stdout, 'columns', {
                value: undefined,
                configurable: true,
                writable: true,
            });
            Object.defineProperty(process.stdout, 'rows', {
                value: undefined,
                configurable: true,
                writable: true,
            });
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider>{children}</TerminalProvider>
            );

            const { result } = renderHook(() => useTerminal(), { wrapper });

            expect(result.current.terminalWidth).toBe(80);
            expect(result.current.terminalHeight).toBe(24);

            // Restore original stdout
            Object.defineProperty(process.stdout, 'columns', {
                value: originalColumns,
                configurable: true,
                writable: true,
            });
            Object.defineProperty(process.stdout, 'rows', {
                value: originalRows,
                configurable: true,
                writable: true,
            });
        });

        test('uses process.stdout dimensions when no props provided', () => {
            const originalColumns = process.stdout.columns;
            const originalRows = process.stdout.rows;
            Object.defineProperty(process.stdout, 'columns', {
                value: 200,
                configurable: true,
                writable: true,
            });
            Object.defineProperty(process.stdout, 'rows', {
                value: 60,
                configurable: true,
                writable: true,
            });
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider>{children}</TerminalProvider>
            );

            const { result } = renderHook(() => useTerminal(), { wrapper });

            expect(result.current.terminalWidth).toBe(200);
            expect(result.current.terminalHeight).toBe(60);

            // Restore original stdout
            Object.defineProperty(process.stdout, 'columns', {
                value: originalColumns,
                configurable: true,
                writable: true,
            });
            Object.defineProperty(process.stdout, 'rows', {
                value: originalRows,
                configurable: true,
                writable: true,
            });
        });

        test('memoizes context value when dimensions unchanged', () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalHeight={30} terminalWidth={100}>
                    {children}
                </TerminalProvider>
            );

            const { result, rerender } = renderHook(() => useTerminal(), { wrapper });

            const firstValue = result.current;

            // Rerender without changing props
            rerender();

            // Should be same object reference (memoized)
            expect(result.current).toBe(firstValue);
        });

        test('updates context value when dimensions change', () => {
            const WrapperWithDimensions = ({
                children,
                width,
                height,
            }: {
                children: React.ReactNode;
                width: number;
                height: number;
            }) => (
                <TerminalProvider terminalHeight={height} terminalWidth={width}>
                    {children}
                </TerminalProvider>
            );

            const { result } = renderHook(() => useTerminal(), {
                wrapper: ({ children }) => (
                    <WrapperWithDimensions width={100} height={30}>
                        {children}
                    </WrapperWithDimensions>
                ),
            });

            const firstValue = result.current;

            expect(firstValue.terminalWidth).toBe(100);
            expect(firstValue.terminalHeight).toBe(30);

            // Rerender with different dimensions
            const { result: result2 } = renderHook(() => useTerminal(), {
                wrapper: ({ children }) => (
                    <WrapperWithDimensions width={120} height={40}>
                        {children}
                    </WrapperWithDimensions>
                ),
            });

            expect(result2.current).not.toBe(firstValue);
            expect(result2.current.terminalWidth).toBe(120);
            expect(result2.current.terminalHeight).toBe(40);
        });
    });

    describe('resize handling', () => {
        test('registers SIGWINCH listener when not in test mode', () => {
            const listenersBefore = process.listenerCount('SIGWINCH');

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider sessionId="test-hash">{children}</TerminalProvider>
            );

            renderHook(() => useTerminal(), { wrapper });

            const listenersAfter = process.listenerCount('SIGWINCH');
            expect(listenersAfter).toBeGreaterThan(listenersBefore);
        });

        test('does not register SIGWINCH listener when props provided (test mode)', () => {
            const listenersBefore = process.listenerCount('SIGWINCH');

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider terminalHeight={30} terminalWidth={100}>
                    {children}
                </TerminalProvider>
            );

            renderHook(() => useTerminal(), { wrapper });

            const listenersAfter = process.listenerCount('SIGWINCH');
            expect(listenersAfter).toBe(listenersBefore);
        });

        test('cleans up SIGWINCH listener on unmount', () => {
            const listenersBefore = process.listenerCount('SIGWINCH');

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider sessionId="test-hash">{children}</TerminalProvider>
            );

            const { unmount } = renderHook(() => useTerminal(), { wrapper });

            const listenersDuring = process.listenerCount('SIGWINCH');
            expect(listenersDuring).toBeGreaterThan(listenersBefore);

            unmount();

            const listenersAfter = process.listenerCount('SIGWINCH');
            expect(listenersAfter).toBe(listenersBefore);
        });

        test('updates dimensions when SIGWINCH fires', async () => {
            // Mock process.stdout dimensions
            const originalColumns = process.stdout.columns;
            const originalRows = process.stdout.rows;

            // Use getters/setters to prevent Node's internal tty code from overwriting our mock values
            let mockColumns = 100;
            let mockRows = 30;

            Object.defineProperty(process.stdout, 'columns', {
                get: () => mockColumns,
                set: () => {}, // No-op setter - ignore writes from Node's tty code
                configurable: true,
            });
            Object.defineProperty(process.stdout, 'rows', {
                get: () => mockRows,
                set: () => {}, // No-op setter - ignore writes from Node's tty code
                configurable: true,
            });

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <TerminalProvider sessionId="test-hash">{children}</TerminalProvider>
            );

            const { result } = renderHook(() => useTerminal(), { wrapper });

            // Initial dimensions
            expect(result.current.terminalWidth).toBe(100);
            expect(result.current.terminalHeight).toBe(30);

            // Simulate terminal resize by updating mock values
            mockColumns = 120;
            mockRows = 40;

            // Emit SIGWINCH and wait for state updates
            await act(async () => {
                process.emit('SIGWINCH');
                // Wait for debounce (100ms + buffer)
                await new Promise((resolve) => setTimeout(resolve, 150));
            });

            // Dimensions should update
            expect(result.current.terminalWidth).toBe(120);
            expect(result.current.terminalHeight).toBe(40);

            // Restore original stdout
            Object.defineProperty(process.stdout, 'columns', {
                value: originalColumns,
                configurable: true,
                writable: true,
            });
            Object.defineProperty(process.stdout, 'rows', {
                value: originalRows,
                configurable: true,
                writable: true,
            });
        });
    });
});
