import { PlanViewMode } from '~/utils/config/constants';
import { countInputVisualLines } from '~/utils/rendering/line-wrapping';
import {
    findCurrentLineEnd,
    findCurrentLineStart,
    findCursorPositionDown,
    findCursorPositionUp,
    findNextWordStart,
    findPrevWordStart,
    findWordDeleteStart,
} from '~/utils/rendering/text-navigation';
import { calculateViewportHeight } from '~/utils/rendering/viewport';

import { PlanViewAction } from './planViewActions';
import { PlanViewState } from './planViewState';

/**
 * Get current text buffer and minimum cursor position based on mode
 */
const getInputContext = (state: PlanViewState): { text: string; minPos: number } => {
    if (state.mode === 'command') {
        return { text: state.commandText, minPos: 1 };
    } else if (state.mode === 'comment') {
        return { text: state.currentCommentText, minPos: 0 };
    } else if (state.mode === 'question') {
        return { text: state.currentQuestionText, minPos: 0 };
    }
    return { text: '', minPos: 0 };
};

/**
 * Update text buffer based on mode
 */
const updateTextBuffer = (state: PlanViewState, newText: string): Partial<PlanViewState> => {
    if (state.mode === 'command') {
        return { commandText: newText };
    } else if (state.mode === 'comment') {
        return { currentCommentText: newText };
    } else if (state.mode === 'question') {
        return { currentQuestionText: newText };
    }
    return {};
};

/**
 * Compute the correct viewport height for input modes based on current text/cursor/dimensions.
 */
const computeViewportHeight = (
    mode: PlanViewMode,
    text: string,
    cursor: number,
    maxWidth: number,
    terminalHeight: number,
): number => Math.max(1, calculateViewportHeight(mode, terminalHeight, countInputVisualLines(text, cursor, maxWidth)));

/**
 * Returns a viewportHeight update computed atomically from the new text/cursor state.
 */
const atomicViewportUpdate = (
    mode: PlanViewMode,
    text: string,
    cursor: number,
    maxWidth: number,
    terminalHeight: number,
): Partial<PlanViewState> => ({
    viewportHeight: computeViewportHeight(mode, text, cursor, maxWidth, terminalHeight),
});

/**
 * Reducer for PlanView state management
 * All updates are immutable
 */
export const planViewReducer = (state: PlanViewState, action: PlanViewAction): PlanViewState => {
    switch (action.type) {
        // Viewport actions
        case 'SET_VIEWPORT_HEIGHT':
            return {
                ...state,
                viewportHeight: Math.max(1, action.height),
            };

        // Navigation actions
        case 'MOVE_CURSOR':
            return {
                ...state,
                cursorLine: action.line,
            };

        case 'START_SELECTION':
            return {
                ...state,
                selectionAnchor: action.line,
                cursorLine: action.line,
            };

        case 'EXTEND_SELECTION':
            return {
                ...state,
                cursorLine: action.line,
            };

        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectionAnchor: null,
            };

        case 'SET_SCROLL_OFFSET':
            return {
                ...state,
                scrollOffset: action.offset,
            };

        case 'JUMP_TO_LINE': {
            const { targetLine, viewportHeight } = action;
            // Note: contentLines is not in state, it's in static context
            // We'll assume the caller has already clamped the targetLine

            // Calculate new scroll offset based on target position
            let newScrollOffset = state.scrollOffset;

            // If target is above viewport, scroll up (target becomes first visible line)
            if (targetLine < state.scrollOffset) {
                newScrollOffset = targetLine;
            }
            // If target is below viewport, scroll down (target becomes last visible line)
            else if (targetLine >= state.scrollOffset + viewportHeight) {
                newScrollOffset = Math.max(0, targetLine - viewportHeight + 1);
            }
            // If target is within viewport, no scroll change needed

            return {
                ...state,
                cursorLine: targetLine,
                scrollOffset: newScrollOffset,
                selectionAnchor: null, // Clear selection on jump
            };
        }

        // Feedback actions
        case 'ADD_COMMENT': {
            const newComments = new Map(state.comments);
            newComments.set(action.line, {
                text: action.text,
                lines: [action.line],
            });
            return {
                ...state,
                comments: newComments,
            };
        }

        case 'REMOVE_COMMENT': {
            const newComments = new Map(state.comments);
            newComments.delete(action.line);
            return {
                ...state,
                comments: newComments,
            };
        }

        case 'TOGGLE_DELETE_LINES': {
            const newDeletedLines = new Set(state.deletedLines);
            action.lines.forEach((line) => {
                if (action.shouldDelete) {
                    // Delete all selected lines
                    newDeletedLines.add(line);
                } else {
                    // Undelete all selected lines
                    newDeletedLines.delete(line);
                }
            });
            return {
                ...state,
                deletedLines: newDeletedLines,
            };
        }

        // Mode actions
        case 'ENTER_MODE': {
            const isConfirmMode =
                action.mode === 'confirm-approve' || action.mode === 'confirm-deny' || action.mode === 'confirm-cancel';
            return {
                ...state,
                mode: action.mode,
                selectionAnchor: null, // Clear selection when entering mode
                inputCursor: action.mode === 'command' ? 1 : state.inputCursor,
                ...(isConfirmMode && { confirmSelectedIndex: 0 }),
                ...(action.viewportHeight !== undefined && { viewportHeight: action.viewportHeight }),
            };
        }

        case 'EXIT_MODE':
            return {
                ...state,
                mode: 'plan',
                commandText: '',
                currentCommentText: '',
                currentCommentLine: null,
                currentCommentLines: [],
                currentQuestionText: '',
                currentQuestionLine: null,
                currentQuestionLines: [],
                inputCursor: 0,
                ...(action.viewportHeight !== undefined && { viewportHeight: action.viewportHeight }),
            };

        // Input actions
        case 'SET_COMMAND_TEXT':
            return {
                ...state,
                commandText: action.text,
            };

        case 'SET_COMMENT_TEXT':
            return {
                ...state,
                currentCommentText: action.text,
            };

        case 'APPEND_INPUT': {
            if (state.mode === 'command') {
                const newText =
                    state.commandText.slice(0, state.inputCursor) +
                    action.char +
                    state.commandText.slice(state.inputCursor);
                const newCursor = state.inputCursor + action.char.length;
                return {
                    ...state,
                    commandText: newText,
                    inputCursor: newCursor,
                    ...atomicViewportUpdate(state.mode, newText, newCursor, action.maxWidth, action.terminalHeight),
                };
            } else if (state.mode === 'comment') {
                const newText =
                    state.currentCommentText.slice(0, state.inputCursor) +
                    action.char +
                    state.currentCommentText.slice(state.inputCursor);
                const newCursor = state.inputCursor + action.char.length;
                return {
                    ...state,
                    currentCommentText: newText,
                    inputCursor: newCursor,
                    ...atomicViewportUpdate(state.mode, newText, newCursor, action.maxWidth, action.terminalHeight),
                };
            } else if (state.mode === 'question') {
                const newText =
                    state.currentQuestionText.slice(0, state.inputCursor) +
                    action.char +
                    state.currentQuestionText.slice(state.inputCursor);
                const newCursor = state.inputCursor + action.char.length;
                return {
                    ...state,
                    currentQuestionText: newText,
                    inputCursor: newCursor,
                    ...atomicViewportUpdate(state.mode, newText, newCursor, action.maxWidth, action.terminalHeight),
                };
            }
            return state;
        }

        case 'BACKSPACE_INPUT': {
            if (state.mode === 'command') {
                // Keep at least ':' and cannot delete before cursor position 1
                if (state.inputCursor > 1 && state.commandText.length > 1) {
                    const newText =
                        state.commandText.slice(0, state.inputCursor - 1) + state.commandText.slice(state.inputCursor);
                    const newCursor = state.inputCursor - 1;
                    return {
                        ...state,
                        commandText: newText,
                        inputCursor: newCursor,
                        ...atomicViewportUpdate(state.mode, newText, newCursor, action.maxWidth, action.terminalHeight),
                    };
                }
            } else if (state.mode === 'comment') {
                if (state.inputCursor > 0 && state.currentCommentText.length > 0) {
                    const newText =
                        state.currentCommentText.slice(0, state.inputCursor - 1) +
                        state.currentCommentText.slice(state.inputCursor);
                    const newCursor = state.inputCursor - 1;
                    return {
                        ...state,
                        currentCommentText: newText,
                        inputCursor: newCursor,
                        ...atomicViewportUpdate(state.mode, newText, newCursor, action.maxWidth, action.terminalHeight),
                    };
                }
            } else if (state.mode === 'question') {
                if (state.inputCursor > 0 && state.currentQuestionText.length > 0) {
                    const newText =
                        state.currentQuestionText.slice(0, state.inputCursor - 1) +
                        state.currentQuestionText.slice(state.inputCursor);
                    const newCursor = state.inputCursor - 1;
                    return {
                        ...state,
                        currentQuestionText: newText,
                        inputCursor: newCursor,
                        ...atomicViewportUpdate(state.mode, newText, newCursor, action.maxWidth, action.terminalHeight),
                    };
                }
            }
            return state;
        }

        // Input cursor actions
        case 'MOVE_INPUT_CURSOR_LEFT': {
            if (state.mode === 'command') {
                // Cannot move before colon (position 1)
                return {
                    ...state,
                    inputCursor: Math.max(1, state.inputCursor - 1),
                };
            } else if (state.mode === 'comment' || state.mode === 'question') {
                // Cannot move before position 0
                return {
                    ...state,
                    inputCursor: Math.max(0, state.inputCursor - 1),
                };
            }
            return state;
        }

        case 'MOVE_INPUT_CURSOR_RIGHT': {
            if (state.mode === 'command') {
                return {
                    ...state,
                    inputCursor: Math.min(state.commandText.length, state.inputCursor + 1),
                };
            } else if (state.mode === 'comment') {
                return {
                    ...state,
                    inputCursor: Math.min(state.currentCommentText.length, state.inputCursor + 1),
                };
            } else if (state.mode === 'question') {
                return {
                    ...state,
                    inputCursor: Math.min(state.currentQuestionText.length, state.inputCursor + 1),
                };
            }
            return state;
        }

        case 'SET_INPUT_CURSOR': {
            if (state.mode === 'command') {
                // Command mode: cursor minimum is 1 (after colon)
                return {
                    ...state,
                    inputCursor: Math.max(1, Math.min(state.commandText.length, action.position)),
                };
            } else if (state.mode === 'comment') {
                return {
                    ...state,
                    inputCursor: Math.max(0, Math.min(state.currentCommentText.length, action.position)),
                };
            } else if (state.mode === 'question') {
                return {
                    ...state,
                    inputCursor: Math.max(0, Math.min(state.currentQuestionText.length, action.position)),
                };
            }
            return state;
        }

        // Advanced input cursor navigation
        case 'MOVE_INPUT_CURSOR_TO_START': {
            const { minPos } = getInputContext(state);
            return {
                ...state,
                inputCursor: minPos,
            };
        }

        case 'MOVE_INPUT_CURSOR_TO_END': {
            const { text } = getInputContext(state);
            return {
                ...state,
                inputCursor: text.length,
            };
        }

        case 'MOVE_INPUT_CURSOR_UP': {
            if (state.mode !== 'command' && state.mode !== 'comment' && state.mode !== 'question') return state;
            const { text, minPos } = getInputContext(state);
            const newPos = findCursorPositionUp(text, state.inputCursor, action.maxWidth);
            return { ...state, inputCursor: Math.max(minPos, newPos) };
        }

        case 'MOVE_INPUT_CURSOR_DOWN': {
            if (state.mode !== 'command' && state.mode !== 'comment' && state.mode !== 'question') return state;
            const { text } = getInputContext(state);
            const newPos = findCursorPositionDown(text, state.inputCursor, action.maxWidth);
            return { ...state, inputCursor: newPos };
        }

        case 'JUMP_INPUT_CURSOR_WORD_LEFT': {
            const { text, minPos } = getInputContext(state);
            const newPos = findPrevWordStart(text, state.inputCursor);
            return {
                ...state,
                inputCursor: Math.max(minPos, newPos),
            };
        }

        case 'JUMP_INPUT_CURSOR_WORD_RIGHT': {
            const { text } = getInputContext(state);
            const newPos = findNextWordStart(text, state.inputCursor);
            return {
                ...state,
                inputCursor: newPos,
            };
        }

        // Advanced input deletion
        case 'DELETE_INPUT_FORWARD': {
            const { text } = getInputContext(state);
            if (state.inputCursor >= text.length) return state; // No-op at end

            const newText = text.slice(0, state.inputCursor) + text.slice(state.inputCursor + 1);
            return {
                ...state,
                ...updateTextBuffer(state, newText),
                // Cursor stays at same position
                ...atomicViewportUpdate(state.mode, newText, state.inputCursor, action.maxWidth, action.terminalHeight),
            };
        }

        case 'DELETE_INPUT_WORD_BACKWARD': {
            const { text, minPos } = getInputContext(state);
            if (state.inputCursor <= minPos) return state; // No-op at minimum position

            const deleteFrom = findWordDeleteStart(text, state.inputCursor, minPos);
            const newText = text.slice(0, deleteFrom) + text.slice(state.inputCursor);

            return {
                ...state,
                ...updateTextBuffer(state, newText),
                inputCursor: deleteFrom,
                ...atomicViewportUpdate(state.mode, newText, deleteFrom, action.maxWidth, action.terminalHeight),
            };
        }

        case 'DELETE_INPUT_TO_START': {
            const { text, minPos } = getInputContext(state);
            if (state.inputCursor <= minPos) return state; // No-op at minimum position

            const lineStart = Math.max(minPos, findCurrentLineStart(text, state.inputCursor, action.maxWidth));
            if (state.inputCursor <= lineStart) return state; // No-op: cursor already at line start
            const newText = text.slice(0, lineStart) + text.slice(state.inputCursor);
            return {
                ...state,
                ...updateTextBuffer(state, newText),
                inputCursor: lineStart,
                ...atomicViewportUpdate(state.mode, newText, lineStart, action.maxWidth, action.terminalHeight),
            };
        }

        case 'DELETE_INPUT_TO_END': {
            const { text } = getInputContext(state);
            if (state.inputCursor >= text.length) return state; // No-op at end

            const lineEnd = findCurrentLineEnd(text, state.inputCursor, action.maxWidth);
            if (state.inputCursor >= lineEnd) return state; // No-op: cursor already at line end
            const newText = text.slice(0, state.inputCursor) + text.slice(lineEnd);
            return {
                ...state,
                ...updateTextBuffer(state, newText),
                ...atomicViewportUpdate(state.mode, newText, state.inputCursor, action.maxWidth, action.terminalHeight),
            };
        }

        // Comment setup actions
        case 'START_COMMENT': {
            const commentText = action.existingText || '';
            return {
                ...state,
                mode: 'comment',
                currentCommentLine: action.line,
                currentCommentLines: action.lines,
                currentCommentText: commentText,
                inputCursor: commentText.length,
                ...(action.viewportHeight !== undefined && { viewportHeight: action.viewportHeight }),
            };
        }

        case 'SAVE_COMMENT': {
            if (state.currentCommentLine === null) {
                return state;
            }

            const newComments = new Map(state.comments);
            // Determine storage line and range for cursor positioning
            const lines =
                state.currentCommentLines.length > 0
                    ? [...state.currentCommentLines].sort((a, b) => a - b)
                    : [state.currentCommentLine];
            const storageLine = lines[0]; // First selected line

            // Create a set of current lines for overlap detection
            const currentLines = new Set(lines);

            if (state.currentCommentText.trim()) {
                // Before saving, remove any existing comments that overlap with current selection
                // This prevents duplicate entries when creating multi-select comments
                [...state.comments.entries()]
                    .filter(([, entry]) => entry.lines.some((l) => currentLines.has(l)))
                    .forEach(([line]) => newComments.delete(line));

                // Now save the new comment
                newComments.set(storageLine, {
                    text: state.currentCommentText,
                    lines: lines,
                });
            } else {
                // Deletion: Remove if current selection overlaps with any existing feedback
                [...state.comments.entries()]
                    .filter(([, entry]) => entry.lines.some((l) => currentLines.has(l)))
                    .forEach(([line]) => newComments.delete(line));
            }

            return {
                ...state,
                comments: newComments,
                mode: 'plan',
                currentCommentLine: null,
                currentCommentLines: [],
                currentCommentText: '',
                inputCursor: 0,
                selectionAnchor: lines.length > 1 ? state.selectionAnchor : null,
                ...(action.viewportHeight !== undefined && { viewportHeight: action.viewportHeight }),
            };
        }

        case 'CANCEL_COMMENT':
            return {
                ...state,
                mode: 'plan',
                currentCommentLine: null,
                currentCommentLines: [],
                currentCommentText: '',
                inputCursor: 0,
                ...(action.viewportHeight !== undefined && { viewportHeight: action.viewportHeight }),
            };

        // Question setup actions
        case 'ADD_QUESTION': {
            const newQuestions = new Map(state.questions);
            newQuestions.set(action.line, {
                text: action.text,
                lines: [action.line],
            });
            return {
                ...state,
                questions: newQuestions,
            };
        }

        case 'START_QUESTION': {
            const questionText = action.existingText || '';
            return {
                ...state,
                mode: 'question',
                currentQuestionLine: action.line,
                currentQuestionLines: action.lines,
                currentQuestionText: questionText,
                inputCursor: questionText.length,
                ...(action.viewportHeight !== undefined && { viewportHeight: action.viewportHeight }),
            };
        }

        case 'SAVE_QUESTION': {
            // Line-specific question case
            const newQuestions = new Map(state.questions);
            // Determine storage line and range for cursor positioning
            const lines =
                state.currentQuestionLines.length > 0
                    ? [...state.currentQuestionLines].sort((a, b) => a - b)
                    : [state.currentQuestionLine!];
            const storageLine = lines[0]; // First selected line

            // Create a set of current lines for overlap detection
            const currentLines = new Set(lines);

            if (state.currentQuestionText.trim()) {
                // Before saving, remove any existing questions that overlap with current selection
                // This prevents duplicate entries when creating multi-select questions
                [...state.questions.entries()]
                    .filter(([, entry]) => entry.lines.some((l) => currentLines.has(l)))
                    .forEach(([line]) => newQuestions.delete(line));

                // Now save the new question
                newQuestions.set(storageLine, {
                    text: state.currentQuestionText,
                    lines: lines,
                });
            } else {
                // Deletion: Remove if current selection overlaps with any existing feedback
                [...state.questions.entries()]
                    .filter(([, entry]) => entry.lines.some((l) => currentLines.has(l)))
                    .forEach(([line]) => newQuestions.delete(line));
            }

            return {
                ...state,
                questions: newQuestions,
                mode: 'plan',
                currentQuestionLine: null,
                currentQuestionLines: [],
                currentQuestionText: '',
                inputCursor: 0,
                selectionAnchor: lines.length > 1 ? state.selectionAnchor : null,
                ...(action.viewportHeight !== undefined && { viewportHeight: action.viewportHeight }),
            };
        }

        case 'CANCEL_QUESTION':
            return {
                ...state,
                mode: 'plan',
                currentQuestionLine: null,
                currentQuestionLines: [],
                currentQuestionText: '',
                inputCursor: 0,
                ...(action.viewportHeight !== undefined && { viewportHeight: action.viewportHeight }),
            };

        case 'MOVE_CONFIRM_SELECTION':
            return {
                ...state,
                confirmSelectedIndex:
                    action.direction === 'down'
                        ? Math.min(1, state.confirmSelectedIndex + 1)
                        : Math.max(0, state.confirmSelectedIndex - 1),
            };

        default: {
            // Exhaustiveness check - ensures all action types are handled
            const _exhaustive: never = action;
            void _exhaustive; // Mark as intentionally unused
            return state;
        }
    }
};
