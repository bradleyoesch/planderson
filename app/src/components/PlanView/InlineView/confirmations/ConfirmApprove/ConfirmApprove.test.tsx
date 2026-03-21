import { describe, expect, test } from 'bun:test';
import { render as inkRender } from 'ink-testing-library';
import React, { useLayoutEffect } from 'react';

const stripAnsi = (str: string) => str.replaceAll(/\x1b\[[\d;]*m/g, '');

import { PlanViewProvider, usePlanViewDynamicContext } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import type { PlanViewAction } from '~/state/planViewActions';
import type { FeedbackEntry } from '~/state/planViewState';
import { DEFAULT_SETTINGS, type Settings } from '~/utils/config/settings';

import { ConfirmApprove } from './ConfirmApprove';

const NOOP = () => {};

const renderWithState = (
    setup: {
        comments?: Map<number, FeedbackEntry>;
        questions?: Map<number, FeedbackEntry>;
        deletedLines?: Set<number>;
        confirmSelectedIndex?: 0 | 1;
        settings?: Settings;
    } = {},
) => {
    const actions: PlanViewAction[] = [];
    setup.comments?.forEach((entry, line) => {
        actions.push({ type: 'ADD_COMMENT', line, text: entry.text });
    });
    setup.questions?.forEach((entry, line) => {
        actions.push({ type: 'ADD_QUESTION', line, text: entry.text });
    });
    if (setup.deletedLines?.size) {
        actions.push({ type: 'TOGGLE_DELETE_LINES', lines: [...setup.deletedLines], shouldDelete: true });
    }
    if (setup.confirmSelectedIndex === 1) {
        actions.push({ type: 'MOVE_CONFIRM_SELECTION', direction: 'down' });
    }

    const StateInit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const { dispatch } = usePlanViewDynamicContext();
        useLayoutEffect(() => {
            actions.forEach((action) => dispatch(action));
        }, []);
        return <>{children}</>;
    };

    return inkRender(
        <SettingsProvider settings={setup.settings ?? DEFAULT_SETTINGS}>
            <TerminalProvider terminalWidth={80} terminalHeight={24}>
                <PlanViewProvider
                    sessionId="test"
                    content=""
                    onShowHelp={NOOP}
                    onApprove={NOOP}
                    onDeny={NOOP}
                    onCancel={NOOP}
                >
                    <StateInit>
                        <ConfirmApprove />
                    </StateInit>
                </PlanViewProvider>
            </TerminalProvider>
        </SettingsProvider>,
    );
};

describe('ConfirmApprove', () => {
    describe('No Feedback', () => {
        test('shows approve title and question', () => {
            const { lastFrame } = renderWithState();
            const output = lastFrame();
            expect(output).toContain('Approve plan');
            expect(output).toContain('Approve plan?');
        });

        test('shows Yes and No choices', () => {
            const output = stripAnsi(renderWithState().lastFrame() ?? '');
            expect(output).toContain('1. Yes');
            expect(output).toContain('2. No');
        });

        test('does not mention discard', () => {
            const { lastFrame } = renderWithState();
            expect(lastFrame()).not.toContain('discard');
        });
    });

    describe('With Feedback', () => {
        test('shows discard summary with 1 comment', () => {
            const comments = new Map([[1, { text: 'test', lines: [1] }]]);
            const { lastFrame } = renderWithState({ comments });
            expect(lastFrame()).toContain('Approve and discard 1 comment?');
        });

        test('shows discard summary with multiple feedback types', () => {
            const comments = new Map([[1, { text: 'c', lines: [1] }]]);
            const deletedLines = new Set([2]);
            const { lastFrame } = renderWithState({ comments, deletedLines });
            expect(lastFrame()).toContain('Approve and discard 1 comment and 1 deletion?');
        });

        test('shows discard summary with questions', () => {
            const questions = new Map([[3, { text: 'why?', lines: [3] }]]);
            const { lastFrame } = renderWithState({ questions });
            expect(lastFrame()).toContain('Approve and discard 1 question?');
        });
    });

    describe('approveAction=exit', () => {
        test('shows approve title and exit question without feedback', () => {
            const settings = { ...DEFAULT_SETTINGS, approveAction: 'exit' as const };
            const { lastFrame } = renderWithState({ settings });
            const output = lastFrame();
            expect(output).toContain('Approve plan');
            expect(output).toContain('Exit (approve manually)?');
        });

        test('shows Yes and No choices', () => {
            const settings = { ...DEFAULT_SETTINGS, approveAction: 'exit' as const };
            const output = stripAnsi(renderWithState({ settings }).lastFrame() ?? '');
            expect(output).toContain('1. Yes');
            expect(output).toContain('2. No');
        });

        test('shows exit discard summary with 1 comment', () => {
            const settings = { ...DEFAULT_SETTINGS, approveAction: 'exit' as const };
            const comments = new Map([[1, { text: 'c', lines: [1] }]]);
            const { lastFrame } = renderWithState({ settings, comments });
            expect(lastFrame()).toContain('Exit and discard 1 comment?');
        });
    });

    describe('confirmSelectedIndex', () => {
        test('default shows arrow on first item', () => {
            const output = stripAnsi(renderWithState().lastFrame() ?? '');
            expect(output).toContain('❯ 1. Yes');
        });

        test('confirmSelectedIndex=1 shows arrow on second item', () => {
            const output = stripAnsi(renderWithState({ confirmSelectedIndex: 1 }).lastFrame() ?? '');
            expect(output).toContain('❯ 2. No');
            expect(output).not.toContain('❯ 1.');
        });
    });

    describe('help text', () => {
        test('shows Enter and Escape instructions', () => {
            const { lastFrame } = renderWithState();
            expect(lastFrame()).toContain('Enter to confirm · Esc to cancel');
        });
    });
});
