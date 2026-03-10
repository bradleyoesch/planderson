import { describe, expect, test } from 'bun:test';
import React from 'react';

import { renderWithTerminalProvider as render } from '~/test-utils/render-helpers';
import { hasInputCursorAtEnd, hasInputCursorOnChar, hasOnlyInputCursor } from '~/test-utils/visual-assertions';

import { QuestionInput } from './QuestionInput';
describe('QuestionInput', () => {
    test('renders with question text and cursor at end', () => {
        const { lastFrame } = render(<QuestionInput currentQuestionText="Why is this needed?" inputCursor={19} />);

        const output = lastFrame();
        expect(output).toContain('Question');
        expect(hasInputCursorAtEnd(output!, 'Why is this needed?')).toBe(true);
    });

    test('renders with empty question showing only cursor', () => {
        const { lastFrame } = render(<QuestionInput currentQuestionText="" inputCursor={0} />);

        const output = lastFrame();
        expect(output).toContain('Question');
        expect(hasOnlyInputCursor(output!)).toBe(true);
    });

    test('renders with cursor on specific character in middle of text', () => {
        const { lastFrame } = render(<QuestionInput currentQuestionText="What about this?" inputCursor={11} />);

        const output = lastFrame();
        expect(output).toContain('Question');
        // Cursor should be on "t" at position 11: "What about [t]his?"
        expect(hasInputCursorOnChar(output!, 'What about ', 't')).toBe(true);
    });
});
