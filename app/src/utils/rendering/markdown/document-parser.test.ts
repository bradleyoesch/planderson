import { describe, expect, test } from 'bun:test';

import { parseMarkdownDocument } from './document-parser';

describe('markdown document-parser', () => {
    describe('parseMarkdownDocument', () => {
        test('handles empty content', () => {
            const result = parseMarkdownDocument('');

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('normal');
        });

        describe('code block structure', () => {
            test('parses code block with language tag and validates structure', () => {
                const content = '```typescript\nconst x = 1;\n```';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(3); // Opening, content, closing
                expect(result[0].type).toBe('code');
                expect(result[0].codeMetadata?.isOpening).toBe(true);
                expect(result[0].codeMetadata?.language).toBe('typescript');
                expect(result[1].type).toBe('code');
                const codeText = result[1].segments.map((s) => s.text).join('');
                expect(codeText).toContain('x');
                expect(result[2].type).toBe('code');
                expect(result[2].codeMetadata?.isClosing).toBe(true);
            });

            test('parses code block without language tag', () => {
                const content = '```\nplain code\n```';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(3);
                expect(result[0].codeMetadata?.language).toBeUndefined();
                expect(result[1].segments[0].text).toBe('plain code');
            });

            test('parses multi-line code block with blank lines', () => {
                const content = '```python\ndef hello():\n\n    print("world")\n```';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(5); // Opening, 3 lines (including blank), closing
                expect(result[0].codeMetadata?.isOpening).toBe(true);
                expect(result[1].type).toBe('code');
                expect(result[2].type).toBe('code');
                expect(result[2].segments[0].text).toBe(''); // Blank line preserved
                expect(result[3].type).toBe('code');
                expect(result[4].codeMetadata?.isClosing).toBe(true);
            });
        });

        describe('code block metadata', () => {
            test('validates complete metadata for multi-line block', () => {
                const content = '```js\nline1\nline2\n```';
                const result = parseMarkdownDocument(content);

                const totalLines = 4; // Opening, line1, line2, closing

                // All lines share same blockIndex and totalLinesInBlock
                result.forEach((line) => {
                    expect(line.codeMetadata?.blockIndex).toBe(0);
                    expect(line.codeMetadata?.totalLinesInBlock).toBe(totalLines);
                });

                // lineInBlock increments correctly
                expect(result[0].codeMetadata?.lineInBlock).toBe(0);
                expect(result[1].codeMetadata?.lineInBlock).toBe(1);
                expect(result[2].codeMetadata?.lineInBlock).toBe(2);
                expect(result[3].codeMetadata?.lineInBlock).toBe(3);

                // Only opening and closing have their respective flags
                expect(result[0].codeMetadata?.isOpening).toBe(true);
                expect(result[3].codeMetadata?.isClosing).toBe(true);
                expect(result[1].codeMetadata?.isOpening).toBeUndefined();
                expect(result[1].codeMetadata?.isClosing).toBeUndefined();
            });

            test('assigns different blockIndex to multiple code blocks', () => {
                const content = '```js\ncode1\n```\ntext\n```py\ncode2\n```';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(7);

                // First block: blockIndex = 0
                expect(result[0].codeMetadata?.blockIndex).toBe(0);
                expect(result[1].codeMetadata?.blockIndex).toBe(0);
                expect(result[2].codeMetadata?.blockIndex).toBe(0);

                // Second block: blockIndex = 1
                expect(result[4].codeMetadata?.blockIndex).toBe(1);
                expect(result[5].codeMetadata?.blockIndex).toBe(1);
                expect(result[6].codeMetadata?.blockIndex).toBe(1);
            });
        });

        describe('mixed content', () => {
            test('parses code blocks with surrounding text and headings', () => {
                const content = '# Title\nBefore\n```js\ncode\n```\nAfter';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(6);
                expect(result[0].type).toBe('heading');
                expect(result[0].segments[0].text).toBe('Title');
                expect(result[1].type).toBe('normal');
                expect(result[1].segments[0].text).toBe('Before');
                expect(result[2].type).toBe('code'); // Opening
                expect(result[3].type).toBe('code'); // Content
                expect(result[4].type).toBe('code'); // Closing
                expect(result[5].type).toBe('normal');
                expect(result[5].segments[0].text).toBe('After');
            });
        });

        describe('indented code blocks', () => {
            test('parses single-line indented code block', () => {
                const content = '    const x = 1;';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({
                    type: 'normal',
                    segments: [{ text: 'const x = 1;', code: true }],
                });
            });

            test('parses multi-line indented code block with each line separate', () => {
                const content = '    const x = 1;\n    const y = 2;';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(2);
                expect(result[0]).toEqual({
                    type: 'normal',
                    segments: [{ text: 'const x = 1;', code: true }],
                });
                expect(result[1]).toEqual({
                    type: 'normal',
                    segments: [{ text: 'const y = 2;', code: true }],
                });
            });

            test('parses indented code block with blank lines preserved', () => {
                const content = '    line1\n\n    line3';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(3);
                expect(result[0].segments[0].text).toBe('line1');
                expect(result[1].segments[0].text).toBe(''); // Blank line preserved
                expect(result[2].segments[0].text).toBe('line3');

                // All should have code: true
                expect(result[0].segments[0].code).toBe(true);
                expect(result[1].segments[0].code).toBe(true);
                expect(result[2].segments[0].code).toBe(true);
            });

            test('distinguishes indented code from fenced code without language', () => {
                const content = '```\nfenced\n```\n\n    indented';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(5);

                // Fenced block: 3 lines with type='code' and codeMetadata
                expect(result[0].type).toBe('code');
                expect(result[0].codeMetadata?.isOpening).toBe(true);
                expect(result[1].type).toBe('code');
                expect(result[2].type).toBe('code');
                expect(result[2].codeMetadata?.isClosing).toBe(true);

                // Blank line
                expect(result[3].type).toBe('normal');

                // Indented block: type='normal' with code segment, no codeMetadata
                expect(result[4].type).toBe('normal');
                expect(result[4].segments[0].text).toBe('indented');
                expect(result[4].segments[0].code).toBe(true);
                expect(result[4].codeMetadata).toBeUndefined();
            });

            test('handles indented code with surrounding normal text', () => {
                const content = 'Before\n\n    code line\n\nAfter';
                const result = parseMarkdownDocument(content);

                expect(result).toHaveLength(5);
                expect(result[0].type).toBe('normal');
                expect(result[0].segments[0].text).toBe('Before');
                expect(result[1].segments[0].text).toBe(''); // Blank line
                expect(result[2].type).toBe('normal');
                expect(result[2].segments[0]).toEqual({ text: 'code line', code: true });
                expect(result[3].segments[0].text).toBe(''); // Blank line
                expect(result[4].segments[0].text).toBe('After');
            });

            test('does not false-positive on simple nested list items', () => {
                const content = '- Item 1\n    - Nested item\n        - Deeply nested';
                const result = parseMarkdownDocument(content);

                // Remark parses this as a list, not code
                // This test verifies we don't accidentally parse list items as code
                // All lines should be 'normal' (remark doesn't expose list structure to our parser yet)
                result.forEach((line) => {
                    expect(line.type).toBe('normal');
                    // Should NOT have code:true segments
                    const hasCode = line.segments.some((seg) => seg.code);
                    expect(hasCode).toBe(false);
                });
            });

            test('does not false-positive on complex nested list items (4+ spaces)', () => {
                const content =
                    '- Top level\n    - Nested (4 spaces)\n        - Deep nested (8 spaces)\n            - Very deep (12 spaces)';
                const result = parseMarkdownDocument(content);

                // Even with 4+ spaces for nested items, remark knows these are list items, not code
                result.forEach((line) => {
                    expect(line.type).toBe('normal');
                    const hasCode = line.segments.some((seg) => seg.code);
                    expect(hasCode).toBe(false);
                });
            });

            test('does not false-positive on list with indented paragraph continuation', () => {
                const content = '- Item 1\n    continued paragraph';
                const result = parseMarkdownDocument(content);

                // 4-space indentation after list item is paragraph continuation, not code
                result.forEach((line) => {
                    expect(line.type).toBe('normal');
                    const hasCode = line.segments.some((seg) => seg.code);
                    expect(hasCode).toBe(false);
                });
            });

            test('does not false-positive on ordered list with nested items', () => {
                const content = '1. First\n    1. Nested first\n        1. Deep nested';
                const result = parseMarkdownDocument(content);

                result.forEach((line) => {
                    expect(line.type).toBe('normal');
                    const hasCode = line.segments.some((seg) => seg.code);
                    expect(hasCode).toBe(false);
                });
            });

            test('correctly distinguishes list from standalone indented code', () => {
                const content = '- List item\n\nNew paragraph\n\n    standalone code';
                const result = parseMarkdownDocument(content);

                // First two lines: list and blank line (no code)
                expect(result[0].segments.some((seg) => seg.code)).toBe(false);
                expect(result[1].type).toBe('normal');

                // Line 3: new paragraph (no code)
                expect(result[2].segments.some((seg) => seg.code)).toBe(false);

                // Line 4: blank line
                expect(result[3].type).toBe('normal');

                // Line 5: standalone indented code (SHOULD have code:true)
                expect(result[4].segments[0]).toEqual({ text: 'standalone code', code: true });
            });
        });
    });
});
