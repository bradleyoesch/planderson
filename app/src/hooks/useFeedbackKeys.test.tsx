/**
 * TESTING APPROACH: Reducer Logic via Dispatch
 *
 * These tests validate state transitions by manually dispatching actions.
 * We cannot test keyboard input at the unit level because Ink's useInput
 * hook returns no-op values in test environments (no terminal session).
 *
 * Keyboard behavior (c for comment, q for question, x for delete)
 * is validated in integration tests.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, mock, test } from 'bun:test';

import { createPlanViewProps, createPlanViewTestHook, createPlanViewWrapper } from '~/test-utils/plan-view-helpers';

import { useFeedbackKeys } from './useFeedbackKeys';

describe('useFeedbackKeys', () => {
    const useTestHook = createPlanViewTestHook(useFeedbackKeys);

    describe('Comment Mode Actions', () => {
        test('can enter comment mode and save comment', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
            });

            // Simulate entering comment mode (what 'c' key would trigger)
            act(() => {
                result.current.dispatch({
                    type: 'START_COMMENT',
                    line: 5,
                    lines: [5],
                    existingText: '',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('comment');
            expect(result.current.state.currentCommentLine).toBe(5);
            expect(result.current.state.currentCommentLines).toEqual([5]);
            expect(result.current.state.currentCommentText).toBe('');
        });

        test('pre-fills existing comment when editing', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
                // Add comment using ADD_COMMENT action (stores as FeedbackEntry)
                result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'existing comment' });
            });

            // Verify comment is stored with FeedbackEntry structure
            expect(result.current.state.comments.get(5)).toEqual({ text: 'existing comment', lines: [5] });

            // Simulate entering comment mode with existing text
            act(() => {
                result.current.dispatch({
                    type: 'START_COMMENT',
                    line: 5,
                    lines: [5],
                    existingText: 'existing comment',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('comment');
            expect(result.current.state.currentCommentText).toBe('existing comment');
        });

        test('handles multi-line comment selection', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
                result.current.dispatch({ type: 'START_SELECTION', line: 5 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 8 });
            });

            // Simulate entering comment mode for multiple lines
            act(() => {
                result.current.dispatch({
                    type: 'START_COMMENT',
                    line: 8,
                    lines: [5, 6, 7, 8],
                    existingText: '',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('comment');
            expect(result.current.state.currentCommentLines).toEqual([5, 6, 7, 8]);
            expect(result.current.state.currentCommentText).toBe('');
        });

        test('does not pre-fill when multiple lines selected even if one has comment', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
                result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'existing comment' });
                result.current.dispatch({ type: 'START_SELECTION', line: 5 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 7 });
            });

            // Verify comment is stored with FeedbackEntry structure
            expect(result.current.state.comments.get(5)).toEqual({ text: 'existing comment', lines: [5] });

            // For multiple lines, even if one has existing comment, don't pre-fill
            act(() => {
                result.current.dispatch({
                    type: 'START_COMMENT',
                    line: 7,
                    lines: [5, 6, 7],
                    existingText: '',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.currentCommentText).toBe('');
            expect(result.current.state.currentCommentLines).toEqual([5, 6, 7]);
        });
    });

    describe('Question Mode Actions', () => {
        test('can enter line question mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            // Simulate entering question mode (what 'q' or 'z' would trigger)
            act(() => {
                result.current.dispatch({
                    type: 'START_QUESTION',
                    line: 10,
                    lines: [10],
                    existingText: '',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('question');
            expect(result.current.state.currentQuestionLine).toBe(10);
            expect(result.current.state.currentQuestionLines).toEqual([10]);
        });

        test('pre-fills existing question when editing', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'ADD_QUESTION', line: 10, text: 'existing question?' });
            });

            // Verify question is stored with FeedbackEntry structure
            expect(result.current.state.questions.get(10)).toEqual({ text: 'existing question?', lines: [10] });

            act(() => {
                result.current.dispatch({
                    type: 'START_QUESTION',
                    line: 10,
                    lines: [10],
                    existingText: 'existing question?',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('question');
            expect(result.current.state.currentQuestionText).toBe('existing question?');
        });

        test('handles multi-line question selection', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 15 });
            });

            act(() => {
                result.current.dispatch({
                    type: 'START_QUESTION',
                    line: 15,
                    lines: [10, 11, 12, 13, 14, 15],
                    existingText: '',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('question');
            expect(result.current.state.currentQuestionLines).toEqual([10, 11, 12, 13, 14, 15]);
        });
    });

    describe('Delete Toggle Actions', () => {
        test('marks line for deletion', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            // Simulate delete toggle (what 'x' or Delete would trigger)
            act(() => {
                result.current.dispatch({
                    type: 'TOGGLE_DELETE_LINES',
                    lines: [10],
                    shouldDelete: true,
                });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(true);
        });

        test('unmarks line when toggling already deleted line', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'TOGGLE_DELETE_LINES', lines: [10], shouldDelete: true });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(true);

            // Toggle again to undelete
            act(() => {
                result.current.dispatch({
                    type: 'TOGGLE_DELETE_LINES',
                    lines: [10],
                    shouldDelete: false,
                });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(false);
        });

        test('marks multiple selected lines for deletion', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 14 });
            });

            act(() => {
                result.current.dispatch({
                    type: 'TOGGLE_DELETE_LINES',
                    lines: [10, 11, 12, 13, 14],
                    shouldDelete: true,
                });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(true);
            expect(result.current.state.deletedLines.has(11)).toBe(true);
            expect(result.current.state.deletedLines.has(12)).toBe(true);
            expect(result.current.state.deletedLines.has(13)).toBe(true);
            expect(result.current.state.deletedLines.has(14)).toBe(true);
        });

        test('toggle logic: deletes all when some selected lines are not deleted', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'TOGGLE_DELETE_LINES', lines: [10], shouldDelete: true });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 12 });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(true);
            expect(result.current.state.deletedLines.has(11)).toBe(false);

            // Deleting selection with mixed state should delete all
            act(() => {
                result.current.dispatch({
                    type: 'TOGGLE_DELETE_LINES',
                    lines: [10, 11, 12],
                    shouldDelete: true,
                });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(true);
            expect(result.current.state.deletedLines.has(11)).toBe(true);
            expect(result.current.state.deletedLines.has(12)).toBe(true);
        });

        test('toggle logic: undeletes all when all selected lines are deleted', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({
                    type: 'TOGGLE_DELETE_LINES',
                    lines: [10, 11, 12],
                    shouldDelete: true,
                });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(true);
            expect(result.current.state.deletedLines.has(11)).toBe(true);
            expect(result.current.state.deletedLines.has(12)).toBe(true);

            // Toggling when all are deleted should undelete all
            act(() => {
                result.current.dispatch({
                    type: 'TOGGLE_DELETE_LINES',
                    lines: [10, 11, 12],
                    shouldDelete: false,
                });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(false);
            expect(result.current.state.deletedLines.has(11)).toBe(false);
            expect(result.current.state.deletedLines.has(12)).toBe(false);
        });

        test('clears selection after delete operation', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 12 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);

            act(() => {
                result.current.dispatch({
                    type: 'TOGGLE_DELETE_LINES',
                    lines: [10, 11, 12],
                    shouldDelete: true,
                });
                result.current.dispatch({ type: 'CLEAR_SELECTION' });
            });

            expect(result.current.state.selectionAnchor).toBe(null);
        });
    });

    describe('Command Mode', () => {
        test('can enter command mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Simulate entering command mode (what ':' would trigger)
            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'command',
                    viewportHeight: 20,
                });
                result.current.dispatch({ type: 'SET_COMMAND_TEXT', text: ':' });
            });

            expect(result.current.state.mode).toBe('command');
            expect(result.current.state.commandText).toBe(':');
        });
    });

    describe('Help Mode', () => {
        test('can enter help mode and clears selection', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 12 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);

            act(() => {
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'help' });
                result.current.dispatch({ type: 'CLEAR_SELECTION' });
            });

            expect(result.current.state.mode).toBe('help');
            expect(result.current.state.selectionAnchor).toBe(null);
        });
    });

    describe('Smart Submit Behavior', () => {
        test('enters confirm-approve mode when no feedback exists', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Simulate Enter key press with no feedback
            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-approve',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('confirm-approve');
        });

        test('enters confirm-deny mode when any feedback exists', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'comment' });
                result.current.dispatch({ type: 'ADD_QUESTION', line: 10, text: 'question?' });
                result.current.dispatch({ type: 'TOGGLE_DELETE_LINES', lines: [15], shouldDelete: true });
            });

            // Verify feedback is stored with FeedbackEntry structure
            expect(result.current.state.comments.get(5)).toEqual({ text: 'comment', lines: [5] });
            expect(result.current.state.questions.get(10)).toEqual({ text: 'question?', lines: [10] });

            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-deny',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('confirm-deny');
        });
    });

    describe('Escape - Cancel/Deny', () => {
        test('calls onCancel immediately when no feedback exists', () => {
            const onCancel = mock(() => {});
            const wrapper = createPlanViewWrapper(createPlanViewProps({ onCancel }));
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Simulate Escape key press with no feedback
            act(() => {
                result.current.onCancel();
            });

            expect(onCancel).toHaveBeenCalled();
        });

        test('enters confirm-cancel mode when feedback exists', () => {
            const onCancel = mock(() => {});
            const wrapper = createPlanViewWrapper(createPlanViewProps({ onCancel }));
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'comment' });
            });

            // Verify comment is stored with FeedbackEntry structure
            expect(result.current.state.comments.get(5)).toEqual({ text: 'comment', lines: [5] });

            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-cancel',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.mode).toBe('confirm-cancel');
            expect(onCancel).not.toHaveBeenCalled();
        });

        test('clears selection when Escape pressed', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 12 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);

            act(() => {
                result.current.dispatch({ type: 'CLEAR_SELECTION' });
            });

            expect(result.current.state.selectionAnchor).toBe(null);
        });
    });

    describe('Selection Handling', () => {
        test('handles empty selection (selectionAnchor null) for single line operations', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            expect(result.current.state.selectionAnchor).toBe(null);

            act(() => {
                result.current.dispatch({
                    type: 'START_COMMENT',
                    line: 10,
                    lines: [10],
                    existingText: '',
                    viewportHeight: 20,
                });
            });

            expect(result.current.state.currentCommentLines).toEqual([10]);
        });

        test('handles selection with cursor before anchor (reverse selection)', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 15 });
                result.current.dispatch({ type: 'START_SELECTION', line: 15 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            // Selection should work in both directions
            act(() => {
                result.current.dispatch({
                    type: 'TOGGLE_DELETE_LINES',
                    lines: [10, 11, 12, 13, 14, 15],
                    shouldDelete: true,
                });
            });

            expect(result.current.state.deletedLines.has(10)).toBe(true);
            expect(result.current.state.deletedLines.has(15)).toBe(true);
        });
    });
});
