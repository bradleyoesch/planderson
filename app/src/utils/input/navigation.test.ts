import { describe, expect, test } from 'bun:test';
import { Key } from 'ink';

import { PlanViewAction } from '~/state/planViewActions';

import { handleInputNavigation } from './navigation';

describe('input navigation', () => {
    // Helper to create mock dispatch
    const createMockDispatch = () => {
        let lastAction: PlanViewAction | null = null;
        const dispatch = (action: PlanViewAction) => {
            lastAction = action;
        };
        return { dispatch, getLastAction: () => lastAction };
    };

    // Helper to create mock Key object
    const createKey = (overrides: Partial<Key> = {}): Key => ({
        upArrow: false,
        downArrow: false,
        leftArrow: false,
        rightArrow: false,
        pageDown: false,
        pageUp: false,
        return: false,
        escape: false,
        ctrl: false,
        shift: false,
        tab: false,
        backspace: false,
        delete: false,
        meta: false,
        ...overrides,
    });

    describe('Basic Backspace/Delete', () => {
        test('returns true and dispatches BACKSPACE_INPUT for backspace without meta', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ backspace: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns true and dispatches BACKSPACE_INPUT for delete without meta', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ delete: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns false when backspace is pressed with meta (handled by word deletion)', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            // This will be handled by word deletion section
            handleInputNavigation('', createKey({ backspace: true, meta: true }), dispatch, 80, 30);

            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns false when delete is pressed with meta (handled by word deletion)', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            // This will be handled by word deletion section
            handleInputNavigation('', createKey({ delete: true, meta: true }), dispatch, 80, 30);

            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth: 80, terminalHeight: 30 });
        });
    });

    describe('Up/Down Navigation', () => {
        test('returns true and dispatches MOVE_INPUT_CURSOR_UP for up arrow', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ upArrow: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'MOVE_INPUT_CURSOR_UP', maxWidth: 80 });
        });

        test('returns true and dispatches MOVE_INPUT_CURSOR_DOWN for down arrow', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ downArrow: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth: 80 });
        });
    });

    describe('Arrow Keys', () => {
        test('returns true and dispatches MOVE_INPUT_CURSOR_LEFT for left arrow', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ leftArrow: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'MOVE_INPUT_CURSOR_LEFT' });
        });

        test('returns true and dispatches MOVE_INPUT_CURSOR_RIGHT for right arrow', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ rightArrow: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'MOVE_INPUT_CURSOR_RIGHT' });
        });

        test('returns false when arrow key is pressed with meta (handled by word jumping)', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            // This will be handled by word jumping section below
            handleInputNavigation('', createKey({ leftArrow: true, meta: true }), dispatch, 80, 30);

            expect(getLastAction()).toEqual({ type: 'JUMP_INPUT_CURSOR_WORD_LEFT' });
        });
    });

    describe('Word Jumping', () => {
        test('returns true and dispatches JUMP_INPUT_CURSOR_WORD_LEFT for Alt+Left', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ leftArrow: true, meta: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'JUMP_INPUT_CURSOR_WORD_LEFT' });
        });

        test('returns true and dispatches JUMP_INPUT_CURSOR_WORD_RIGHT for Alt+Right', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ rightArrow: true, meta: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'JUMP_INPUT_CURSOR_WORD_RIGHT' });
        });

        test('returns true and dispatches JUMP_INPUT_CURSOR_WORD_LEFT for Option+b (Mac)', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('b', createKey({ meta: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'JUMP_INPUT_CURSOR_WORD_LEFT' });
        });

        test('returns true and dispatches JUMP_INPUT_CURSOR_WORD_RIGHT for Option+f (Mac)', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('f', createKey({ meta: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'JUMP_INPUT_CURSOR_WORD_RIGHT' });
        });
    });

    describe('Line Navigation', () => {
        test('returns true and dispatches MOVE_INPUT_CURSOR_TO_START for Ctrl+A', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('a', createKey({ ctrl: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'MOVE_INPUT_CURSOR_TO_START' });
        });

        test('returns true and dispatches MOVE_INPUT_CURSOR_TO_END for Ctrl+E', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('e', createKey({ ctrl: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'MOVE_INPUT_CURSOR_TO_END' });
        });

        test('returns false for regular "a" without ctrl', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('a', createKey(), dispatch, 80, 30);

            expect(result).toBe(false);
            expect(getLastAction()).toBe(null);
        });
    });

    describe('Deletions', () => {
        test('returns true and dispatches DELETE_INPUT_FORWARD for Ctrl+D', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('d', createKey({ ctrl: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_FORWARD', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns true and dispatches DELETE_INPUT_WORD_BACKWARD for Ctrl+W', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('w', createKey({ ctrl: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns true and dispatches DELETE_INPUT_WORD_BACKWARD for Alt+Backspace', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ backspace: true, meta: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns true and dispatches DELETE_INPUT_WORD_BACKWARD for Alt+Delete', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ delete: true, meta: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns true and dispatches DELETE_INPUT_WORD_BACKWARD for Option+d (Mac)', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('d', createKey({ meta: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns true and dispatches DELETE_INPUT_TO_START for Ctrl+U', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('u', createKey({ ctrl: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_TO_START', maxWidth: 80, terminalHeight: 30 });
        });

        test('returns true and dispatches DELETE_INPUT_TO_END for Ctrl+K', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('k', createKey({ ctrl: true }), dispatch, 80, 30);

            expect(result).toBe(true);
            expect(getLastAction()).toEqual({ type: 'DELETE_INPUT_TO_END', maxWidth: 80, terminalHeight: 30 });
        });
    });

    describe('Unhandled Input', () => {
        test('returns false for regular character input', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('x', createKey(), dispatch, 80, 30);

            expect(result).toBe(false);
            expect(getLastAction()).toBe(null);
        });

        test('returns false for Enter key', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ return: true }), dispatch, 80, 30);

            expect(result).toBe(false);
            expect(getLastAction()).toBe(null);
        });

        test('returns false for Escape key', () => {
            const { dispatch, getLastAction } = createMockDispatch();

            const result = handleInputNavigation('', createKey({ escape: true }), dispatch, 80, 30);

            expect(result).toBe(false);
            expect(getLastAction()).toBe(null);
        });
    });
});
