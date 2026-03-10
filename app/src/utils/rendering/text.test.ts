import { describe, expect, test } from 'bun:test';

import type { TextSegment } from './markdown/markdown';
import { trimWrappedSegment } from './text';

describe('rendering text', () => {
    describe('trimWrappedSegment', () => {
        test('returns empty array for empty input', () => {
            const result = trimWrappedSegment([]);
            expect(result).toEqual([]);
        });

        test('trims leading whitespace from first segment', () => {
            const segments: TextSegment[] = [{ text: '  Hello' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: 'Hello' }]);
        });

        test('trims trailing whitespace from last segment', () => {
            const segments: TextSegment[] = [{ text: 'Hello  ' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: 'Hello' }]);
        });

        test('trims both leading and trailing whitespace', () => {
            const segments: TextSegment[] = [{ text: '  Hello  ' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: 'Hello' }]);
        });

        test('preserves whitespace between segments', () => {
            const segments: TextSegment[] = [{ text: '  Hello ' }, { text: 'world  ' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: 'Hello ' }, { text: 'world' }]);
        });

        test('preserves formatting properties when trimming', () => {
            const segments: TextSegment[] = [
                { text: '  Hello', bold: true, color: '#ff0000' },
                { text: ' world  ', italic: true },
            ];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([
                { text: 'Hello', bold: true, color: '#ff0000' },
                { text: ' world', italic: true },
            ]);
        });

        test('handles single segment with only whitespace', () => {
            const segments: TextSegment[] = [{ text: '   ' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: '' }]);
        });

        test('handles multiple segments with whitespace only at boundaries', () => {
            const segments: TextSegment[] = [{ text: '  First' }, { text: 'Middle' }, { text: 'Last  ' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: 'First' }, { text: 'Middle' }, { text: 'Last' }]);
        });

        test('preserves internal whitespace while trimming boundaries', () => {
            const segments: TextSegment[] = [{ text: '  Hello  World  ' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: 'Hello  World' }]);
        });

        test('does not modify original segments array', () => {
            const segments: TextSegment[] = [{ text: '  Hello  ' }];
            const original = JSON.parse(JSON.stringify(segments));

            trimWrappedSegment(segments);

            expect(segments).toEqual(original);
        });

        test('handles segments with tabs and newlines', () => {
            const segments: TextSegment[] = [{ text: '\t\nHello\t\n' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: 'Hello' }]);
        });

        test('handles empty text in middle segments', () => {
            const segments: TextSegment[] = [{ text: '  First' }, { text: '' }, { text: 'Last  ' }];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([{ text: 'First' }, { text: '' }, { text: 'Last' }]);
        });

        test('handles complex formatting across multiple segments', () => {
            const segments: TextSegment[] = [
                { text: '  const ', bold: true },
                { text: 'foo', code: true, color: '#00ff00' },
                { text: ' = "bar";  ', italic: true },
            ];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([
                { text: 'const ', bold: true },
                { text: 'foo', code: true, color: '#00ff00' },
                { text: ' = "bar";', italic: true },
            ]);
        });

        test('preserves all formatting properties', () => {
            const segments: TextSegment[] = [
                {
                    text: '  text  ',
                    bold: true,
                    italic: true,
                    code: true,
                    color: '#ff0000',
                    backgroundColor: '#000000',
                    strikethrough: true,
                },
            ];
            const result = trimWrappedSegment(segments);

            expect(result).toEqual([
                {
                    text: 'text',
                    bold: true,
                    italic: true,
                    code: true,
                    color: '#ff0000',
                    backgroundColor: '#000000',
                    strikethrough: true,
                },
            ]);
        });

        describe('with trimStart option', () => {
            test('preserves leading whitespace when trimStart is false', () => {
                const segments: TextSegment[] = [{ text: '    nested item' }];
                const result = trimWrappedSegment(segments, { trimStart: false });

                expect(result).toEqual([{ text: '    nested item' }]);
            });

            test('still trims trailing whitespace when trimStart is false', () => {
                const segments: TextSegment[] = [{ text: '    nested item  ' }];
                const result = trimWrappedSegment(segments, { trimStart: false });

                expect(result).toEqual([{ text: '    nested item' }]);
            });

            test('trims both leading and trailing when trimStart is true (default)', () => {
                const segments: TextSegment[] = [{ text: '    nested item  ' }];
                const result = trimWrappedSegment(segments, { trimStart: true });

                expect(result).toEqual([{ text: 'nested item' }]);
            });

            test('preserves indentation with multiple segments when trimStart is false', () => {
                const segments: TextSegment[] = [{ text: '    - ' }, { text: 'Nested', bold: true }, { text: ' item' }];
                const result = trimWrappedSegment(segments, { trimStart: false });

                expect(result).toEqual([{ text: '    - ' }, { text: 'Nested', bold: true }, { text: ' item' }]);
            });

            test('handles wrapped continuation lines (trimStart true for idx > 0)', () => {
                // First line: preserve indentation
                const firstLine: TextSegment[] = [{ text: '    - Nested item with long text' }];
                const firstResult = trimWrappedSegment(firstLine, { trimStart: false });
                expect(firstResult[0].text).toStartWith('    ');

                // Continuation line: trim indentation
                const contLine: TextSegment[] = [{ text: '    that wraps to next line' }];
                const contResult = trimWrappedSegment(contLine, { trimStart: true });
                expect(contResult[0].text).toBe('that wraps to next line');
            });

            test('preserves empty segments when trimStart is false', () => {
                const segments: TextSegment[] = [{ text: '  ' }, { text: 'text' }];
                const result = trimWrappedSegment(segments, { trimStart: false });

                expect(result).toEqual([{ text: '  ' }, { text: 'text' }]);
            });
        });
    });
});
