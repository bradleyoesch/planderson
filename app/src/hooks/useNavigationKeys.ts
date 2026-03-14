import { useInput } from 'ink';
import { useMemo } from 'react';

import { usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';
import { wrapFeedback } from '~/utils/rendering/line-wrapping';
import { calculateMaxScroll } from '~/utils/rendering/viewport';

/**
 * Hook to handle navigation keys
 * - Up/Down: Move cursor one line
 * - Shift+Up/Down: Start/extend multi-line selection
 * - Space: Page down (move cursor down one viewport height)
 * - b: Page up (move cursor up one viewport height) - follows less/more/vim conventions
 * - Scrolling: Auto-scrolls to keep cursor visible, accounts for line wrapping
 *
 * Note: Shift+Space cannot be used for page up because Node.js readline (which Ink uses)
 * does not parse extended keyboard sequences (CSI u). See docs/shift-space-investigation.md
 *
 * @testing
 * This hook uses Ink's useInput, which returns no-op values in unit test environments.
 * Unit tests validate state transitions via dispatch. Keyboard behavior is tested
 * end-to-end in integration tests using ink-testing-library.
 */
export const useNavigationKeys = (): void => {
    const { state, dispatch } = usePlanViewDynamicContext();
    const { contentLines, wrappedLines, paddingX } = usePlanViewStaticContext();
    const { terminalWidth } = useTerminal();
    const viewportHeight = state.viewportHeight;

    // Data structure usage:
    // - contentLines: Used for cursor bounds (logical line count) since cursor position is a line index
    // - wrappedLines: Used for scroll calculations (terminal line count) to account for line wrapping
    // - terminalWidth: Used for feedback (comment/question) wrapping calculations
    // Note: contentLines.length === wrappedLines.length (same number of logical lines)

    // Wrap feedback once for reuse in scroll calculations
    const wrappedComments = useMemo(
        () => wrapFeedback(state.comments, 'comment', terminalWidth, paddingX),
        [state.comments, terminalWidth, paddingX],
    );

    const wrappedQuestions = useMemo(
        () => wrapFeedback(state.questions, 'question', terminalWidth, paddingX),
        [state.questions, terminalWidth, paddingX],
    );

    useInput((input, key) => {
        // Handle page navigation (Space and b)
        // Node.js readline doesn't support Shift+Space detection, so we use 'b' like less/more/vim
        if (state.mode === 'plan' && (input === 'b' || input === ' ')) {
            const direction = input === 'b' ? -1 : 1;
            const targetLine = state.cursorLine + viewportHeight * direction;
            const newCursor = direction === 1 ? Math.min(contentLines.length - 1, targetLine) : Math.max(0, targetLine);

            if (state.selectionAnchor !== null) {
                dispatch({ type: 'CLEAR_SELECTION' });
            }
            dispatch({ type: 'MOVE_CURSOR', line: newCursor });

            // Use wrappedLines for scroll calculations (accounts for wrapped terminal lines)
            const maxScroll = calculateMaxScroll(wrappedLines, viewportHeight, wrappedComments, wrappedQuestions);
            const newScrollOffset = Math.max(0, Math.min(maxScroll, newCursor));
            dispatch({ type: 'SET_SCROLL_OFFSET', offset: newScrollOffset });
            return;
        }

        // Only handle arrow keys beyond this point
        if (!key.upArrow && !key.downArrow) {
            return;
        }

        // Arrow key navigation only applies in plan mode.
        // In command/comment/question mode, up/down are handled by their respective key hooks.
        if (state.mode !== 'plan') {
            return;
        }

        if (key.shift) {
            // Selection: compute target and extend selection (stale closure acceptable — shift+selection
            // is a slow deliberate gesture unlikely to batch, and selection tests are not affected)
            const newCursor = key.upArrow
                ? Math.max(0, state.cursorLine - 1)
                : Math.min(contentLines.length - 1, state.cursorLine + 1);
            if (state.selectionAnchor === null) {
                dispatch({ type: 'START_SELECTION', line: state.cursorLine });
            }
            dispatch({ type: 'EXTEND_SELECTION', line: newCursor });
        } else {
            // STEP_CURSOR: atomic cursor move + scroll in one reducer call.
            // Fixes React 19 automatic batching: each dispatch accumulates independently
            // because the reducer sees the state produced by the previous dispatch.
            dispatch({
                type: 'STEP_CURSOR',
                direction: key.upArrow ? 'up' : 'down',
                wrappedLines,
                wrappedComments,
                wrappedQuestions,
            });
        }
    });
};
