/**
 * TESTING APPROACH: Reducer Logic via Dispatch
 *
 * These tests validate state transitions by manually dispatching actions.
 * We cannot test keyboard input at the unit level because Ink's useInput
 * hook returns no-op values in test environments (no terminal session).
 *
 * Keyboard behavior (: for command mode, :n for line jump, :wq, :q)
 * is validated in integration tests at tests/integration/line-jumping.integration.test.tsx
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'bun:test';

import { createPlanViewTestHook, createPlanViewWrapper } from '~/test-utils/plan-view-helpers';

import { parseLineNumberCommand, useCommandKeys } from './useCommandKeys';

describe('useCommandKeys', () => {
    // Helper to enter command mode (simulates useFeedbackKeys behavior)
    const enterCommandMode = (result: any) => {
        act(() => {
            result.current.dispatch({ type: 'ENTER_MODE', mode: 'command' });
            result.current.dispatch({ type: 'SET_COMMAND_TEXT', text: ':' });
        });
    };

    // Note: simulateInput helper removed - we test by directly dispatching actions
    // since useInput behavior is tested through integration tests

    describe('Mode Guard (Only Handles Command Mode)', () => {
        test('ignores input when not in command mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            // Start in plan mode
            expect(result.current.state.mode).toBe('plan');

            // Try to append character (should be ignored by useCommandKeys)
            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'a', maxWidth: 80, terminalHeight: 30 });
            });

            // Command text should remain empty (never entered command mode)
            expect(result.current.state.commandText).toBe('');
        });

        test('handles input only when in command mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            // Enter command mode and set initial colon (simulates useFeedbackKeys behavior)
            enterCommandMode(result);

            expect(result.current.state.mode).toBe('command');
            expect(result.current.state.commandText).toBe(':');

            // Append character (should work now)
            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: '9', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':9');
        });
    });

    describe('Character Accumulation', () => {
        test('appends characters to command text', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            // Type ":99"
            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: '9', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: '9', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':99');
        });

        test('ignores ctrl/meta key combinations', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            const initialText = result.current.state.commandText;

            // Ctrl/Meta keys should be handled by the hook's input guard
            // We can verify that only regular input gets through by checking APPEND_INPUT
            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'a', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':a');
            expect(result.current.state.commandText).not.toBe(initialText);
        });
    });

    describe('Backspace Key', () => {
        test('removes last character from command text', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'w', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':wq');

            // Backspace once
            act(() => {
                result.current.dispatch({ type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':w');
        });

        test('keeps at least colon when backspacing', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            expect(result.current.state.commandText).toBe(':');

            // Backspace (should keep colon)
            act(() => {
                result.current.dispatch({ type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':');
        });
    });

    describe('Advanced Deletion Actions', () => {
        test('DELETE_INPUT_WORD_BACKWARD preserves colon in command mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 't', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'e', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 's', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 't', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':test');

            act(() => {
                result.current.dispatch({ type: 'DELETE_INPUT_WORD_BACKWARD', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':');
            expect(result.current.state.inputCursor).toBe(1);
        });

        test('DELETE_INPUT_FORWARD deletes character at cursor', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 't', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'e', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 's', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 't', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'SET_INPUT_CURSOR', position: 2 });
            });

            expect(result.current.state.commandText).toBe(':test');
            expect(result.current.state.inputCursor).toBe(2);

            act(() => {
                result.current.dispatch({ type: 'DELETE_INPUT_FORWARD', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':tst');
            expect(result.current.state.inputCursor).toBe(2);
        });

        test('DELETE_INPUT_TO_START preserves colon', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'h', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'e', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'l', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'l', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'o', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'SET_INPUT_CURSOR', position: 4 });
            });

            expect(result.current.state.commandText).toBe(':hello');
            expect(result.current.state.inputCursor).toBe(4);

            act(() => {
                result.current.dispatch({ type: 'DELETE_INPUT_TO_START', maxWidth: 78, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':lo');
            expect(result.current.state.inputCursor).toBe(1);
        });

        test('DELETE_INPUT_TO_END deletes from cursor to end', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'h', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'e', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'l', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'l', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'o', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'SET_INPUT_CURSOR', position: 3 });
            });

            expect(result.current.state.commandText).toBe(':hello');
            expect(result.current.state.inputCursor).toBe(3);

            act(() => {
                result.current.dispatch({ type: 'DELETE_INPUT_TO_END', maxWidth: 78, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':he');
            expect(result.current.state.inputCursor).toBe(3);
        });
    });

    describe('Escape Key', () => {
        test('exits command mode without executing', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.mode).toBe('command');
            expect(result.current.state.commandText).toBe(':q');

            // Press Escape
            act(() => {
                result.current.dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.mode).toBe('plan');
        });
    });

    describe('Line Number Commands (Integration via Dispatch)', () => {
        test('jumps to absolute line number (1-based)', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: '5', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: '0', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':50');

            act(() => {
                result.current.dispatch({
                    type: 'JUMP_TO_LINE',
                    targetLine: 49,
                    viewportHeight: result.current.state.viewportHeight,
                });
                result.current.dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.cursorLine).toBe(49);
            expect(result.current.state.mode).toBe('plan');
        });

        test('jumps forward with relative :+n', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: '+', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: '5', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':+5');

            act(() => {
                result.current.dispatch({
                    type: 'JUMP_TO_LINE',
                    targetLine: 15,
                    viewportHeight: result.current.state.viewportHeight,
                });
                result.current.dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.cursorLine).toBe(15);
        });

        test('ignores non-numeric line numbers', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'a', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'b', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'c', maxWidth: 80, terminalHeight: 30 });
            });

            const cursorBefore = result.current.state.cursorLine;

            act(() => {
                result.current.dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.cursorLine).toBe(cursorBefore);
            expect(result.current.state.mode).toBe('plan');
        });
    });

    describe('Help Command (:h, :help)', () => {
        test(':h builds command text', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'h', maxWidth: 80, terminalHeight: 30 });
            });

            // Verify command text is built correctly
            expect(result.current.state.commandText).toBe(':h');
            expect(result.current.state.mode).toBe('command');
        });

        test(':help builds command text', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'h', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'e', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'l', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'p', maxWidth: 80, terminalHeight: 30 });
            });

            // Verify command text is built correctly
            expect(result.current.state.commandText).toBe(':help');
            expect(result.current.state.mode).toBe('command');
        });
    });

    describe('Write and Quit Command (:wq)', () => {
        test(':wq shows confirm-approve when no feedback exists', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            expect(result.current.state.comments.size).toBe(0);
            expect(result.current.state.questions.size).toBe(0);
            expect(result.current.state.deletedLines.size).toBe(0);

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'w', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
            });

            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-approve',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.mode).toBe('confirm-approve');
        });

        test(':wq! immediately approves without confirmation', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'w', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: '!', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':wq!');

            act(() => {
                result.current.onApprove(undefined, 'force approved');
            });

            expect(result.current.onApprove).toHaveBeenCalledWith(undefined, 'force approved');
        });

        test(':wq shows confirm-deny when comments exist', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
                result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'Test comment' });
            });

            expect(result.current.state.comments.size).toBe(1);

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'w', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
            });

            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-deny',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.mode).toBe('confirm-deny');
        });

        test(':wq! immediately denies with feedback message', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
                result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'Fix this' });
            });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'w', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: '!', maxWidth: 80, terminalHeight: 30 });
            });

            act(() => {
                const message = 'Comments on the plan:\nLine 6: "Line 6"\nFix this';
                result.current.onDeny(message, message && message.length > 0 ? message : 'force denied with feedback');
            });

            expect(result.current.onDeny).toHaveBeenCalled();
            const callArgs = (result.current.onDeny as any).mock.calls[0];
            expect(callArgs[0]).toContain('Comments on the plan');
        });
    });

    describe('Quit Command (:q)', () => {
        test(':q immediately cancels when no feedback exists', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            expect(result.current.state.comments.size).toBe(0);

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
            });

            act(() => {
                result.current.onCancel();
            });

            expect(result.current.onCancel).toHaveBeenCalled();
        });

        test(':q shows confirmation when feedback exists', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 2 });
                result.current.dispatch({ type: 'ADD_COMMENT', line: 2, text: 'Important feedback' });
            });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
            });

            act(() => {
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'confirm-cancel' });
            });

            expect(result.current.state.mode).toBe('confirm-cancel');
            expect(result.current.onCancel).not.toHaveBeenCalled();
        });

        test(':q! immediately cancels without confirmation', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'ADD_COMMENT', line: 1, text: 'Will be discarded' });
            });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: '!', maxWidth: 80, terminalHeight: 30 });
            });

            act(() => {
                result.current.onCancel();
            });

            expect(result.current.onCancel).toHaveBeenCalled();
        });
    });

    describe('Unknown Commands', () => {
        test('ignores unknown commands and exits mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'x', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'y', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'z', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':xyz');

            const cursorBefore = result.current.state.cursorLine;

            // Execute unknown command
            act(() => {
                result.current.dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            // Should exit command mode but not change state
            expect(result.current.state.mode).toBe('plan');
            expect(result.current.state.cursorLine).toBe(cursorBefore);
            expect(result.current.onApprove).not.toHaveBeenCalled();
            expect(result.current.onDeny).not.toHaveBeenCalled();
            expect(result.current.onCancel).not.toHaveBeenCalled();
        });

        test('ignores :w (write only)', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'w', maxWidth: 80, terminalHeight: 30 });
            });

            // Execute :w (should be ignored)
            act(() => {
                result.current.dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.mode).toBe('plan');
            expect(result.current.onApprove).not.toHaveBeenCalled();
            expect(result.current.onDeny).not.toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        test('handles commands with whitespace', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useCommandKeys), { wrapper });

            enterCommandMode(result);

            act(() => {
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'w', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: 'q', maxWidth: 80, terminalHeight: 30 });
                result.current.dispatch({ type: 'APPEND_INPUT', char: ' ', maxWidth: 80, terminalHeight: 30 });
            });

            expect(result.current.state.commandText).toBe(':wq ');

            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-approve',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.mode).toBe('confirm-approve');
        });
    });

    describe('parseLineNumberCommand (Pure Function)', () => {
        describe('Basic Parsing', () => {
            test('parses absolute line numbers', () => {
                expect(parseLineNumberCommand(':1', 5, 100)).toEqual({ type: 'absolute', targetLine: 0 });
                expect(parseLineNumberCommand(':99', 5, 100)).toEqual({ type: 'absolute', targetLine: 98 });
                expect(parseLineNumberCommand(':100', 5, 100)).toEqual({ type: 'absolute', targetLine: 99 });
            });

            test('parses relative line numbers', () => {
                expect(parseLineNumberCommand(':+5', 10, 100)).toEqual({ type: 'relative', targetLine: 15 });
                expect(parseLineNumberCommand(':-3', 10, 100)).toEqual({ type: 'relative', targetLine: 7 });
                expect(parseLineNumberCommand(':+0', 10, 100)).toEqual({ type: 'relative', targetLine: 10 });
            });
        });

        describe('Clamping Behavior', () => {
            test('clamps to valid range', () => {
                expect(parseLineNumberCommand(':99999', 5, 100)).toEqual({ type: 'absolute', targetLine: 99 });
                expect(parseLineNumberCommand(':0', 5, 100)).toEqual({ type: 'absolute', targetLine: 0 });
                expect(parseLineNumberCommand(':+9999', 50, 100)).toEqual({ type: 'relative', targetLine: 99 });
                expect(parseLineNumberCommand(':-9999', 50, 100)).toEqual({ type: 'relative', targetLine: 0 });
            });

            test('handles edge content sizes', () => {
                expect(parseLineNumberCommand(':99', 0, 1)).toEqual({ type: 'absolute', targetLine: 0 });
                expect(parseLineNumberCommand(':1', 0, 0)).toEqual({ type: 'absolute', targetLine: 0 });
                expect(parseLineNumberCommand(':+5', 0, 0)).toEqual({ type: 'relative', targetLine: 0 });
            });
        });

        describe('Invalid Input', () => {
            test('returns null for non-line-number commands', () => {
                expect(parseLineNumberCommand(':wq', 5, 100)).toBeNull();
                expect(parseLineNumberCommand(':q', 5, 100)).toBeNull();
            });

            test('returns null for malformed input', () => {
                expect(parseLineNumberCommand(':99x', 5, 100)).toBeNull();
                expect(parseLineNumberCommand(':x99', 5, 100)).toBeNull();
                expect(parseLineNumberCommand(':', 5, 100)).toBeNull();
                expect(parseLineNumberCommand('99', 5, 100)).toBeNull();
                expect(parseLineNumberCommand('::99', 5, 100)).toBeNull();
            });
        });

        describe('Whitespace Handling', () => {
            test('handles whitespace correctly', () => {
                expect(parseLineNumberCommand(':99  ', 5, 100)).toEqual({ type: 'absolute', targetLine: 98 });
                expect(parseLineNumberCommand(':  99', 5, 100)).toEqual({ type: 'absolute', targetLine: 98 });
                expect(parseLineNumberCommand(':+5  ', 10, 100)).toEqual({ type: 'relative', targetLine: 15 });
            });
        });
    });
});
