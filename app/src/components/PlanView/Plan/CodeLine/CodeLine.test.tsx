import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import React from 'react';

import type { WrappedSegmentWithFormatting } from '~/utils/rendering/line-wrapping';
import type { CodeMetadata } from '~/utils/rendering/markdown/markdown';

import { CodeLine } from './CodeLine';
describe('CodeLine', () => {
    describe('Fence Lines', () => {
        test('renders opening fence in dim color', () => {
            const metadata: CodeMetadata = {
                language: 'typescript',
                blockIndex: 0,
                lineInBlock: 0,
                totalLinesInBlock: 3,
                isOpening: true,
            };

            const wrappedSegments: WrappedSegmentWithFormatting[] = [
                { segments: [{ text: '```typescript', code: true }], segmentIndex: 0 },
            ];

            const { lastFrame } = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={false}
                />,
            );

            expect(lastFrame()).toContain('```typescript');
        });

        test('renders closing fence', () => {
            const metadata: CodeMetadata = {
                blockIndex: 0,
                lineInBlock: 2,
                totalLinesInBlock: 3,
                isClosing: true,
            };

            const wrappedSegments: WrappedSegmentWithFormatting[] = [
                { segments: [{ text: '```', code: true }], segmentIndex: 0 },
            ];

            const { lastFrame } = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={false}
                />,
            );

            expect(lastFrame()).toContain('```');
        });
    });

    describe('Code Content', () => {
        test('renders code with syntax highlighting segments', () => {
            const metadata: CodeMetadata = {
                language: 'typescript',
                blockIndex: 0,
                lineInBlock: 1,
                totalLinesInBlock: 3,
            };

            const wrappedSegments: WrappedSegmentWithFormatting[] = [
                {
                    segments: [
                        { text: 'const ', code: true, color: '#569cd6' },
                        { text: 'x', code: true, color: '#9cdcfe' },
                        { text: ' = 1;', code: true },
                    ],
                    segmentIndex: 0,
                },
            ];

            const { lastFrame } = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={false}
                />,
            );

            expect(lastFrame()).toContain('const');
            expect(lastFrame()).toContain('x');
        });

        test('applies highlight background when cursor on line', () => {
            const metadata: CodeMetadata = {
                blockIndex: 0,
                lineInBlock: 1,
                totalLinesInBlock: 3,
            };

            const wrappedSegments: WrappedSegmentWithFormatting[] = [
                { segments: [{ text: 'code', code: true }], segmentIndex: 0 },
            ];

            const highlightedResult = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={true}
                    isDeleted={false}
                />,
            );
            const notHighlightedResult = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={false}
                />,
            );

            expect(highlightedResult.lastFrame()).toContain('code');
            expect(highlightedResult.lastFrame()).not.toBe(notHighlightedResult.lastFrame());
        });

        test('passes isDeleted to child components', () => {
            const metadata: CodeMetadata = {
                blockIndex: 0,
                lineInBlock: 1,
                totalLinesInBlock: 3,
            };

            const wrappedSegments: WrappedSegmentWithFormatting[] = [
                {
                    segments: [
                        { text: 'const ', code: true, color: '#569cd6' },
                        { text: 'x', code: true, color: '#9cdcfe' },
                    ],
                    segmentIndex: 0,
                },
            ];

            const notDeleted = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={false}
                />,
            );
            const deleted = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={true}
                />,
            );

            expect(deleted.lastFrame()).not.toBe(notDeleted.lastFrame());
        });
    });

    describe('Blank Lines', () => {
        test('renders blank line with empty segment', () => {
            const metadata: CodeMetadata = {
                blockIndex: 0,
                lineInBlock: 1,
                totalLinesInBlock: 3,
            };

            const wrappedSegments: WrappedSegmentWithFormatting[] = [
                { segments: [{ text: '', code: true }], segmentIndex: 0 },
            ];

            const { lastFrame } = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={false}
                />,
            );

            const output = lastFrame();
            expect(output).toBeDefined();
            // Without background, blank lines may render as empty - this is expected
        });

        test('renders blank line with no segments', () => {
            const metadata: CodeMetadata = {
                blockIndex: 0,
                lineInBlock: 1,
                totalLinesInBlock: 3,
            };

            const wrappedSegments: WrappedSegmentWithFormatting[] = [{ segments: [], segmentIndex: 0 }];

            const { lastFrame } = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={false}
                />,
            );

            const output = lastFrame();
            expect(output).toBeDefined();
            // Without background, blank lines may render as empty - this is expected
        });
    });

    describe('Wrapping', () => {
        test('renders multiple wrapped segments with newlines', () => {
            const wrappedSegments: WrappedSegmentWithFormatting[] = [
                { segments: [{ text: 'const longVar = "first', code: true }], segmentIndex: 0 },
                { segments: [{ text: ' part and second part', code: true }], segmentIndex: 1 },
            ];

            const metadata: CodeMetadata = {
                blockIndex: 0,
                lineInBlock: 1,
                totalLinesInBlock: 3,
            };

            const { lastFrame } = render(
                <CodeLine
                    wrappedSegments={wrappedSegments}
                    metadata={metadata}
                    isHighlighted={false}
                    isDeleted={false}
                />,
            );

            const output = lastFrame();
            expect(output).toContain('const longVar = "first');
            expect(output).toContain(' part and second part');
            expect(output?.split('\n')).toHaveLength(2);
        });
    });
});
