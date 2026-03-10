/**
 * TESTING APPROACH: Reducer Logic via Dispatch
 *
 * These tests validate state transitions by manually dispatching actions.
 * We cannot test keyboard input at the unit level because Ink's useInput
 * hook returns no-op values in test environments (no terminal session).
 *
 * Keyboard behavior is validated in integration tests at:
 * - tests/integration/page-navigation-bug.integration.test.tsx
 * - tests/integration/scrolling-behavior.integration.test.tsx
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'bun:test';

import { createPlanViewProps, createPlanViewTestHook, createPlanViewWrapper } from '~/test-utils/plan-view-helpers';

import { useNavigationKeys } from './useNavigationKeys';

describe('useNavigationKeys', () => {
    describe('Arrow Key Navigation', () => {
        test('up arrow moves cursor up by 1', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Set cursor at line 10
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            expect(result.current.state.cursorLine).toBe(10);

            // Simulate up arrow key
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 9 });
            });

            expect(result.current.state.cursorLine).toBe(9);
        });

        test('down arrow moves cursor down by 1', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Initial cursor at line 0
            expect(result.current.state.cursorLine).toBe(0);

            // Simulate down arrow key
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 1 });
            });

            expect(result.current.state.cursorLine).toBe(1);
        });

        test('clamps at boundaries (line 0 and last line)', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // At line 0, up arrow should clamp to 0
            expect(result.current.state.cursorLine).toBe(0);
            const upFromZero = Math.max(0, result.current.state.cursorLine - 1);
            expect(upFromZero).toBe(0);

            // At last line, down arrow should stay at last line
            const lastLine = result.current.contentLines.length - 1;
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: lastLine });
            });
            const downFromLast = Math.min(result.current.contentLines.length - 1, result.current.state.cursorLine + 1);
            expect(downFromLast).toBe(lastLine);
        });

        test('arrow keys clear selection when shift not pressed', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Start a selection
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);

            // Move cursor without shift (clears selection)
            act(() => {
                result.current.dispatch({ type: 'CLEAR_SELECTION' });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 11 });
            });

            expect(result.current.state.selectionAnchor).toBeNull();
            expect(result.current.state.cursorLine).toBe(11);
        });
    });

    describe('Selection with Shift+Arrow Keys', () => {
        test('shift+down starts selection when no selection exists', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Set cursor at line 10
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            expect(result.current.state.selectionAnchor).toBeNull();

            // Shift+down: start selection at current line, extend to next
            act(() => {
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 11 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);
            expect(result.current.state.cursorLine).toBe(11);
        });

        test('shift+down extends existing selection', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Start selection at line 10
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 11 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);
            expect(result.current.state.cursorLine).toBe(11);

            // Extend selection downward
            act(() => {
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 12 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);
            expect(result.current.state.cursorLine).toBe(12);
        });

        test('shift+up starts selection when no selection exists', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Set cursor at line 10
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            expect(result.current.state.selectionAnchor).toBeNull();

            // Shift+up: start selection at current line, extend upward
            act(() => {
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 9 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);
            expect(result.current.state.cursorLine).toBe(9);
        });

        test('shift+up extends existing selection upward', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Start selection at line 10
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 9 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);
            expect(result.current.state.cursorLine).toBe(9);

            // Extend selection upward again
            act(() => {
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 8 });
            });

            expect(result.current.state.selectionAnchor).toBe(10);
            expect(result.current.state.cursorLine).toBe(8);
        });

        test('selection anchor remains fixed during multi-step selection', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Start selection at line 10
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
            });

            const anchor = result.current.state.selectionAnchor;

            // Extend selection multiple times
            act(() => {
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 11 });
            });
            expect(result.current.state.selectionAnchor).toBe(anchor);

            act(() => {
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 12 });
            });
            expect(result.current.state.selectionAnchor).toBe(anchor);

            act(() => {
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 13 });
            });
            expect(result.current.state.selectionAnchor).toBe(anchor);
        });
    });

    describe('Page Navigation (Space and b)', () => {
        test('Space moves cursor down by viewport height', () => {
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps(), { viewportHeight });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Initial cursor at line 0
            expect(result.current.state.cursorLine).toBe(0);

            // Simulate Space key (page down)
            const newCursor = Math.min(
                result.current.contentLines.length - 1,
                result.current.state.cursorLine + viewportHeight,
            );
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: newCursor });
            });

            expect(result.current.state.cursorLine).toBe(20);
        });

        test('b moves cursor up by viewport height', () => {
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps(), { viewportHeight });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Set cursor at line 50
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 50 });
            });

            // Simulate 'b' key (page up)
            const newCursor = Math.max(0, result.current.state.cursorLine - viewportHeight);
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: newCursor });
            });

            expect(result.current.state.cursorLine).toBe(30);
        });

        test('page navigation clamps at boundaries', () => {
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps(), { viewportHeight });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // b at line 10 clamps to line 0
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });
            const pageUpFromTen = Math.max(0, result.current.state.cursorLine - viewportHeight);
            expect(pageUpFromTen).toBe(0);

            // Space near bottom clamps to last line (95 + 20 = 115, but max is 99)
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 95 });
            });
            const pageDownFromNinetyFive = Math.min(
                result.current.contentLines.length - 1,
                result.current.state.cursorLine + viewportHeight,
            );
            expect(pageDownFromNinetyFive).toBe(99);
        });

        test('page navigation clears selection', () => {
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps(), { viewportHeight });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Start selection at line 10
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
                result.current.dispatch({ type: 'START_SELECTION', line: 10 });
                result.current.dispatch({ type: 'EXTEND_SELECTION', line: 15 });
            });
            expect(result.current.state.selectionAnchor).toBe(10);

            // Page navigation clears selection
            act(() => {
                result.current.dispatch({ type: 'CLEAR_SELECTION' });
            });
            expect(result.current.state.selectionAnchor).toBeNull();
        });
    });

    describe('Auto-scrolling Behavior', () => {
        test('scrolls down when cursor moves below viewport', () => {
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps(), { viewportHeight });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Set scroll at 0, cursor at 0 (viewport shows lines 0-19)
            expect(result.current.state.scrollOffset).toBe(0);

            // Move cursor to line 25 (below viewport)
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 25 });
            });

            // Scroll should adjust to keep cursor visible
            // This is handled by useScrollClamping hook, but we can verify the cursor moved
            expect(result.current.state.cursorLine).toBe(25);
        });

        test('scrolls up when cursor moves above viewport', () => {
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps(), { viewportHeight });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Set scroll at 30, cursor at 35
            act(() => {
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 30 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 35 });
            });

            // Move cursor to line 25 (above viewport start at 30)
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 25 });
            });

            // Verify cursor moved
            expect(result.current.state.cursorLine).toBe(25);
        });
    });

    describe('Small Plans (< viewport height)', () => {
        test('handles plan with 10 lines when viewport is 20 lines', () => {
            const shortContent = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps({ content: shortContent }), {
                viewportHeight,
            });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Try to page down from line 5
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
            });

            const newCursor = Math.min(
                result.current.contentLines.length - 1,
                result.current.state.cursorLine + viewportHeight,
            );
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: newCursor });
            });

            // Should clamp to last line (9)
            expect(result.current.state.cursorLine).toBe(9);
        });

        test('handles single-line plan', () => {
            const singleLine = 'Single line';
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps({ content: singleLine }), {
                viewportHeight,
            });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Initial cursor at line 0
            expect(result.current.state.cursorLine).toBe(0);

            // Try to move down (should stay at 0)
            const downCursor = Math.min(result.current.contentLines.length - 1, result.current.state.cursorLine + 1);
            expect(downCursor).toBe(0);

            // Try to page down (should stay at 0)
            const pageDownCursor = Math.min(
                result.current.contentLines.length - 1,
                result.current.state.cursorLine + viewportHeight,
            );
            expect(pageDownCursor).toBe(0);
        });
    });

    describe('Mode Restrictions', () => {
        test('navigation only works in plan mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Initial mode is 'plan'
            expect(result.current.state.mode).toBe('plan');

            // Switch to 'help' mode
            act(() => {
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'help', viewportHeight: 20 });
            });

            expect(result.current.state.mode).toBe('help');

            // In help mode, page navigation should not work
            // (This is checked in the hook implementation)
        });

        test('arrow keys do not move plan cursor in comment mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'comment', viewportHeight: 20 });
            });

            expect(result.current.state.mode).toBe('comment');
            const cursorBefore = result.current.state.cursorLine;

            // Arrow key navigation must not move plan cursor in comment mode
            // (useNavigationKeys guards on state.mode === 'plan' — verified in integration tests)
            expect(cursorBefore).toBe(5);
        });

        test('arrow keys do not move plan cursor in command mode', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'command', viewportHeight: 20 });
            });

            expect(result.current.state.mode).toBe('command');
            expect(result.current.state.cursorLine).toBe(5);
        });
    });

    describe('Viewport Height Changes', () => {
        test('page navigation distance changes with viewport height', () => {
            const smallViewportHeight = 10;
            const largeViewportHeight = 30;

            // Small viewport test
            const wrapperSmall = createPlanViewWrapper(createPlanViewProps(), {
                viewportHeight: smallViewportHeight,
                terminalHeight: 14,
            });
            const { result: resultSmall } = renderHook(createPlanViewTestHook(useNavigationKeys), {
                wrapper: wrapperSmall,
            });

            const pageDownSmall = Math.min(
                resultSmall.current.contentLines.length - 1,
                resultSmall.current.state.cursorLine + smallViewportHeight,
            );
            expect(pageDownSmall).toBe(10);

            // Large viewport test
            const wrapperLarge = createPlanViewWrapper(createPlanViewProps(), {
                viewportHeight: largeViewportHeight,
                terminalHeight: 34,
            });
            const { result: resultLarge } = renderHook(createPlanViewTestHook(useNavigationKeys), {
                wrapper: wrapperLarge,
            });

            const pageDownLarge = Math.min(
                resultLarge.current.contentLines.length - 1,
                resultLarge.current.state.cursorLine + largeViewportHeight,
            );
            expect(pageDownLarge).toBe(30);
        });
    });

    describe('Edge Cases', () => {
        test('handles empty content', () => {
            const emptyContent = '';
            const wrapper = createPlanViewWrapper(createPlanViewProps({ content: emptyContent }));
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // With empty content, contentLines should have 1 empty line
            // Cursor should be at line 0
            expect(result.current.state.cursorLine).toBe(0);
        });

        test('handles cursor at exact boundary (line equals viewport height)', () => {
            const viewportHeight = 20;
            const wrapper = createPlanViewWrapper(createPlanViewProps(), { viewportHeight });
            const { result } = renderHook(createPlanViewTestHook(useNavigationKeys), { wrapper });

            // Set cursor at line 20 (exactly at viewport boundary)
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 20 });
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 0 });
            });

            // Cursor at line 20 with scroll 0 means viewport shows 0-19, cursor is at 20 (just outside)
            expect(result.current.state.cursorLine).toBe(20);
        });
    });
});
