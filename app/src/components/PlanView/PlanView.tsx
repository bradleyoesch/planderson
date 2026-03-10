import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { HelpView } from '~/components/HelpView';
import { InlineView } from '~/components/PlanView/InlineView';
import { Plan } from '~/components/PlanView/Plan';
import { View } from '~/components/shared/View';
import { PlanViewProvider, usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';
import { useCommandKeys } from '~/hooks/useCommandKeys';
import { useCommentKeys } from '~/hooks/useCommentKeys';
import { useConfirmKeys } from '~/hooks/useConfirmKeys';
import { useFeedbackKeys } from '~/hooks/useFeedbackKeys';
import { useNavigationKeys } from '~/hooks/useNavigationKeys';
import { useQuestionKeys } from '~/hooks/useQuestionKeys';
import { useScrollClamping } from '~/hooks/useScrollClamping';
import { PlanViewMode } from '~/utils/config/constants';
import { logEvent } from '~/utils/io/logger';
import { countInputVisualLines, countTerminalLinesInRange, wrapFeedback } from '~/utils/rendering/line-wrapping';
import { calculateViewportHeight, countFeedbackLines } from '~/utils/rendering/viewport';

interface PlanViewProps {
    // From App (read-only)
    sessionId: string;
    content: string;

    // Callbacks to App
    onShowHelp: () => void;
    onApprove: (message?: string, logMetadata?: string) => void;
    onDeny: (message?: string, logMetadata?: string) => void;
    onCancel: () => void;
}

/**
 * PlanView component - wraps content with provider and renders the plan view
 * Note: TerminalProvider wraps this component, providing terminal dimensions
 */
export const PlanView: React.FC<PlanViewProps> = ({ sessionId, content, onShowHelp, onApprove, onDeny, onCancel }) => {
    // Inner component that consumes contexts and renders the plan view
    const PlanViewContent = (): React.JSX.Element => {
        const { state, dispatch } = usePlanViewDynamicContext();
        const { wrappedLines, paddingX } = usePlanViewStaticContext();
        const { terminalHeight, terminalWidth } = useTerminal();

        const viewportHeight = state.viewportHeight;

        // Handle terminal resize and cursor overflow boundary — update viewport height when
        // terminal dimensions change or when cursor movement crosses a wrap boundary (inputCursor).
        // Text mutations are now handled atomically in the reducer via maxWidth/terminalHeight
        // on each action, so those fields are excluded from deps to avoid redundant effect runs.
        // Note: state.viewportHeight is intentionally excluded from deps — the guard
        // inside prevents re-dispatch when height is already correct, and including it
        // would cause an unnecessary extra effect run on every SET_VIEWPORT_HEIGHT.
        useLayoutEffect(() => {
            // command mode renders without InlinePane padding, so uses full terminal width;
            // comment/question modes render inside InlinePane which applies paddingX on both sides.
            const effectiveWidth = state.mode === 'command' ? terminalWidth : terminalWidth - paddingX * 2;
            const activeText =
                state.mode === 'comment'
                    ? state.currentCommentText
                    : state.mode === 'question'
                      ? state.currentQuestionText
                      : state.mode === 'command'
                        ? state.commandText
                        : '';
            const inputLineCount = countInputVisualLines(activeText, state.inputCursor, effectiveWidth);
            const newViewportHeight = calculateViewportHeight(state.mode, terminalHeight, inputLineCount);
            if (state.viewportHeight !== newViewportHeight) {
                dispatch({ type: 'SET_VIEWPORT_HEIGHT', height: newViewportHeight });
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps -- text fields excluded intentionally: text mutations are handled atomically in the reducer; only terminal resize and cursor movement need this effect
        }, [terminalHeight, terminalWidth, paddingX, state.mode, state.inputCursor, dispatch]);

        // Wrap feedback (comments/questions) first - needed for both viewport calc and rendering
        const wrappedComments = useMemo(
            () => wrapFeedback(state.comments, 'comment', terminalWidth, paddingX),
            [state.comments, terminalWidth, paddingX],
        );

        const wrappedQuestions = useMemo(
            () => wrapFeedback(state.questions, 'question', terminalWidth, paddingX),
            [state.questions, terminalWidth, paddingX],
        );

        // Calculate visible lines accounting for feedback items
        // Feedback items (comments/questions) render as extra lines above content lines
        // We need to reduce the number of content lines shown to fit within viewportHeight
        const startLine = state.scrollOffset;
        let endLine = Math.min(state.scrollOffset + viewportHeight, wrappedLines.length);

        // Iteratively adjust endLine to account for feedback lines
        // We may need multiple iterations if reducing endLine reveals new feedback
        let prevEndLine = -1;
        while (endLine !== prevEndLine) {
            // Count feedback lines using pre-wrapped feedback (avoids re-wrapping)
            const feedbackCount = countFeedbackLines(startLine, endLine, wrappedComments, wrappedQuestions);
            // Count terminal lines (accounts for wrapping) instead of logical lines
            const terminalLinesForContent = countTerminalLinesInRange(wrappedLines, startLine, endLine - 1);
            const totalLinesNeeded = terminalLinesForContent + feedbackCount;

            if (totalLinesNeeded > viewportHeight) {
                // Too many lines, reduce content lines
                const excess = totalLinesNeeded - viewportHeight;
                prevEndLine = endLine;
                endLine = Math.max(startLine + 1, endLine - excess);
            } else {
                // Fits within viewport
                break;
            }
        }

        const visibleLines = wrappedLines.slice(startLine, endLine);

        // Track previous mode for change detection
        const prevMode = useRef<PlanViewMode | undefined>(undefined);
        useEffect(() => {
            if (prevMode.current !== undefined && prevMode.current !== state.mode) {
                logEvent(__filename, sessionId, 'inline.changed', `from:${prevMode.current} to:${state.mode}`);
            }
            prevMode.current = state.mode;
        }, [state.mode]);

        // Clamp scroll offset when viewport changes (terminal resize or content change)
        useScrollClamping();

        // Handle keyboard input via specialized hooks
        // Order matters: hooks that check specific modes first
        useConfirmKeys();
        useCommandKeys();
        useCommentKeys();
        useQuestionKeys();
        useFeedbackKeys();
        useNavigationKeys();

        // Helper for exit handler
        const handleExit = useCallback((): void => {
            dispatch({ type: 'EXIT_MODE' });
        }, [dispatch]);

        // If help mode, render HelpView instead
        if (state.mode === 'help') {
            return <HelpView onExit={handleExit} />;
        }

        return (
            <View
                title="Review plan"
                footer={
                    <InlineView
                        mode={state.mode}
                        commandText={state.commandText}
                        currentCommentText={state.currentCommentText}
                        currentQuestionText={state.currentQuestionText}
                        inputCursor={state.inputCursor}
                    />
                }
            >
                <Plan
                    visibleLines={visibleLines}
                    scrollOffset={state.scrollOffset}
                    cursorLine={state.cursorLine}
                    selectionAnchor={state.selectionAnchor}
                    wrappedComments={wrappedComments}
                    wrappedQuestions={wrappedQuestions}
                    deletedLines={state.deletedLines}
                />
            </View>
        );
    };

    return (
        <PlanViewProvider
            sessionId={sessionId}
            content={content}
            onShowHelp={onShowHelp}
            onApprove={onApprove}
            onDeny={onDeny}
            onCancel={onCancel}
        >
            <PlanViewContent />
        </PlanViewProvider>
    );
};
