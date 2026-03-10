import { useInput } from 'ink';

import { usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useSettings } from '~/contexts/SettingsContext';
import { useTerminal } from '~/contexts/TerminalContext';
import { formatDiscardedSummary, formatFeedbackMessage } from '~/utils/feedback/decision';
import { calculateViewportHeight } from '~/utils/rendering/viewport';

/**
 * Hook to handle confirmation screen keys
 * - Enter / '1': Confirm with option 1 (the action)
 * - '2' / Enter with option 2 selected: Cancel and return to plan view
 * - ↑/↓: Move selection between options
 * - Escape: Always cancel and return to plan view
 *
 * Handles three confirmation modes:
 * - confirm-approve: Execute approve action
 * - confirm-deny: Execute deny action
 * - confirm-cancel: Execute cancel action
 */
export const useConfirmKeys = (): void => {
    const { state, dispatch } = usePlanViewDynamicContext();
    const { contentLines, onApprove, onDeny, onCancel } = usePlanViewStaticContext();
    const { settings } = useSettings();
    const { terminalHeight } = useTerminal();

    useInput((input, key) => {
        // Only handle in confirmation modes
        const confirmModes: (typeof state.mode)[] = ['confirm-approve', 'confirm-deny', 'confirm-cancel'];
        if (!confirmModes.includes(state.mode)) {
            return;
        }

        // Arrow keys move selection
        if (key.upArrow || key.downArrow) {
            dispatch({ type: 'MOVE_CONFIRM_SELECTION', direction: key.upArrow ? 'up' : 'down' });
            return;
        }

        // '2' always cancels (same as selecting option 2 + Enter)
        if (input === '2') {
            dispatch({
                type: 'EXIT_MODE',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });
            return;
        }

        // Cancel confirmation
        if (key.escape) {
            dispatch({
                type: 'EXIT_MODE',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });
            return;
        }

        // Enter with option 2 selected: cancel
        if (key.return && state.confirmSelectedIndex === 1) {
            dispatch({
                type: 'EXIT_MODE',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });
            return;
        }

        // Enter with option 1 selected (or '1' key): execute action
        const shouldExecute = key.return || input === '1';
        if (!shouldExecute) return;

        if (state.mode === 'confirm-approve') {
            // Check setting: if exit mode, just exit without sending approval
            if (settings.approveAction === 'exit') {
                onCancel();
                return;
            }

            // Normal approve flow
            const hasFeedback = state.comments.size > 0 || state.questions.size > 0 || state.deletedLines.size > 0;
            if (hasFeedback) {
                const discardedSummary = formatDiscardedSummary(state.comments, state.questions, state.deletedLines);
                onApprove(undefined, `approved with ${discardedSummary} discarded`);
            } else {
                onApprove(undefined, 'response_sent_via_socket');
            }
        } else if (state.mode === 'confirm-deny') {
            const message = formatFeedbackMessage(state.comments, state.questions, state.deletedLines, contentLines);
            if (message) {
                onDeny(message, message);
            } else {
                onDeny(undefined, 'no comments or deletions');
            }
        } else if (state.mode === 'confirm-cancel') {
            onCancel();
        }
    });
};
