import { describe, expect, test } from 'bun:test';

import type { FeedbackEntry } from '~/state/planViewState';

import { wrapFeedback } from './line-wrapping';
import { calculateViewportHeight, countFeedbackLines } from './viewport';

describe('rendering viewport', () => {
    describe('calculateViewportHeight', () => {
        test('calculates height with plan mode', () => {
            expect(calculateViewportHeight('plan', 24)).toBe(20); // 24 - 3 (header) - 1 (footer)
        });

        test('calculates height with command mode', () => {
            expect(calculateViewportHeight('command', 24)).toBe(20); // 24 - 3 (header) - 1 (footer)
        });

        test('calculates height with comment mode', () => {
            expect(calculateViewportHeight('comment', 24)).toBe(17); // 24 - 3 (header) - 4 (footer)
        });

        test('calculates height with question mode', () => {
            expect(calculateViewportHeight('question', 24)).toBe(17); // 24 - 3 (header) - 4 (footer)
        });

        test('returns minimum of 1 for very small terminals', () => {
            expect(calculateViewportHeight('plan', 3)).toBe(1);
            expect(calculateViewportHeight('comment', 5)).toBe(1);
        });

        test('comment mode with inputLineCount=1 returns same as default', () => {
            expect(calculateViewportHeight('comment', 24, 1)).toBe(17); // 24 - 3 - 4
        });

        test('comment mode with inputLineCount=3 returns terminalHeight minus header and 6-line footer', () => {
            expect(calculateViewportHeight('comment', 24, 3)).toBe(15); // 24 - 3 - (3+3)
        });

        test('question mode with inputLineCount=2 uses inputLineCount for footer height', () => {
            expect(calculateViewportHeight('question', 24, 2)).toBe(16); // 24 - 3 - (3+2)
        });

        test('confirm-approve mode ignores inputLineCount', () => {
            expect(calculateViewportHeight('confirm-approve', 24, 3)).toBe(13); // 24 - 3 - 8
        });

        test('command mode without inputLineCount defaults to single line', () => {
            expect(calculateViewportHeight('command', 24)).toBe(20); // same as plan mode: 24 - 3 - 1
        });

        test('command mode with inputLineCount=1 returns same as default', () => {
            expect(calculateViewportHeight('command', 30, 1)).toBe(26); // 30 - 3 - 1
        });

        test('command mode with inputLineCount=3 returns 3 fewer lines than single-line', () => {
            expect(calculateViewportHeight('command', 30, 3)).toBe(24); // 30 - 3 - 3
        });

        test('returns minimum of 1 for very small terminals in command mode', () => {
            expect(calculateViewportHeight('command', 4)).toBe(1);
            expect(calculateViewportHeight('command', 5, 4)).toBe(1); // 5 - 3 - 4 = -2 → clamped to 1
        });
    });

    describe('countFeedbackLines', () => {
        test('returns 0 when no feedback items', () => {
            const comments = new Map<number, FeedbackEntry>();
            const questions = new Map<number, FeedbackEntry>();
            expect(
                countFeedbackLines(
                    0,
                    5,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(0);
        });

        test('counts single feedback item (comment or question)', () => {
            const comments = new Map([[0, { text: 'test comment', lines: [0] }]]);
            const questions = new Map([[1, { text: 'test question', lines: [1] }]]);
            expect(
                countFeedbackLines(
                    0,
                    5,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(2);
        });

        test('counts both comment and question on same line', () => {
            const comments = new Map([[2, { text: 'test comment', lines: [2] }]]);
            const questions = new Map([[2, { text: 'test question', lines: [2] }]]);
            expect(
                countFeedbackLines(
                    0,
                    5,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(2);
        });

        test('counts feedback spanning multiple lines only once', () => {
            const comments = new Map([
                [1, { text: 'same comment', lines: [1] }],
                [2, { text: 'same comment', lines: [2] }],
                [3, { text: 'same comment', lines: [3] }],
            ]);
            const questions = new Map<number, FeedbackEntry>();
            expect(
                countFeedbackLines(
                    0,
                    5,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(1);
        });

        test('counts different feedback items separately', () => {
            const comments = new Map([
                [1, { text: 'first comment', lines: [1] }],
                [2, { text: 'second comment', lines: [2] }],
                [3, { text: 'third comment', lines: [3] }],
            ]);
            const questions = new Map<number, FeedbackEntry>();
            expect(
                countFeedbackLines(
                    0,
                    5,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(3);
        });

        test('distinguishes between same and different feedback items', () => {
            const comments = new Map([
                [0, { text: 'comment A', lines: [0] }],
                [1, { text: 'comment A', lines: [1] }], // same as previous, not counted
                [2, { text: 'comment B', lines: [2] }], // different, counted
                [3, { text: 'comment B', lines: [3] }], // same as previous, not counted
            ]);
            const questions = new Map<number, FeedbackEntry>();
            expect(
                countFeedbackLines(
                    0,
                    5,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(2);
        });

        test('only counts feedback in specified range', () => {
            const comments = new Map([
                [0, { text: 'before range', lines: [0] }],
                [5, { text: 'in range', lines: [5] }],
                [10, { text: 'after range', lines: [10] }],
            ]);
            const questions = new Map<number, FeedbackEntry>();
            // Range is [5, 10), so only line 5 is counted
            expect(
                countFeedbackLines(
                    5,
                    10,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(1);
        });

        test('handles feedback starting before visible range', () => {
            const comments = new Map([
                [0, { text: 'same comment', lines: [0] }],
                [1, { text: 'same comment', lines: [1] }],
                [2, { text: 'same comment', lines: [2] }],
            ]);
            const questions = new Map<number, FeedbackEntry>();
            // Range starts at line 1, but comment started at line 0
            // Per Plan.tsx logic, if prev line is out of range, show the comment
            expect(
                countFeedbackLines(
                    1,
                    3,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(1);
        });

        test('handles feedback at range boundaries', () => {
            const comments = new Map([
                [4, { text: 'different before', lines: [4] }],
                [5, { text: 'new comment', lines: [5] }], // Start of range, counted
            ]);
            const questions = new Map<number, FeedbackEntry>();
            expect(
                countFeedbackLines(
                    5,
                    10,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(1);
        });

        test('counts complex mix of comments and questions', () => {
            const comments = new Map([
                [0, { text: 'comment A', lines: [0] }],
                [1, { text: 'comment A', lines: [1] }], // same
                [2, { text: 'comment B', lines: [2] }], // different, counted
                [5, { text: 'comment C', lines: [5] }], // different, counted
            ]);
            const questions = new Map([
                [1, { text: 'question X', lines: [1] }],
                [3, { text: 'question Y', lines: [3] }], // different, counted
                [4, { text: 'question Y', lines: [4] }], // same
            ]);
            // Range [0, 6): 3 comments (A, B, C) + 2 questions (X, Y) = 5
            expect(
                countFeedbackLines(
                    0,
                    6,
                    wrapFeedback(comments, 'comment', 80, 1),
                    wrapFeedback(questions, 'question', 80, 1),
                ),
            ).toBe(5);
        });

        test('counts wrapped feedback as multiple terminal lines', () => {
            // Long feedback wraps - verify counting uses actual terminal lines not logical lines
            // With word-wrap: '💬 ' goes on line 1, then 120 A's char-wrap at effective width 38
            // line 1: '💬 ', line 2-4: 38 A's each, line 5: 6 A's (120 - 3*38 = 6) → 5 total
            const longComment = 'A'.repeat(120);
            const comments = new Map<number, FeedbackEntry>([[0, { text: longComment, lines: [0] }]]);
            const questions = new Map<number, FeedbackEntry>();

            const count = countFeedbackLines(
                0,
                1,
                wrapFeedback(comments, 'comment', 40, 1),
                wrapFeedback(questions, 'question', 40, 1),
            );

            // Should count actual terminal lines (5), not logical lines (1)
            expect(count).toBe(5);
        });

        test('counts multiple wrapped feedback items independently', () => {
            // With word-wrap: prefix alone on line 1, then A's/B's char-wrap at effective 38
            // 80 A's: line 1 '💬 ', line 2: 38 A's, line 3: 38 A's, line 4: 4 A's → 4 lines
            // 80 B's: same → 4 lines
            const longComment = 'A'.repeat(80);
            const longQuestion = 'B'.repeat(80);
            const comments = new Map<number, FeedbackEntry>([[0, { text: longComment, lines: [0] }]]);
            const questions = new Map<number, FeedbackEntry>([[0, { text: longQuestion, lines: [0] }]]);

            const count = countFeedbackLines(
                0,
                1,
                wrapFeedback(comments, 'comment', 40, 1),
                wrapFeedback(questions, 'question', 40, 1),
            );

            expect(count).toBe(8); // 4 + 4
        });
    });
});
