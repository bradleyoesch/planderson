import { Key } from 'ink';
import React from 'react';

import { PlanViewAction } from '~/state/planViewActions';

/**
 * Shared input navigation handler for command, comment, and question modes
 * Handles cursor movement, word jumping, line navigation, and deletions
 *
 * @param input - The character input from useInput
 * @param key - The key object from useInput
 * @param dispatch - The dispatch function to send actions
 * @returns true if the input was handled, false otherwise
 */
export const handleInputNavigation = (
    input: string,
    key: Key,
    dispatch: React.Dispatch<PlanViewAction>,
    maxWidth: number,
    terminalHeight: number,
): boolean => {
    if (key.upArrow) {
        dispatch({ type: 'MOVE_INPUT_CURSOR_UP', maxWidth });
        return true;
    }

    if (key.downArrow) {
        dispatch({ type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth });
        return true;
    }

    // Basic backspace/delete (without meta modifier)
    // Must come before arrow keys to handle delete key priority
    if ((key.backspace || key.delete) && !key.meta) {
        dispatch({ type: 'BACKSPACE_INPUT', maxWidth, terminalHeight });
        return true;
    }

    // Left arrow - move cursor left
    if (key.leftArrow && !key.meta) {
        dispatch({ type: 'MOVE_INPUT_CURSOR_LEFT' });
        return true;
    }

    // Right arrow - move cursor right
    if (key.rightArrow && !key.meta) {
        dispatch({ type: 'MOVE_INPUT_CURSOR_RIGHT' });
        return true;
    }

    // Word jumping
    // Option+Left/Right (standard terminal behavior)
    if (key.leftArrow && key.meta) {
        dispatch({ type: 'JUMP_INPUT_CURSOR_WORD_LEFT' });
        return true;
    }

    if (key.rightArrow && key.meta) {
        dispatch({ type: 'JUMP_INPUT_CURSOR_WORD_RIGHT' });
        return true;
    }

    // Option+b/f (Emacs/readline bindings, Mac default)
    // On Mac, Option+Arrow often sends Option+b (backward) or Option+f (forward)
    if (input === 'b' && key.meta) {
        dispatch({ type: 'JUMP_INPUT_CURSOR_WORD_LEFT' });
        return true;
    }

    if (input === 'f' && key.meta) {
        dispatch({ type: 'JUMP_INPUT_CURSOR_WORD_RIGHT' });
        return true;
    }

    // Line navigation
    // Note: HOME/END keys are not supported because Ink's useInput Key type
    // doesn't expose key.home or key.end properties (TypeScript compilation error).
    // Ctrl+A and Ctrl+E serve as the standard terminal alternatives.
    if (input === 'a' && key.ctrl) {
        dispatch({ type: 'MOVE_INPUT_CURSOR_TO_START' });
        return true;
    }

    if (input === 'e' && key.ctrl) {
        dispatch({ type: 'MOVE_INPUT_CURSOR_TO_END' });
        return true;
    }

    // Deletions
    if (input === 'd' && key.ctrl) {
        dispatch({ type: 'DELETE_INPUT_FORWARD', maxWidth, terminalHeight });
        return true;
    }

    if (input === 'w' && key.ctrl) {
        dispatch({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth, terminalHeight });
        return true;
    }

    if (key.backspace && key.meta) {
        dispatch({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth, terminalHeight });
        return true;
    }

    if (key.delete && key.meta) {
        dispatch({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth, terminalHeight });
        return true;
    }

    // Option+d (Mac terminals often send this for Option+Delete)
    if (input === 'd' && key.meta) {
        dispatch({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth, terminalHeight });
        return true;
    }

    if (input === 'u' && key.ctrl) {
        dispatch({ type: 'DELETE_INPUT_TO_START', maxWidth, terminalHeight });
        return true;
    }

    if (input === 'k' && key.ctrl) {
        dispatch({ type: 'DELETE_INPUT_TO_END', maxWidth, terminalHeight });
        return true;
    }

    // Input not handled by this function
    return false;
};
