import { describe, expect, test } from 'bun:test';

import type { FeedbackEntry } from '~/state/planViewState';

import { formatFeedbackCounts, formatFeedbackMetadata, hasFeedback, joinFeedbackCounts } from './feedback';

describe('feedback feedback', () => {
    describe('formatFeedbackCounts', () => {
        test('returns empty array when no feedback', () => {
            const result = formatFeedbackCounts(new Map<number, FeedbackEntry>(), new Map(), new Set());
            expect(result).toEqual([]);
        });

        test('formats singular comment', () => {
            const comments = new Map([[1, { text: 'test comment', lines: [1] }]]);
            const result = formatFeedbackCounts(comments, new Map<number, FeedbackEntry>(), new Set());
            expect(result).toEqual(['1 comment']);
        });

        test('formats plural comments', () => {
            const comments = new Map([
                [1, { text: 'comment 1', lines: [1] }],
                [2, { text: 'comment 2', lines: [2] }],
            ]);
            const result = formatFeedbackCounts(comments, new Map<number, FeedbackEntry>(), new Set());
            expect(result).toEqual(['2 comments']);
        });

        test('formats singular deletion', () => {
            const deletions = new Set([5]);
            const result = formatFeedbackCounts(new Map<number, FeedbackEntry>(), new Map(), deletions);
            expect(result).toEqual(['1 deletion']);
        });

        test('formats plural deletions', () => {
            const deletions = new Set([3, 7, 9]);
            const result = formatFeedbackCounts(new Map<number, FeedbackEntry>(), new Map(), deletions);
            expect(result).toEqual(['3 deletions']);
        });

        test('formats both comments and deletions', () => {
            const comments = new Map([
                [1, { text: 'comment 1', lines: [1] }],
                [2, { text: 'comment 2', lines: [2] }],
            ]);
            const deletions = new Set([5, 10, 15]);
            const result = formatFeedbackCounts(comments, new Map<number, FeedbackEntry>(), deletions);
            expect(result).toEqual(['2 comments', '3 deletions']);
        });

        test('formats singular question', () => {
            const questions = new Map([[1, { text: 'why this?', lines: [1] }]]);
            const result = formatFeedbackCounts(new Map<number, FeedbackEntry>(), questions, new Set());
            expect(result).toEqual(['1 question']);
        });

        test('formats plural questions', () => {
            const questions = new Map([
                [1, { text: 'why this?', lines: [1] }],
                [2, { text: 'what about that?', lines: [2] }],
            ]);
            const result = formatFeedbackCounts(new Map<number, FeedbackEntry>(), questions, new Set());
            expect(result).toEqual(['2 questions']);
        });

        test('formats comments, questions, and deletions together', () => {
            const comments = new Map([[1, { text: 'comment', lines: [1] }]]);
            const questions = new Map([
                [2, { text: 'question 1', lines: [2] }],
                [3, { text: 'question 2', lines: [3] }],
            ]);
            const deletions = new Set([5]);
            const result = formatFeedbackCounts(comments, questions, deletions);
            expect(result).toEqual(['2 questions', '1 comment', '1 deletion']);
        });

        // Multi-line feedback counting tests (Issue #68)
        test('counts unique comment texts for multi-line comments', () => {
            // 3 map entries = 3 comments (counts map.size, not unique text values)
            const comments = new Map([
                [1, { text: 'test comment', lines: [1] }],
                [2, { text: 'test comment', lines: [2] }],
                [3, { text: 'test comment', lines: [3] }],
            ]);
            const result = formatFeedbackCounts(comments, new Map<number, FeedbackEntry>(), new Set());
            expect(result).toEqual(['3 comments']);
        });

        test('counts multiple unique comment texts correctly', () => {
            // 3 map entries = 3 comments (counts map.size, not unique text values)
            const comments = new Map([
                [1, { text: 'comment A', lines: [1] }],
                [2, { text: 'comment A', lines: [2] }],
                [3, { text: 'comment B', lines: [3] }],
            ]);
            const result = formatFeedbackCounts(comments, new Map<number, FeedbackEntry>(), new Set());
            expect(result).toEqual(['3 comments']);
        });

        test('counts unique question texts for multi-line questions', () => {
            // 2 map entries = 2 questions (counts map.size, not unique text values)
            const questions = new Map([
                [1, { text: 'why this?', lines: [1] }],
                [2, { text: 'why this?', lines: [2] }],
            ]);
            const result = formatFeedbackCounts(new Map<number, FeedbackEntry>(), questions, new Set());
            expect(result).toEqual(['2 questions']);
        });

        test('counts multiple unique question texts correctly', () => {
            // 3 map entries = 3 questions (counts map.size, not unique text values)
            const questions = new Map([
                [1, { text: 'why this?', lines: [1] }],
                [2, { text: 'what about that?', lines: [2] }],
                [3, { text: 'what about that?', lines: [3] }],
            ]);
            const result = formatFeedbackCounts(new Map<number, FeedbackEntry>(), questions, new Set());
            expect(result).toEqual(['3 questions']);
        });
    });

    describe('joinFeedbackCounts', () => {
        test('returns empty string for empty array', () => {
            expect(joinFeedbackCounts([])).toBe('');
        });

        test('returns single item as-is', () => {
            expect(joinFeedbackCounts(['1 deletion'])).toBe('1 deletion');
        });

        test('joins two items with "and"', () => {
            expect(joinFeedbackCounts(['4 comments', '1 question'])).toBe('4 comments and 1 question');
        });

        test('joins three items with Oxford comma', () => {
            expect(joinFeedbackCounts(['1 comment', '2 questions', '1 deletion'])).toBe(
                '1 comment, 2 questions, and 1 deletion',
            );
        });
    });

    describe('formatFeedbackMetadata', () => {
        test('returns empty string when no feedback', () => {
            const result = formatFeedbackMetadata(
                new Map<number, FeedbackEntry>(),
                new Map<number, FeedbackEntry>(),
                new Set(),
            );
            expect(result).toBe('');
        });

        test('formats singular comment', () => {
            const comments = new Map([[1, { text: 'test', lines: [1] }]]);
            const result = formatFeedbackMetadata(comments, new Map<number, FeedbackEntry>(), new Set());
            expect(result).toBe('(1 comment)');
        });

        test('formats plural comments', () => {
            const comments = new Map([
                [1, { text: 'a', lines: [1] }],
                [2, { text: 'b', lines: [2] }],
            ]);
            const result = formatFeedbackMetadata(comments, new Map<number, FeedbackEntry>(), new Set());
            expect(result).toBe('(2 comments)');
        });

        test('formats singular deletion', () => {
            const deletions = new Set([5]);
            const result = formatFeedbackMetadata(
                new Map<number, FeedbackEntry>(),
                new Map<number, FeedbackEntry>(),
                deletions,
            );
            expect(result).toBe('(1 deletion)');
        });

        test('formats plural deletions', () => {
            const deletions = new Set([3, 7, 9]);
            const result = formatFeedbackMetadata(
                new Map<number, FeedbackEntry>(),
                new Map<number, FeedbackEntry>(),
                deletions,
            );
            expect(result).toBe('(3 deletions)');
        });

        test('formats both comments and deletions', () => {
            const comments = new Map([[1, { text: 'test', lines: [1] }]]);
            const deletions = new Set([5, 10]);
            const result = formatFeedbackMetadata(comments, new Map<number, FeedbackEntry>(), deletions);
            expect(result).toBe('(1 comment, 2 deletions)');
        });

        test('formats singular question', () => {
            const questions = new Map([[1, { text: 'why?', lines: [1] }]]);
            const result = formatFeedbackMetadata(new Map(), questions, new Set());
            expect(result).toBe('(1 question)');
        });

        test('formats plural questions', () => {
            const questions = new Map([
                [1, { text: 'why?', lines: [1] }],
                [2, { text: 'how?', lines: [2] }],
            ]);
            const result = formatFeedbackMetadata(new Map<number, FeedbackEntry>(), questions, new Set());
            expect(result).toBe('(2 questions)');
        });

        test('formats comments, questions, and deletions together', () => {
            const comments = new Map([[1, { text: 'comment', lines: [1] }]]);
            const questions = new Map([[2, { text: 'question', lines: [2] }]]);
            const deletions = new Set([5]);
            const result = formatFeedbackMetadata(comments, questions, deletions);
            expect(result).toBe('(1 question, 1 comment, 1 deletion)');
        });
    });

    describe('hasFeedback', () => {
        test('returns false when no feedback', () => {
            expect(hasFeedback(new Map<number, FeedbackEntry>(), new Map<number, FeedbackEntry>(), new Set())).toBe(
                false,
            );
        });

        test('returns true when comments exist', () => {
            const comments = new Map([[1, { text: 'test', lines: [1] }]]);
            expect(hasFeedback(comments, new Map<number, FeedbackEntry>(), new Set())).toBe(true);
        });

        test('returns true when deletions exist', () => {
            const deletions = new Set([5]);
            expect(hasFeedback(new Map<number, FeedbackEntry>(), new Map<number, FeedbackEntry>(), deletions)).toBe(
                true,
            );
        });

        test('returns true when both exist', () => {
            const comments = new Map([[1, { text: 'test', lines: [1] }]]);
            const deletions = new Set([5]);
            expect(hasFeedback(comments, new Map<number, FeedbackEntry>(), deletions)).toBe(true);
        });

        test('returns true when questions exist', () => {
            const questions = new Map([[1, { text: 'why?', lines: [1] }]]);
            expect(hasFeedback(new Map(), questions, new Set())).toBe(true);
        });

        test('returns true when comments, questions, and deletions exist', () => {
            const comments = new Map([[1, { text: 'comment', lines: [1] }]]);
            const questions = new Map([[2, { text: 'question', lines: [2] }]]);
            const deletions = new Set([5]);
            expect(hasFeedback(comments, questions, deletions)).toBe(true);
        });
    });
});
