import { describe, expect, test } from 'bun:test';
import React from 'react';
import stringWidth from 'string-width';

import { COLORS } from '~/test-utils/ansi-assertions';
import { stripAnsi } from '~/test-utils/ink-helpers';
import { wrapContent, wrapMarkdownContent } from '~/test-utils/line-wrapping-helpers';
import { renderWithPlanViewProvider } from '~/test-utils/render-helpers';
import { SNAPSHOT_FIXTURES } from '~/test-utils/snapshot-fixtures';
import { ALL_WIDTHS, normalizeSnapshot, TERMINAL_WIDTHS, testAtAllWidths } from '~/test-utils/snapshot-helpers';
import { wrapFeedback } from '~/utils/rendering/line-wrapping';

import { Plan } from './Plan';

describe('Plan snapshots', () => {
    const contentLines = ['line 1', 'line 2', 'line 3'];
    const wrappedLines = wrapContent(contentLines, 80, 1);
    const basicProps = {
        visibleLines: wrappedLines,
        scrollOffset: 0,
        cursorLine: 0,
        selectionAnchor: null,
        wrappedComments: wrapFeedback(new Map(), 'comment', 80, 1),
        wrappedQuestions: wrapFeedback(new Map(), 'question', 80, 1),
        deletedLines: new Set<number>(),
        terminalWidth: 80,
    };

    const render = (planElement: React.ReactElement, terminalWidth: number = 80) =>
        renderWithPlanViewProvider(planElement, { terminalWidth });

    describe('Multi-Line Selection', () => {
        test('snapshot: multi-line selection (3 lines selected)', () => {
            const lines = ['Step 1: Initialize', 'Step 2: Process', 'Step 3: Complete', 'Step 4: Cleanup'];
            const { lastFrame } = render(
                <Plan {...basicProps} visibleLines={wrapContent(lines, 80, 1)} cursorLine={2} selectionAnchor={0} />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multi-line selection with comment on selected lines', () => {
            const comments = new Map([[0, { text: 'Fix this section', lines: [0, 1, 2] }]]);
            const lines = ['Line 1: First', 'Line 2: Second', 'Line 3: Third', 'Line 4: Fourth'];
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(lines, 80, 1)}
                    cursorLine={2}
                    selectionAnchor={0}
                    wrappedComments={wrapFeedback(comments, 'comment', 80, 1)}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multi-line selection with deletions', () => {
            const deletedLines = new Set([0, 1, 2]);
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(
                        ['Remove this line', 'Remove this too', 'And this one', 'Keep this line'],
                        80,
                        1,
                    )}
                    cursorLine={2}
                    selectionAnchor={0}
                    deletedLines={deletedLines}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multi-line selection with both comments and deletions', () => {
            const comments = new Map([[0, { text: 'These lines need work', lines: [0, 1] }]]);
            const deletedLines = new Set([2]);
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line A', 'Line B', 'Line C', 'Line D'], 80, 1)}
                    cursorLine={2}
                    selectionAnchor={0}
                    wrappedComments={wrapFeedback(comments, 'comment', 80, 1)}
                    deletedLines={deletedLines}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multiple separate comments (no duplication)', () => {
            const comments = new Map([
                [0, { text: 'First issue', lines: [0, 1, 2] }],
                [4, { text: 'Second issue', lines: [4, 5] }],
            ]);
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6'], 80, 1)}
                    cursorLine={0}
                    selectionAnchor={null}
                    wrappedComments={wrapFeedback(comments, 'comment', 80, 1)}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: reversed selection (anchor > cursor)', () => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['First', 'Second', 'Third', 'Fourth'], 80, 1)}
                    cursorLine={0}
                    selectionAnchor={3}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });
    });

    describe('Delete Behavior Visual States', () => {
        test('snapshot: single line not deleted', () => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line 1', 'Line 2', 'Line 3', 'Line 4'], 80, 1)}
                    cursorLine={1}
                    selectionAnchor={null}
                    deletedLines={new Set()}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: single line deleted', () => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line 1', 'Line 2', 'Line 3', 'Line 4'], 80, 1)}
                    cursorLine={1}
                    selectionAnchor={null}
                    deletedLines={new Set([1])}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multi-line all not deleted (before delete action)', () => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line 1', 'Line 2', 'Line 3', 'Line 4'], 80, 1)}
                    cursorLine={2}
                    selectionAnchor={0}
                    deletedLines={new Set()}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multi-line all deleted (before undelete action)', () => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line 1', 'Line 2', 'Line 3', 'Line 4'], 80, 1)}
                    cursorLine={2}
                    selectionAnchor={0}
                    deletedLines={new Set([0, 1, 2])}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multi-line mixed state - starting line deleted (lines 1-3, start on 2)', () => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line 1', 'Line 2', 'Line 3', 'Line 4'], 80, 1)}
                    cursorLine={3}
                    selectionAnchor={1}
                    deletedLines={new Set([0, 1, 2])}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multi-line mixed state - starting line not deleted (lines 2-4, start on 4)', () => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line 1', 'Line 2', 'Line 3', 'Line 4'], 80, 1)}
                    cursorLine={1}
                    selectionAnchor={3}
                    deletedLines={new Set([0, 1, 2])}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: multi-line some deleted some not (lines 1-4, lines 2-3 deleted)', () => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Line 1', 'Line 2', 'Line 3', 'Line 4'], 80, 1)}
                    cursorLine={3}
                    selectionAnchor={0}
                    deletedLines={new Set([1, 2])}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });
    });

    describe('Simple Content', () => {
        test('snapshot: renders at 40 columns', () => {
            const { lastFrame } = render(
                <Plan {...basicProps} visibleLines={wrapContent(SNAPSHOT_FIXTURES.simple.lines, 40, 1)} />,
                TERMINAL_WIDTHS.NARROW,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: renders at 80 columns', () => {
            const { lastFrame } = render(
                <Plan {...basicProps} visibleLines={wrapContent(SNAPSHOT_FIXTURES.simple.lines, 80, 1)} />,
                TERMINAL_WIDTHS.STANDARD,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });
    });

    describe('With Comments and Deletions', () => {
        testAtAllWidths('renders with feedback', (width) => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(SNAPSHOT_FIXTURES.withFeedback.lines, width, 1)}
                    wrappedComments={wrapFeedback(SNAPSHOT_FIXTURES.withFeedback.comments, 'comment', width, 1)}
                    deletedLines={SNAPSHOT_FIXTURES.withFeedback.deletedLines}
                />,
                width,
            );
            return normalizeSnapshot(lastFrame());
        });
    });

    describe('Long Lines (Wrapping)', () => {
        testAtAllWidths('handles long lines', (width) => {
            const { lastFrame } = render(
                <Plan {...basicProps} visibleLines={wrapContent(SNAPSHOT_FIXTURES.longLines.lines, width, 1)} />,
                width,
            );
            return normalizeSnapshot(lastFrame());
        });
    });

    describe('Empty Content', () => {
        testAtAllWidths('handles empty content', (width) => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(contentLines, width, 1)}
                    wrappedComments={wrapFeedback(SNAPSHOT_FIXTURES.empty.comments, 'comment', width, 1)}
                    deletedLines={SNAPSHOT_FIXTURES.empty.deletedLines}
                />,
                width,
            );
            return normalizeSnapshot(lastFrame());
        });
    });

    describe('Special Characters', () => {
        testAtAllWidths('handles special characters', (width) => {
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(SNAPSHOT_FIXTURES.specialChars.lines, width, 1)}
                    wrappedComments={wrapFeedback(SNAPSHOT_FIXTURES.specialChars.comments, 'comment', width, 1)}
                />,
                width,
            );
            return normalizeSnapshot(lastFrame());
        });
    });

    describe('Line Wrapping', () => {
        test('snapshot: wraps long comment with consistent styling at narrow width', () => {
            const longComment = 'A'.repeat(100);
            const comments = new Map([[0, { text: longComment, lines: [0] }]]);
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Short line'], 40, 1)}
                    wrappedComments={wrapFeedback(comments, 'comment', 40, 1)}
                />,
                40,
            );

            expect(normalizeSnapshot(lastFrame()!)).toMatchSnapshot();
        });

        test('each wrapped segment has color code applied', () => {
            const longComment = 'A'.repeat(100);
            const comments = new Map([[0, { text: longComment, lines: [0] }]]);
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Short line'], 40, 1)}
                    wrappedComments={wrapFeedback(comments, 'comment', 40, 1)}
                />,
                40,
            );

            const output = lastFrame()!;
            const lines = output.split('\n');
            const commentLines = lines.slice(0, lines.length - 1).filter((line) => line.trim().length > 0);
            const greyColorCode = COLORS.ACCENT;

            commentLines.forEach((line, idx) => {
                expect(line).toContain(greyColorCode);
                if (idx === 0) {
                    expect(line).toContain('💬');
                }
            });

            expect(commentLines.length).toBeGreaterThan(1);
        });

        test('long words wrap at terminal width boundary', () => {
            const longWord = 'a'.repeat(150);
            const comments = new Map([[0, { text: longWord, lines: [0] }]]);
            const terminalWidth = 80;

            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Content line'], 80, 1)}
                    wrappedComments={wrapFeedback(comments, 'comment', 80, 1)}
                />,
                terminalWidth,
            );

            const output = lastFrame()!;
            const lines = output.split('\n');
            const commentLines = lines.slice(0, lines.length - 1);

            const firstLineVisible = stripAnsi(commentLines[0]);
            expect(firstLineVisible.length).toBeLessThanOrEqual(terminalWidth);

            commentLines.slice(1).forEach((line) => {
                const visibleContent = stripAnsi(line);
                expect(visibleContent.length).toBeLessThanOrEqual(terminalWidth);
            });

            expect(commentLines.length).toBeGreaterThan(1);
        });

        test('repeated words with spaces wrap correctly', () => {
            const repeatedWords = 'aaa '.repeat(50);
            const comments = new Map([[0, { text: repeatedWords, lines: [0] }]]);
            const terminalWidth = 80;

            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Content line'], 80, 1)}
                    wrappedComments={wrapFeedback(comments, 'comment', 80, 1)}
                />,
                terminalWidth,
            );

            const output = lastFrame()!;
            const lines = output.split('\n');
            const commentLines = lines.slice(0, lines.length - 1);

            commentLines.forEach((line) => {
                const visible = stripAnsi(line);
                const displayWidth = stringWidth(visible);
                expect(displayWidth).toBeLessThanOrEqual(terminalWidth);
            });
        });

        test('content lines wrap at terminal width boundary', () => {
            const longContentLine = 'c'.repeat(200);
            const terminalWidth = 80;

            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent([longContentLine], 80, 1)}
                    wrappedComments={wrapFeedback(new Map(), 'comment', terminalWidth, 1)}
                />,
                terminalWidth,
            );

            const output = lastFrame()!;
            const lines = output.split('\n');

            lines.forEach((line) => {
                const visible = stripAnsi(line);
                const displayWidth = stringWidth(visible);
                expect(displayWidth).toBeLessThanOrEqual(terminalWidth);
            });
        });

        test('comment with many characters wraps correctly', () => {
            const longComment = 'c'.repeat(300);
            const comments = new Map([[0, { text: longComment, lines: [0] }]]);
            const terminalWidth = 80;

            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Short content'], 80, 1)}
                    wrappedComments={wrapFeedback(comments, 'comment', 80, 1)}
                />,
                terminalWidth,
            );

            const output = lastFrame()!;
            const lines = output.split('\n');

            const commentLines = lines.slice(0, -1);

            commentLines.forEach((line) => {
                const visible = stripAnsi(line);
                const displayWidth = stringWidth(visible);
                expect(displayWidth).toBeLessThanOrEqual(terminalWidth);
            });
        });

        test('snapshot: wraps long question with consistent styling at narrow width', () => {
            const longQuestion = 'B'.repeat(100);
            const questions = new Map([[0, { text: longQuestion, lines: [0] }]]);
            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapContent(['Short line'], 40, 1)}
                    wrappedQuestions={wrapFeedback(questions, 'question', 40, 1)}
                />,
                40,
            );

            expect(normalizeSnapshot(lastFrame()!)).toMatchSnapshot();
        });
    });

    describe('Layout Invariants', () => {
        test('snapshot: maintains proper content rendering', () => {
            ALL_WIDTHS.forEach((width) => {
                const { lastFrame } = render(<Plan {...basicProps} />, width);
                const output = lastFrame()!;

                expect(normalizeSnapshot(output)).toMatchSnapshot();

                const stripped = stripAnsi(output);
                const lines = stripped.split('\n');
                const maxLength = Math.max(...lines.map((l) => l.length));
                expect(maxLength).toBeLessThanOrEqual(width);

                expect(output).toContain('line 1');
            });
        });
    });

    describe('Small Plan (Smaller than Viewport)', () => {
        test('snapshot: 3-line plan in 24-line viewport at 80 columns', () => {
            const { lastFrame } = render(
                <Plan {...basicProps} visibleLines={wrapContent(SNAPSHOT_FIXTURES.small.lines, 80, 1)} />,
                TERMINAL_WIDTHS.STANDARD,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: 3-line plan in 24-line viewport at 40 columns', () => {
            const { lastFrame } = render(
                <Plan {...basicProps} visibleLines={wrapContent(SNAPSHOT_FIXTURES.small.lines, 40, 1)} />,
                TERMINAL_WIDTHS.NARROW,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });
    });

    describe('Markdown Rendering', () => {
        testAtAllWidths('renders markdown with bold, italic, and code blocks', (width) => {
            const { lastFrame } = render(
                <Plan {...basicProps} visibleLines={wrapMarkdownContent(SNAPSHOT_FIXTURES.markdown.lines, width, 1)} />,
                width,
            );
            return normalizeSnapshot(lastFrame());
        });
    });

    describe('Code Block Blank Lines', () => {
        test('snapshot: code block with blank lines (single space per blank line)', () => {
            const lines = ['Before', '```python', 'def test():', '    x = 1', '', '    y = 2', '```', 'After'];

            const { lastFrame } = render(
                <Plan {...basicProps} visibleLines={wrapMarkdownContent(lines, 80, 1)} cursorLine={4} />,
            );
            const output = lastFrame();

            // Verify blank line rendering (snapshot captures the exact behavior)
            expect(normalizeSnapshot(output)).toMatchSnapshot();
        });
    });

    describe('Code Block Deletion Styling', () => {
        test('snapshot: deleted multi-line code block (no syntax highlighting)', () => {
            const lines = [
                'Before code block',
                '```typescript',
                'function hello() {',
                '  return "world";',
                '}',
                '```',
                'After code block',
            ];
            const deletedLines = new Set([1, 2, 3, 4, 5]); // Delete entire code block

            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapMarkdownContent(lines, 80, 1)}
                    cursorLine={2}
                    deletedLines={deletedLines}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: deleted line with inline code', () => {
            const lines = ['Regular line', 'This line has `inline code` in it', 'Another line'];
            const deletedLines = new Set([1]); // Delete line with inline code

            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapMarkdownContent(lines, 80, 1)}
                    cursorLine={1}
                    deletedLines={deletedLines}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });

        test('snapshot: partial code block deletion (only some lines deleted)', () => {
            const lines = ['```typescript', 'const x = 1;', 'const y = 2;', 'const z = 3;', '```'];
            const deletedLines = new Set([2]); // Delete middle line only

            const { lastFrame } = render(
                <Plan
                    {...basicProps}
                    visibleLines={wrapMarkdownContent(lines, 80, 1)}
                    cursorLine={2}
                    deletedLines={deletedLines}
                />,
            );
            expect(normalizeSnapshot(lastFrame())).toMatchSnapshot();
        });
    });
});
