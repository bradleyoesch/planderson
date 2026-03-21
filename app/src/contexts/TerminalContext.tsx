import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { debounce } from '~/utils/debounce';
import { logEvent } from '~/utils/io/logger';

interface TerminalContextValue {
    terminalHeight: number;
    terminalWidth: number;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

interface TerminalProviderProps {
    children: React.ReactNode;
    // Optional overrides for testing
    terminalHeight?: number;
    terminalWidth?: number;
    // Session ID for logging (optional, defaults to 'unknown')
    sessionId?: string;
}

/**
 * Provides terminal dimensions (terminalHeight, terminalWidth) with automatic resize handling.
 * Listens to SIGWINCH signal and updates dimensions when terminal is resized.
 */
export const TerminalProvider: React.FC<TerminalProviderProps> = ({
    children,
    terminalHeight: propTerminalHeight,
    terminalWidth: propTerminalWidth,
    sessionId = 'unknown',
}) => {
    // Read initial dimensions (from props for testing, or from process.stdout)
    const initialWidth = propTerminalWidth ?? process.stdout.columns ?? 80;
    const initialHeight = propTerminalHeight ?? process.stdout.rows ?? 24;

    // State for terminal dimensions
    const [terminalWidth, setTerminalWidth] = useState(initialWidth);
    const [terminalHeight, setTerminalHeight] = useState(initialHeight);

    // Set up SIGWINCH listener if not in test mode (props provided)
    useEffect(() => {
        // Skip resize listener if dimensions are provided via props (test mode)
        if (propTerminalHeight !== undefined || propTerminalWidth !== undefined) {
            return;
        }

        // Debounced resize handler - waits 100ms after resize stops
        const handleResize = debounce(() => {
            const newWidth = process.stdout.columns ?? 80;
            const newHeight = process.stdout.rows ?? 24;

            // Only update if dimensions actually changed
            if (newWidth !== terminalWidth || newHeight !== terminalHeight) {
                setTerminalWidth(newWidth);
                setTerminalHeight(newHeight);

                // Log resize event
                logEvent(
                    sessionId,
                    'terminal.resized',
                    'viewport',
                    `${terminalWidth}x${terminalHeight} to ${newWidth}x${newHeight}`,
                );
            }
        }, 100);

        // Register SIGWINCH listener
        process.on('SIGWINCH', handleResize);

        // Cleanup on unmount
        return () => {
            process.off('SIGWINCH', handleResize);
        };
    }, [terminalWidth, terminalHeight, propTerminalHeight, propTerminalWidth, sessionId]);

    const value = useMemo(() => ({ terminalHeight, terminalWidth }), [terminalHeight, terminalWidth]);
    return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
};

/**
 * Hook to access terminal dimensions
 * For viewport height (content area), use state.viewportHeight from PlanView state
 */
export const useTerminal = (): TerminalContextValue => {
    const context = useContext(TerminalContext);
    if (!context) {
        throw new Error('useTerminal must be used within a TerminalProvider');
    }
    return context;
};
