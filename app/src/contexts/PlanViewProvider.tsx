import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';

import {
    categorizeVersionBump,
    currentVersion,
    fetchLatestVersion,
    isNewerVersion,
    runSilentUpgrade,
    shouldAutoUpgrade,
} from '~/commands/upgrade';
import { useSettings } from '~/contexts/SettingsContext';
import { useTerminal } from '~/contexts/TerminalContext';
import { PlanViewAction } from '~/state/planViewActions';
import { planViewReducer } from '~/state/planViewReducer';
import { createInitialState, PlanViewState } from '~/state/planViewState';
import { logError, logEvent } from '~/utils/io/logger';
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
    upgradedVersion: string | null;
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

const useVersionCheck = (sessionId: string): { latestVersion: string | null; upgradedVersion: string | null } => {
    const { settings } = useSettings();
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [upgradedVersion, setUpgradedVersion] = useState<string | null>(null);

    useEffect(() => {
        logEvent(__filename, sessionId, 'upgrade.check.started');
        fetchLatestVersion()
            .then((v) => {
                if (!v || !isNewerVersion(v, currentVersion)) {
                    logEvent(__filename, sessionId, 'upgrade.nooped', `latest=${v} current=${currentVersion}`);
                    return;
                }

                logEvent(__filename, sessionId, 'upgrade.check.found', `latest=${v} current=${currentVersion}`);
                if (shouldAutoUpgrade(settings.autoUpgrade, v, currentVersion)) {
                    runSilentUpgrade()
                        .then((result) => {
                            if (result === 'success') {
                                setUpgradedVersion(v);
                                logEvent(__filename, sessionId, 'upgrade.success', `version=${v}`);
                            } else {
                                logError(__filename, sessionId, 'upgrade.failed', new Error(`version=${v}`));
                            }
                        })
                        .catch((err) => {
                            logError(__filename, sessionId, 'upgrade.failed', err as Error);
                        });
                } else if (settings.autoUpgrade === 'never') {
                    setLatestVersion(v);
                    logEvent(__filename, sessionId, 'upgrade.skipped', `autoUpgrade=${settings.autoUpgrade}`);
                } else {
                    const bump = categorizeVersionBump(v, currentVersion);
                    logEvent(
                        __filename,
                        sessionId,
                        'upgrade.skipped',
                        `latest=${v} autoUpgrade=${settings.autoUpgrade} bump=${bump}`,
                    );
                }
            })
            .catch((err) => {
                logError(__filename, sessionId, 'upgrade.check.failed', err as Error);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { latestVersion, upgradedVersion };
};

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

    const { latestVersion, upgradedVersion } = useVersionCheck(sessionId);

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
            upgradedVersion,
            onShowHelp,
            onApprove,
            onDeny,
            onCancel,
        };
    }, [sessionId, content, terminalWidth, latestVersion, upgradedVersion, onShowHelp, onApprove, onDeny, onCancel]);

    // Memoize dynamic context - only changes when state/dispatch changes
    const dynamicValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);

    return (
        <PlanViewStaticContext.Provider value={staticValue}>
            <PlanViewDynamicContext.Provider value={dynamicValue}>{children}</PlanViewDynamicContext.Provider>
        </PlanViewStaticContext.Provider>
    );
};
