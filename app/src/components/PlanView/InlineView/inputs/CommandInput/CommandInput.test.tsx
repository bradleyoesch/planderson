import { describe, expect, test } from 'bun:test';
import React from 'react';

import { stripAnsi } from '~/test-utils/ink-helpers';
import { renderWithTerminalProvider as render } from '~/test-utils/render-helpers';

import { CommandInput } from './CommandInput';

describe('CommandInput', () => {
    describe('maxWidth — full terminal width (no wrapper padding)', () => {
        test('wraps at terminalWidth, not terminalWidth - paddingX*2', () => {
            // CommandInput renders in View's footer slot with NO Box paddingX wrapper.
            // CommentInput/QuestionInput use InlinePane which applies paddingX on both sides.
            // terminalWidth=20, paddingX=1 (default in test context):
            //   Wrong: maxWidth = 20 - 1*2 = 18 → 20 'a's split into 18 + 2 (3 lines)
            //   Correct: maxWidth = 20      → 20 'a's all fit in one line (2 lines total)
            const longText = `:${'a'.repeat(20)}`;
            const { lastFrame } = render(<CommandInput commandText={longText} inputCursor={longText.length} />, {
                terminalWidth: 20,
            });
            const frame = stripAnsi(lastFrame()!);
            // All 20 'a's appear on one line (not split 18+2); cursor overflows to its own line
            const lines = frame.split('\n').filter((l) => l.trim().length > 0);
            const aaLine = lines.find((l) => l.startsWith('a'));
            expect(aaLine).toBe('a'.repeat(20));
            expect(lines[lines.indexOf(aaLine!) + 1]).toBe('█');
        });

        test('text that fits in terminalWidth but not in terminalWidth - paddingX*2 renders on one line', () => {
            // ':' + 18 'a's = 19 chars; terminalWidth=20, paddingX=1 → wrong maxWidth=18
            //   With wrong maxWidth=18: ':' on line 1, 18 'a's on line 2 (wraps at break char ':' then fits)
            //   With correct maxWidth=20: ':' on line 1, 18 'a's on line 2 (same — ':' is still a break char)
            // Use a cleaner case: 19 'a's with terminalWidth=20
            // Wrong (maxWidth=18): 18 'a's + 1 'a' = wraps to 2 segments
            // Correct (maxWidth=20): ':aaaaaaaaaaaaaaaaaaa' (20 chars) = fits in one segment
            const text = `:${'a'.repeat(19)}`;
            const { lastFrame } = render(<CommandInput commandText={text} inputCursor={text.length} />, {
                terminalWidth: 20,
            });
            const frame = stripAnsi(lastFrame()!);
            // With correct maxWidth=20, ':' + 19 'a's (20 chars total) fit on one line; cursor overflows to its own line
            const lines = frame.split('\n').filter((l) => l.trim().length > 0);
            expect(lines[0]).toBe(`:${'a'.repeat(19)}`);
            expect(lines[1]).toBe('█');
        });
    });
});
