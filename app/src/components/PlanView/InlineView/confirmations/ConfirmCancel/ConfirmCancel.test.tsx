import { describe, expect, test } from 'bun:test';
import React, { useLayoutEffect } from 'react';

import { usePlanViewDynamicContext } from '~/contexts/PlanViewProvider';
import { renderWithPlanViewProvider } from '~/test-utils/render-helpers';

import { ConfirmCancel } from './ConfirmCancel';

const stripAnsi = (str: string) => str.replaceAll(/\x1b\[[\d;]*m/g, '');

const renderWithIndex = (confirmSelectedIndex: 0 | 1 = 0) => {
    const StateInit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const { dispatch } = usePlanViewDynamicContext();
        useLayoutEffect(() => {
            if (confirmSelectedIndex === 1) {
                dispatch({ type: 'MOVE_CONFIRM_SELECTION', direction: 'down' });
            }
        }, []);
        return <>{children}</>;
    };

    return renderWithPlanViewProvider(
        <StateInit>
            <ConfirmCancel />
        </StateInit>,
    );
};

describe('ConfirmCancel', () => {
    test('shows exit title', () => {
        const { lastFrame } = renderWithIndex();
        expect(lastFrame()).toContain('Exit plan');
    });

    test('shows question text', () => {
        const { lastFrame } = renderWithIndex();
        expect(lastFrame()).toContain('Discard feedback and exit?');
    });

    test('shows choices', () => {
        const output = stripAnsi(renderWithIndex().lastFrame() ?? '');
        expect(output).toContain('1. Yes');
        expect(output).toContain('2. No');
    });

    test('shows arrow on first item by default', () => {
        const output = stripAnsi(renderWithIndex(0).lastFrame() ?? '');
        expect(output).toContain('❯ 1. Yes');
    });

    test('shows arrow on second item when confirmSelectedIndex=1', () => {
        const output = stripAnsi(renderWithIndex(1).lastFrame() ?? '');
        expect(output).toContain('❯ 2. No');
        expect(output).not.toContain('❯ 1.');
    });

    test('shows help text', () => {
        const { lastFrame } = renderWithIndex();
        expect(lastFrame()).toContain('Enter to confirm · Esc to cancel');
    });

    test('uses default title color (no WARNING color override)', () => {
        const { lastFrame } = renderWithIndex();
        expect(lastFrame()).toContain('Exit plan');
    });
});
