import { describe, expect, test } from 'bun:test';
import React from 'react';

import { ANSI } from '~/test-utils/ansi-assertions';
import { stripAnsi } from '~/test-utils/ink-helpers';
import { renderWithTerminalProvider as render } from '~/test-utils/render-helpers';
import { hasInputCursorAtEnd, hasInputCursorOnChar } from '~/test-utils/visual-assertions';

import { TextInput } from './TextInput';

describe('TextInput', () => {
    describe('Cursor at End of Line', () => {
        test('renders white block cursor (█) when at end of text', () => {
            const { lastFrame } = render(<TextInput text="hello" cursorPosition={5} />);

            const output = lastFrame();
            expect(hasInputCursorAtEnd(output!, 'hello')).toBe(true);
        });

        test('renders white block cursor when text is empty', () => {
            const { lastFrame } = render(<TextInput text="" cursorPosition={0} />);

            const output = lastFrame();
            expect(stripAnsi(output!)).toBe('█'); // Only the cursor block, no text
        });

        test('renders white block cursor when position exceeds text length', () => {
            const { lastFrame } = render(<TextInput text="hi" cursorPosition={10} />);

            const output = lastFrame();
            expect(hasInputCursorAtEnd(output!, 'hi')).toBe(true);
        });
    });

    describe('Cursor on Character', () => {
        test('renders inverted character when cursor is in middle of text', () => {
            const { lastFrame } = render(<TextInput text="hello" cursorPosition={2} />);

            const output = lastFrame();
            // Text should be split: "he" + cursor on "l" + "lo"
            expect(stripAnsi(output!)).toBe('hello');
            expect(hasInputCursorOnChar(output!, 'he', 'l')).toBe(true);
        });

        test('renders inverted character when cursor is at start', () => {
            const { lastFrame } = render(<TextInput text="hello" cursorPosition={0} />);

            const output = lastFrame();
            // Text should be split: "" + cursor on "h" + "ello"
            expect(stripAnsi(output!)).toBe('hello');
            expect(hasInputCursorOnChar(output!, '', 'h')).toBe(true);
        });

        test('renders inverted character at second-to-last position', () => {
            const { lastFrame } = render(<TextInput text="test" cursorPosition={3} />);

            const output = lastFrame();
            // Text should be split: "tes" + cursor on "t" + ""
            expect(stripAnsi(output!)).toBe('test');
            const stripped = stripAnsi(output!);
            expect(stripped.slice(0, 3)).toBe('tes'); // before cursor
            expect(stripped[3]).toBe('t'); // char at cursor (position 3)
        });
    });

    describe('Text Before and After Cursor', () => {
        test('splits text correctly around cursor position', () => {
            const { lastFrame } = render(<TextInput text="hello world" cursorPosition={6} />);

            const output = lastFrame();
            // Text should be split: "hello " + cursor on "w" + "orld"
            expect(stripAnsi(output!)).toBe('hello world');
            const stripped = stripAnsi(output!);
            expect(stripped.slice(0, 6)).toBe('hello '); // before cursor
            expect(stripped[6]).toBe('w'); // char at cursor (position 6)
            expect(stripped.slice(7)).toBe('orld'); // after cursor
        });

        test('handles cursor at position 1 with longer text', () => {
            const { lastFrame } = render(<TextInput text=":jump 99" cursorPosition={1} />);

            const output = lastFrame();
            // Text should be split: ":" + cursor on "j" + "ump 99"
            expect(stripAnsi(output!)).toBe(':jump 99');
            const stripped = stripAnsi(output!);
            expect(stripped.slice(0, 1)).toBe(':'); // before cursor
            expect(stripped[1]).toBe('j'); // char at cursor (position 1)
            expect(stripped.slice(2)).toBe('ump 99'); // after cursor
        });
    });

    describe('multi-line wrapping (maxWidth prop)', () => {
        test('text fitting within maxWidth renders identically to no-wrap', () => {
            // "hello" at maxWidth=10 — fits without wrapping, should show cursor at end
            const { lastFrame } = render(<TextInput text="hello" cursorPosition={5} maxWidth={10} />);

            const output = lastFrame();
            expect(hasInputCursorAtEnd(output!, 'hello')).toBe(true);
        });

        test('wraps text and places cursor on first line when cursorPosition is in first segment', () => {
            // "hello world" at maxWidth=5: segment 0="hello" (flatStart=0), segment 1="world" (flatStart=6)
            // cursorPosition=2 → segIdx=0, posInSeg=2 → cursor on 'l' in "hello"
            const { lastFrame } = render(<TextInput text="hello world" cursorPosition={2} maxWidth={5} />);

            const output = lastFrame()!;
            const lines = stripAnsi(output)
                .split('\n')
                .filter((l) => l.trim().length > 0);
            expect(lines.length).toBeGreaterThanOrEqual(2);
            expect(hasInputCursorOnChar(output, 'he', 'l')).toBe(true);
        });

        test('cursor in second segment renders cursor markup on second line only', () => {
            // "hello world" at maxWidth=5, cursorPosition=8 (at 'r' in "world")
            // segIdx=1, posInSeg=2 → cursor on 'r'; "hello" line must have no cursor
            const { lastFrame } = render(<TextInput text="hello world" cursorPosition={8} maxWidth={5} />);

            const output = lastFrame()!;
            const lines = output.split('\n');
            const helloLine = lines.find((l) => stripAnsi(l).includes('hello'));
            expect(helloLine).toBeDefined();
            expect(helloLine).not.toContain(ANSI.INPUT_CURSOR_BG);
            expect(helloLine).not.toContain(ANSI.INPUT_CURSOR_BLOCK);
            expect(hasInputCursorOnChar(output, 'wo', 'r')).toBe(true);
        });

        test('cursor at discarded-space position renders cursor on its own line after first segment', () => {
            // "hello world" at maxWidth=5, cursorPosition=5 (the space that gets discarded on wrap)
            // segIdx=0, posInSeg=min(5,5)=5, "hello" fills exactly maxWidth=5 → cursorOverflows
            // cursor rendered on separate line to avoid Ink re-wrapping "hello█"
            const { lastFrame } = render(<TextInput text="hello world" cursorPosition={5} maxWidth={5} />);

            const output = lastFrame()!;
            const lines = stripAnsi(output)
                .split('\n')
                .filter((l) => l.trim().length > 0);
            expect(lines[0]).toBe('hello');
            expect(lines[1]).toBe('█');
            expect(lines[2]).toBe('world');
        });

        test('cursor at end of final segment renders cursor on its own line after last segment', () => {
            // "hello world" at maxWidth=5, cursorPosition=11 (end of text)
            // segIdx=1, posInSeg=min(11-6,5)=5, "world" fills exactly maxWidth=5 → cursorOverflows
            // cursor rendered on separate line to avoid Ink re-wrapping "world█"
            const { lastFrame } = render(<TextInput text="hello world" cursorPosition={11} maxWidth={5} />);

            const output = lastFrame()!;
            const lines = stripAnsi(output)
                .split('\n')
                .filter((l) => l.trim().length > 0);
            expect(lines.at(-2)).toBe('world');
            expect(lines.at(-1)).toBe('█');
        });

        test('cursor at end of exactly-full-width segment renders text then cursor on next line', () => {
            // "1 234" at maxWidth=5: fills exactly 5 cols, cursor at pos 5
            const { lastFrame } = render(<TextInput text="1 234" cursorPosition={5} maxWidth={5} />);

            const output = lastFrame()!;
            const lines = stripAnsi(output)
                .split('\n')
                .filter((l) => l.trim().length > 0);
            expect(lines[0]).toBe('1 234');
            expect(lines[1]).toBe('█');
        });

        test('hard newline splits text onto separate visual lines', () => {
            const { lastFrame } = render(<TextInput text={'hello\nworld'} cursorPosition={11} maxWidth={80} />);
            const output = lastFrame()!;
            const firstLine = stripAnsi(output)
                .split('\n')
                .find((l) => l.trim().length > 0);
            expect(firstLine).toBe('hello');
            expect(hasInputCursorAtEnd(output, 'world')).toBe(true);
        });

        test('cursor after newline renders on second line', () => {
            // cursor at 6 = start of "world" (index 5 is '\n')
            const { lastFrame } = render(<TextInput text={'hello\nworld'} cursorPosition={6} maxWidth={80} />);
            expect(hasInputCursorOnChar(lastFrame()!, '', 'w')).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('handles single character text with cursor at position 0', () => {
            const { lastFrame } = render(<TextInput text="x" cursorPosition={0} />);

            const output = lastFrame();
            // Text should be: "" + cursor on "x" + ""
            expect(stripAnsi(output!)).toBe('x');
            const stripped = stripAnsi(output!);
            expect(stripped[0]).toBe('x'); // char at cursor
        });

        test('handles single character text with cursor at end', () => {
            const { lastFrame } = render(<TextInput text="x" cursorPosition={1} />);

            const output = lastFrame();
            expect(stripAnsi(output!)).toBe('x█'); // Cursor block comes after text
        });

        test('handles text with special characters', () => {
            const { lastFrame } = render(<TextInput text=":test-command" cursorPosition={5} />);

            const output = lastFrame();
            // Text should be split: ":test" + cursor on "-" + "command"
            expect(stripAnsi(output!)).toBe(':test-command');
            const stripped = stripAnsi(output!);
            expect(stripped.slice(0, 5)).toBe(':test'); // before cursor
            expect(stripped[5]).toBe('-'); // char at cursor (position 5)
            expect(stripped.slice(6)).toBe('command'); // after cursor
        });
    });
});
