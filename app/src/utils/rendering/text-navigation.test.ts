import { describe, expect, test } from 'bun:test';

import {
    findCurrentLineEnd,
    findCurrentLineStart,
    findCursorPositionDown,
    findCursorPositionUp,
    findNextWordStart,
    findPrevWordStart,
    findWordDeleteStart,
} from './text-navigation';

describe('rendering text-navigation', () => {
    describe('findPrevWordStart', () => {
        test('returns 0 when cursor is at position 0', () => {
            const text = 'hello world';

            const result = findPrevWordStart(text, 0);

            expect(result).toBe(0);
        });

        test('returns 0 when cursor is at position 1', () => {
            const text = 'hello world';

            const result = findPrevWordStart(text, 1);

            expect(result).toBe(0);
        });

        test('jumps to start of current word when cursor is mid-word', () => {
            const text = 'hello world';

            const result = findPrevWordStart(text, 8);

            expect(result).toBe(6);
        });

        test('jumps to start of previous word when cursor is at word boundary', () => {
            const text = 'hello world';

            const result = findPrevWordStart(text, 6);

            expect(result).toBe(0);
        });

        test('skips multiple spaces between words', () => {
            const text = 'hello   world';

            const result = findPrevWordStart(text, 8);

            expect(result).toBe(0);
        });

        test('handles cursor at end of text', () => {
            const text = 'hello world';

            const result = findPrevWordStart(text, text.length);

            expect(result).toBe(6);
        });

        test('handles single word', () => {
            const text = 'hello';

            const result = findPrevWordStart(text, 3);

            expect(result).toBe(0);
        });

        test('treats special characters as word characters', () => {
            const text = ':jump line-99';

            const result = findPrevWordStart(text, 13);

            expect(result).toBe(6);
        });

        test('handles empty string', () => {
            const text = '';

            const result = findPrevWordStart(text, 0);

            expect(result).toBe(0);
        });

        test('handles text with only whitespace', () => {
            const text = '   ';

            const result = findPrevWordStart(text, 3);

            expect(result).toBe(0);
        });

        test('handles cursor after single space', () => {
            const text = 'hello world';

            const result = findPrevWordStart(text, 6);

            expect(result).toBe(0);
        });
    });

    describe('findNextWordStart', () => {
        test('returns text length when cursor is at end', () => {
            const text = 'hello world';

            const result = findNextWordStart(text, text.length);

            expect(result).toBe(text.length);
        });

        test('jumps to start of next word when cursor is mid-word', () => {
            const text = 'hello world';

            const result = findNextWordStart(text, 2);

            expect(result).toBe(6);
        });

        test('jumps to start of next word when cursor is at word boundary', () => {
            const text = 'hello world';

            const result = findNextWordStart(text, 5);

            expect(result).toBe(6);
        });

        test('skips multiple spaces between words', () => {
            const text = 'hello   world';

            const result = findNextWordStart(text, 5);

            expect(result).toBe(8);
        });

        test('handles cursor at start of text', () => {
            const text = 'hello world';

            const result = findNextWordStart(text, 0);

            expect(result).toBe(6);
        });

        test('handles single word', () => {
            const text = 'hello';

            const result = findNextWordStart(text, 2);

            expect(result).toBe(5);
        });

        test('treats special characters as word characters', () => {
            const text = ':jump line-99';

            const result = findNextWordStart(text, 0);

            expect(result).toBe(6);
        });

        test('handles empty string', () => {
            const text = '';

            const result = findNextWordStart(text, 0);

            expect(result).toBe(0);
        });

        test('handles text with only whitespace', () => {
            const text = '   ';

            const result = findNextWordStart(text, 0);

            expect(result).toBe(3);
        });

        test('handles cursor before single space', () => {
            const text = 'hello world';

            const result = findNextWordStart(text, 5);

            expect(result).toBe(6);
        });
    });

    describe('findWordDeleteStart', () => {
        test('returns minPosition when cursor is at minPosition', () => {
            const text = 'hello world';

            const result = findWordDeleteStart(text, 0, 0);

            expect(result).toBe(0);
        });

        test('returns minPosition when cursor is before minPosition', () => {
            const text = 'hello world';

            const result = findWordDeleteStart(text, 0, 1);

            expect(result).toBe(1);
        });

        test('deletes to start of word including trailing whitespace', () => {
            const text = 'hello world';

            const result = findWordDeleteStart(text, 11, 0);

            expect(result).toBe(6);
        });

        test('deletes partial word when cursor is mid-word', () => {
            const text = 'hello world';

            const result = findWordDeleteStart(text, 8, 0);

            expect(result).toBe(6);
        });

        test('deletes multiple words with multiple spaces', () => {
            const text = 'hello   world';

            const result = findWordDeleteStart(text, 13, 0);

            expect(result).toBe(8);
        });

        test('respects minPosition for command mode (position 1)', () => {
            const text = ':test';

            const result = findWordDeleteStart(text, 5, 1);

            expect(result).toBe(1);
        });

        test('respects minPosition when delete would go past it', () => {
            const text = ':hello world';

            const result = findWordDeleteStart(text, 7, 1);

            expect(result).toBe(1);
        });

        test('handles single word with minPosition 0', () => {
            const text = 'hello';

            const result = findWordDeleteStart(text, 5, 0);

            expect(result).toBe(0);
        });

        test('handles cursor at position 1 with minPosition 1', () => {
            const text = ':test';

            const result = findWordDeleteStart(text, 1, 1);

            expect(result).toBe(1);
        });

        test('handles empty string', () => {
            const text = '';

            const result = findWordDeleteStart(text, 0, 0);

            expect(result).toBe(0);
        });

        test('treats special characters as word characters', () => {
            const text = ':jump line-99';

            const result = findWordDeleteStart(text, 13, 1);

            expect(result).toBe(6);
        });

        test('deletes word and trailing whitespace when cursor is in whitespace', () => {
            const text = 'hello   world';

            const result = findWordDeleteStart(text, 7, 0);

            expect(result).toBe(0);
        });
    });

    describe('findCursorPositionUp', () => {
        test('returns 0 when text is single line', () => {
            const text = 'hello world';

            const result = findCursorPositionUp(text, 5, 80);

            expect(result).toBe(0);
        });

        test('returns 0 when cursor is on the first wrapped line', () => {
            // "abcde fghij" with maxWidth=5 → segments ["abcde","fghij"], flatStarts=[0,6]
            const text = 'abcde fghij';

            const result = findCursorPositionUp(text, 3, 5);

            expect(result).toBe(0);
        });

        test('moves cursor to same column on previous line', () => {
            // segments ["abcde","fghij"], flatStarts=[0,6]
            // cursor=9 → col 3 of "fghij" → UP → col 3 of "abcde" = 3
            const text = 'abcde fghij';

            const result = findCursorPositionUp(text, 9, 5);

            expect(result).toBe(3);
        });

        test('moves cursor to correct column in three-segment text', () => {
            // "abcde fghij klmno" → segments ["abcde","fghij","klmno"], flatStarts=[0,6,12]
            // cursor=14 (col 2 of "klmno") → UP → col 2 of "fghij" = 8
            const text = 'abcde fghij klmno';

            const result = findCursorPositionUp(text, 14, 5);

            expect(result).toBe(8);
        });

        test('clamps column when previous segment is shorter', () => {
            // "a-bcde" with maxWidth=5 → segments ["a-","bcde"], flatStarts=[0,2]
            // adjacent: flatStarts[1] = flatStarts[0] + "a-".length = 2
            // cursor=5 (col 3 of "bcde") → UP → returns 1 (last pos within "a-" on line 1), not 2 (start of "bcde" on line 2)
            const text = 'a-bcde';

            const result = findCursorPositionUp(text, 5, 5);

            expect(result).toBe(1);
        });

        test('clamps to last position of previous segment when segments are adjacent (word-break trailing space)', () => {
            // "x bbbb" maxWidth=4 → wrapLine → ["x ","bbbb"], flatStarts=[0,2]
            // adjacent: flatStarts[1] = flatStarts[0] + "x ".length = 2
            // cursor=6 (end of "bbbb") → UP → should return 1 (last pos within "x ")
            // without fix: returns 2 = flatStarts[1] → TextInput renders on line 2
            const text = 'x bbbb';

            const result = findCursorPositionUp(text, 6, 4);

            expect(result).toBe(1);
        });

        test('handles cursor at discarded-space boundary', () => {
            // "abcde fghij" → flatStarts=[0,6]; space at 5 maps to segIdx=0
            // cursor=5 (the discarded space) → segIdx=0 → UP returns 0
            const text = 'abcde fghij';

            const result = findCursorPositionUp(text, 5, 5);

            expect(result).toBe(0);
        });
    });

    describe('findCurrentLineStart', () => {
        test('returns 0 for single-line text', () => {
            const text = 'hello world';

            const result = findCurrentLineStart(text, 5, 80);

            expect(result).toBe(0);
        });

        test('returns 0 when cursor is on first wrapped segment', () => {
            // "abcde fghij" → segments ["abcde","fghij"], flatStarts=[0,6]
            const text = 'abcde fghij';

            const result = findCurrentLineStart(text, 3, 5);

            expect(result).toBe(0);
        });

        test('returns flatStarts[1] when cursor is on second wrapped segment', () => {
            // "abcde fghij" → segments ["abcde","fghij"], flatStarts=[0,6]
            // cursor=9 is on segment 1 (flatStarts[1]=6)
            const text = 'abcde fghij';

            const result = findCurrentLineStart(text, 9, 5);

            expect(result).toBe(6);
        });

        test('returns flatStarts[2] when cursor is on last of three segments', () => {
            // "abcde fghij klmno" → flatStarts=[0,6,12]
            // cursor=14 is on segment 2
            const text = 'abcde fghij klmno';

            const result = findCurrentLineStart(text, 14, 5);

            expect(result).toBe(12);
        });

        test('returns position after newline when cursor is on an empty segment from blank line', () => {
            // "hello\n\nworld": 0:"h"..4:"o" 5:"\n" 6:"\n" 7:"w"..11:"d"
            // wrapLine splits on \n → ["hello","","world"], flatStarts=[0,5,7]
            // cursor=6 (on 2nd \n, the empty line) → segIdx=1, flatStarts[1]=5 points to \n
            // Must return 6 so the no-op guard (cursor<=lineStart) fires and Ctrl+U is a no-op
            const text = 'hello\n\nworld';

            const result = findCurrentLineStart(text, 6, 78);

            expect(result).toBe(6);
        });

        test('returns position after newline when cursor is on the newline separator', () => {
            // "hello\n\nworld": cursor=5 is on the first \n
            // computeFlatStarts maps cursor=5 to segIdx=1 (flatStarts[1]=5<=5), text[5]=\n
            // Must return 6 so Ctrl+U at the newline boundary is a no-op (no deleting newlines)
            const text = 'hello\n\nworld';

            const result = findCurrentLineStart(text, 5, 78);

            expect(result).toBe(6);
        });
    });

    describe('findCurrentLineEnd', () => {
        test('returns text.length for single-line text', () => {
            const text = 'hello world';

            const result = findCurrentLineEnd(text, 5, 80);

            expect(result).toBe(text.length);
        });

        test('returns end of first segment when cursor is on first wrapped segment', () => {
            // "abcde fghij" → segments ["abcde","fghij"], flatStarts=[0,6]
            // segment[0].content="abcde", length=5, end=0+5=5
            const text = 'abcde fghij';

            const result = findCurrentLineEnd(text, 3, 5);

            expect(result).toBe(5);
        });

        test('returns text.length when cursor is on last wrapped segment', () => {
            // "abcde fghij" → segments ["abcde","fghij"], flatStarts=[0,6]
            // cursor=9 is on segment 1 (last) → returns text.length=11
            const text = 'abcde fghij';

            const result = findCurrentLineEnd(text, 9, 5);

            expect(result).toBe(text.length);
        });
    });

    describe('findCursorPositionDown', () => {
        test('returns text.length when text is single line', () => {
            const text = 'hello world';

            const result = findCursorPositionDown(text, 5, 80);

            expect(result).toBe(text.length);
        });

        test('returns text.length when cursor is on the last wrapped line', () => {
            // "abcde fghij" → segments ["abcde","fghij"], flatStarts=[0,6]
            // cursor=9 (col 3 of "fghij") → DOWN → text.length=11
            const text = 'abcde fghij';

            const result = findCursorPositionDown(text, 9, 5);

            expect(result).toBe(text.length);
        });

        test('moves cursor to same column on next line', () => {
            // segments ["abcde","fghij"], flatStarts=[0,6]
            // cursor=3 (col 3 of "abcde") → DOWN → flatStarts[1]+min(3,5)=6+3=9
            const text = 'abcde fghij';

            const result = findCursorPositionDown(text, 3, 5);

            expect(result).toBe(9);
        });

        test('moves cursor to correct column in three-segment text', () => {
            // "abcde fghij klmno" → segments ["abcde","fghij","klmno"], flatStarts=[0,6,12]
            // cursor=8 (col 2 of "fghij") → DOWN → flatStarts[2]+min(2,5)=12+2=14
            const text = 'abcde fghij klmno';

            const result = findCursorPositionDown(text, 8, 5);

            expect(result).toBe(14);
        });

        test('clamps column when next segment is shorter', () => {
            // "abcde x" with maxWidth=5 → segments ["abcde","x"], flatStarts=[0,6]
            // cursor=3 (col 3 of "abcde") → DOWN → flatStarts[1]+min(3,1)=6+1=7=text.length (clamped)
            const text = 'abcde x';

            const result = findCursorPositionDown(text, 3, 5);

            expect(result).toBe(text.length);
        });

        test('handles cursor at discarded-space boundary', () => {
            // "abcde fghij" → flatStarts=[0,6]; space at 5 maps to segIdx=0 (colInSeg=5)
            // cursor=5 → DOWN → flatStarts[1]+min(5,5)=6+5=11=text.length
            const text = 'abcde fghij';

            const result = findCursorPositionDown(text, 5, 5);

            expect(result).toBe(text.length);
        });
    });
});
