import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import React from 'react';

import { ANSI } from '~/test-utils/ansi-assertions';
import type { TextSegment } from '~/utils/rendering/markdown/markdown';

import { StyledText } from './StyledText';
describe('StyledText', () => {
    describe('Text Formatting', () => {
        test('renders plain TextSegment', () => {
            const segment: TextSegment = { text: 'plain' };
            const { lastFrame } = render(<StyledText segment={segment} />);

            expect(lastFrame()).toContain('plain');
        });

        test('renders bold TextSegment', () => {
            const segment: TextSegment = { text: 'bold', bold: true };
            const { lastFrame } = render(<StyledText segment={segment} />);

            const output = lastFrame();
            expect(output).toContain('bold');
            expect(output).toContain(ANSI.BOLD);
        });

        test('renders italic TextSegment', () => {
            const segment: TextSegment = { text: 'italic', italic: true };
            const { lastFrame } = render(<StyledText segment={segment} />);

            const output = lastFrame();
            expect(output).toContain('italic');
            expect(output).toContain(ANSI.ITALIC);
        });

        test('renders strikethrough TextSegment', () => {
            const segment: TextSegment = { text: 'strike', strikethrough: true };
            const { lastFrame } = render(<StyledText segment={segment} />);

            const output = lastFrame();
            expect(output).toContain('strike');
            expect(output).toContain(ANSI.STRIKETHROUGH);
        });

        test('renders link with color and no underline', () => {
            const segment: TextSegment = {
                text: 'link text',
                link: { text: 'link text', url: 'https://example.com' },
            };
            const { lastFrame } = render(<StyledText segment={segment} />);

            const output = lastFrame();
            expect(output).toContain('link text');
            expect(output).not.toContain(ANSI.UNDERLINE);
        });
    });

    describe('Code and Colors', () => {
        test('renders code TextSegment with color and background', () => {
            const segment: TextSegment = { text: 'code', code: true };
            const { lastFrame } = render(<StyledText segment={segment} />);

            const output = lastFrame();
            expect(output).toContain('code');
            expect(output).toContain(ANSI.ESCAPE);
        });

        test('renders with custom color override', () => {
            const segment: TextSegment = { text: 'colored', color: '#ff0000' };
            const { lastFrame } = render(<StyledText segment={segment} />);

            const output = lastFrame();
            expect(output).toContain('colored');
            expect(output).toContain(ANSI.FG_24BIT);
        });

        test('renders with custom backgroundColor from segment', () => {
            const segment: TextSegment = { text: 'background text', backgroundColor: '#00ff00' };
            const { lastFrame } = render(<StyledText segment={segment} />);

            const output = lastFrame();
            expect(output).toContain('background text');
            expect(output).toContain(ANSI.BG_24BIT);
        });

        test('applies different background to inline code when highlighted', () => {
            const segment: TextSegment = { text: 'inline code', code: true };

            const notHighlighted = render(<StyledText segment={segment} isHighlighted={false} />);
            const highlighted = render(<StyledText segment={segment} isHighlighted={true} />);

            expect(highlighted.lastFrame()).not.toBe(notHighlighted.lastFrame());
        });
    });

    describe('Deletion Styling', () => {
        test('skips syntax highlighting color when deleted', () => {
            const segment: TextSegment = { text: 'code', code: true, color: '#ff0000' };

            const notDeleted = render(<StyledText segment={segment} isDeleted={false} />);
            const deleted = render(<StyledText segment={segment} isDeleted={true} />);

            const notDeletedOutput = notDeleted.lastFrame();
            const deletedOutput = deleted.lastFrame();

            expect(notDeletedOutput).toContain(ANSI.FG_24BIT);
            expect(deletedOutput).not.toContain(ANSI.FG_24BIT);
        });

        test('skips inline code color when deleted', () => {
            const segment: TextSegment = { text: 'inline', code: true };

            const notDeleted = render(<StyledText segment={segment} isDeleted={false} />);
            const deleted = render(<StyledText segment={segment} isDeleted={true} />);

            expect(deleted.lastFrame()).not.toBe(notDeleted.lastFrame());
        });

        test('skips link color when deleted', () => {
            const segment: TextSegment = {
                text: 'link',
                link: { text: 'link', url: 'https://example.com' },
            };

            const notDeleted = render(<StyledText segment={segment} isDeleted={false} />);
            const deleted = render(<StyledText segment={segment} isDeleted={true} />);

            expect(deleted.lastFrame()).not.toBe(notDeleted.lastFrame());
        });

        test('preserves text when deleted', () => {
            const segment: TextSegment = { text: 'preserved text', color: '#ff0000' };
            const { lastFrame } = render(<StyledText segment={segment} isDeleted={true} />);

            expect(lastFrame()).toContain('preserved text');
        });
    });

    describe('Edge Cases', () => {
        test('renders empty text segment', () => {
            const segment: TextSegment = { text: '' };
            const { lastFrame } = render(<StyledText segment={segment} />);

            expect(lastFrame()).toBeDefined();
        });
    });
});
