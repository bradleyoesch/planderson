import { useInput } from 'ink';

import { usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';
import { formatFeedbackMessage } from '~/utils/feedback/decision';
import { handleInputNavigation } from '~/utils/input/navigation';
import { logEvent } from '~/utils/io/logger';
import { calculateViewportHeight } from '~/utils/rendering/viewport';

export interface LineJumpCommand {
    type: 'absolute' | 'relative';
    targetLine: number; // 0-based index
}

/**
 * Parse line number commands like :99, :+5, :-3
 * Returns null if not a valid line number command
 *
 * @param commandText - The command text including colon (e.g., ":99")
 * @param currentLine - Current cursor position (0-based)
 * @param totalLines - Total number of lines in content
 */
export const parseLineNumberCommand = (
    commandText: string,
    currentLine: number,
    totalLines: number,
): LineJumpCommand | null => {
    // Must start with colon
    if (!commandText.startsWith(':')) {
        return null;
    }

    const text = commandText.slice(1).trim();

    // Empty after colon
    if (text.length === 0) {
        return null;
    }

    // Relative jumps: :+N or :-N
    if (text.startsWith('+') || text.startsWith('-')) {
        const offset = Number.parseInt(text, 10);
        if (Number.isNaN(offset)) {
            return null;
        }

        const targetLine = currentLine + offset;
        // Clamp to valid range [0, totalLines-1]
        const clampedTarget = Math.max(0, Math.min(targetLine, Math.max(0, totalLines - 1)));

        return {
            type: 'relative',
            targetLine: clampedTarget,
        };
    }

    // Absolute jumps: :N
    // Use stricter validation - entire string must be a valid number
    if (!/^-?\d+$/.test(text)) {
        return null; // Not a pure number
    }

    const lineNumber = Number.parseInt(text, 10);
    if (Number.isNaN(lineNumber)) {
        return null; // Not a number
    }

    // Convert 1-based user input to 0-based index
    // :1 → index 0, :99 → index 98
    const targetIndex = lineNumber - 1;

    // Clamp to valid range [0, totalLines-1]
    // :99999 when totalLines=100 → index 99 (last line)
    const clampedTarget = Math.max(0, Math.min(targetIndex, Math.max(0, totalLines - 1)));

    return {
        type: 'absolute',
        targetLine: clampedTarget,
    };
};

/**
 * Hook to handle command mode input
 * - :n - Jump to line n (absolute, 1-based)
 * - :+n / :-n - Jump relative to current line
 * - :wq / :wq! - Approve (with/without confirmation) - write and quit
 * - :h / :help - Show help view
 * - :q / :q! - Quit/cancel (with/without confirmation)
 * - Escape: Exit command mode
 * - Backspace: Remove last character (keeps at least ':')
 * - Char input: Append to command text (wraps at terminal width like comment/question modes)
 */
export const useCommandKeys = (): void => {
    const { state, dispatch } = usePlanViewDynamicContext();
    const { sessionId, contentLines, onApprove, onDeny, onCancel, onShowHelp } = usePlanViewStaticContext();
    const { terminalHeight, terminalWidth } = useTerminal();
    const viewportHeight = state.viewportHeight;

    useInput((input, key) => {
        // Only handle in command mode
        if (state.mode !== 'command') {
            return;
        }

        // Execute command
        if (key.return) {
            const cmd = state.commandText.trim();
            logEvent(__filename, sessionId, 'command.executed', `command:${cmd.substring(1)}`);

            // Try parsing as line number command FIRST (before checking named commands)
            const lineJump = parseLineNumberCommand(cmd, state.cursorLine, contentLines.length);
            if (lineJump !== null) {
                logEvent(__filename, sessionId, 'line.jumped', `${lineJump.type}:${lineJump.targetLine + 1}`); // Log 1-based for readability

                dispatch({
                    type: 'JUMP_TO_LINE',
                    targetLine: lineJump.targetLine,
                    viewportHeight,
                });

                dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: calculateViewportHeight('plan', terminalHeight),
                });
                return;
            }

            dispatch({
                type: 'EXIT_MODE',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });

            // Check for force flag (!)
            const forceExecute = cmd.endsWith('!');
            const baseCmd = forceExecute ? cmd.slice(0, -1) : cmd;

            // Check for feedback once
            const hasFeedback = state.comments.size > 0 || state.questions.size > 0 || state.deletedLines.size > 0;

            if (baseCmd === ':wq') {
                // Write and quit command - context-sensitive like Enter key
                // If feedback exists: "write" = send feedback (deny)
                // If no feedback: approve
                if (forceExecute) {
                    // Force write and quit (:wq!)
                    if (hasFeedback) {
                        const message = formatFeedbackMessage(
                            state.comments,
                            state.questions,
                            state.deletedLines,
                            contentLines,
                        );
                        onDeny(message, message && message.length > 0 ? message : 'force denied with feedback');
                    } else {
                        onApprove(undefined, 'force approved');
                    }
                } else {
                    // Normal :wq - show confirmation for appropriate action
                    if (hasFeedback) {
                        // Has feedback → confirm deny (write feedback)
                        dispatch({
                            type: 'ENTER_MODE',
                            mode: 'confirm-deny',
                            viewportHeight: calculateViewportHeight('confirm-deny', terminalHeight),
                        });
                    } else {
                        // No feedback → confirm approve
                        dispatch({
                            type: 'ENTER_MODE',
                            mode: 'confirm-approve',
                            viewportHeight: calculateViewportHeight('confirm-approve', terminalHeight),
                        });
                    }
                }
            } else if (baseCmd === ':h' || baseCmd === ':help') {
                // Show help view
                dispatch({ type: 'ENTER_MODE', mode: 'help' });
                // Notify App that we entered help mode (for logging)
                onShowHelp();
            } else if (baseCmd === ':q') {
                // Quit/cancel command
                if (forceExecute) {
                    // Force quit immediately
                    onCancel();
                } else {
                    if (hasFeedback) {
                        dispatch({ type: 'ENTER_MODE', mode: 'confirm-cancel' });
                    } else {
                        onCancel();
                    }
                }
            }
            // Ignore unknown commands
            return;
        }

        // Exit command mode
        if (key.escape) {
            logEvent(__filename, sessionId, 'command.cancelled');
            dispatch({
                type: 'EXIT_MODE',
                viewportHeight: calculateViewportHeight('plan', terminalHeight),
            });
            return;
        }

        // Handle common input navigation (basic movement, word jumping, line navigation, deletions)
        // CommandInput uses full terminalWidth (no InlinePane padding wrapper)
        if (handleInputNavigation(input, key, dispatch, terminalWidth, terminalHeight)) {
            return;
        }

        // Append character to command
        if (input && input.length > 0 && !key.ctrl && !key.meta) {
            dispatch({ type: 'APPEND_INPUT', char: input, maxWidth: terminalWidth, terminalHeight });
            return;
        }
    });
};
