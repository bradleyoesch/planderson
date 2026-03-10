import { useInput } from 'ink';

import { usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';
import { handleInputNavigation } from '~/utils/input/navigation';
import { logEvent } from '~/utils/io/logger';
import { calculateViewportHeight } from '~/utils/rendering/viewport';

/**
 * Hook to handle question mode input
 * - Enter: Save question
 * - Escape: Cancel question
 * - Backspace: Remove last character
 * - Char input: Append to question text
 *
 * @testing
 * This hook uses Ink's useInput, which returns no-op values in unit test environments.
 * Unit tests validate state transitions via dispatch. Keyboard behavior is tested
 * end-to-end in integration tests using ink-testing-library.
 */
export const useQuestionKeys = (): void => {
    const { state, dispatch } = usePlanViewDynamicContext();
    const { sessionId, paddingX } = usePlanViewStaticContext();
    const { terminalHeight, terminalWidth } = useTerminal();

    useInput((input, key) => {
        // Only handle in question mode
        if (state.mode !== 'question') {
            return;
        }

        // Save question
        if (key.return) {
            const trimmedQuestion = state.currentQuestionText.trim();

            if (trimmedQuestion && state.currentQuestionLines.length > 0) {
                // Apply same question to all selected lines
                state.currentQuestionLines.forEach((line) => {
                    dispatch({ type: 'ADD_QUESTION', line, text: trimmedQuestion });
                });

                const linesStr =
                    state.currentQuestionLines.length > 1
                        ? `lines:${state.currentQuestionLines.map((l) => l + 1).join(',')}`
                        : `line:${state.currentQuestionLines[0] + 1}`;

                logEvent(__filename, sessionId, 'question.submitted', `${linesStr} length:${trimmedQuestion.length}`);
            }

            dispatch({
                type: 'SAVE_QUESTION',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });
            return;
        }

        // Cancel question
        if (key.escape) {
            logEvent(__filename, sessionId, 'question.cancelled', `line:${state.currentQuestionLine! + 1}`);
            dispatch({
                type: 'CANCEL_QUESTION',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });
            return;
        }

        // Handle common input navigation (basic movement, word jumping, line navigation, deletions)
        // maxWidth enables up/down wrapped-line navigation in question mode
        const maxWidth = terminalWidth - paddingX * 2;
        if (handleInputNavigation(input, key, dispatch, maxWidth, terminalHeight)) {
            return;
        }

        // Append character to question
        if (input && input.length > 0 && !key.ctrl && !key.meta) {
            dispatch({ type: 'APPEND_INPUT', char: input, maxWidth, terminalHeight });
            return;
        }
    });
};
