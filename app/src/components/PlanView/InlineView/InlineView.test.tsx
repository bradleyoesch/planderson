import { describe, expect, test } from 'bun:test';
import React from 'react';

import { renderWithProviders } from '~/test-utils/render-helpers';

const stripAnsi = (str: string) => str.replaceAll(/\x1b\[[\d;]*m/g, '');

import { InlineView } from './InlineView';

describe('InlineView', () => {
    describe('Input Modes', () => {
        test('should render empty in plan mode', () => {
            const { lastFrame } = renderWithProviders(
                <InlineView mode="plan" commandText="" currentQuestionText="" currentCommentText="" inputCursor={0} />,
            );

            expect(lastFrame()).toBe('');
        });

        test('should render empty in help mode', () => {
            const { lastFrame } = renderWithProviders(
                <InlineView mode="help" commandText="" currentQuestionText="" currentCommentText="" inputCursor={0} />,
            );

            expect(lastFrame()).toBe('');
        });

        test('should render command mode with cursor', () => {
            const { lastFrame } = renderWithProviders(
                <InlineView
                    mode="command"
                    commandText=":a"
                    inputCursor={2}
                    currentQuestionText=""
                    currentCommentText=""
                />,
            );

            expect(lastFrame()).toContain(':a');
            expect(lastFrame()).toContain('█'); // White full block cursor
        });

        test('should render comment mode with title and input', () => {
            const { lastFrame } = renderWithProviders(
                <InlineView
                    mode="comment"
                    commandText=""
                    currentQuestionText=""
                    currentCommentText="Test comment"
                    inputCursor={12}
                />,
            );

            expect(lastFrame()).toContain('Comment');
            expect(lastFrame()).toContain('Test comment');
            expect(lastFrame()).toContain('█'); // White full block cursor
        });
    });

    describe('Confirmation Modes', () => {
        test('should render confirm-approve', () => {
            const { lastFrame } = renderWithProviders(
                <InlineView
                    mode="confirm-approve"
                    commandText=""
                    currentQuestionText=""
                    currentCommentText=""
                    inputCursor={0}
                />,
            );

            const output = stripAnsi(lastFrame() ?? '');
            expect(output).toContain('Approve plan');
            expect(output).toContain('Approve plan?');
            expect(output).toContain('1. Yes');
            expect(output).toContain('2. No');
        });

        test('should render confirm-deny', () => {
            const { lastFrame } = renderWithProviders(
                <InlineView
                    mode="confirm-deny"
                    commandText=""
                    currentQuestionText=""
                    currentCommentText=""
                    inputCursor={0}
                />,
            );

            expect(lastFrame()).toContain('Send feedback');
            expect(lastFrame()).toContain('Deny without feedback?');
        });

        test('should render confirm-cancel', () => {
            const { lastFrame } = renderWithProviders(
                <InlineView
                    mode="confirm-cancel"
                    commandText=""
                    currentQuestionText=""
                    currentCommentText=""
                    inputCursor={0}
                />,
            );

            expect(lastFrame()).toContain('Exit plan');
            expect(lastFrame()).toContain('Discard feedback and exit?');
        });
    });
});
