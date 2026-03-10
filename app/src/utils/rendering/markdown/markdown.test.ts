import { describe, expect, test } from 'bun:test';

import { COLORS } from '~/utils/config/constants';

import { getHeadingColor, parseMarkdownLine } from './markdown';

describe('markdown markdown', () => {
    describe('edge cases', () => {
        test('handles empty line', () => {
            const result = parseMarkdownLine('');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: '' }],
            });
        });

        test('handles unclosed markdown as literal text', () => {
            const result = parseMarkdownLine('**unclosed bold');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: '**unclosed bold' }],
            });
        });
    });

    describe('inline formatting', () => {
        test('parses plain text with no formatting', () => {
            const result = parseMarkdownLine('plain text');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'plain text' }],
            });
        });

        test.each([
            ['**', '**bold**'],
            ['__', '__bold__'],
        ])('parses bold with %s', (_, input) => {
            const result = parseMarkdownLine(input);
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'bold', bold: true }],
            });
        });

        test.each([
            ['*', '*italic*'],
            ['_', '_italic_'],
        ])('parses italic with %s', (_, input) => {
            const result = parseMarkdownLine(input);
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'italic', italic: true }],
            });
        });

        test('parses inline code with backticks', () => {
            const result = parseMarkdownLine('Use `code` here');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'Use ' }, { text: 'code', code: true }, { text: ' here' }],
            });
        });

        test('parses strikethrough with ~~', () => {
            const result = parseMarkdownLine('~~strikethrough~~');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'strikethrough', strikethrough: true }],
            });
        });

        test('parses links [text](url)', () => {
            const result = parseMarkdownLine('[link text](https://example.com)');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'link text', link: { text: 'link text', url: 'https://example.com' } }],
            });
        });

        test.each([
            ['without language', '```'],
            ['with language', '```javascript'],
        ])('triple backticks %s are NOT inline code (code block marker)', (_, input) => {
            const result = parseMarkdownLine(input);
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: input }],
            });
        });

        test('empty inline code (two backticks) renders as literal', () => {
            const result = parseMarkdownLine('Empty `` code');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'Empty `` code' }],
            });
        });

        test('inline code with escaped backticks using ``', () => {
            const result = parseMarkdownLine('`Code with ``escaped`` backticks`');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'Code with `escaped` backticks', code: true }],
            });
        });

        test('inline code with single escaped backtick', () => {
            const result = parseMarkdownLine('Use `git commit -m ``message``` for commits');
            expect(result).toEqual({
                type: 'normal',
                segments: [{ text: 'Use ' }, { text: 'git commit -m `message`', code: true }, { text: ' for commits' }],
            });
        });
    });

    describe('multiple inline formats', () => {
        test('parses multiple formats in one line', () => {
            const result = parseMarkdownLine('Text with **bold** and *italic* and `code`');
            expect(result).toEqual({
                type: 'normal',
                segments: [
                    { text: 'Text with ' },
                    { text: 'bold', bold: true },
                    { text: ' and ' },
                    { text: 'italic', italic: true },
                    { text: ' and ' },
                    { text: 'code', code: true },
                ],
            });
        });
    });

    describe('nested formatting', () => {
        test('parses italic with bold inside: *Italic **BOLD** Italic*', () => {
            const result = parseMarkdownLine('*Italic **BOLD** Italic*');
            expect(result).toEqual({
                type: 'normal',
                segments: [
                    { text: 'Italic ', italic: true },
                    { text: 'BOLD', italic: true, bold: true },
                    { text: ' Italic', italic: true },
                ],
            });
        });

        test('parses bold with italic inside: **Bold *ITALIC* Bold**', () => {
            const result = parseMarkdownLine('**Bold *ITALIC* Bold**');
            expect(result).toEqual({
                type: 'normal',
                segments: [
                    { text: 'Bold ', bold: true },
                    { text: 'ITALIC', bold: true, italic: true },
                    { text: ' Bold', bold: true },
                ],
            });
        });
    });

    describe('block-level elements', () => {
        test.each([
            [1, '# Heading 1'],
            [2, '## Heading 2'],
            [3, '### Heading 3'],
            [4, '#### Heading 4'],
            [5, '##### Heading 5'],
            [6, '###### Heading 6'],
        ])('parses H%i heading', (level, input) => {
            const result = parseMarkdownLine(input);
            expect(result).toEqual({
                type: 'heading',
                headingLevel: level as 1 | 2 | 3 | 4 | 5 | 6,
                segments: [{ text: `Heading ${level}` }],
            });
        });

        test('parses heading with inline formatting', () => {
            const result = parseMarkdownLine('## Heading with **bold**');
            expect(result).toEqual({
                type: 'heading',
                headingLevel: 2,
                segments: [{ text: 'Heading with ' }, { text: 'bold', bold: true }],
            });
        });

        test('parses blockquote with > prefix', () => {
            const result = parseMarkdownLine('> Quote text');
            expect(result).toEqual({
                type: 'blockquote',
                blockquoteDepth: 1,
                segments: [{ text: 'Quote text' }],
            });
        });

        test('parses blockquote with inline formatting', () => {
            const result = parseMarkdownLine('> Quote with *italic*');
            expect(result).toEqual({
                type: 'blockquote',
                blockquoteDepth: 1,
                segments: [{ text: 'Quote with ' }, { text: 'italic', italic: true }],
            });
        });

        describe('nested blockquotes', () => {
            test.each([
                [1, '> Level 1'],
                [2, '>> Level 2'],
                [3, '>>> Level 3'],
                [4, '>>>> Level 4'],
                [5, '>>>>> Level 5'],
            ])('parses depth %i blockquote', (depth, input) => {
                const result = parseMarkdownLine(input);
                expect(result).toEqual({
                    type: 'blockquote',
                    blockquoteDepth: depth as 1 | 2 | 3 | 4 | 5,
                    segments: [{ text: `Level ${depth}` }],
                });
            });

            test('treats 6+ markers as normal text', () => {
                const result = parseMarkdownLine('>>>>>> Six markers');
                expect(result).toEqual({
                    type: 'normal',
                    segments: [{ text: '>>>>>> Six markers' }],
                });
            });

            test('requires space after markers', () => {
                const result = parseMarkdownLine('>>no space');
                expect(result).toEqual({
                    type: 'normal',
                    segments: [{ text: '>>no space' }],
                });
            });

            test('parses empty blockquote', () => {
                const result = parseMarkdownLine('>>> ');
                expect(result).toEqual({
                    type: 'blockquote',
                    blockquoteDepth: 3,
                    segments: [{ text: '' }],
                });
            });

            test('preserves inline formatting in nested blockquotes', () => {
                const result = parseMarkdownLine('>>> Nested with **bold** and *italic*');
                expect(result).toEqual({
                    type: 'blockquote',
                    blockquoteDepth: 3,
                    segments: [
                        { text: 'Nested with ' },
                        { text: 'bold', bold: true },
                        { text: ' and ' },
                        { text: 'italic', italic: true },
                    ],
                });
            });

            test('defaults to depth 1 for single marker (backward compatibility)', () => {
                const result = parseMarkdownLine('> Single level');
                expect(result).toEqual({
                    type: 'blockquote',
                    blockquoteDepth: 1,
                    segments: [{ text: 'Single level' }],
                });
            });

            test('handles level jumping', () => {
                const result1 = parseMarkdownLine('> Level 1');
                const result2 = parseMarkdownLine('>>> Level 3');

                expect(result1.type).toBe('blockquote');
                expect((result1 as any).blockquoteDepth).toBe(1);

                expect(result2.type).toBe('blockquote');
                expect((result2 as any).blockquoteDepth).toBe(3);
            });
        });

        test.each([['---'], ['***'], ['___']])('parses %s as horizontal rule', (input) => {
            const result = parseMarkdownLine(input);
            expect(result).toEqual({
                type: 'hr',
                segments: [],
            });
        });
    });

    describe('getHeadingColor', () => {
        test('returns H1_COLOR for level 1', () => {
            expect(getHeadingColor(1)).toBe(COLORS.H1_COLOR);
        });

        test.each([2, 3, 4, 5, 6])('returns undefined for level %i', (level) => {
            expect(getHeadingColor(level)).toBeUndefined();
        });
    });
});
