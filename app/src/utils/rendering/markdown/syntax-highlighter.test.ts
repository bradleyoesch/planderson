import { describe, expect, test } from 'bun:test';

import { syntaxHighlight } from './syntax-highlighter';

describe('markdown syntax-highlighter', () => {
    describe('syntaxHighlight', () => {
        describe('edge cases', () => {
            test('handles empty, unknown, and unspecified language as plain text', () => {
                const empty = syntaxHighlight('', 'typescript');
                expect(empty).toEqual([[{ text: '', code: true }]]);

                const noLang = syntaxHighlight('plain code', undefined);
                expect(noLang).toEqual([[{ text: 'plain code', code: true }]]);

                const unknown = syntaxHighlight('some code', 'foobar-lang');
                expect(unknown).toEqual([[{ text: 'some code', code: true }]]);
            });

            test('handles MAX_CODE_BLOCK_LINES limit (5000 lines)', () => {
                // At limit: should highlight
                const atLimit = Array.from({ length: 5000 }, (_, i) => `line ${i + 1}`).join('\n');
                const atLimitResult = syntaxHighlight(atLimit, 'typescript');
                expect(atLimitResult).toHaveLength(5000);
                const hasHighlighting = atLimitResult[0].some((seg) => seg.color !== undefined);
                expect(hasHighlighting).toBe(true);

                // Over limit: should fallback to plain text
                const overLimit = Array.from({ length: 5001 }, (_, i) => `line ${i + 1}`).join('\n');
                const overLimitResult = syntaxHighlight(overLimit, 'typescript');
                expect(overLimitResult).toHaveLength(5001);
                overLimitResult.forEach((line, i) => {
                    expect(line).toEqual([{ text: `line ${i + 1}`, code: true }]);
                });
            });
        });

        describe('highlighting behavior', () => {
            test('highlights TypeScript keywords', () => {
                const result = syntaxHighlight('const x = 1;', 'typescript');

                expect(result).toHaveLength(1);
                const hasColor = result[0].some((seg) => seg.color !== undefined);
                expect(hasColor).toBe(true);
            });

            test('handles multi-line code', () => {
                const code = 'const x = 1;\nconst y = 2;';
                const result = syntaxHighlight(code, 'typescript');

                expect(result).toHaveLength(2);
            });

            test('preserves whitespace and indentation', () => {
                const code = '    indented line';
                const result = syntaxHighlight(code, 'python');

                const text = result[0].map((seg) => seg.text).join('');
                expect(text).toBe('    indented line');
            });
        });

        describe('blank line handling', () => {
            test('preserves single and consecutive blank lines', () => {
                // Single blank line
                const singleBlank = 'const x = 1;\n\nconst y = 2;';
                const singleResult = syntaxHighlight(singleBlank, 'typescript');

                expect(singleResult).toHaveLength(3);
                expect(singleResult[0].map((seg) => seg.text).join('')).toBe('const x = 1;');
                expect(singleResult[1][0].text).toBe('');
                expect(singleResult[1][0].code).toBe(true);
                expect(singleResult[2].map((seg) => seg.text).join('')).toBe('const y = 2;');

                // Multiple consecutive blank lines
                const multiBlank = 'function foo() {}\n\n\nfunction bar() {}';
                const multiResult = syntaxHighlight(multiBlank, 'typescript');

                expect(multiResult).toHaveLength(4);
                expect(multiResult[0].length).toBeGreaterThan(0);
                expect(multiResult[1][0].text).toBe('');
                expect(multiResult[2][0].text).toBe('');
                expect(multiResult[3].length).toBeGreaterThan(0);
            });
        });
    });
});
