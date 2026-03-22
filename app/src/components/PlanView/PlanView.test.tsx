import { describe, expect, mock, test } from 'bun:test';
import { Box, Text } from 'ink';
import { render as inkRender } from 'ink-testing-library';
import React from 'react';

import { PlanViewProvider, usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { renderWithProviders } from '~/test-utils/render-helpers';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

import { PlanView } from './PlanView';
// No mocks needed: Ink's useInput is a no-op in test environments (no terminal session),
// so the keyboard hooks (useNavigationKeys, useFeedbackKeys, etc.) just do nothing.

describe('PlanView', () => {
    const defaultProps = {
        content: 'Line 1\nLine 2\nLine 3',
        sessionId: 'test123',
        onShowHelp: mock(() => {}),
        onApprove: mock(() => {}),
        onDeny: mock(() => {}),
        onCancel: mock(() => {}),
    };

    describe('Content Rendering', () => {
        test('renders multi-line content', () => {
            const { lastFrame } = renderWithProviders(<PlanView {...defaultProps} />);
            const output = lastFrame();

            expect(output).toContain('Line 1');
            expect(output).toContain('Line 2');
            expect(output).toContain('Line 3');
        });

        test('renders various content formats', () => {
            // Single line
            const singleLine = renderWithProviders(<PlanView {...defaultProps} content="Single line" />);
            expect(singleLine.lastFrame()).toContain('Single line');

            // Empty content
            const empty = renderWithProviders(<PlanView {...defaultProps} content="" />);
            expect(empty.lastFrame()).toBeDefined();

            // Long content
            const longContent = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
            const long = renderWithProviders(<PlanView {...defaultProps} content={longContent} />);
            expect(long.lastFrame()).toContain('Line 1');

            // Malformed content (multiple newlines)
            const malformed = renderWithProviders(<PlanView {...defaultProps} content="\n\n\n" />);
            expect(malformed.lastFrame()).toBeDefined();

            // Very long single line
            const longLine = 'A'.repeat(1000);
            const veryLong = renderWithProviders(<PlanView {...defaultProps} content={longLine} />);
            expect(veryLong.lastFrame()).toBeDefined();
        });

        test('handles special and unicode characters', () => {
            const specialContent = 'Line with "quotes"\nLine with \'apostrophes\'\nLine with <brackets>';
            const special = renderWithProviders(<PlanView {...defaultProps} content={specialContent} />);
            const specialOutput = special.lastFrame();
            expect(specialOutput).toContain('quotes');
            expect(specialOutput).toContain('apostrophes');
            expect(specialOutput).toContain('brackets');

            const unicodeContent = '日本語\n中文\n한국어\n🎉 Emoji';
            const unicode = renderWithProviders(<PlanView {...defaultProps} content={unicodeContent} />);
            expect(unicode.lastFrame()).toBeDefined();
        });

        test('updates content on rerender', () => {
            const { lastFrame, rerender } = renderWithProviders(<PlanView {...defaultProps} />);

            expect(lastFrame()).toContain('Line 1');

            rerender(
                <SettingsProvider settings={DEFAULT_SETTINGS}>
                    <TerminalProvider terminalWidth={80} terminalHeight={24}>
                        <PlanView {...defaultProps} content="Updated Line 1\nUpdated Line 2" />
                    </TerminalProvider>
                </SettingsProvider>,
            );

            expect(lastFrame()).toContain('Updated Line 1');
            expect(lastFrame()).toContain('Updated Line 2');
        });
    });

    describe('Layout and Viewport', () => {
        test('renders with custom terminal dimensions', () => {
            // Custom height
            const customHeight = renderWithProviders(<PlanView {...defaultProps} />, { terminalHeight: 30 });
            expect(customHeight.lastFrame()).toContain('Line 1');

            // Narrow width
            const narrow = renderWithProviders(<PlanView {...defaultProps} />, { terminalWidth: 40 });
            expect(narrow.lastFrame()).toContain('Line 1');

            // Wide width
            const wide = renderWithProviders(<PlanView {...defaultProps} />, { terminalWidth: 200 });
            expect(wide.lastFrame()).toContain('Line 1');
        });
    });

    describe('Provider Integration', () => {
        test('passes callbacks through provider to static context', () => {
            const onShowHelp = mock(() => {});
            const onApprove = mock(() => {});
            const onDeny = mock(() => {});
            const onCancel = mock(() => {});

            // Component that accesses callbacks from static context
            const CallbackTester = () => {
                const {
                    onShowHelp: ctxShowHelp,
                    onApprove: ctxApprove,
                    onDeny: ctxDeny,
                    onCancel: ctxCancel,
                } = usePlanViewStaticContext();

                return (
                    <Box flexDirection="column">
                        <Text>show-help: {String(ctxShowHelp === onShowHelp)}</Text>
                        <Text>approve: {String(ctxApprove === onApprove)}</Text>
                        <Text>deny: {String(ctxDeny === onDeny)}</Text>
                        <Text>cancel: {String(ctxCancel === onCancel)}</Text>
                    </Box>
                );
            };

            const { lastFrame } = inkRender(
                <TerminalProvider terminalWidth={80} terminalHeight={24}>
                    <SettingsProvider settings={DEFAULT_SETTINGS}>
                        <PlanViewProvider
                            content={defaultProps.content}
                            sessionId={defaultProps.sessionId}
                            onShowHelp={onShowHelp}
                            onApprove={onApprove}
                            onDeny={onDeny}
                            onCancel={onCancel}
                        >
                            <CallbackTester />
                        </PlanViewProvider>
                    </SettingsProvider>
                </TerminalProvider>,
            );

            const output = lastFrame();

            // Verify callbacks are accessible in context and match the provided ones
            expect(output).toContain('show-help: true');
            expect(output).toContain('approve: true');
            expect(output).toContain('deny: true');
            expect(output).toContain('cancel: true');
        });
    });
});
