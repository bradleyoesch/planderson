import { describe, expect, test } from 'bun:test';

import { ANSI } from '~/test-utils/ansi-assertions';
import { wrapContent } from '~/test-utils/line-wrapping-helpers';

import {
    countInputVisualLines,
    countTerminalLinesInRange,
    wrapContentWithFormatting,
    wrapFeedback,
    wrapLine,
    wrapLineSegments,
    wrapParsedLine,
} from './line-wrapping';
import type { LineFormatting } from './markdown/markdown';
import { parseMarkdownLine } from './markdown/markdown';

// Test data helpers
const EMOJI_CHAR = '🎉';
const CJK_CHAR = '古';
const createRepeatedText = (char: string, count: number) => char.repeat(count);
const createLongLine = (length: number) => 'A'.repeat(length);

describe('rendering line-wrapping', () => {
    describe('wrapLine', () => {
        test('handles short, exact, and wrapped lines', () => {
            // Short line - no wrap
            expect(wrapLine('short', 80)).toEqual([{ content: 'short', segmentIndex: 0 }]);

            // Exact boundary - no wrap
            const exactLine = createLongLine(50);
            expect(wrapLine(exactLine, 50)).toHaveLength(1);

            // Exceeds boundary - wraps
            const longLine = createLongLine(100);
            const wrapped = wrapLine(longLine, 50);
            expect(wrapped).toHaveLength(2);
            expect(wrapped[0].content).toBe(createLongLine(50));
            expect(wrapped[1].content).toBe(createLongLine(50));
        });

        test('handles wide characters (emoji and CJK)', () => {
            // Emoji - 10 emoji = width 20, wrap at 15
            const emojiLine = createRepeatedText(EMOJI_CHAR, 10);
            const emojiResult = wrapLine(emojiLine, 15);
            expect(emojiResult).toHaveLength(2);
            expect(emojiResult[0].content).toBe(createRepeatedText(EMOJI_CHAR, 7)); // width 14
            expect(emojiResult[1].content).toBe(createRepeatedText(EMOJI_CHAR, 3)); // width 6

            // CJK - 10 chars = width 20, wrap at 15
            const cjkLine = createRepeatedText(CJK_CHAR, 10);
            const cjkResult = wrapLine(cjkLine, 15);
            expect(cjkResult).toHaveLength(2);
            expect(cjkResult[0].content).toBe(createRepeatedText(CJK_CHAR, 7));
            expect(cjkResult[1].content).toBe(createRepeatedText(CJK_CHAR, 3));

            // Mixed ASCII and emoji
            const mixedLine = 'Hello 🎉 World 🌍 Test';
            expect(wrapLine(mixedLine, 15).length).toBeGreaterThan(1);
        });

        test('handles ANSI codes (zero width)', () => {
            const styledLine = `\x1b[1m${createLongLine(60)}\x1b[22m`;
            const result = wrapLine(styledLine, 50);

            expect(result).toHaveLength(2);
            expect(result[0].content).toContain(ANSI.BOLD);
            const totalACount = result.reduce((sum, seg) => sum + (seg.content.match(/A/g) || []).length, 0);
            expect(totalACount).toBe(60);
        });

        test('empty line returns single empty segment', () => {
            expect(wrapLine('', 80)).toEqual([{ content: '', segmentIndex: 0 }]);
        });

        test('splits on newline characters as hard line breaks', () => {
            const result = wrapLine('hello\nworld', 80);
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('hello');
            expect(result[1].content).toBe('world');
        });

        test('handles trailing newline', () => {
            const result = wrapLine('hello\n', 80);
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('hello');
            expect(result[1].content).toBe('');
        });

        test('handles consecutive newlines', () => {
            const result = wrapLine('a\n\nb', 80);
            expect(result).toHaveLength(3);
            expect(result[1].content).toBe('');
        });

        test('wraps each newline-separated part independently', () => {
            // "hello" fits, "this is a long line" wraps at width 10
            const result = wrapLine('hello\nthis is a long line', 10);
            expect(result[0].content).toBe('hello');
            expect(result.length).toBeGreaterThan(2);
        });
    });

    describe('wrapContent', () => {
        test('builds lines array with metadata', () => {
            const lines = ['first', 'second', 'third'];
            const result = wrapContent(lines, 80, 0);

            expect(result).toHaveLength(3);
            expect(result[0]).toMatchObject({
                originalContent: 'first',
                planLineIndex: 0,
                renderedLineCount: 1,
            });
            expect(result[1]).toMatchObject({
                originalContent: 'second',
                planLineIndex: 1,
            });
            expect(result[2]).toMatchObject({
                originalContent: 'third',
                planLineIndex: 2,
            });
        });

        test('handles padding width calculations', () => {
            const line = createLongLine(50);

            // Padding allows exact fit: 60 - (5 * 2) = 50
            expect(wrapContent([line], 60, 5)[0].renderedLineCount).toBe(1);

            // Padding causes wrap: 55 - (5 * 2) = 45, need 2 lines for 50 chars
            expect(wrapContent([line], 55, 5)[0].renderedLineCount).toBe(2);
        });

        test('handles empty content', () => {
            expect(wrapContent([], 80, 0)).toHaveLength(0);
        });
    });

    describe('countTerminalLinesInRange', () => {
        test('counts terminal lines across various ranges', () => {
            const lines = ['short', createLongLine(100), 'medium', createLongLine(150)];
            const wrappedLines = wrapContent(lines, 50, 0);

            // Single line (wraps to 2)
            expect(countTerminalLinesInRange(wrappedLines, 1, 1)).toBe(2);

            // Range 1-2: 100 A's (2 lines) + 'medium' (1 line) = 3
            expect(countTerminalLinesInRange(wrappedLines, 1, 2)).toBe(3);

            // All lines: 1 + 2 + 1 + 3 = 7
            expect(countTerminalLinesInRange(wrappedLines, 0, 3)).toBe(7);

            // Simple inclusive range
            expect(countTerminalLinesInRange(wrapContent(['a', 'b', 'c'], 80, 0), 1, 2)).toBe(2);

            // Empty range (start > end)
            expect(countTerminalLinesInRange(wrappedLines, 2, 1)).toBe(0);
        });
    });

    describe('wrapFeedback', () => {
        test('wraps feedback with correct metadata', () => {
            const feedback = new Map([
                [0, { text: 'Short comment', lines: [0] }],
                [2, { text: createLongLine(100), lines: [2] }],
                [5, { text: 'Another', lines: [5] }],
            ]);
            const result = wrapFeedback(feedback, 'comment', 50, 1);

            // Short feedback - single segment
            expect(result[0]).toMatchObject({
                lineIndex: 0,
                text: 'Short comment',
                type: 'comment',
                prefix: '💬\u00A0',
            });
            expect(result[0].segments).toHaveLength(1);
            expect(result[0].segments[0].content).toBe('Short comment');

            // Long feedback - multiple segments
            expect(result[1].lineIndex).toBe(2);
            expect(result[1].segments.length).toBeGreaterThan(1);

            // Third item
            expect(result[2].lineIndex).toBe(5);
        });

        test('accounts for emoji prefix width when wrapping', () => {
            // Width 40 - padding 2 = 38 effective
            // '💬\u00A0' (width 3) + 73 A's char-wraps at 38 visual:
            // segment 0: '💬\u00A0' + 35 A's (width 38), segment 1: 38 A's → 2 total segments
            const text = createLongLine(73);
            const result = wrapFeedback(new Map([[0, { text, lines: [0] }]]), 'comment', 40, 1);

            expect(result[0].segments).toHaveLength(2);
            // prefix (width 3) occupies first 3 visual cols, so segment 0 gets 35 A's
            expect(result[0].segments[0].content).toHaveLength(35);
            expect(result[0].segments[1].content).toHaveLength(38); // 73 - 35 = 38 A's
        });

        test('handles wide characters in feedback', () => {
            // 30 emoji + 30 CJK = 120 display width, should wrap at width 50
            const wideText = createRepeatedText(EMOJI_CHAR, 30) + createRepeatedText(CJK_CHAR, 30);
            const result = wrapFeedback(new Map([[0, { text: wideText, lines: [0] }]]), 'comment', 50, 1);

            expect(result[0].segments.length).toBeGreaterThan(1);
        });

        test('sets correct prefix for each type', () => {
            const comment = wrapFeedback(new Map([[0, { text: 'Test', lines: [0] }]]), 'comment', 80, 1)[0];
            const question = wrapFeedback(new Map([[0, { text: 'Test', lines: [0] }]]), 'question', 80, 1)[0];
            expect(comment.prefix).toBe('💬\u00A0');
            expect(question.prefix).toBe('❔\u00A0');
        });

        test('accounts for question prefix visual width (❔ is width 2, .length 1)', () => {
            // ❔ has .length === 1 (BMP) but stringWidth === 2, so '❔\u00A0' is still width 3
            // Same wrapping behavior as '💬\u00A0': segment 0 gets 35 A's, segment 1 gets 38
            const text = createLongLine(73);
            const result = wrapFeedback(new Map([[0, { text, lines: [0] }]]), 'question', 40, 1);

            expect(result[0].segments).toHaveLength(2);
            expect(result[0].segments[0].content).toHaveLength(35);
            expect(result[0].segments[1].content).toHaveLength(38);
        });

        test('preserves feedback type and handles empty map', () => {
            expect(wrapFeedback(new Map([[0, { text: 'Test', lines: [0] }]]), 'comment', 80, 1)[0].type).toBe(
                'comment',
            );
            expect(wrapFeedback(new Map([[0, { text: 'Test', lines: [0] }]]), 'question', 80, 1)[0].type).toBe(
                'question',
            );
            expect(wrapFeedback(new Map(), 'comment', 80, 1)).toHaveLength(0);
        });
    });

    describe('wrapParsedLine - code blocks', () => {
        test('wraps code and preserves formatting', () => {
            const codeMetadata = { blockIndex: 0, lineInBlock: 1, totalLinesInBlock: 3 };

            // Long code wraps
            const longCode: LineFormatting = {
                type: 'code',
                segments: [{ text: 'const veryLongVariableName = "very long string value";', code: true }],
                codeMetadata,
            };
            const wrappedResult = wrapParsedLine(longCode, 30);
            expect(wrappedResult.renderedLineCount).toBeGreaterThan(1);
            expect(wrappedResult.formattedSegments!.length).toBeGreaterThan(1);

            // Preserves leading whitespace
            const indentedCode: LineFormatting = {
                type: 'code',
                segments: [{ text: '    function foo() {', code: true }],
                codeMetadata,
            };
            expect(wrapParsedLine(indentedCode, 80).originalContent).toStartWith('    ');

            // Preserves syntax highlighting
            const coloredCode: LineFormatting = {
                type: 'code',
                segments: [
                    { text: 'const ', code: true, color: '#569cd6' },
                    { text: 'veryLongName', code: true, color: '#9cdcfe' },
                    { text: ' = "value";', code: true },
                ],
                codeMetadata,
            };
            const coloredResult = wrapParsedLine(coloredCode, 15);
            expect(coloredResult.renderedLineCount).toBeGreaterThan(1);
            expect(coloredResult.formattedSegments![0].segments[0].color).toBe('#569cd6');
        });
    });

    describe('wrapLineSegments', () => {
        test('wraps segments with correct indices', () => {
            // Short text - no wrap
            const shortFormatting: LineFormatting = {
                type: 'normal',
                segments: [{ text: 'short' }],
            };
            const shortResult = wrapLineSegments(shortFormatting, 80);
            expect(shortResult).toHaveLength(1);
            expect(shortResult[0]).toMatchObject({
                segments: [{ text: 'short' }],
                segmentIndex: 0,
            });

            // Long text - wraps
            const longFormatting: LineFormatting = {
                type: 'normal',
                segments: [{ text: createLongLine(100) }],
            };
            const longResult = wrapLineSegments(longFormatting, 50);
            expect(longResult).toHaveLength(2);
            expect(longResult[0].segments).toEqual([{ text: createLongLine(50) }]);
            expect(longResult[1].segments).toEqual([{ text: createLongLine(50) }]);

            // Empty text
            expect(wrapLineSegments({ type: 'normal', segments: [{ text: '' }] }, 80)[0].segments).toEqual([
                { text: '' },
            ]);
        });

        test('preserves formatting attributes when wrapping', () => {
            // Single segment with bold
            const boldFormatting: LineFormatting = {
                type: 'normal',
                segments: [{ text: createLongLine(100), bold: true }],
            };
            const boldResult = wrapLineSegments(boldFormatting, 50);
            expect(boldResult).toHaveLength(2);
            expect(boldResult[0].segments).toEqual([{ text: createLongLine(50), bold: true }]);
            expect(boldResult[1].segments).toEqual([{ text: createLongLine(50), bold: true }]);

            // Multiple segments - splits across wrap boundary
            const multiFormatting: LineFormatting = {
                type: 'normal',
                segments: [{ text: createLongLine(45) }, { text: createLongLine(45), bold: true }],
            };
            const multiResult = wrapLineSegments(multiFormatting, 50);
            expect(multiResult).toHaveLength(2);
            expect(multiResult[0].segments).toEqual([
                { text: createLongLine(45) },
                { text: createLongLine(5), bold: true },
            ]);
            expect(multiResult[1].segments).toEqual([{ text: createLongLine(40), bold: true }]);
        });
    });

    describe('wrapContentWithFormatting', () => {
        test('converts LineFormatting[] into LineMetadata[]', () => {
            const formatting: LineFormatting[] = [
                { type: 'normal', segments: [{ text: 'line1' }] },
                { type: 'heading', headingLevel: 1, segments: [{ text: 'Heading' }] },
                { type: 'blockquote', segments: [{ text: 'Quote' }] },
                { type: 'hr', segments: [] },
            ];
            const result = wrapContentWithFormatting(formatting, 80, 0);

            expect(result).toHaveLength(4);
            expect(result[0]).toMatchObject({
                planLineIndex: 0,
                originalContent: 'line1',
                formatting: formatting[0],
            });
            expect(result[1].formatting).toMatchObject({ type: 'heading', headingLevel: 1 });
            expect(result[2].formatting?.type).toBe('blockquote');
            expect(result[3].formatting?.type).toBe('hr');
            expect(result[3].segments).toHaveLength(1);
        });

        test('blockquote width adjustment for prefix', () => {
            const padding = 1;

            // Long blockquote wraps (78 chars with "│ " prefix needs wrapping at width 80)
            const longText = createLongLine(78);
            const longQuote = wrapContentWithFormatting([parseMarkdownLine(`> ${longText}`)], 80, padding);
            expect(longQuote[0].formatting?.type).toBe('blockquote');
            expect(longQuote[0].formattedSegments!.length).toBeGreaterThan(1);

            // Short blockquote fits
            const shortQuote = wrapContentWithFormatting([parseMarkdownLine('> Short quote')], 80, padding);
            expect(shortQuote[0].formattedSegments!.length).toBe(1);

            // Wide characters in blockquote
            const emojiText = createRepeatedText(EMOJI_CHAR, 40); // 80 display width
            const emojiQuote = wrapContentWithFormatting([parseMarkdownLine(`> ${emojiText}`)], 80, padding);
            expect(emojiQuote[0].formattedSegments!.length).toBeGreaterThan(1);

            // Normal text not affected by blockquote adjustment
            const normalText = createLongLine(78);
            const normalLine = wrapContentWithFormatting([parseMarkdownLine(normalText)], 80, padding);
            expect(normalLine[0].formatting?.type).toBe('normal');
            expect(normalLine[0].formattedSegments!.length).toBe(1);
        });
    });

    describe('countInputVisualLines', () => {
        test('returns 1 for empty text', () => {
            expect(countInputVisualLines('', 0, 10)).toBe(1);
        });

        test('returns 1 when cursor is at end but segment does not fill width', () => {
            // "hello" = 5 chars, maxWidth=10, cursor at 5 (end) → no overflow
            expect(countInputVisualLines('hello', 5, 10)).toBe(1);
        });

        test('returns 2 when cursor is at end of segment that exactly fills width', () => {
            // "hello" = 5 chars fills maxWidth=5 exactly, cursor at 5 → overflow
            expect(countInputVisualLines('hello', 5, 5)).toBe(2);
        });

        test('returns 1 when cursor is on a character (not at end of segment)', () => {
            // "hello" at maxWidth=5, cursor at 3 (on 'l') → no overflow
            expect(countInputVisualLines('hello', 3, 5)).toBe(1);
        });

        test('returns count+1 when cursor overflows at end of last wrapped segment', () => {
            // "hello world" at maxWidth=5 → ["hello", "world"] (2 segments)
            // cursor at 11 (end of "world" which fills 5) → overflow → 3
            expect(countInputVisualLines('hello world', 11, 5)).toBe(3);
        });

        test('returns segment count without overflow when last segment does not fill width', () => {
            // "hello world" at maxWidth=10 → ["hello ", "world"] (2 segments)
            // cursor at 11 (end of "world" which is 5 < 10) → no overflow → 2
            expect(countInputVisualLines('hello world', 11, 10)).toBe(2);
        });
    });

    describe('nested blockquotes', () => {
        test.each([
            [1, 76], // 78 - (1 * 2)
            [2, 74], // 78 - (2 * 2)
            [3, 72], // 78 - (3 * 2)
            [4, 70], // 78 - (4 * 2)
            [5, 68], // 78 - (5 * 2)
        ])('adjusts width for depth %i (%i chars available)', (depth, expectedWidth) => {
            const terminalWidth = 80;
            const padding = 1;
            const markers = '>'.repeat(depth);
            const longText = 'A'.repeat(100);

            const formatting = parseMarkdownLine(`${markers} ${longText}`);
            const wrapped = wrapContentWithFormatting([formatting], terminalWidth, padding);

            const firstLineContent = wrapped[0].formattedSegments![0].segments.map((s) => s.text).join('');
            expect(firstLineContent.length).toBe(expectedWidth);
        });

        test('handles level jumping', () => {
            const terminalWidth = 80;
            const padding = 1;

            const depth1 = parseMarkdownLine(`> ${'A'.repeat(100)}`);
            const depth3 = parseMarkdownLine(`>>> ${'B'.repeat(100)}`);

            const wrapped1 = wrapContentWithFormatting([depth1], terminalWidth, padding);
            const wrapped3 = wrapContentWithFormatting([depth3], terminalWidth, padding);

            const line1Content = wrapped1[0].formattedSegments![0].segments.map((s) => s.text).join('');
            const line3Content = wrapped3[0].formattedSegments![0].segments.map((s) => s.text).join('');

            expect(line1Content.length).toBe(76); // 78 - 2
            expect(line3Content.length).toBe(72); // 78 - 6
        });

        test('defaults to depth 1 when blockquoteDepth is missing', () => {
            const terminalWidth = 80;
            const padding = 1;
            const longText = 'A'.repeat(100);

            const formatting = parseMarkdownLine(`> ${longText}`);
            const wrapped = wrapContentWithFormatting([formatting], terminalWidth, padding);

            const firstLineContent = wrapped[0].formattedSegments![0].segments.map((s) => s.text).join('');
            expect(firstLineContent.length).toBe(76); // 78 - 2 (depth 1 default)
        });

        test('wraps long nested blockquote across multiple lines', () => {
            const terminalWidth = 80;
            const padding = 1;
            const longText = 'Word '.repeat(50);

            const formatting = parseMarkdownLine(`>>> ${longText}`);
            const wrapped = wrapContentWithFormatting([formatting], terminalWidth, padding);

            expect(wrapped[0].formattedSegments!.length).toBeGreaterThan(1);

            // Each wrapped line should respect depth 3 width (72 chars)
            wrapped[0].formattedSegments!.forEach((segment) => {
                const lineContent = segment.segments.map((s) => s.text).join('');
                expect(lineContent.length).toBeLessThanOrEqual(72);
            });
        });

        test('preserves inline formatting in nested blockquotes', () => {
            const terminalWidth = 80;
            const padding = 1;

            const formatting = parseMarkdownLine('>>> Text with **bold** and *italic*');
            const wrapped = wrapContentWithFormatting([formatting], terminalWidth, padding);

            expect(wrapped[0].formatting?.type).toBe('blockquote');
            expect(wrapped[0].formatting?.blockquoteDepth).toBe(3);

            // Check that inline formatting is preserved
            const segments = wrapped[0].formattedSegments![0].segments;
            expect(segments.some((s) => s.bold)).toBe(true);
            expect(segments.some((s) => s.italic)).toBe(true);
        });
    });

    describe('word wrapping', () => {
        describe('wrapLine word-wrap behavior', () => {
            test('breaks at space: trailing space stays on first line, next word starts new line', () => {
                // "Hello world" at width 7 — "Hello " fits (6), "w" would make 7 but the space is a break char
                // actual break: "Hello " / "world"
                const result = wrapLine('Hello world', 7);

                expect(result).toHaveLength(2);
                expect(result[0].content).toBe('Hello ');
                expect(result[1].content).toBe('world');
            });

            test('breaks at punctuation: break char stays on first line', () => {
                // "Hello,world" at width 6 → "Hello," / "world"
                const result = wrapLine('Hello,world', 6);

                expect(result).toHaveLength(2);
                expect(result[0].content).toBe('Hello,');
                expect(result[1].content).toBe('world');
            });

            test('breaks at hyphen: hyphen stays on first line', () => {
                // "long-word" at width 5 → "long-" / "word"
                const result = wrapLine('long-word', 5);

                expect(result).toHaveLength(2);
                expect(result[0].content).toBe('long-');
                expect(result[1].content).toBe('word');
            });

            test('char-wrap fallback when no break char found in line', () => {
                // "aaaaaaa" at width 5 → "aaaaa" / "aa"
                const result = wrapLine('aaaaaaa', 5);

                expect(result).toHaveLength(2);
                expect(result[0].content).toBe('aaaaa');
                expect(result[1].content).toBe('aa');
            });

            test('discards overflow space: space that causes overflow is dropped', () => {
                // "This is a" at width 7 → ["This is", "a"] (the space before "a" is dropped)
                const result = wrapLine('This is a', 7);

                const texts = result.map((r) => r.content);
                expect(texts[0]).toBe('This is');
                expect(texts[1]).toBe('a');
            });

            test('breaks multiple times across a long sentence', () => {
                // "alpha beta gamma" at width 10
                // "alpha beta" = 10, then space causes a wrap (discarded), then "gamma"
                const result = wrapLine('alpha beta gamma', 10);

                expect(result).toHaveLength(2);
                expect(result[0].content).toBe('alpha beta');
                expect(result[1].content).toBe('gamma');
            });
        });

        describe('wrapLineSegments word-wrap behavior', () => {
            test('word-wraps normal text across segments', () => {
                // Two segments: "Hello " + "world!" at width 7
                // Should wrap between "Hello " and "world!"
                const formatting: LineFormatting = {
                    type: 'normal',
                    segments: [{ text: 'Hello ' }, { text: 'world!' }],
                };
                const result = wrapLineSegments(formatting, 7);

                expect(result).toHaveLength(2);
                const line1Text = result[0].segments.map((s) => s.text).join('');
                const line2Text = result[1].segments.map((s) => s.text).join('');
                expect(line1Text).toBe('Hello ');
                expect(line2Text).toBe('world!');
            });

            test('preserves formatting when splitting across word boundary', () => {
                // Bold segment "Hello " + italic "world" at width 7
                const formatting: LineFormatting = {
                    type: 'normal',
                    segments: [
                        { text: 'Hello ', bold: true },
                        { text: 'world', italic: true },
                    ],
                };
                const result = wrapLineSegments(formatting, 7);

                expect(result).toHaveLength(2);
                expect(result[0].segments[0].bold).toBe(true);
                expect(result[1].segments[0].italic).toBe(true);
            });
        });

        describe('wrapParsedLine code block still uses char-wrap', () => {
            test('code block wraps at char boundary, not word boundary', () => {
                // Code "aaaa bbbb" at width 6 should char-wrap, not word-wrap
                // With char-wrap: "aaaa b" / "bbb"
                // With word-wrap: "aaaa " / "bbbb"
                const codeFormatting: LineFormatting = {
                    type: 'code',
                    segments: [{ text: 'aaaa bbbb', code: true }],
                    codeMetadata: { blockIndex: 0, lineInBlock: 0, totalLinesInBlock: 1 },
                };
                const result = wrapParsedLine(codeFormatting, 6);

                expect(result.renderedLineCount).toBeGreaterThan(1);
                // First line should be exactly 6 chars (char-wrap)
                const firstLineText = result.formattedSegments![0].segments.map((s) => s.text).join('');
                expect(firstLineText).toBe('aaaa b');
            });
        });
    });
});
