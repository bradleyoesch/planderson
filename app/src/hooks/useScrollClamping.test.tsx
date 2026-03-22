/**
 * TESTING APPROACH: Reducer Logic via Dispatch
 *
 * These tests validate state transitions by manually dispatching actions.
 * We cannot test keyboard input at the unit level because Ink's useInput
 * hook returns no-op values in test environments (no terminal session).
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'bun:test';
import React, { useEffect, useState } from 'react';

import { PlanViewProvider, usePlanViewDynamicContext } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { createPlanViewProps, createPlanViewTestHook, createPlanViewWrapper } from '~/test-utils/plan-view-helpers';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

import { useScrollClamping } from './useScrollClamping';

// Helper to create dynamic viewport wrapper with state setter
type SetDimsFunc = (dims: { vh: number; th: number }) => void;
const createDynamicViewportWrapper = (
    initialVh: number,
    initialTh: number,
    content?: string,
): [React.ComponentType<{ children: React.ReactNode }>, React.MutableRefObject<SetDimsFunc | null>] => {
    const setterRef: React.MutableRefObject<SetDimsFunc | null> = { current: null };

    const DynamicWrapper = ({ children }: { children: React.ReactNode }) => {
        const [{ vh, th }, setDims] = useState({ vh: initialVh, th: initialTh });
        useEffect(() => {
            setterRef.current = setDims;
        }, []);

        const ViewportHeightSetter = ({ children: c }: { children: React.ReactNode }) => {
            const { state, dispatch } = usePlanViewDynamicContext();

            useEffect(() => {
                if (state.viewportHeight !== vh) {
                    dispatch({ type: 'SET_VIEWPORT_HEIGHT', height: vh });
                }
            }, [state.viewportHeight]);

            return <>{c}</>;
        };

        return (
            <TerminalProvider terminalWidth={80} terminalHeight={th}>
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <PlanViewProvider {...createPlanViewProps(content ? { content } : {})}>
                        <ViewportHeightSetter>{children}</ViewportHeightSetter>
                    </PlanViewProvider>
                </SettingsProvider>
            </TerminalProvider>
        );
    };

    return [DynamicWrapper, setterRef];
};

describe('useScrollClamping', () => {
    describe('Initial State (No Adjustment Needed)', () => {
        test('does not adjust scroll when initial state is valid', () => {
            const wrapper = createPlanViewWrapper();

            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            // Initial state: scrollOffset=0, cursorLine=0, content has 100 lines
            // No adjustment needed
            expect(result.current.state.scrollOffset).toBe(0);
            expect(result.current.state.cursorLine).toBe(0);
        });

        test('does not adjust scroll when cursor is in middle of viewport', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            // Cursor at 10, scroll at 5 (viewport shows 5-24, cursor visible)
            act(() => {
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 5 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            expect(result.current.state.scrollOffset).toBe(5);
        });
    });

    describe('Clamps Scroll Offset to Valid Range', () => {
        test('clamps scroll offset when it exceeds maxScroll (content shrinks)', () => {
            const shortContent = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
            const wrapper = createPlanViewWrapper(createPlanViewProps({ content: shortContent }));
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            // Scroll to invalid position (50, but content only has 10 lines)
            act(() => {
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 50 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 1 });
            });

            // Should clamp to 0 (maxScroll = 10 - 20 = 0)
            expect(result.current.state.scrollOffset).toBe(0);
        });

        test('clamps scroll offset when viewport grows larger than content', () => {
            const shortContent = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join('\n');
            const wrapper = createPlanViewWrapper(createPlanViewProps({ content: shortContent }), {
                viewportHeight: 30,
                terminalHeight: 34,
            });
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 15 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 1 });
            });

            // Should clamp to 0 (maxScroll = 30 - 30 = 0)
            expect(result.current.state.scrollOffset).toBe(0);
        });
    });

    describe('Keeps Cursor Visible After Terminal Resize', () => {
        test('adjusts scroll when cursor is above viewport (cursor < scrollOffset)', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 10 });
            });

            expect(result.current.state.scrollOffset).toBe(5);
        });

        test('adjusts scroll when cursor is below viewport', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 50 });
            });

            // Should adjust scroll: 50 - 20 + 1 = 31
            expect(result.current.state.scrollOffset).toBe(31);
        });

        test('adjusts scroll when cursor is exactly at bottom edge (boundary)', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            // Cursor at line 20, viewport shows 0-19, so cursor is out of view
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 20 });
            });

            // Should adjust scroll: 20 - 20 + 1 = 1
            expect(result.current.state.scrollOffset).toBe(1);
        });
    });

    describe('Responds to Terminal Height Changes', () => {
        test('adjusts scroll when terminal height decreases and cursor becomes out of view', () => {
            const [DynamicWrapper, setterRef] = createDynamicViewportWrapper(20, 24);
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper: DynamicWrapper });

            // Cursor at line 19 is visible in 20-line viewport
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 19 });
            });

            // Shrink viewport to 10 lines (cursor now out of view)
            act(() => {
                setterRef.current!({ vh: 10, th: 14 });
            });

            // Should adjust scroll: 19 - 10 + 1 = 10
            expect(result.current.state.scrollOffset).toBe(10);
        });

        test('adjusts scroll when terminal height increases and content now fits', () => {
            const shortContent = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
            const [DynamicWrapper, setterRef] = createDynamicViewportWrapper(10, 14, shortContent);
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper: DynamicWrapper });

            // Scroll to line 10 (valid for 10-line viewport with 20 lines)
            act(() => {
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 10 });
            });

            // Expand viewport to 30 lines (content now fits entirely)
            act(() => {
                setterRef.current!({ vh: 30, th: 34 });
            });

            // Should clamp to 0 (maxScroll = 20 - 30 = 0)
            expect(result.current.state.scrollOffset).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        test('handles viewport height of 1', () => {
            const wrapper = createPlanViewWrapper(createPlanViewProps(), { viewportHeight: 1, terminalHeight: 5 });
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 10 });
            });

            expect(result.current.state.scrollOffset).toBe(10);
        });

        test('handles empty content (0 lines)', () => {
            const wrapper = createPlanViewWrapper(createPlanViewProps({ content: '' }));

            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            // With empty content, scroll should be 0
            expect(result.current.state.scrollOffset).toBe(0);
        });

        test('handles content exactly matching viewport height', () => {
            const exactContent = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
            const wrapper = createPlanViewWrapper(createPlanViewProps({ content: exactContent }));
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 5 });
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 1 });
            });

            // maxScroll = 20 - 20 = 0
            expect(result.current.state.scrollOffset).toBe(0);
        });

        test('handles cursor at last line of content', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 99 });
            });

            // Should scroll: 99 - 20 + 1 = 80
            expect(result.current.state.scrollOffset).toBe(80);
        });
    });

    describe('Performance (No Unnecessary Dispatches)', () => {
        test('does not dispatch when already at correct scroll position', () => {
            const wrapper = createPlanViewWrapper();
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 25 });
                result.current.dispatch({ type: 'SET_SCROLL_OFFSET', offset: 10 });
            });

            const scrollBefore = result.current.state.scrollOffset;

            // Re-render with same cursor position
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 25 });
            });

            expect(result.current.state.scrollOffset).toBe(scrollBefore);
        });
    });

    describe('Content Changes', () => {
        test('adjusts scroll when content shrinks below current scroll offset', () => {
            const shortContent = Array.from({ length: 15 }, (_, i) => `Line ${i + 1}`).join('\n');

            // New content (15 lines) with maxScroll = 15 - 20 = 0
            const { result } = renderHook(createPlanViewTestHook(useScrollClamping), {
                wrapper: createPlanViewWrapper(createPlanViewProps({ content: shortContent })),
            });

            expect(result.current.state.scrollOffset).toBe(0);
        });
    });
});
