import { describe, expect, test } from 'bun:test';
import React from 'react';
import stringWidth from 'string-width';

import { ANSI } from '~/test-utils/ansi-assertions';
import { wrapContent } from '~/test-utils/line-wrapping-helpers';
import { renderWithPlanViewProvider } from '~/test-utils/render-helpers';
import { wrapContentWithFormatting, wrapFeedback } from '~/utils/rendering/line-wrapping';
import type { LineFormatting } from '~/utils/rendering/markdown/markdown';

import { Plan } from './Plan';
describe('Plan', () => {
    const contentLines = ['line 1', 'line 2', 'line 3'];
    const wrappedLines = wrapContent(contentLines, 80, 1);
    const basicProps = {
        visibleLines: wrappedLines, // Show all in tests by default
        scrollOffset: 0,
        cursorLine: 0,
        selectionAnchor: null,
        wrappedComments: wrapFeedback(new Map(), 'comment', 80, 1),
        wrappedQuestions: wrapFeedback(new Map(), 'question', 80, 1),
        deletedLines: new Set<number>(),
        terminalWidth: 80,
    };

    describe('Basic Rendering', () => {
        test('should render plan content', () => {
            const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} />);

            expect(lastFrame()).toContain('line 1');
            expect(lastFrame()).toContain('line 2');
            expect(lastFrame()).toContain('line 3');
        });

        test('should handle empty content lines', () => {
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} visibleLines={wrapContent([], 80, 1)} />,
            );
            expect(lastFrame()).toBeDefined();
        });
    });

    describe('Cursor Positioning', () => {
        test('should render cursor on current line', () => {
            const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} cursorLine={1} />);

            const output = lastFrame();
            expect(output).toContain('line 2');
        });

        test('should handle cursor at first line', () => {
            const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} cursorLine={0} />);

            expect(lastFrame()).toContain('line 1');
        });

        test('should handle cursor at last line', () => {
            const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} cursorLine={2} />);

            expect(lastFrame()).toContain('line 3');
        });

        test('should highlight inline code when line is selected', () => {
            // Content with inline code
            const formatting: LineFormatting[] = [
                {
                    type: 'normal',
                    segments: [{ text: 'Text with ' }, { text: 'inline code', code: true }, { text: ' here' }],
                },
            ];
            const wrappedWithFormatting = wrapContentWithFormatting(formatting, 80, 1);

            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} visibleLines={wrappedWithFormatting} cursorLine={0} />,
            );

            const output = lastFrame();
            // Should contain the text and inline code
            expect(output).toContain('Text with');
            expect(output).toContain('inline code');
        });

        test('should handle cursor beyond content bounds', () => {
            const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} cursorLine={999} />);

            // Should still render content even with invalid cursor position
            expect(lastFrame()).toBeDefined();
            expect(lastFrame()).toContain('line 1');
        });
    });

    describe('Markdown Rendering', () => {
        describe('Headings', () => {
            test('renders H1 heading with TITLE color and bold', () => {
                const formatting: LineFormatting[] = [
                    {
                        type: 'heading',
                        headingLevel: 1,
                        segments: [{ text: 'Main Heading' }],
                    },
                ];
                const wrappedLines = wrapContentWithFormatting(formatting, 80, 1);

                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />);

                const output = lastFrame();
                expect(output).toContain('Main Heading');
                expect(output).toContain(ANSI.BOLD);
            });

            test('renders H3 heading with ACCENT color', () => {
                const formatting: LineFormatting[] = [
                    {
                        type: 'heading',
                        headingLevel: 3,
                        segments: [{ text: 'Subheading' }],
                    },
                ];
                const wrappedLines = wrapContentWithFormatting(formatting, 80, 1);

                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />);

                const output = lastFrame();
                expect(output).toContain('Subheading');
            });
        });

        describe('Blockquotes', () => {
            test('renders blockquote with vertical bar prefix', () => {
                const formatting: LineFormatting[] = [
                    {
                        type: 'blockquote',
                        segments: [{ text: 'Quoted text' }],
                    },
                ];
                const wrappedLines = wrapContentWithFormatting(formatting, 80, 1);

                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />);

                const output = lastFrame();
                expect(output).toContain('│ ');
                expect(output).toContain('Quoted text');
            });
        });

        describe('Horizontal Rules', () => {
            test('renders horizontal rule as line', () => {
                const formatting: LineFormatting[] = [
                    {
                        type: 'hr',
                        segments: [],
                    },
                ];
                const wrappedLines = wrapContentWithFormatting(formatting, 80, 1);

                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />);

                const output = lastFrame();
                expect(output).toContain('─');
            });
        });

        describe('Text Formatting', () => {
            test('renders TextSegments with bold formatting', () => {
                const formatting: LineFormatting[] = [
                    {
                        type: 'normal',
                        segments: [
                            { text: 'This is ', bold: false },
                            { text: 'bold', bold: true },
                        ],
                    },
                ];
                const wrappedLines = wrapContentWithFormatting(formatting, 80, 1);

                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />);

                const output = lastFrame();
                expect(output).toContain('This is ');
                expect(output).toContain('bold');
                expect(output).toContain(ANSI.BOLD);
            });

            test('renders TextSegments with italic formatting', () => {
                const formatting: LineFormatting[] = [
                    {
                        type: 'normal',
                        segments: [
                            { text: 'This is ', italic: false },
                            { text: 'italic', italic: true },
                        ],
                    },
                ];
                const wrappedLines = wrapContentWithFormatting(formatting, 80, 1);

                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />);

                const output = lastFrame();
                expect(output).toContain('italic');
                expect(output).toContain(ANSI.ITALIC);
            });

            test('renders TextSegments with code formatting', () => {
                const formatting: LineFormatting[] = [
                    {
                        type: 'normal',
                        segments: [{ text: 'Use ', code: false }, { text: 'code', code: true }, { text: ' here' }],
                    },
                ];
                const wrappedLines = wrapContentWithFormatting(formatting, 80, 1);

                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />);

                const output = lastFrame();
                expect(output).toContain('Use ');
                expect(output).toContain('code');
                expect(output).toContain(' here');
            });
        });

        describe('Blank Lines', () => {
            test('blank lines between content preserve spacing', () => {
                const terminalWidth = 80;
                const paddingX = 1;
                const formatting: LineFormatting[] = [
                    { type: 'normal', segments: [{ text: 'Line 1' }] },
                    { type: 'normal', segments: [{ text: '' }] },
                    { type: 'normal', segments: [{ text: 'Line 2' }] },
                ];
                const wrappedLines = wrapContentWithFormatting(formatting, terminalWidth, paddingX);

                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />, {
                    terminalWidth,
                });

                const output = lastFrame();
                const lines = output!.split('\n');

                expect(lines.length).toBe(3);
                expect(lines[0]).toContain('Line 1');
                expect(lines[2]).toContain('Line 2');
            });

            test('trims leading and trailing spaces from wrapped markdown lines', () => {
                const formatting: LineFormatting[] = [
                    {
                        type: 'heading',
                        headingLevel: 2,
                        segments: [
                            {
                                text: 'This is a very long heading that will wrap across multiple lines and should have spaces trimmed at line boundaries',
                            },
                        ],
                    },
                    {
                        type: 'blockquote',
                        segments: [
                            {
                                text: 'This is a very long blockquote that will wrap across multiple lines and should have spaces trimmed at line boundaries',
                            },
                        ],
                    },
                    {
                        type: 'normal',
                        segments: [
                            { text: 'Normal text with ', bold: false },
                            { text: 'bold formatting', bold: true },
                            {
                                text: ' that wraps across multiple lines and should have spaces trimmed at line boundaries',
                                bold: false,
                            },
                        ],
                    },
                ];

                const wrappedLines = wrapContentWithFormatting(formatting, 50, 1);
                const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} visibleLines={wrappedLines} />);
                const output = lastFrame();
                expect(output).toBeDefined();

                const lines = output!.split('\n');
                lines.forEach((line) => {
                    if (line.length > 0) {
                        const visibleWidth = stringWidth(line);
                        const trimmedWidth = stringWidth(line.trim());
                        expect(visibleWidth).toBe(trimmedWidth);
                    }
                });
            });
        });
    });

    describe('Feedback Rendering', () => {
        describe('Comments', () => {
            test('should render comments above their target lines', () => {
                const commentsWithData = new Map([[1, { text: 'This is a comment', lines: [1] }]]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan {...basicProps} wrappedComments={wrapFeedback(commentsWithData, 'comment', 80, 1)} />,
                );

                const output = lastFrame()!;
                expect(output).toContain('💬');
                expect(output).toContain('This is a comment');
                expect(output).toContain('line 2');

                const commentIndex = output.indexOf('This is a comment');
                const lineIndex = output.indexOf('line 2');
                expect(commentIndex).toBeLessThan(lineIndex);
            });

            test('should render multiple comments in order', () => {
                const commentsWithData = new Map([
                    [0, { text: 'First comment', lines: [0] }],
                    [2, { text: 'Second comment', lines: [2] }],
                ]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan {...basicProps} wrappedComments={wrapFeedback(commentsWithData, 'comment', 80, 1)} />,
                );

                const output = lastFrame();
                expect(output).toContain('First comment');
                expect(output).toContain('Second comment');
            });

            test('should handle comments with special characters', () => {
                const commentsWithSpecial = new Map([[0, { text: 'Comment with "quotes" and <tags>', lines: [0] }]]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan {...basicProps} wrappedComments={wrapFeedback(commentsWithSpecial, 'comment', 80, 1)} />,
                );

                expect(lastFrame()).toContain('"quotes"');
                expect(lastFrame()).toContain('<tags>');
            });

            test('should not add extra blank line between comment and content', () => {
                const commentsWithData = new Map([[1, { text: 'This is a comment', lines: [1] }]]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan {...basicProps} wrappedComments={wrapFeedback(commentsWithData, 'comment', 80, 1)} />,
                );

                const output = lastFrame()!;
                const lines = output.split('\n');

                const commentLineIndex = lines.findIndex((line) => line.includes('This is a comment'));
                const contentLineIndex = lines.findIndex((line) => line.includes('line 2'));

                expect(contentLineIndex).toBe(commentLineIndex + 1);
            });
        });

        describe('Questions', () => {
            test('should not add extra blank line between question and content', () => {
                const questionsWithData = new Map([[1, { text: 'Why is this here?', lines: [1] }]]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan {...basicProps} wrappedQuestions={wrapFeedback(questionsWithData, 'question', 80, 1)} />,
                );

                const output = lastFrame()!;
                const lines = output.split('\n');

                const questionLineIndex = lines.findIndex((line) => line.includes('Why is this here?'));
                const contentLineIndex = lines.findIndex((line) => line.includes('line 2'));

                expect(contentLineIndex).toBe(questionLineIndex + 1);
            });
        });

        describe('Deletions', () => {
            test('should render single deleted line with strikethrough', () => {
                const deletedWithData = new Set([1]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan {...basicProps} deletedLines={deletedWithData} />,
                );

                expect(lastFrame()).toContain('line 2');
            });

            test('should render multiple deleted lines with strikethrough', () => {
                const deletedWithData = new Set([0, 1, 2]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan {...basicProps} deletedLines={deletedWithData} />,
                );

                expect(lastFrame()).toContain('line 1');
                expect(lastFrame()).toContain('line 2');
                expect(lastFrame()).toContain('line 3');
            });
        });

        describe('Combined Feedback and Deletions', () => {
            test('should render comments and deletions on same line', () => {
                const commentsWithData = new Map([[1, { text: 'Fix this line', lines: [1] }]]);
                const deletedWithData = new Set([1]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan
                        {...basicProps}
                        wrappedComments={wrapFeedback(commentsWithData, 'comment', 80, 1)}
                        deletedLines={deletedWithData}
                    />,
                );

                expect(lastFrame()).toContain('💬');
                expect(lastFrame()).toContain('Fix this line');
                expect(lastFrame()).toContain('line 2');
            });

            test('should render both comments and deletions', () => {
                const commentsWithData = new Map([[0, { text: 'comment', lines: [0] }]]);
                const deletedWithData = new Set([1]);
                const { lastFrame } = renderWithPlanViewProvider(
                    <Plan
                        {...basicProps}
                        wrappedComments={wrapFeedback(commentsWithData, 'comment', 80, 1)}
                        deletedLines={deletedWithData}
                    />,
                );

                expect(lastFrame()).toContain('💬');
                expect(lastFrame()).toContain('comment');
                expect(lastFrame()).toContain('line 1');
                expect(lastFrame()).toContain('line 2');
            });
        });
    });

    describe('Multi-Line Selection', () => {
        test('should highlight single line when no selection', () => {
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} cursorLine={1} selectionAnchor={null} />,
            );

            // Only line 1 should have background (implementation detail - visual test in snapshots)
            expect(lastFrame()).toContain('line 2');
        });

        test('should highlight range when selection active (anchor < cursor)', () => {
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} cursorLine={2} selectionAnchor={0} />,
            );

            // Lines 0, 1, 2 should be highlighted (visual test in snapshots)
            expect(lastFrame()).toContain('line 1');
            expect(lastFrame()).toContain('line 2');
            expect(lastFrame()).toContain('line 3');
        });

        test('should highlight range when selection reversed (anchor > cursor)', () => {
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} cursorLine={0} selectionAnchor={2} />,
            );

            // Lines 0, 1, 2 should be highlighted (same as above - bidirectional)
            expect(lastFrame()).toContain('line 1');
            expect(lastFrame()).toContain('line 2');
            expect(lastFrame()).toContain('line 3');
        });

        test('should handle selection with comments and deletions', () => {
            const comments = new Map([[1, { text: 'Test comment', lines: [1] }]]);
            const deletedLines = new Set([2]);
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan
                    {...basicProps}
                    cursorLine={2}
                    selectionAnchor={0}
                    wrappedComments={wrapFeedback(comments, 'comment', 80, 1)}
                    deletedLines={deletedLines}
                />,
            );

            expect(lastFrame()).toContain('💬');
            expect(lastFrame()).toContain('Test comment');
        });
    });

    describe('Edge Cases', () => {
        test('should handle content with empty lines', () => {
            const contentWithEmpty = ['line 1', '', 'line 3'];
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} visibleLines={wrapContent(contentWithEmpty, 80, 1)} />,
            );

            expect(lastFrame()).toContain('line 1');
            expect(lastFrame()).toContain('line 3');
        });

        test('should handle very long lines', () => {
            const longLine = 'A'.repeat(200);
            const contentWithLongLine = [longLine, 'line 2'];
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} visibleLines={wrapContent(contentWithLongLine, 80, 1)} />,
            );

            expect(lastFrame()).toContain('A');
        });

        test('should handle special characters in content', () => {
            const specialContent = ['<tag>', '"quotes"', "it's"];
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} visibleLines={wrapContent(specialContent, 80, 1)} />,
            );

            expect(lastFrame()).toContain('<tag>');
            expect(lastFrame()).toContain('"quotes"');
            expect(lastFrame()).toContain("it's");
        });

        test('should render with narrow terminal width', () => {
            const { lastFrame } = renderWithPlanViewProvider(<Plan {...basicProps} />, { terminalWidth: 40 });

            expect(lastFrame()).toContain('line 1');
            expect(lastFrame()).toContain('line 2');
        });

        test('should handle large number of content lines', () => {
            const manyLines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
            const { lastFrame } = renderWithPlanViewProvider(
                <Plan {...basicProps} visibleLines={wrapContent(manyLines, 80, 1)} />,
            );

            expect(lastFrame()).toContain('Line 1');
            expect(lastFrame()).toContain('Line 100');
        });
    });
});
