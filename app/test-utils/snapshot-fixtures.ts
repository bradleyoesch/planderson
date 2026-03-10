/**
 * Consistent test fixtures for snapshot testing
 * Ensures snapshots don't change due to test data variations
 */

import type { FeedbackEntry } from '~/state/planViewState';

export const SNAPSHOT_FIXTURES = {
    // Simple content (fits all widths)
    simple: {
        lines: ['Line 1', 'Line 2', 'Line 3'] as string[],
        comments: new Map<number, FeedbackEntry>(),
        deletedLines: new Set<number>(),
    },

    // Content with feedback
    withFeedback: {
        lines: ['First line', 'Second line needs fix', 'Third line'] as string[],
        comments: new Map([[1, { text: 'This needs improvement', lines: [1] }]]),
        deletedLines: new Set([2]),
    },

    // Long lines (tests wrapping)
    longLines: {
        lines: [
            'This is a very long line that will definitely wrap on narrow terminals and test text overflow behavior',
            'Normal line',
            'Another extremely long line with lots of content that triggers wrapping',
        ] as string[],
        comments: new Map<number, FeedbackEntry>(),
        deletedLines: new Set<number>(),
    },

    // Many lines (tests scrolling)
    manyLines: {
        lines: Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`),
        comments: new Map([[10, { text: 'Comment at line 10', lines: [10] }]]),
        deletedLines: new Set([20, 21]),
    },

    // Edge cases
    empty: {
        lines: [] as string[],
        comments: new Map<number, FeedbackEntry>(),
        deletedLines: new Set<number>(),
    },

    specialChars: {
        lines: ['<tag>', '"quotes"', "it's", '├─ tree', '🎉 emoji'] as string[],
        comments: new Map([[0, { text: 'Special: <>&"', lines: [0] }]]),
        deletedLines: new Set<number>(),
    },

    // Markdown content (comprehensive formatting test)
    markdown: {
        lines: [
            '# Heading Level 1',
            '## Heading Level 2',
            '',
            'This is **bold text** and *italic text* and ~~strikethrough text~~.',
            'Here is `inline code` in a sentence.',
            '',
            'Check out [this link](https://example.com) for more info.',
            '',
            '> This is a blockquote.',
            '> It can span multiple lines.',
            '',
            '---',
            '',
            '```typescript',
            'function hello() {',
            '  return "world";',
            '}',
            '```',
            '',
            'Plain text after code block.',
        ] as string[],
        comments: new Map<number, FeedbackEntry>(),
        deletedLines: new Set<number>(),
    },

    // Small plan (fits in viewport)
    small: {
        lines: ['Task 1', 'Task 2', 'Task 3'] as string[],
        comments: new Map<number, FeedbackEntry>(),
        deletedLines: new Set<number>(),
    },
};
