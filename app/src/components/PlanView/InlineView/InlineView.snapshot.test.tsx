import { describe, expect, test } from 'bun:test';
import { render as inkRender } from 'ink-testing-library';
import React from 'react';

import { PlanViewProvider } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { normalizeSnapshot, testAtAllWidths } from '~/test-utils/snapshot-helpers';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

import { InlineView } from './InlineView';

const NOOP = () => {};

describe('InlineView snapshots', () => {
    // Helper factory to create width-aware render function
    const createRenderWithWidth = (width: number) => (component: React.ReactElement) =>
        inkRender(
            <TerminalProvider terminalWidth={width} terminalHeight={24}>
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <PlanViewProvider
                        sessionId="test-session"
                        content=""
                        onShowHelp={NOOP}
                        onApprove={NOOP}
                        onDeny={NOOP}
                        onCancel={NOOP}
                    >
                        {component}
                    </PlanViewProvider>
                </SettingsProvider>
            </TerminalProvider>,
        );

    // Default render for non-width-specific tests
    const render = createRenderWithWidth(80);

    // Helper for backward compatibility
    const withSettings = (component: React.ReactElement) => (
        <TerminalProvider terminalWidth={80} terminalHeight={24}>
            <SettingsProvider settings={DEFAULT_SETTINGS}>
                <PlanViewProvider
                    sessionId="test-session"
                    content=""
                    onShowHelp={NOOP}
                    onApprove={NOOP}
                    onDeny={NOOP}
                    onCancel={NOOP}
                >
                    {component}
                </PlanViewProvider>
            </SettingsProvider>
        </TerminalProvider>
    );

    test('snapshot: command mode', () => {
        const { lastFrame } = render(
            <InlineView mode="command" commandText=":a" currentQuestionText="" currentCommentText="" inputCursor={2} />,
        );
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    describe('Comment Input Mode', () => {
        testAtAllWidths('renders comment input', (width) => {
            const render = createRenderWithWidth(width);
            const { lastFrame } = render(
                <InlineView
                    mode="comment"
                    commandText=""
                    currentQuestionText=""
                    currentCommentText="This is a test comment"
                    inputCursor={22}
                />,
            );
            return normalizeSnapshot(lastFrame());
        });
    });

    test('snapshot: confirm approve', () => {
        const { lastFrame } = render(
            withSettings(
                <InlineView
                    mode="confirm-approve"
                    commandText=""
                    currentQuestionText=""
                    currentCommentText=""
                    inputCursor={0}
                />,
            ),
        );
        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    describe('Confirm Deny', () => {
        testAtAllWidths('renders deny confirmation', (width) => {
            const render = createRenderWithWidth(width);
            const { lastFrame } = render(
                <InlineView
                    mode="confirm-deny"
                    commandText=""
                    currentQuestionText=""
                    currentCommentText=""
                    inputCursor={0}
                />,
            );
            return normalizeSnapshot(lastFrame());
        });
    });

    describe('Confirm Cancel', () => {
        testAtAllWidths('renders cancel confirmation', (width) => {
            const render = createRenderWithWidth(width);
            const { lastFrame } = render(
                <InlineView
                    mode="confirm-cancel"
                    commandText=""
                    currentQuestionText=""
                    currentCommentText=""
                    inputCursor={0}
                />,
            );
            return normalizeSnapshot(lastFrame());
        });
    });
});
