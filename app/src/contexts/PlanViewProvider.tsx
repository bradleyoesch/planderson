import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';

import { currentVersion, fetchLatestVersion, isNewerVersion } from '~/commands/upgrade';
import { useTerminal } from '~/contexts/TerminalContext';
import { PlanViewAction } from '~/state/planViewActions';
import { planViewReducer } from '~/state/planViewReducer';
import { createInitialState, PlanViewState } from '~/state/planViewState';
import { LineMetadata, wrapContentWithFormatting } from '~/utils/rendering/line-wrapping';
import { parseMarkdownDocument } from '~/utils/rendering/markdown/document-parser';
import { calculateViewportHeight } from '~/utils/rendering/viewport';

/**
 * Static context for PlanView - data that never changes during a session
 */
export interface PlanViewStaticContextValue {
    sessionId: string;
    contentLines: string[];
    wrappedLines: LineMetadata[];
    paddingX: number;
    latestVersion: string | null;
    onShowHelp: () => void;
    onApprove: (message?: string, logMetadata?: string) => void;
    onDeny: (message?: string, logMetadata?: string) => void;
    onCancel: () => void;
}

export const PlanViewStaticContext = createContext<PlanViewStaticContextValue | null>(null);

/**
 * Hook to access static context
 * Throws if used outside provider
 */
export const usePlanViewStaticContext = (): PlanViewStaticContextValue => {
    const context = useContext(PlanViewStaticContext);
    if (!context) {
        throw new Error('usePlanViewStaticContext must be used within PlanViewProvider');
    }
    return context;
};

/**
 * Dynamic context for PlanView - state that changes frequently
 */
export interface PlanViewDynamicContextValue {
    state: PlanViewState;
    dispatch: React.Dispatch<PlanViewAction>;
}

export const PlanViewDynamicContext = createContext<PlanViewDynamicContextValue | null>(null);

/**
 * Hook to access dynamic context
 * Throws if used outside provider
 */
export const usePlanViewDynamicContext = (): PlanViewDynamicContextValue => {
    const context = useContext(PlanViewDynamicContext);
    if (!context) {
        throw new Error('usePlanViewDynamicContext must be used within PlanViewProvider');
    }
    return context;
};

interface PlanViewProviderProps {
    children: React.ReactNode;
    sessionId: string;
    content: string;
    onShowHelp: () => void;
    onApprove: (message?: string, logMetadata?: string) => void;
    onDeny: (message?: string, logMetadata?: string) => void;
    onCancel: () => void;
}

/**
 * Provider for PlanView contexts
 * Splits static (read-only) and dynamic (changing) data to optimize re-renders
 */
export const PlanViewProvider: React.FC<PlanViewProviderProps> = ({
    children,
    sessionId,
    content,
    onShowHelp,
    onApprove,
    onDeny,
    onCancel,
}) => {
    const { terminalWidth, terminalHeight } = useTerminal();
    const [state, dispatch] = useReducer(planViewReducer, terminalHeight, (height) => ({
        ...createInitialState(),
        viewportHeight: calculateViewportHeight('plan', height),
    }));

    const [latestVersion, setLatestVersion] = useState<string | null>(null);

    useEffect(() => {
        fetchLatestVersion()
            .then((v) => {
                if (v && isNewerVersion(v, currentVersion)) setLatestVersion(v);
            })
            .catch(() => {}); // silent on network failure
    }, []);

    // Memoize static context - recalculates when content or terminal width changes
    const staticValue: PlanViewStaticContextValue = useMemo(() => {
        const paddingX = 1;
        // Strip a single trailing newline so files ending with \n (standard for editors)
        // don't produce a ghost empty line that the cursor can navigate to.
        const normalizedContent = content.replace(/\n$/, '');
        const contentLines = normalizedContent.split('\n');
        // Parse entire document as markdown (supports code blocks)
        const lineFormattings = parseMarkdownDocument(normalizedContent);
        // Wrap with markdown formatting
        const wrappedLines = wrapContentWithFormatting(lineFormattings, terminalWidth, paddingX);
        return {
            sessionId,
            contentLines,
            wrappedLines,
            paddingX,
            latestVersion,
            onShowHelp,
            onApprove,
            onDeny,
            onCancel,
        };
    }, [sessionId, content, terminalWidth, latestVersion, onShowHelp, onApprove, onDeny, onCancel]);

    // Memoize dynamic context - only changes when state/dispatch changes
    const dynamicValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);

    return (
        <PlanViewStaticContext.Provider value={staticValue}>
            <PlanViewDynamicContext.Provider value={dynamicValue}>{children}</PlanViewDynamicContext.Provider>
        </PlanViewStaticContext.Provider>
    );
};
