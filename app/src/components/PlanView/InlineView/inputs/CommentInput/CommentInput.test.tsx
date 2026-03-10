import { describe, expect, test } from 'bun:test';
import React from 'react';

import { renderWithTerminalProvider as render } from '~/test-utils/render-helpers';
import { hasInputCursorAtEnd, hasInputCursorOnChar, hasOnlyInputCursor } from '~/test-utils/visual-assertions';

import { CommentInput } from './CommentInput';
describe('CommentInput', () => {
    test('renders with comment text and cursor at end', () => {
        const { lastFrame } = render(<CommentInput currentCommentText="This needs improvement" inputCursor={22} />);

        const output = lastFrame();
        expect(output).toContain('Comment');
        expect(hasInputCursorAtEnd(output!, 'This needs improvement')).toBe(true);
    });

    test('renders with empty comment showing only cursor', () => {
        const { lastFrame } = render(<CommentInput currentCommentText="" inputCursor={0} />);

        const output = lastFrame();
        expect(output).toContain('Comment');
        expect(hasOnlyInputCursor(output!)).toBe(true);
    });

    test('renders with cursor on specific character in middle of text', () => {
        const { lastFrame } = render(<CommentInput currentCommentText="This is a test" inputCursor={8} />);

        const output = lastFrame();
        expect(output).toContain('Comment');
        // Cursor should be on "a" at position 8: "This is [a] test"
        expect(hasInputCursorOnChar(output!, 'This is ', 'a')).toBe(true);
    });
});
