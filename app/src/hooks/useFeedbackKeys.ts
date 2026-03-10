import { useInput } from 'ink';

import { usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';
import { logEvent } from '~/utils/io/logger';
import { countInputVisualLines } from '~/utils/rendering/line-wrapping';
import { calculateViewportHeight } from '~/utils/rendering/viewport';

/**
 * Helper to get all selected lines (inclusive range from anchor to cursor)
 */
const getSelectedLines = (cursorLine: number, selectionAnchor: number | null): number[] => {
    if (selectionAnchor === null) {
        return [cursorLine];
    }
    const start = Math.min(cursorLine, selectionAnchor);
    const end = Math.max(cursorLine, selectionAnchor);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

/**
 * Hook to handle feedback keys in plan view mode
 * - c: Add/edit comment
 * - q/z: Add/edit line-specific question
 * - x/Delete: Toggle deletion
 * - :: Enter command mode
 * - ?: Show help
 * - Enter: Smart submit (approve/deny based on feedback)
 * - Escape: Cancel with confirmation if feedback exists
 */
export const useFeedbackKeys = (): void => {
    const { state, dispatch } = usePlanViewDynamicContext();
    const { sessionId, paddingX, onShowHelp, onCancel } = usePlanViewStaticContext();
    const { terminalHeight, terminalWidth } = useTerminal();

    useInput((input, key) => {
        // Only handle in plan view mode
        if (state.mode !== 'plan') {
            return;
        }

        // Comment key
        if (input === 'c' && !key.ctrl && !key.meta) {
            const selectedLines = getSelectedLines(state.cursorLine, state.selectionAnchor);

            // Find all comments that overlap with the current selection
            const selectedLinesSet = new Set(selectedLines);
            const overlappingComments = [...state.comments.entries()].filter(([, entry]) =>
                entry.lines.some((l) => selectedLinesSet.has(l)),
            );

            // If multiple overlapping comments, use the one with the lowest line number
            const existingEntry =
                overlappingComments.length > 0
                    ? overlappingComments.reduce((lowest, current) => (current[0] < lowest[0] ? current : lowest))
                    : undefined;

            const isEditing = existingEntry !== undefined;
            const existingText = existingEntry !== undefined ? existingEntry[1].text : '';

            // Calculate target lines: if editing, use union of all overlapping ranges + selection
            let targetLines = selectedLines;
            if (isEditing) {
                const allOverlappingLines = new Set(selectedLines);
                overlappingComments.forEach(([, entry]) => {
                    entry.lines.forEach((line) => allOverlappingLines.add(line));
                });
                targetLines = [...allOverlappingLines].sort((a, b) => a - b);
            }

            const storageLine = targetLines[0]; // Use first line of target range
            const lines = targetLines;

            logEvent(
                __filename,
                sessionId,
                'comment.started',
                `line:${state.cursorLine + 1}${selectedLines.length > 1 ? ` (${selectedLines.length} lines)` : ''}${isEditing ? ' editing' : ''}`,
            );

            const commentEffectiveWidth = terminalWidth - paddingX * 2;
            const commentLineCount = countInputVisualLines(existingText, existingText.length, commentEffectiveWidth);
            dispatch({
                type: 'START_COMMENT',
                line: storageLine, // Use first selected line or existing storage line
                lines: lines, // Preserve original range when editing
                existingText,
                viewportHeight: calculateViewportHeight('comment', terminalHeight, commentLineCount),
            });
            return;
        }

        // Line-specific question key (lowercase q or z)
        if ((input === 'q' || input === 'z') && !key.shift && !key.ctrl && !key.meta) {
            const selectedLines = getSelectedLines(state.cursorLine, state.selectionAnchor);

            // Find all questions that overlap with the current selection
            const selectedLinesSet = new Set(selectedLines);
            const overlappingQuestions = [...state.questions.entries()].filter(([, entry]) =>
                entry.lines.some((l) => selectedLinesSet.has(l)),
            );

            // If multiple overlapping questions, use the one with the lowest line number
            const existingEntry =
                overlappingQuestions.length > 0
                    ? overlappingQuestions.reduce((lowest, current) => (current[0] < lowest[0] ? current : lowest))
                    : undefined;

            const isEditing = existingEntry !== undefined;
            const existingText = existingEntry !== undefined ? existingEntry[1].text : '';

            // Calculate target lines: if editing, use union of all overlapping ranges + selection
            let targetLines = selectedLines;
            if (isEditing) {
                const allOverlappingLines = new Set(selectedLines);
                overlappingQuestions.forEach(([, entry]) => {
                    entry.lines.forEach((line) => allOverlappingLines.add(line));
                });
                targetLines = [...allOverlappingLines].sort((a, b) => a - b);
            }

            const storageLine = targetLines[0]; // Use first line of target range
            const lines = targetLines;

            logEvent(
                __filename,
                sessionId,
                'question.started',
                `line:${state.cursorLine + 1}${selectedLines.length > 1 ? ` (${selectedLines.length} lines)` : ''}${isEditing ? ' editing' : ''}`,
            );

            const questionEffectiveWidth = terminalWidth - paddingX * 2;
            const questionLineCount = countInputVisualLines(existingText, existingText.length, questionEffectiveWidth);
            dispatch({
                type: 'START_QUESTION',
                line: storageLine, // Use first selected line or existing storage line
                lines: lines, // Preserve original range when editing
                existingText,
                viewportHeight: calculateViewportHeight('question', terminalHeight, questionLineCount),
            });
            return;
        }

        // Delete key
        if ((input === 'x' || key.delete) && !key.ctrl && !key.meta) {
            const selectedLines = getSelectedLines(state.cursorLine, state.selectionAnchor);

            // Toggle logic: if ALL lines are deleted, undelete all; otherwise delete all
            const allDeleted = selectedLines.every((line) => state.deletedLines.has(line));

            dispatch({
                type: 'TOGGLE_DELETE_LINES',
                lines: selectedLines,
                shouldDelete: !allDeleted, // If all deleted, undelete (false); otherwise delete (true)
            });

            const linesStr =
                selectedLines.length > 1
                    ? `lines:${selectedLines
                          .sort((a, b) => a - b)
                          .map((l) => l + 1)
                          .join(',')}`
                    : `line:${state.cursorLine + 1}`;

            logEvent(__filename, sessionId, allDeleted ? 'delete.cancelled' : 'delete.submitted', linesStr);

            // Clear selection after operation
            dispatch({ type: 'CLEAR_SELECTION' });
            return;
        }

        // Command mode key
        if (input === ':' && !key.ctrl && !key.meta) {
            dispatch({
                type: 'ENTER_MODE',
                mode: 'command',
                viewportHeight: calculateViewportHeight('command', terminalHeight),
            });
            dispatch({ type: 'SET_COMMAND_TEXT', text: ':' });
            return;
        }

        // Help key
        if (input === '?' && !key.ctrl && !key.meta) {
            dispatch({ type: 'ENTER_MODE', mode: 'help' });
            dispatch({ type: 'CLEAR_SELECTION' });
            // Notify App that we entered help mode (for logging)
            onShowHelp();
            return;
        }

        // Helper to check if any feedback exists
        const hasFeedback = state.comments.size > 0 || state.questions.size > 0 || state.deletedLines.size > 0;

        // Smart submit with Enter key
        if (key.return) {
            const mode = hasFeedback ? 'confirm-deny' : 'confirm-approve';
            dispatch({
                type: 'ENTER_MODE',
                mode,
                viewportHeight: calculateViewportHeight(mode, terminalHeight),
            });
            return;
        }

        // Escape - cancel with confirmation if feedback exists
        if (key.escape) {
            // Priority 1: Cancel multi-line selection (if exists)
            if (state.selectionAnchor !== null && state.selectionAnchor !== state.cursorLine) {
                logEvent(
                    __filename,
                    sessionId,
                    'selection.cancelled',
                    `lines:${Math.min(state.cursorLine, state.selectionAnchor) + 1}-${Math.max(state.cursorLine, state.selectionAnchor) + 1} cursor:${state.cursorLine + 1}`,
                );
                dispatch({ type: 'CLEAR_SELECTION' });
                return; // Don't exit plan, just clear selection
            }

            // Priority 2: Exit/cancel plan (existing behavior for single-line)
            if (hasFeedback) {
                dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-cancel',
                    viewportHeight: calculateViewportHeight('confirm-cancel', terminalHeight),
                });
            } else {
                onCancel();
            }
            dispatch({ type: 'CLEAR_SELECTION' });
            return;
        }
    });
};
