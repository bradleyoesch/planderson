import { describe, expect, test } from 'bun:test';
import { render as inkRender } from 'ink-testing-library';
import React from 'react';

const stripAnsi = (str: string) => str.replaceAll(/\x1b\[[\d;]*m/g, '');

import { PlanViewProvider, usePlanViewDynamicContext } from '~/contexts/PlanViewProvider';
import { TerminalProvider } from '~/contexts/TerminalContext';
import type { PlanViewAction } from '~/state/planViewActions';
import type { FeedbackEntry } from '~/state/planViewState';

import { ConfirmDeny } from './ConfirmDeny';

const NOOP = () => {};

const renderWithState = (
    setup: {
        comments?: Map<number, FeedbackEntry>;
        questions?: Map<number, FeedbackEntry>;
        deletedLines?: Set<number>;
        confirmSelectedIndex?: 0 | 1;
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
        React.useLayoutEffect(() => {
            actions.forEach((action) => dispatch(action));
        }, []);
        return <>{children}</>;
    };

    return inkRender(
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
                    <ConfirmDeny />
                </StateInit>
            </PlanViewProvider>
        </TerminalProvider>,
    );
};

describe('ConfirmDeny', () => {
    describe('No Feedback', () => {
        test('shows send feedback title and question', () => {
            const { lastFrame } = renderWithState();
            const output = lastFrame();
            expect(output).toContain('Send feedback');
            expect(output).toContain('Deny without feedback?');
        });

        test('shows Yes and No choices', () => {
            const output = stripAnsi(renderWithState().lastFrame() ?? '');
            expect(output).toContain('1. Yes');
            expect(output).toContain('2. No');
        });
    });

    describe('With Feedback', () => {
        test('shows send feedback question with comments', () => {
            const comments = new Map([[1, { text: 'test comment', lines: [1] }]]);
            const { lastFrame } = renderWithState({ comments });
            expect(lastFrame()).toContain('Send 1 comment?');
        });

        test('shows Yes and No choices', () => {
            const comments = new Map([[1, { text: 'test', lines: [1] }]]);
            const output = stripAnsi(renderWithState({ comments }).lastFrame() ?? '');
            expect(output).toContain('1. Yes');
            expect(output).toContain('2. No');
        });

        test('shows send feedback question with deletions', () => {
            const deletedLines = new Set([3, 7]);
            const { lastFrame } = renderWithState({ deletedLines });
            expect(lastFrame()).toContain('Send 2 deletions?');
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
