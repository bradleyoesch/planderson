import { PlanViewMode } from '~/utils/config/constants';

/**
 * Action types for PlanView state management
 * Using discriminated unions for type safety
 */

// Viewport actions
export type SetViewportHeightAction = {
    type: 'SET_VIEWPORT_HEIGHT';
    height: number;
};

// Navigation actions
export type MoveCursorAction = {
    type: 'MOVE_CURSOR';
    line: number;
};

export type StartSelectionAction = {
    type: 'START_SELECTION';
    line: number;
};

export type ExtendSelectionAction = {
    type: 'EXTEND_SELECTION';
    line: number;
};

export type ClearSelectionAction = {
    type: 'CLEAR_SELECTION';
};

export type SetScrollOffsetAction = {
    type: 'SET_SCROLL_OFFSET';
    offset: number;
};

export type JumpToLineAction = {
    type: 'JUMP_TO_LINE';
    targetLine: number; // 0-based target index
    viewportHeight: number; // Needed for scroll calculation
};

// Feedback actions
export type AddCommentAction = {
    type: 'ADD_COMMENT';
    line: number;
    text: string;
};

export type RemoveCommentAction = {
    type: 'REMOVE_COMMENT';
    line: number;
};

export type ToggleDeleteLinesAction = {
    type: 'TOGGLE_DELETE_LINES';
    lines: number[];
    shouldDelete: boolean; // true = delete all, false = undelete all
};

// Mode actions
export type EnterModeAction = {
    type: 'ENTER_MODE';
    mode: PlanViewMode;
    viewportHeight?: number;
};

export type ExitModeAction = {
    type: 'EXIT_MODE';
    viewportHeight?: number;
};

// Input actions
export type SetCommandTextAction = {
    type: 'SET_COMMAND_TEXT';
    text: string;
};

export type SetCommentTextAction = {
    type: 'SET_COMMENT_TEXT';
    text: string;
};

export type AppendInputAction = {
    type: 'APPEND_INPUT';
    char: string;
    maxWidth: number;
    terminalHeight: number;
};

export type BackspaceInputAction = {
    type: 'BACKSPACE_INPUT';
    maxWidth: number;
    terminalHeight: number;
};

// Input cursor actions
export type MoveInputCursorLeftAction = {
    type: 'MOVE_INPUT_CURSOR_LEFT';
};

export type MoveInputCursorRightAction = {
    type: 'MOVE_INPUT_CURSOR_RIGHT';
};

export type SetInputCursorAction = {
    type: 'SET_INPUT_CURSOR';
    position: number;
};

// Advanced input cursor navigation
export type MoveInputCursorToStartAction = {
    type: 'MOVE_INPUT_CURSOR_TO_START';
};

export type MoveInputCursorToEndAction = {
    type: 'MOVE_INPUT_CURSOR_TO_END';
};

export type MoveInputCursorUpAction = {
    type: 'MOVE_INPUT_CURSOR_UP';
    maxWidth: number;
};

export type MoveInputCursorDownAction = {
    type: 'MOVE_INPUT_CURSOR_DOWN';
    maxWidth: number;
};

export type JumpInputCursorWordLeftAction = {
    type: 'JUMP_INPUT_CURSOR_WORD_LEFT';
};

export type JumpInputCursorWordRightAction = {
    type: 'JUMP_INPUT_CURSOR_WORD_RIGHT';
};

// Advanced input deletion
export type DeleteInputForwardAction = {
    type: 'DELETE_INPUT_FORWARD';
    maxWidth: number;
    terminalHeight: number;
};

export type DeleteInputWordBackwardAction = {
    type: 'DELETE_INPUT_WORD_BACKWARD';
    maxWidth: number;
    terminalHeight: number;
};

export type DeleteInputToStartAction = {
    type: 'DELETE_INPUT_TO_START';
    maxWidth: number;
    terminalHeight: number;
};

export type DeleteInputToEndAction = {
    type: 'DELETE_INPUT_TO_END';
    maxWidth: number;
    terminalHeight: number;
};

// Comment setup actions
export type StartCommentAction = {
    type: 'START_COMMENT';
    line: number;
    lines: number[];
    existingText?: string;
    viewportHeight?: number;
};

export type SaveCommentAction = {
    type: 'SAVE_COMMENT';
    viewportHeight?: number;
};

export type CancelCommentAction = {
    type: 'CANCEL_COMMENT';
    viewportHeight?: number;
};

// Confirm selection action
export type MoveConfirmSelectionAction = {
    type: 'MOVE_CONFIRM_SELECTION';
    direction: 'up' | 'down';
};

// Question setup actions
export type AddQuestionAction = {
    type: 'ADD_QUESTION';
    line: number;
    text: string;
};

export type StartQuestionAction = {
    type: 'START_QUESTION';
    line: number;
    lines: number[];
    existingText?: string;
    viewportHeight?: number;
};

export type SaveQuestionAction = {
    type: 'SAVE_QUESTION';
    viewportHeight?: number;
};

export type CancelQuestionAction = {
    type: 'CANCEL_QUESTION';
    viewportHeight?: number;
};

/**
 * Union of all action types for the reducer
 */
export type PlanViewAction =
    | SetViewportHeightAction
    | MoveCursorAction
    | StartSelectionAction
    | ExtendSelectionAction
    | ClearSelectionAction
    | SetScrollOffsetAction
    | JumpToLineAction
    | AddCommentAction
    | RemoveCommentAction
    | ToggleDeleteLinesAction
    | EnterModeAction
    | ExitModeAction
    | SetCommandTextAction
    | SetCommentTextAction
    | AppendInputAction
    | BackspaceInputAction
    | MoveInputCursorLeftAction
    | MoveInputCursorRightAction
    | SetInputCursorAction
    | MoveInputCursorToStartAction
    | MoveInputCursorToEndAction
    | MoveInputCursorUpAction
    | MoveInputCursorDownAction
    | JumpInputCursorWordLeftAction
    | JumpInputCursorWordRightAction
    | DeleteInputForwardAction
    | DeleteInputWordBackwardAction
    | DeleteInputToStartAction
    | DeleteInputToEndAction
    | StartCommentAction
    | SaveCommentAction
    | CancelCommentAction
    | AddQuestionAction
    | StartQuestionAction
    | SaveQuestionAction
    | CancelQuestionAction
    | MoveConfirmSelectionAction;
