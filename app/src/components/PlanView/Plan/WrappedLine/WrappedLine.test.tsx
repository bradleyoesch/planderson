import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import React from 'react';

import { ANSI, COLORS } from '~/test-utils/ansi-assertions';
import { stripAnsi } from '~/test-utils/ink-helpers';
import { renderWithPlanViewProvider } from '~/test-utils/render-helpers';
import type { FeedbackMetadata, LineMetadata } from '~/utils/rendering/line-wrapping';
import type { CodeMetadata } from '~/utils/rendering/markdown/markdown';

import { WrappedFeedback, WrappedLine } from './WrappedLine';
describe('WrappedLine', () => {
    describe('WrappedFeedback', () => {
        test('renders comment with ACCENT color and italic', () => {
            const feedback: FeedbackMetadata = {
                lineIndex: 0,
                text: 'This is a comment',
                segments: [{ content: 'This is a comment', segmentIndex: 0 }],
                type: 'comment',
            };

            const { lastFrame } = render(<WrappedFeedback feedback={feedback} />);

            const output = lastFrame();
            expect(output).toContain('This is a comment');
            expect(output).toContain(COLORS.ACCENT);
            expect(output).toContain(ANSI.ITALIC);
        });

        test('renders question with QUESTION color and italic', () => {
            const feedback: FeedbackMetadata = {
                lineIndex: 0,
                text: 'Why is this here?',
                segments: [{ content: 'Why is this here?', segmentIndex: 0 }],
                type: 'question',
            };

            const { lastFrame } = render(<WrappedFeedback feedback={feedback} />);

            const output = lastFrame();
            expect(output).toContain('Why is this here?');
            expect(output).toContain(COLORS.QUESTION);
            expect(output).toContain(ANSI.ITALIC);
        });

        describe('Segment Trimming', () => {
            test('trims each segment and joins with newlines', () => {
                const feedback: FeedbackMetadata = {
                    lineIndex: 0,
                    text: 'Long comment that wraps',
                    segments: [
                        { content: 'Long comment ', segmentIndex: 0 },
                        { content: 'that wraps', segmentIndex: 1 },
                    ],
                    type: 'comment',
                };

                const { lastFrame } = render(<WrappedFeedback feedback={feedback} />);

                const output = stripAnsi(lastFrame()!);
                expect(output).toContain('Long comment\nthat wraps');
            });

            test('handles trailing spaces in segments', () => {
                const feedback: FeedbackMetadata = {
                    lineIndex: 0,
                    text: 'Comment with trailing spaces',
                    segments: [
                        { content: 'end of the   ', segmentIndex: 0 },
                        { content: ' line     ', segmentIndex: 1 },
                    ],
                    type: 'comment',
                };

                const { lastFrame } = render(<WrappedFeedback feedback={feedback} />);

                const output = stripAnsi(lastFrame()!);
                expect(output).toContain('end of the\nline');
            });

            test('handles empty segment content', () => {
                const feedback: FeedbackMetadata = {
                    lineIndex: 0,
                    text: '',
                    segments: [{ content: '', segmentIndex: 0 }],
                    type: 'comment',
                };

                const { lastFrame } = render(<WrappedFeedback feedback={feedback} />);

                expect(lastFrame()).toBeDefined();
            });
        });
    });

    describe('WrappedLine component', () => {
        const terminalWidth = 80;

        describe('Horizontal Rule', () => {
            test('renders HR with full width and SUBTLE color', () => {
                const paddingX = 1;
                const expectedWidth = terminalWidth - paddingX * 2;

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

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                expect(output).toContain('─');
                expect(output).toContain(COLORS.SUBTLE);

                const stripped = stripAnsi(output!);
                expect(stripped.length).toBe(expectedWidth);
            });

            test('adjusts to different terminal widths', () => {
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

                const widths = [40, 60, 80];
                const paddingX = 1;

                widths.forEach((width) => {
                    const { lastFrame } = renderWithPlanViewProvider(
                        <WrappedLine
                            lineMetadata={lineMetadata}
                            isSelected={false}
                            isDeleted={false}
                            terminalWidth={width}
                        />,
                        { terminalWidth: width },
                    );

                    const output = lastFrame();
                    const stripped = stripAnsi(output!).trim();
                    expect(stripped.length).toBe(width - paddingX * 2);
                });
            });
        });

        describe('Blockquote', () => {
            test('renders with vertical bar prefix and SUBTLE color', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '> Quoted text',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'Quoted text' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'blockquote',
                        segments: [{ text: 'Quoted text' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                expect(output).toContain('│ ');
                expect(output).toContain('Quoted text');
                expect(output).toContain(COLORS.SUBTLE);
            });

            test('renders wrapped blockquote with prefix on each line', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '> Long quoted text that wraps',
                    renderedLineCount: 2,
                    segments: [],
                    formattedSegments: [
                        { segments: [{ text: 'Long quoted text ' }], segmentIndex: 0 },
                        { segments: [{ text: 'that wraps' }], segmentIndex: 1 },
                    ],
                    formatting: {
                        type: 'blockquote',
                        segments: [{ text: 'Long quoted text that wraps' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                const lines = output!.split('\n');
                expect(lines[0]).toContain('│ ');
                expect(lines[1]).toContain('│ ');
            });

            test('trims whitespace from segments', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '> Text with spaces',
                    renderedLineCount: 2,
                    segments: [],
                    formattedSegments: [
                        { segments: [{ text: 'Text with  ' }], segmentIndex: 0 },
                        { segments: [{ text: '  spaces' }], segmentIndex: 1 },
                    ],
                    formatting: {
                        type: 'blockquote',
                        segments: [{ text: 'Text with spaces' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = stripAnsi(lastFrame()!);
                expect(output).toContain('│ Text with\n│ spaces');
            });
        });

        describe('Nested Blockquotes', () => {
            test.each([
                [1, '│ '],
                [2, '│ │ '],
                [3, '│ │ │ '],
                [4, '│ │ │ │ '],
                [5, '│ │ │ │ │ '],
            ])('renders depth %i with correct pipe count', (depth, expectedPrefix) => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: `${'>'.repeat(depth)} Nested quote`,
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'Nested quote' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'blockquote',
                        blockquoteDepth: depth as 1 | 2 | 3 | 4 | 5,
                        segments: [{ text: 'Nested quote' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
                );

                const output = stripAnsi(lastFrame()!);
                expect(output).toContain(`${expectedPrefix}Nested quote`);
            });

            test('wrapped lines preserve prefix on each line', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '>>> Long text that wraps',
                    renderedLineCount: 2,
                    segments: [],
                    formattedSegments: [
                        { segments: [{ text: 'Long text' }], segmentIndex: 0 },
                        { segments: [{ text: 'that wraps' }], segmentIndex: 0 },
                    ],
                    formatting: {
                        type: 'blockquote',
                        blockquoteDepth: 3,
                        segments: [{ text: 'Long text that wraps' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
                );

                const output = stripAnsi(lastFrame()!);
                expect(output).toContain('│ │ │ Long text\n│ │ │ that wraps');
            });

            test('renders empty blockquote with pipes only', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '>>> ',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: '' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'blockquote',
                        blockquoteDepth: 3,
                        segments: [{ text: '' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
                );

                const output = stripAnsi(lastFrame()!);
                expect(output).toContain('│ │ │ ');
            });

            test('preserves inline formatting in nested blockquotes', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '>>> Text with **bold**',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [
                        {
                            segments: [{ text: 'Text with ' }, { text: 'bold', bold: true }],
                            segmentIndex: 0,
                        },
                    ],
                    formatting: {
                        type: 'blockquote',
                        blockquoteDepth: 3,
                        segments: [{ text: 'Text with ' }, { text: 'bold', bold: true }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
                );

                const output = lastFrame()!;
                expect(stripAnsi(output)).toContain('│ │ │ Text with bold');
                expect(output).toContain('\x1b[1m'); // Bold ANSI code
            });

            test('defaults to depth 1 when blockquoteDepth is missing', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '> Quote',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'Quote' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'blockquote',
                        // blockquoteDepth intentionally omitted
                        segments: [{ text: 'Quote' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={false} terminalWidth={80} />,
                );

                const output = stripAnsi(lastFrame()!);
                expect(output).toContain('│ Quote');
            });

            test('handles deleted nested blockquotes', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '>>> Deleted quote',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'Deleted quote' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'blockquote',
                        blockquoteDepth: 3,
                        segments: [{ text: 'Deleted quote' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine lineMetadata={lineMetadata} isSelected={false} isDeleted={true} terminalWidth={80} />,
                );

                const output = stripAnsi(lastFrame()!);
                expect(output).toContain('│ │ │ Deleted quote');
            });
        });

        describe('Heading', () => {
            test('renders H1 with bold, italic, and underline', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '# Main Heading',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'Main Heading' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'heading',
                        headingLevel: 1,
                        segments: [{ text: 'Main Heading' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                expect(output).toContain('Main Heading');
                expect(output).toContain(COLORS.H1);
                expect(output).toContain(ANSI.BOLD);
                expect(output).toContain(ANSI.ITALIC);
                expect(output).toContain(ANSI.UNDERLINE);
            });

            test('renders H2 with bold only', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '## Subheading',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'Subheading' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'heading',
                        headingLevel: 2,
                        segments: [{ text: 'Subheading' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                expect(output).toContain('Subheading');
                expect(output).toContain(ANSI.BOLD);
                expect(output).not.toContain(ANSI.UNDERLINE);
            });

            test('renders wrapped heading with multiple segments', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '## Very long heading that wraps',
                    renderedLineCount: 2,
                    segments: [],
                    formattedSegments: [
                        { segments: [{ text: 'Very long heading ' }], segmentIndex: 0 },
                        { segments: [{ text: 'that wraps' }], segmentIndex: 1 },
                    ],
                    formatting: {
                        type: 'heading',
                        headingLevel: 2,
                        segments: [{ text: 'Very long heading that wraps' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                expect(output).toContain('Very long heading');
                expect(output).toContain('that wraps');
                expect(output).toContain('\n');
            });
        });

        describe('Code Block', () => {
            test('delegates to CodeLine component', () => {
                const codeMetadata: CodeMetadata = {
                    language: 'typescript',
                    blockIndex: 0,
                    lineInBlock: 1,
                    totalLinesInBlock: 3,
                };

                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: 'const x = 1;',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'const x = 1;', code: true }], segmentIndex: 0 }],
                    formatting: {
                        type: 'code',
                        segments: [{ text: 'const x = 1;', code: true }],
                        codeMetadata,
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                expect(lastFrame()).toContain('const x = 1;');
            });

            test('passes isSelected to CodeLine', () => {
                const codeMetadata: CodeMetadata = {
                    blockIndex: 0,
                    lineInBlock: 1,
                    totalLinesInBlock: 3,
                };

                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: 'code',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'code', code: true }], segmentIndex: 0 }],
                    formatting: {
                        type: 'code',
                        segments: [{ text: 'code', code: true }],
                        codeMetadata,
                    },
                };

                const notSelectedRender = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );
                const selectedRender = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={true}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                expect(selectedRender.lastFrame()).not.toBe(notSelectedRender.lastFrame());
            });
        });

        describe('Normal Text', () => {
            test('renders single segment', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: 'Plain text',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: 'Plain text' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'normal',
                        segments: [{ text: 'Plain text' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                expect(lastFrame()).toContain('Plain text');
            });

            test('renders bold formatting', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: 'Text with bold',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [
                        {
                            segments: [{ text: 'Text with ' }, { text: 'bold', bold: true }],
                            segmentIndex: 0,
                        },
                    ],
                    formatting: {
                        type: 'normal',
                        segments: [{ text: 'Text with ' }, { text: 'bold', bold: true }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                expect(output).toContain('bold');
                expect(output).toContain(ANSI.BOLD);
            });

            test('renders italic formatting', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: 'Text with italic',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [
                        {
                            segments: [{ text: 'Text with ' }, { text: 'italic', italic: true }],
                            segmentIndex: 0,
                        },
                    ],
                    formatting: {
                        type: 'normal',
                        segments: [{ text: 'Text with ' }, { text: 'italic', italic: true }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                expect(output).toContain('italic');
                expect(output).toContain(ANSI.ITALIC);
            });

            test('renders inline code', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: 'Text with code',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [
                        {
                            segments: [{ text: 'Text with ' }, { text: 'code', code: true }],
                            segmentIndex: 0,
                        },
                    ],
                    formatting: {
                        type: 'normal',
                        segments: [{ text: 'Text with ' }, { text: 'code', code: true }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = lastFrame();
                expect(output).toContain('Text with');
                expect(output).toContain('code');
            });

            test('preserves leading spaces on first line, trims trailing spaces', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '  Text with spaces',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [
                        {
                            segments: [{ text: '  Text with spaces  ' }],
                            segmentIndex: 0,
                        },
                    ],
                    formatting: {
                        type: 'normal',
                        segments: [{ text: '  Text with spaces' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                const output = stripAnsi(lastFrame()!);
                // Leading spaces preserved on first line, trailing trimmed
                expect(output).toBe('  Text with spaces');
            });

            test('passes isSelected to StyledText', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: 'Text with inline code',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [
                        {
                            segments: [{ text: 'Text with ' }, { text: 'inline code', code: true }],
                            segmentIndex: 0,
                        },
                    ],
                    formatting: {
                        type: 'normal',
                        segments: [{ text: 'Text with ' }, { text: 'inline code', code: true }],
                    },
                };

                const notSelectedRender = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );
                const selectedRender = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={true}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                expect(selectedRender.lastFrame()).not.toBe(notSelectedRender.lastFrame());
            });
        });

        describe('Empty Lines', () => {
            test('renders empty line', () => {
                const lineMetadata: LineMetadata = {
                    planLineIndex: 0,
                    originalContent: '',
                    renderedLineCount: 1,
                    segments: [],
                    formattedSegments: [{ segments: [{ text: '' }], segmentIndex: 0 }],
                    formatting: {
                        type: 'normal',
                        segments: [{ text: '' }],
                    },
                };

                const { lastFrame } = renderWithPlanViewProvider(
                    <WrappedLine
                        lineMetadata={lineMetadata}
                        isSelected={false}
                        isDeleted={false}
                        terminalWidth={terminalWidth}
                    />,
                );

                expect(lastFrame()).toBeDefined();
            });
        });
    });
});
