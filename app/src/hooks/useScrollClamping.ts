import { useEffect, useMemo } from 'react';

import { usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';
import { countTerminalLinesInRange, wrapFeedback } from '~/utils/rendering/line-wrapping';
import { calculateMaxScroll } from '~/utils/rendering/viewport';

/**
 * Hook to clamp scroll offset when viewport changes (terminal resize or content change)
 *
 * Ensures:
 * - Scroll offset stays within valid range [0, maxScroll]
 * - Cursor remains visible after terminal resize
 * - Adjusts scroll position to keep cursor in viewport if needed
 * - Accounts for line wrapping when calculating scroll bounds and cursor visibility
 *
 * Note: Intentionally excludes state.scrollOffset from deps to match original implementation.
 * This only runs on terminal resize, content change, or cursor movement - not on scroll changes.
 */
export const useScrollClamping = (): void => {
    const { state, dispatch } = usePlanViewDynamicContext();
    const { wrappedLines, paddingX } = usePlanViewStaticContext();
    const { terminalHeight, terminalWidth } = useTerminal();
    const viewportHeight = state.viewportHeight;

    // Wrap feedback once for reuse in scroll calculations
    const wrappedComments = useMemo(
        () => wrapFeedback(state.comments, 'comment', terminalWidth, paddingX),
        [state.comments, terminalWidth, paddingX],
    );

    const wrappedQuestions = useMemo(
        () => wrapFeedback(state.questions, 'question', terminalWidth, paddingX),
        [state.questions, terminalWidth, paddingX],
    );

    useEffect(() => {
        const maxScroll = calculateMaxScroll(wrappedLines, viewportHeight, wrappedComments, wrappedQuestions);
        const currentScrollOffset = state.scrollOffset;

        // Clamp scroll offset to valid range
        let newScrollOffset = Math.min(currentScrollOffset, maxScroll);

        // Ensure cursor stays visible
        if (state.cursorLine < newScrollOffset) {
            newScrollOffset = state.cursorLine;
        } else {
            // Check if cursor is below viewport by counting terminal lines
            const terminalLinesFromScrollToCursor = countTerminalLinesInRange(
                wrappedLines,
                newScrollOffset,
                state.cursorLine,
            );

            if (terminalLinesFromScrollToCursor > viewportHeight) {
                // Cursor is below viewport, find minimum scroll position where cursor is visible
                let candidateScroll = Math.max(0, state.cursorLine - viewportHeight + 1);
                let terminalLines = countTerminalLinesInRange(wrappedLines, candidateScroll, state.cursorLine);

                // Adjust for line wrapping
                if (terminalLines > viewportHeight) {
                    // Move forward until cursor fits
                    while (candidateScroll <= state.cursorLine && terminalLines > viewportHeight) {
                        candidateScroll++;
                        terminalLines = countTerminalLinesInRange(wrappedLines, candidateScroll, state.cursorLine);
                    }
                } else {
                    // Move backward to maximize visible content
                    while (candidateScroll > 0) {
                        const prevTerminalLines = countTerminalLinesInRange(
                            wrappedLines,
                            candidateScroll - 1,
                            state.cursorLine,
                        );
                        if (prevTerminalLines > viewportHeight) {
                            break;
                        }
                        candidateScroll--;
                    }
                }

                newScrollOffset = Math.max(0, Math.min(maxScroll, candidateScroll));
            }
        }

        if (newScrollOffset !== currentScrollOffset) {
            dispatch({ type: 'SET_SCROLL_OFFSET', offset: newScrollOffset });
        }
        // Intentionally exclude state.scrollOffset from deps - only respond to viewport/content changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [terminalHeight, viewportHeight, wrappedLines.length, state.cursorLine, dispatch, wrappedLines]);
};
