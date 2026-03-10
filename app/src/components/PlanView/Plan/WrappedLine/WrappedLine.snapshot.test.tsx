import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import React from 'react';

import { PlanViewProvider } from '~/contexts/PlanViewProvider';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { normalizeSnapshot } from '~/test-utils/snapshot-helpers';
import type { FeedbackMetadata, LineMetadata } from '~/utils/rendering/line-wrapping';

import { WrappedFeedback, WrappedLine } from './WrappedLine';

describe('WrappedLine snapshots', () => {
    const terminalWidth = 80;

    // Helper to wrap with TerminalProvider and PlanViewProvider
    const renderLine = (line: React.ReactElement, width: number = terminalWidth) => {
        return render(
            <TerminalProvider terminalWidth={width} terminalHeight={24}>
                <PlanViewProvider
                    sessionId="test-session"
                    content="Test content"
                    onShowHelp={() => {}}
                    onApprove={() => {}}
                    onDeny={() => {}}
                    onCancel={() => {}}
                >
                    {line}
                </PlanViewProvider>
            </TerminalProvider>,
        );
    };

    test('snapshot: horizontal rule at 80 columns', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '---',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [{ segments: [], segmentIndex: 0 }],
            formatting: {
                type: 'hr',
                segments: [],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: blockquote with formatting', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '> This is a quote with **bold** and *italic*',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [
                {
                    segments: [
                        { text: 'This is a quote with ' },
                        { text: 'bold', bold: true },
                        { text: ' and ' },
                        { text: 'italic', italic: true },
                    ],
                    segmentIndex: 0,
                },
            ],
            formatting: {
                type: 'blockquote',
                segments: [
                    { text: 'This is a quote with ' },
                    { text: 'bold', bold: true },
                    { text: ' and ' },
                    { text: 'italic', italic: true },
                ],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: nested blockquote depth 1', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '> Level 1',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [{ segments: [{ text: 'Level 1' }], segmentIndex: 0 }],
            formatting: {
                type: 'blockquote',
                blockquoteDepth: 1,
                segments: [{ text: 'Level 1' }],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: nested blockquote depth 2', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '>> Level 2',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [{ segments: [{ text: 'Level 2' }], segmentIndex: 0 }],
            formatting: {
                type: 'blockquote',
                blockquoteDepth: 2,
                segments: [{ text: 'Level 2' }],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: nested blockquote depth 3', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '>>> Level 3',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [{ segments: [{ text: 'Level 3' }], segmentIndex: 0 }],
            formatting: {
                type: 'blockquote',
                blockquoteDepth: 3,
                segments: [{ text: 'Level 3' }],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: nested blockquote depth 4', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '>>>> Level 4',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [{ segments: [{ text: 'Level 4' }], segmentIndex: 0 }],
            formatting: {
                type: 'blockquote',
                blockquoteDepth: 4,
                segments: [{ text: 'Level 4' }],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: nested blockquote depth 5', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '>>>>> Level 5',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [{ segments: [{ text: 'Level 5' }], segmentIndex: 0 }],
            formatting: {
                type: 'blockquote',
                blockquoteDepth: 5,
                segments: [{ text: 'Level 5' }],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: nested blockquote with mixed formatting', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '>>> Quote with **bold** and *italic*',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [
                {
                    segments: [
                        { text: 'Quote with ' },
                        { text: 'bold', bold: true },
                        { text: ' and ' },
                        { text: 'italic', italic: true },
                    ],
                    segmentIndex: 0,
                },
            ],
            formatting: {
                type: 'blockquote',
                blockquoteDepth: 3,
                segments: [
                    { text: 'Quote with ' },
                    { text: 'bold', bold: true },
                    { text: ' and ' },
                    { text: 'italic', italic: true },
                ],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: H1 heading', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: '# Main Title',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [{ segments: [{ text: 'Main Title' }], segmentIndex: 0 }],
            formatting: {
                type: 'heading',
                headingLevel: 1,
                segments: [{ text: 'Main Title' }],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: normal text with mixed formatting', () => {
        const lineMetadata: LineMetadata = {
            planLineIndex: 0,
            originalContent: 'Text with **bold**, *italic*, and `code`',
            renderedLineCount: 1,
            segments: [],
            formattedSegments: [
                {
                    segments: [
                        { text: 'Text with ' },
                        { text: 'bold', bold: true },
                        { text: ', ' },
                        { text: 'italic', italic: true },
                        { text: ', and ' },
                        { text: 'code', code: true },
                    ],
                    segmentIndex: 0,
                },
            ],
            formatting: {
                type: 'normal',
                segments: [
                    { text: 'Text with ' },
                    { text: 'bold', bold: true },
                    { text: ', ' },
                    { text: 'italic', italic: true },
                    { text: ', and ' },
                    { text: 'code', code: true },
                ],
            },
        };

        const { lastFrame } = renderLine(
            <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
            80,
        );

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: wrapped comment feedback', () => {
        const feedback: FeedbackMetadata = {
            lineIndex: 0,
            text: 'This is a long comment that should wrap across multiple lines to test the wrapping behavior',
            segments: [
                { content: 'This is a long comment that should wrap across ', segmentIndex: 0 },
                { content: 'multiple lines to test the wrapping behavior', segmentIndex: 1 },
            ],
            type: 'comment',
        };

        const { lastFrame } = render(<WrappedFeedback feedback={feedback} />);

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });

    test('snapshot: wrapped question feedback', () => {
        const feedback: FeedbackMetadata = {
            lineIndex: 0,
            text: 'Why does this implementation use this approach instead of a simpler alternative?',
            segments: [
                { content: 'Why does this implementation use this approach ', segmentIndex: 0 },
                { content: 'instead of a simpler alternative?', segmentIndex: 1 },
            ],
            type: 'question',
        };

        const { lastFrame } = render(<WrappedFeedback feedback={feedback} />);

        expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
    });
});
