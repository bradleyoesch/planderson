/**
 * TESTING APPROACH: Reducer Logic via Dispatch
 *
 * These tests validate state transitions by manually dispatching actions.
 * We cannot test keyboard input at the unit level because Ink's useInput
 * hook returns no-op values in test environments (no terminal session).
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, mock, test } from 'bun:test';
import React, { type ReactNode, useEffect } from 'react';

import { PlanViewProvider, usePlanViewDynamicContext, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { TEST_DEFAULT_SETTINGS } from '~/test-utils/fixtures/settings';
import { DEFAULT_SETTINGS, type Settings } from '~/utils/config/settings';

import { useConfirmKeys } from './useConfirmKeys';

describe('useConfirmKeys', () => {
    const createDefaultProps = () => ({
        content: Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n'),
        sessionId: 'test123',
        terminalWidth: 80,
        onShowHelp: mock(() => {}),
        onApprove: mock(() => {}),
        onDeny: mock(() => {}),
        onCancel: mock(() => {}),
    });

    const createWrapper = (
        props = createDefaultProps(),
        viewport: { viewportHeight: number; terminalHeight?: number } = { viewportHeight: 20 },
        settings: Settings = DEFAULT_SETTINGS,
    ) => {
        const Wrapper = ({ children }: { children: ReactNode }) => {
            const { state, dispatch } = usePlanViewDynamicContext();

            useEffect(() => {
                if (state.viewportHeight !== viewport.viewportHeight) {
                    dispatch({ type: 'SET_VIEWPORT_HEIGHT', height: viewport.viewportHeight });
                }
            }, [state.viewportHeight, dispatch]);

            return children as React.JSX.Element;
        };

        const ProviderWrapper = ({ children }: { children: ReactNode }) => (
            <TerminalProvider terminalHeight={viewport.terminalHeight}>
                <SettingsProvider settings={settings}>
                    <PlanViewProvider {...props}>
                        <Wrapper>{children}</Wrapper>
                    </PlanViewProvider>
                </SettingsProvider>
            </TerminalProvider>
        );

        ProviderWrapper.displayName = 'TestWrapper';
        return ProviderWrapper;
    };

    // Helper hook that combines useConfirmKeys with context access for testing
    const useTestHook = () => {
        const { state, dispatch } = usePlanViewDynamicContext();
        const { contentLines, onApprove, onDeny, onCancel } = usePlanViewStaticContext();
        useConfirmKeys();
        return { state, dispatch, contentLines, onApprove, onDeny, onCancel };
    };

    describe('Mode Guard (Only Handles Confirmation Modes)', () => {
        test('ignores keys when in plan mode', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            expect(result.current.state.mode).toBe('plan');

            // Dispatch an action (useConfirmKeys should ignore it)
            act(() => {
                result.current.dispatch({ type: 'MOVE_CURSOR', line: 5 });
            });

            // Callbacks should not be called, mode unchanged
            expect(result.current.state.mode).toBe('plan');
            expect(result.current.onApprove).not.toHaveBeenCalled();
            expect(result.current.onDeny).not.toHaveBeenCalled();
            expect(result.current.onCancel).not.toHaveBeenCalled();
        });
    });

    describe('Escape Key (Return to Plan View)', () => {
        test('exits any confirmation mode back to plan view without calling callbacks', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            const modes: Array<'confirm-approve' | 'confirm-deny' | 'confirm-cancel'> = [
                'confirm-approve',
                'confirm-deny',
                'confirm-cancel',
            ];

            modes.forEach((mode) => {
                // Enter confirmation mode
                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode,
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                expect(result.current.state.mode).toBe(mode);

                // Press Escape
                act(() => {
                    result.current.dispatch({
                        type: 'EXIT_MODE',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                expect(result.current.state.mode).toBe('plan');

                // No callbacks should be invoked
                expect(result.current.onApprove).not.toHaveBeenCalled();
                expect(result.current.onDeny).not.toHaveBeenCalled();
                expect(result.current.onCancel).not.toHaveBeenCalled();
            });
        });
    });

    describe('Enter Key in confirm-approve Mode', () => {
        describe('Without Feedback', () => {
            test('calls onApprove with no message when no feedback exists', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Enter confirm-approve mode (no feedback)
                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                expect(result.current.state.comments.size).toBe(0);
                expect(result.current.state.questions.size).toBe(0);
                expect(result.current.state.deletedLines.size).toBe(0);

                // Simulate pressing Enter (invoke callback as hook would)
                act(() => {
                    result.current.onApprove(undefined, 'response_sent_via_socket');
                });

                expect(result.current.onApprove).toHaveBeenCalledWith(undefined, 'response_sent_via_socket');
            });
        });

        describe('With Feedback (Discarded Summary)', () => {
            test('calls onApprove with discarded summary when feedback exists', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add various feedback
                act(() => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'Comment 1' });
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 10, text: 'Comment 2' });
                    result.current.dispatch({ type: 'ADD_QUESTION', line: 3, text: 'Question 1' });
                    result.current.dispatch({
                        type: 'TOGGLE_DELETE_LINES',
                        lines: [7],
                        shouldDelete: true,
                    });
                });

                // Enter confirm-approve mode
                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    // Expected: "2 comments and 1 question and 1 deletion"
                    result.current.onApprove(
                        undefined,
                        'approved with 2 comments and 1 question and 1 deletion discarded',
                    );
                });

                expect(result.current.onApprove).toHaveBeenCalled();
                const callArgs = (result.current.onApprove as any).mock.calls[0];
                expect(callArgs[0]).toBeUndefined();
                expect(callArgs[1]).toContain('approved with');
                expect(callArgs[1]).toContain('2 comments');
                expect(callArgs[1]).toContain('1 question');
                expect(callArgs[1]).toContain('1 deletion');
                expect(callArgs[1]).toContain('discarded');
            });

            test('formats discarded summary with only comments', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add only comments
                act(() => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 1, text: 'Comment' });
                });

                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                act(() => {
                    result.current.onApprove(undefined, 'approved with 1 comment discarded');
                });

                expect(result.current.onApprove).toHaveBeenCalled();
                const callArgs = (result.current.onApprove as any).mock.calls[0];
                expect(callArgs[1]).toBe('approved with 1 comment discarded');
            });

            test('formats discarded summary with only questions (line-specific)', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add only questions
                act(() => {
                    result.current.dispatch({ type: 'ADD_QUESTION', line: 2, text: 'Q1' });
                    result.current.dispatch({ type: 'ADD_QUESTION', line: 5, text: 'Q2' });
                });

                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                act(() => {
                    result.current.onApprove(undefined, 'approved with 2 questions discarded');
                });

                expect(result.current.onApprove).toHaveBeenCalled();
                const callArgs = (result.current.onApprove as any).mock.calls[0];
                expect(callArgs[1]).toBe('approved with 2 questions discarded');
            });

            test('formats discarded summary with mixed feedback types', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add all types
                act(() => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 1, text: 'C1' });
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 2, text: 'C2' });
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 3, text: 'C3' });
                    result.current.dispatch({ type: 'ADD_QUESTION', line: 4, text: 'Q1' });
                    result.current.dispatch({
                        type: 'TOGGLE_DELETE_LINES',
                        lines: [5, 6],
                        shouldDelete: true,
                    });
                });

                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                act(() => {
                    result.current.onApprove(
                        undefined,
                        'approved with 3 comments and 1 question and 2 deletions discarded',
                    );
                });

                expect(result.current.onApprove).toHaveBeenCalled();
                const callArgs = (result.current.onApprove as any).mock.calls[0];
                expect(callArgs[1]).toContain('3 comments');
                expect(callArgs[1]).toContain('1 question');
                expect(callArgs[1]).toContain('2 deletions');
            });

            test('uses singular form for single feedback item', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add single items of each type
                act(() => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 1, text: 'C' });
                    result.current.dispatch({ type: 'ADD_QUESTION', line: 2, text: 'Q' });
                    result.current.dispatch({
                        type: 'TOGGLE_DELETE_LINES',
                        lines: [3],
                        shouldDelete: true,
                    });
                });

                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                act(() => {
                    result.current.onApprove(
                        undefined,
                        'approved with 1 comment and 1 question and 1 deletion discarded',
                    );
                });

                expect(result.current.onApprove).toHaveBeenCalled();
                const callArgs = (result.current.onApprove as any).mock.calls[0];
                expect(callArgs[1]).toBe('approved with 1 comment and 1 question and 1 deletion discarded');
            });
        });

        describe('Settings: approveAction', () => {
            test('calls onCancel when approveAction is exit (no feedback)', () => {
                const settings: Settings = { ...TEST_DEFAULT_SETTINGS, approveAction: 'exit' };
                const wrapper = createWrapper(createDefaultProps(), { viewportHeight: 20 }, settings);
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Enter confirm-approve mode
                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    result.current.onCancel();
                });

                expect(result.current.onCancel).toHaveBeenCalled();
                expect(result.current.onApprove).not.toHaveBeenCalled();
            });

            test('calls onCancel when approveAction is exit (with feedback)', () => {
                const settings: Settings = { ...TEST_DEFAULT_SETTINGS, approveAction: 'exit' };
                const wrapper = createWrapper(createDefaultProps(), { viewportHeight: 20 }, settings);
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add feedback
                act(() => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'Feedback' });
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    result.current.onCancel();
                });

                expect(result.current.onCancel).toHaveBeenCalled();
                expect(result.current.onApprove).not.toHaveBeenCalled();
            });

            test('calls onApprove normally when approveAction is approve', () => {
                const settings: Settings = { ...TEST_DEFAULT_SETTINGS, approveAction: 'approve' };
                const wrapper = createWrapper(createDefaultProps(), { viewportHeight: 20 }, settings);
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Enter confirm-approve mode
                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-approve',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    result.current.onApprove(undefined, 'response_sent_via_socket');
                });

                expect(result.current.onApprove).toHaveBeenCalledWith(undefined, 'response_sent_via_socket');
                expect(result.current.onCancel).not.toHaveBeenCalled();
            });
        });
    });

    describe('Enter Key in confirm-deny Mode', () => {
        describe('With Feedback', () => {
            test('calls onDeny with formatted feedback message (comments only)', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add comments
                act(() => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'Fix this line' });
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-deny',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    const message = 'Comments on the plan:\nLine 6: "Line 6"\nFix this line';
                    result.current.onDeny(message, message);
                });

                expect(result.current.onDeny).toHaveBeenCalled();
                const callArgs = (result.current.onDeny as any).mock.calls[0];
                expect(callArgs[0]).toContain('Comments on the plan:');
                expect(callArgs[0]).toContain('Line 6:');
                expect(callArgs[0]).toContain('Fix this line');
                expect(callArgs[1]).toBe(callArgs[0]);
            });

            test('calls onDeny with formatted feedback message (questions only)', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add question
                act(() => {
                    result.current.dispatch({ type: 'ADD_QUESTION', line: 3, text: 'Why this approach?' });
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-deny',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    const message =
                        '<response_instructions>\nRespond with plain text only — this response must not call ExitPlanMode or any other tool.\nThe reason: the user needs to read your answers and may ask follow-up questions before deciding to proceed.\nOnly call ExitPlanMode after the user explicitly tells you to continue (e.g., "proceed", "continue", "go ahead").\n</response_instructions>\n\n<questions>\n  <question>\n    <ref line="4">Line 4</ref>\n    <feedback>Why this approach?</feedback>\n  </question>\n</questions>';
                    result.current.onDeny(message, message);
                });

                expect(result.current.onDeny).toHaveBeenCalled();
                const callArgs = (result.current.onDeny as any).mock.calls[0];
                expect(callArgs[0]).toContain('<questions>');
                expect(callArgs[0]).toContain('<ref line="4">');
                expect(callArgs[0]).toContain('Why this approach?');
            });

            test('calls onDeny with formatted feedback message (deletions only)', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add deletions
                act(() => {
                    result.current.dispatch({
                        type: 'TOGGLE_DELETE_LINES',
                        lines: [7, 8],
                        shouldDelete: true,
                    });
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-deny',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    const message =
                        '<deletions>\n  <deletion>\n    <ref line="8">Line 8</ref>\n  </deletion>\n  <deletion>\n    <ref line="9">Line 9</ref>\n  </deletion>\n</deletions>';
                    result.current.onDeny(message, message);
                });

                expect(result.current.onDeny).toHaveBeenCalled();
                const callArgs = (result.current.onDeny as any).mock.calls[0];
                expect(callArgs[0]).toContain('<deletions>');
                expect(callArgs[0]).toContain('<ref line="8">');
                expect(callArgs[0]).toContain('<ref line="9">');
            });

            test('calls onDeny with formatted feedback message (mixed feedback types)', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add all types
                act(() => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 2, text: 'Comment text' });
                    result.current.dispatch({ type: 'ADD_QUESTION', line: 5, text: 'Question text' });
                    result.current.dispatch({
                        type: 'TOGGLE_DELETE_LINES',
                        lines: [10],
                        shouldDelete: true,
                    });
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-deny',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    const message =
                        '<response_instructions>\nRespond with plain text only — this response must not call ExitPlanMode or any other tool.\nThe reason: the user needs to read your answers and may ask follow-up questions before deciding to proceed.\nDo not act on the comments or deletions below — hold them until the user confirms to proceed.\nOnly call ExitPlanMode after the user explicitly tells you to continue (e.g., "proceed", "continue", "go ahead") — and when you do, apply all the feedback below.\n</response_instructions>\n\n<questions>\n  <question>\n    <ref line="6">Line 6</ref>\n    <feedback>Question text</feedback>\n  </question>\n</questions>\n\n<comments>\n  <comment>\n    <ref line="3">Line 3</ref>\n    <feedback>Comment text</feedback>\n  </comment>\n</comments>\n\n<deletions>\n  <deletion>\n    <ref line="11">Line 11</ref>\n  </deletion>\n</deletions>';
                    result.current.onDeny(message, message);
                });

                expect(result.current.onDeny).toHaveBeenCalled();
                const callArgs = (result.current.onDeny as any).mock.calls[0];
                expect(callArgs[0]).toContain('<questions>');
                expect(callArgs[0]).toContain('<comments>');
                expect(callArgs[0]).toContain('<deletions>');
            });

            test('includes original line content in formatted message', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Add comment on specific line
                act(() => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: 49, text: 'Check line 50 content' });
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-deny',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                // Simulate pressing Enter
                act(() => {
                    const message = 'Comments on the plan:\nLine 50: "Line 50"\nCheck line 50 content';
                    result.current.onDeny(message, message);
                });

                expect(result.current.onDeny).toHaveBeenCalled();
                const callArgs = (result.current.onDeny as any).mock.calls[0];
                expect(callArgs[0]).toContain('Line 50: "Line 50"');
            });
        });

        describe('Without Feedback (Edge Case)', () => {
            test('calls onDeny with undefined message when no feedback exists', () => {
                const wrapper = createWrapper();
                const { result } = renderHook(() => useTestHook(), { wrapper });

                // Enter confirm-deny mode without feedback (unusual but possible)
                act(() => {
                    result.current.dispatch({
                        type: 'ENTER_MODE',
                        mode: 'confirm-deny',
                        viewportHeight: result.current.state.viewportHeight,
                    });
                });

                expect(result.current.state.comments.size).toBe(0);
                expect(result.current.state.questions.size).toBe(0);
                expect(result.current.state.deletedLines.size).toBe(0);

                // Simulate pressing Enter
                act(() => {
                    result.current.onDeny(undefined, 'no comments or deletions');
                });

                expect(result.current.onDeny).toHaveBeenCalledWith(undefined, 'no comments or deletions');
            });
        });
    });

    describe('Enter Key in confirm-cancel Mode', () => {
        test('calls onCancel callback', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Enter confirm-cancel mode
            act(() => {
                result.current.dispatch({ type: 'ADD_COMMENT', line: 5, text: 'Feedback' });
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'confirm-cancel' });
            });

            expect(result.current.state.mode).toBe('confirm-cancel');

            // Simulate pressing Enter
            act(() => {
                result.current.onCancel();
            });

            expect(result.current.onCancel).toHaveBeenCalled();
            expect(result.current.onApprove).not.toHaveBeenCalled();
            expect(result.current.onDeny).not.toHaveBeenCalled();
        });

        test('does not pass any arguments to onCancel', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Enter confirm-cancel mode
            act(() => {
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'confirm-cancel' });
            });

            // Simulate pressing Enter
            act(() => {
                result.current.onCancel();
            });

            expect(result.current.onCancel).toHaveBeenCalledWith();
            expect((result.current.onCancel as any).mock.calls[0].length).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        test('handles empty content (0 lines)', () => {
            const wrapper = createWrapper({ ...createDefaultProps(), content: '' });
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Empty string splits to [''], so length is 1
            expect(result.current.contentLines.length).toBe(1);

            // Enter confirm-deny mode
            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-deny',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            // Simulate pressing Enter (no feedback)
            act(() => {
                result.current.onDeny(undefined, 'no comments or deletions');
            });

            expect(result.current.onDeny).toHaveBeenCalled();
        });

        test('handles single line content', () => {
            const wrapper = createWrapper({ ...createDefaultProps(), content: 'Single line' });
            const { result } = renderHook(() => useTestHook(), { wrapper });

            expect(result.current.contentLines.length).toBe(1);

            // Add comment to only line
            act(() => {
                result.current.dispatch({ type: 'ADD_COMMENT', line: 0, text: 'Only line comment' });
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-deny',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            // Simulate pressing Enter
            act(() => {
                const message = 'Comments on the plan:\nLine 1: "Single line"\nOnly line comment';
                result.current.onDeny(message, message);
            });

            expect(result.current.onDeny).toHaveBeenCalled();
            const callArgs = (result.current.onDeny as any).mock.calls[0];
            expect(callArgs[0]).toContain('Line 1:');
            expect(callArgs[0]).toContain('Single line');
        });

        test('handles viewport height of 1', () => {
            const wrapper = createWrapper(createDefaultProps(), { viewportHeight: 1, terminalHeight: 5 });
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Enter confirm-approve mode
            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-approve',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.viewportHeight).toBe(1);

            // Simulate pressing Enter
            act(() => {
                result.current.onApprove(undefined, 'response_sent_via_socket');
            });

            expect(result.current.onApprove).toHaveBeenCalled();
        });

        test('handles large number of feedback items', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Add many feedback items
            act(() => {
                Array.from({ length: 50 }, (_, i) => i).forEach((i) => {
                    result.current.dispatch({ type: 'ADD_COMMENT', line: i, text: `Comment ${i}` });
                });
            });

            // Enter confirm-approve mode
            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-approve',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            // Simulate pressing Enter
            act(() => {
                result.current.onApprove(undefined, 'approved with 50 comments discarded');
            });

            expect(result.current.onApprove).toHaveBeenCalled();
            const callArgs = (result.current.onApprove as any).mock.calls[0];
            expect(callArgs[1]).toContain('50 comments');
        });

        test('handles special characters in feedback text', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Add comment with special characters
            act(() => {
                result.current.dispatch({
                    type: 'ADD_COMMENT',
                    line: 5,
                    text: 'Special chars: "quotes" & <tags> & newlines\ntest',
                });
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-deny',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            // Simulate pressing Enter
            act(() => {
                const message =
                    'Comments on the plan:\nLine 6: "Line 6"\nSpecial chars: "quotes" & <tags> & newlines\ntest';
                result.current.onDeny(message, message);
            });

            expect(result.current.onDeny).toHaveBeenCalled();
            const callArgs = (result.current.onDeny as any).mock.calls[0];
            expect(callArgs[0]).toContain('Special chars:');
        });
    });

    describe('Callback Guardrails', () => {
        test('does not call callbacks when only entering/exiting confirmation modes', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Enter and exit confirm-approve mode
            act(() => {
                result.current.dispatch({
                    type: 'ENTER_MODE',
                    mode: 'confirm-approve',
                    viewportHeight: result.current.state.viewportHeight,
                });
                result.current.dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            // No callbacks should be triggered
            expect(result.current.onApprove).not.toHaveBeenCalled();
            expect(result.current.onDeny).not.toHaveBeenCalled();
            expect(result.current.onCancel).not.toHaveBeenCalled();
        });
    });

    describe('MOVE_CONFIRM_SELECTION', () => {
        test('dispatch down increments confirmSelectedIndex to 1', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            expect(result.current.state.confirmSelectedIndex).toBe(0);

            act(() => {
                result.current.dispatch({ type: 'MOVE_CONFIRM_SELECTION', direction: 'down' });
            });

            expect(result.current.state.confirmSelectedIndex).toBe(1);
        });

        test('dispatch up from 0 stays at 0', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'MOVE_CONFIRM_SELECTION', direction: 'up' });
            });

            expect(result.current.state.confirmSelectedIndex).toBe(0);
        });

        test('ENTER_MODE with confirm mode resets confirmSelectedIndex to 0', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            // Move to index 1 first
            act(() => {
                result.current.dispatch({ type: 'MOVE_CONFIRM_SELECTION', direction: 'down' });
            });
            expect(result.current.state.confirmSelectedIndex).toBe(1);

            // Entering a confirm mode should reset to 0
            act(() => {
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'confirm-cancel' });
            });

            expect(result.current.state.confirmSelectedIndex).toBe(0);
        });

        test('EXIT_MODE returns to plan mode without calling callbacks', () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useTestHook(), { wrapper });

            act(() => {
                result.current.dispatch({ type: 'ENTER_MODE', mode: 'confirm-cancel' });
                result.current.dispatch({ type: 'MOVE_CONFIRM_SELECTION', direction: 'down' });
            });

            expect(result.current.state.confirmSelectedIndex).toBe(1);

            // Simulating option-2 behavior: dispatch EXIT_MODE
            act(() => {
                result.current.dispatch({
                    type: 'EXIT_MODE',
                    viewportHeight: result.current.state.viewportHeight,
                });
            });

            expect(result.current.state.mode).toBe('plan');
            expect(result.current.onCancel).not.toHaveBeenCalled();
        });
    });
});
