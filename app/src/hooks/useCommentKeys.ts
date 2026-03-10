import { useInput } from 'ink';

import { usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';
import { handleInputNavigation } from '~/utils/input/navigation';
import { logEvent } from '~/utils/io/logger';
import { calculateViewportHeight } from '~/utils/rendering/viewport';

/**
 * Hook to handle comment mode input
 * - Enter: Save comment
 * - Escape: Cancel comment
 * - Backspace: Remove last character
 * - Char input: Append to comment text
 *
 * @testing
 * This hook uses Ink's useInput, which returns no-op values in unit test environments.
 * Unit tests validate state transitions via dispatch. Keyboard behavior is tested
 * end-to-end in integration tests using ink-testing-library.
 */
export const useCommentKeys = (): void => {
    const { state, dispatch } = usePlanViewDynamicContext();
    const { sessionId, paddingX } = usePlanViewStaticContext();
    const { terminalHeight, terminalWidth } = useTerminal();

    useInput((input, key) => {
        // Only handle in comment mode
        if (state.mode !== 'comment' || state.currentCommentLine === null) {
            return;
        }

        // Save comment
        if (key.return) {
            const trimmedComment = state.currentCommentText.trim();
            if (trimmedComment.length > 0 && state.currentCommentLines.length > 0) {
                // Apply same comment to all selected lines
                state.currentCommentLines.forEach((line) => {
                    dispatch({ type: 'ADD_COMMENT', line, text: trimmedComment });
                });

                const linesStr =
                    state.currentCommentLines.length > 1
                        ? `lines:${state.currentCommentLines.map((l) => l + 1).join(',')}`
                        : `line:${state.currentCommentLines[0] + 1}`;

                logEvent(__filename, sessionId, 'comment.submitted', `${linesStr} length:${trimmedComment.length}`);
            }

            dispatch({
                type: 'SAVE_COMMENT',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });
            return;
        }

        // Cancel comment
        if (key.escape) {
            logEvent(__filename, sessionId, 'comment.cancelled', `line:${state.currentCommentLine + 1}`);
            dispatch({
                type: 'CANCEL_COMMENT',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });
            return;
        }

        // Handle common input navigation (basic movement, word jumping, line navigation, deletions)
        // maxWidth enables up/down wrapped-line navigation in comment mode
        const maxWidth = terminalWidth - paddingX * 2;
        if (handleInputNavigation(input, key, dispatch, maxWidth, terminalHeight)) {
            return;
        }

        // Append character to comment
        if (input && input.length > 0 && !key.ctrl && !key.meta) {
            dispatch({ type: 'APPEND_INPUT', char: input, maxWidth, terminalHeight });
            return;
        }
    });
};
