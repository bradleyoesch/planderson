/**
 * Utility functions for formatting feedback (comments and deletions)
 */

import type { FeedbackEntry } from '~/state/planViewState';

/**
 * Format feedback counts as separate strings
 * @returns Array of strings like ["2 comments", "1 question", "3 deletions"]
 */
export const formatFeedbackCounts = (
    comments: Map<number, FeedbackEntry>,
    questions: Map<number, FeedbackEntry>,
    deletedLines: Set<number>,
): string[] => {
    const counts: string[] = [];

    if (questions.size > 0) {
        counts.push(`${questions.size} question${questions.size === 1 ? '' : 's'}`);
    }

    if (comments.size > 0) {
        counts.push(`${comments.size} comment${comments.size === 1 ? '' : 's'}`);
    }

    if (deletedLines.size > 0) {
        counts.push(`${deletedLines.size} deletion${deletedLines.size === 1 ? '' : 's'}`);
    }

    return counts;
};

/**
 * Format feedback as metadata string for display in headers
 * @returns Formatted string like "(2 comments, 1 question, 3 deletions)" or empty string
 */
export const formatFeedbackMetadata = (
    comments: Map<number, FeedbackEntry>,
    questions: Map<number, FeedbackEntry>,
    deletedLines: Set<number>,
): string => {
    const counts = formatFeedbackCounts(comments, questions, deletedLines);
    return counts.length > 0 ? `(${counts.join(', ')})` : '';
};

/**
 * Join feedback count strings with Oxford comma for 3+ items.
 * @returns e.g. "1 comment", "4 comments and 1 question", "1 comment, 2 questions, and 1 deletion"
 */
export const joinFeedbackCounts = (counts: string[]): string => {
    if (counts.length === 0) return '';
    if (counts.length === 1) return counts[0];
    if (counts.length === 2) return `${counts[0]} and ${counts[1]}`;
    return `${counts.slice(0, -1).join(', ')}, and ${counts.at(-1)}`;
};

/**
 * Check if any feedback exists
 * @returns true if there are any comments, questions, or deletions
 */
export const hasFeedback = (
    comments: Map<number, FeedbackEntry>,
    questions: Map<number, FeedbackEntry>,
    deletedLines: Set<number>,
): boolean => {
    return comments.size > 0 || questions.size > 0 || deletedLines.size > 0;
};
