import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs';

import type { PlandersonSocketClient } from '~/lib/socket-ipc';
import type { FeedbackEntry } from '~/state/planViewState';
import { formatDiscardedSummary, formatFeedbackMessage, sendDecisionViaSocket } from '~/utils/feedback/decision';
import { resetWriteFunction, setWriteFunction } from '~/utils/io/logger';

/**
 * Helper to create mock socket client with optional implementation
 */
const createMockSocketClient = (
    implementation?: (decision: string, message?: string) => void,
): PlandersonSocketClient => {
    return {
        sendDecision: implementation ?? (() => {}),
    } as unknown as PlandersonSocketClient;
};

/**
 * Helper to create mock client that captures decision calls
 */
const createCapturingMockClient = (): {
    client: PlandersonSocketClient;
    capturedCalls: Array<{ decision: string; message?: string }>;
} => {
    const capturedCalls: Array<{ decision: string; message?: string }> = [];
    const client = {
        sendDecision: (decision: string, message?: string) => {
            capturedCalls.push({ decision, message });
        },
    } as unknown as PlandersonSocketClient;

    return { client, capturedCalls };
};

describe('feedback decision', () => {
    describe('formatFeedbackMessage', () => {
        describe('basic formatting', () => {
            test('returns undefined when no feedback exists', () => {
                const comments = new Map<number, FeedbackEntry>();
                const deletedLines = new Set<number>();
                const contentLines = ['line 1', 'line 2'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                );

                expect(result).toBeUndefined();
            });

            test('returns undefined when collections are empty', () => {
                const result = formatFeedbackMessage(
                    new Map<number, FeedbackEntry>(),
                    new Map<number, FeedbackEntry>(),
                    new Set(),
                    [],
                );
                expect(result).toBeUndefined();
            });

            test('formats comments only', () => {
                const comments = new Map([
                    [0, { text: 'This needs improvement', lines: [0] }],
                    [2, { text: 'Consider refactoring', lines: [2] }],
                ]);
                const deletedLines = new Set<number>();
                const contentLines = ['line 1', 'line 2', 'line 3'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                );

                expect(result).toContain('<comments>');
                expect(result).toContain('<ref line="1">line 1</ref>');
                expect(result).toContain('<feedback>This needs improvement</feedback>');
                expect(result).toContain('<ref line="3">line 3</ref>');
                expect(result).toContain('<feedback>Consider refactoring</feedback>');
                expect(result).not.toContain('<deletions>');
            });

            test('formats deletions only', () => {
                const comments = new Map<number, FeedbackEntry>();
                const deletedLines = new Set<number>([1, 3]);
                const contentLines = ['line 1', 'line 2', 'line 3', 'line 4'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                );

                expect(result).toContain('<deletions>');
                expect(result).toContain('<ref line="2">line 2</ref>');
                expect(result).toContain('<ref line="4">line 4</ref>');
                expect(result).not.toContain('<comments>');
            });

            test('formats both comments and deletions with blank line separator', () => {
                const comments = new Map([[0, { text: 'Fix this', lines: [0] }]]);
                const deletedLines = new Set<number>([2]);
                const contentLines = ['line 1', 'line 2', 'line 3'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                );

                expect(result).toContain('<comments>');
                expect(result).toContain('<ref line="1">line 1</ref>');
                expect(result).toContain('<feedback>Fix this</feedback>');
                expect(result).toContain('<deletions>');
                expect(result).toContain('<ref line="3">line 3</ref>');
                expect(result).toContain('\n\n');
            });

            test('sorts comments and deletions by line number', () => {
                const comments = new Map<number, FeedbackEntry>([
                    [5, { text: 'Comment on line 6', lines: [5] }],
                    [1, { text: 'Comment on line 2', lines: [1] }],
                    [3, { text: 'Comment on line 4', lines: [3] }],
                ]);
                const deletedLines = new Set<number>([7, 2, 4]);
                const contentLines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                )!;

                // Verify comments appear in ascending order
                const commentSection = result.split('<deletions>')[0];
                const line2Index = commentSection.indexOf('<ref line="2">');
                const line4Index = commentSection.indexOf('<ref line="4">');
                const line6Index = commentSection.indexOf('<ref line="6">');
                expect(line2Index).toBeLessThan(line4Index);
                expect(line4Index).toBeLessThan(line6Index);

                // Verify deletions appear in ascending order
                const deleteSection = result.split('<deletions>')[1];
                const del3Index = deleteSection.indexOf('<ref line="3">');
                const del5Index = deleteSection.indexOf('<ref line="5">');
                const del8Index = deleteSection.indexOf('<ref line="8">');
                expect(del3Index).toBeLessThan(del5Index);
                expect(del5Index).toBeLessThan(del8Index);
            });

            test('includes original line content in element body', () => {
                const comments = new Map<number, FeedbackEntry>([[0, { text: 'Comment here', lines: [0] }]]);
                const deletedLines = new Set<number>([1]);
                const contentLines = ['const foo = "bar"', 'let x = 42'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                );

                expect(result).toContain('<ref line="1">const foo = "bar"</ref>');
                expect(result).toContain('<ref line="2">let x = 42</ref>');
            });
        });

        describe('multi-line comments', () => {
            test('formats multi-line comment with individual ref per line', () => {
                const comments = new Map([[0, { text: 'Fix this', lines: [0, 1, 2] }]]);
                const contentLines = ['line 1', 'line 2', 'line 3', 'line 4'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    new Set(),
                    contentLines,
                );

                expect(result).toContain('<ref line="1">line 1</ref>');
                expect(result).toContain('<ref line="2">line 2</ref>');
                expect(result).toContain('<ref line="3">line 3</ref>');
                expect(result).toContain('<feedback>Fix this</feedback>');
            });

            test('formats non-consecutive lines with individual ref per line', () => {
                const comments = new Map([[0, { text: 'Non-consecutive', lines: [0, 2, 4] }]]);
                const contentLines = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    new Set(),
                    contentLines,
                );

                expect(result).toContain('<ref line="1">line 1</ref>');
                expect(result).toContain('<ref line="3">line 3</ref>');
                expect(result).toContain('<ref line="5">line 5</ref>');
                expect(result).toContain('<feedback>Non-consecutive</feedback>');
            });

            test('handles mix of single and multi-line comments', () => {
                const comments = new Map([
                    [0, { text: 'Single', lines: [0] }],
                    [2, { text: 'Multi', lines: [2, 3] }],
                    [5, { text: 'Another single', lines: [5] }],
                ]);
                const contentLines = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    new Set(),
                    contentLines,
                );

                expect(result).toContain('<ref line="1">l0</ref>');
                expect(result).toContain('<ref line="3">l2</ref>');
                expect(result).toContain('<ref line="4">l3</ref>');
                expect(result).toContain('<ref line="6">l5</ref>');
            });
        });

        describe('questions', () => {
            test('formats line-specific questions only', () => {
                const comments = new Map<number, FeedbackEntry>();
                const questions = new Map<number, FeedbackEntry>([
                    [0, { text: 'Why this approach?', lines: [0] }],
                    [2, { text: 'Is this needed?', lines: [2] }],
                ]);
                const deletedLines = new Set<number>();
                const contentLines = ['line 1', 'line 2', 'line 3'];

                const result = formatFeedbackMessage(comments, questions, deletedLines, contentLines);

                expect(result).toContain('<questions>');
                expect(result).toContain('<ref line="1">line 1</ref>');
                expect(result).toContain('<feedback>Why this approach?</feedback>');
                expect(result).toContain('<ref line="3">line 3</ref>');
                expect(result).toContain('<feedback>Is this needed?</feedback>');
                expect(result).toContain('must not call ExitPlanMode');
                expect(result).toContain('explicitly tells you to continue');
                expect(result).not.toContain('<comments>');
            });

            test('formats questions before comments', () => {
                const comments = new Map<number, FeedbackEntry>([[0, { text: 'Fix this', lines: [0] }]]);
                const questions = new Map<number, FeedbackEntry>([[1, { text: 'Why?', lines: [1] }]]);
                const deletedLines = new Set<number>();
                const contentLines = ['line 1', 'line 2'];

                const result = formatFeedbackMessage(comments, questions, deletedLines, contentLines);

                const questionsIndex = result!.indexOf('<questions>');
                const commentsIndex = result!.indexOf('<comments>');
                expect(questionsIndex).toBeLessThan(commentsIndex);
            });

            test('includes explicit instructions with questions', () => {
                const comments = new Map<number, FeedbackEntry>();
                const questions = new Map<number, FeedbackEntry>([[0, { text: 'Question', lines: [0] }]]);
                const deletedLines = new Set<number>();
                const contentLines = ['line 1'];

                const result = formatFeedbackMessage(comments, questions, deletedLines, contentLines);

                expect(result).toContain('<response_instructions>');
                expect(result).toContain('must not call ExitPlanMode');
                expect(result).toContain('explicitly tells you to continue');
            });

            test('omits hold instruction when questions are present without comments or deletions', () => {
                const questions = new Map<number, FeedbackEntry>([[0, { text: 'Question', lines: [0] }]]);
                const contentLines = ['line 1'];

                const result = formatFeedbackMessage(
                    new Map<number, FeedbackEntry>(),
                    questions,
                    new Set(),
                    contentLines,
                );

                expect(result).not.toContain('Do not act on');
                expect(result).not.toContain('apply all the feedback below');
            });

            test('includes hold instruction for comments when questions are present', () => {
                const comments = new Map<number, FeedbackEntry>([[0, { text: 'Fix this', lines: [0] }]]);
                const questions = new Map<number, FeedbackEntry>([[1, { text: 'Why?', lines: [1] }]]);
                const contentLines = ['line 1', 'line 2'];

                const result = formatFeedbackMessage(comments, questions, new Set(), contentLines);

                expect(result).toContain('Do not act on the comments below');
                expect(result).toContain('apply all the feedback below');
                expect(result).not.toContain('Do not act on the deletions below');
            });

            test('includes hold instruction for deletions when questions are present', () => {
                const questions = new Map<number, FeedbackEntry>([[0, { text: 'Why?', lines: [0] }]]);
                const contentLines = ['line 1', 'line 2'];

                const result = formatFeedbackMessage(
                    new Map<number, FeedbackEntry>(),
                    questions,
                    new Set([1]),
                    contentLines,
                );

                expect(result).toContain('Do not act on the deletions below');
                expect(result).toContain('apply all the feedback below');
                expect(result).not.toContain('Do not act on the comments below');
            });

            test('includes hold instruction for comments or deletions when all three are present', () => {
                const comments = new Map<number, FeedbackEntry>([[0, { text: 'Fix this', lines: [0] }]]);
                const questions = new Map<number, FeedbackEntry>([[1, { text: 'Why?', lines: [1] }]]);
                const contentLines = ['line 1', 'line 2', 'line 3'];

                const result = formatFeedbackMessage(comments, questions, new Set([2]), contentLines);

                expect(result).toContain('Do not act on the comments or deletions below');
                expect(result).toContain('apply all the feedback below');
            });
        });

        describe('edge cases', () => {
            test('handles empty contentLines gracefully', () => {
                const comments = new Map<number, FeedbackEntry>([[0, { text: 'comment', lines: [0] }]]);
                const deletedLines = new Set<number>();
                const contentLines: string[] = [];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                );

                expect(result).toContain('<comments>');
                expect(result).toContain('<ref line="1">undefined</ref>');
            });

            test('handles line indices beyond contentLines bounds', () => {
                const comments = new Map<number, FeedbackEntry>([[10, { text: 'out of bounds comment', lines: [10] }]]);
                const deletedLines = new Set<number>([20]);
                const contentLines = ['line 1', 'line 2'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                );

                expect(result).toContain('<ref line="11">undefined</ref>');
                expect(result).toContain('<ref line="21">undefined</ref>');
            });
        });
    });

    describe('formatDiscardedSummary', () => {
        describe('comments', () => {
            test('formats single comment', () => {
                const comments = new Map<number, FeedbackEntry>();
                comments.set(0, { text: 'comment 1', lines: [0] });
                const deletedLines = new Set<number>();

                const result = formatDiscardedSummary(comments, new Map(), deletedLines);

                expect(result).toBe('1 comment');
            });

            test('formats multiple comments with plural', () => {
                const comments = new Map<number, FeedbackEntry>();
                comments.set(0, { text: 'comment 1', lines: [0] });
                comments.set(1, { text: 'comment 2', lines: [1] });
                comments.set(2, { text: 'comment 3', lines: [2] });
                const deletedLines = new Set<number>();

                const result = formatDiscardedSummary(comments, new Map(), deletedLines);

                expect(result).toBe('3 comments');
            });
        });

        describe('deletions', () => {
            test('formats single deletion', () => {
                const comments = new Map<number, FeedbackEntry>();
                const deletedLines = new Set<number>([0]);

                const result = formatDiscardedSummary(comments, new Map(), deletedLines);

                expect(result).toBe('1 deletion');
            });

            test('formats multiple deletions with plural', () => {
                const comments = new Map<number, FeedbackEntry>();
                const deletedLines = new Set<number>([0, 1, 2, 3]);

                const result = formatDiscardedSummary(comments, new Map(), deletedLines);

                expect(result).toBe('4 deletions');
            });
        });

        describe('questions', () => {
            test('includes line questions in summary', () => {
                const comments = new Map<number, FeedbackEntry>();
                const questions = new Map<number, FeedbackEntry>([
                    [0, { text: 'Q1', lines: [0] }],
                    [1, { text: 'Q2', lines: [1] }],
                ]);
                const deletedLines = new Set<number>();

                const result = formatDiscardedSummary(comments, questions, deletedLines);

                expect(result).toBe('2 questions');
            });
        });

        describe('combinations', () => {
            test('formats both comments and deletions', () => {
                const comments = new Map<number, FeedbackEntry>();
                comments.set(0, { text: 'comment', lines: [0] });
                comments.set(1, { text: 'comment 2', lines: [1] });
                const deletedLines = new Set<number>([2, 3, 4]);

                const result = formatDiscardedSummary(comments, new Map(), deletedLines);

                expect(result).toBe('2 comments and 3 deletions');
            });

            test('uses singular forms correctly', () => {
                const comments = new Map<number, FeedbackEntry>();
                comments.set(0, { text: 'single comment', lines: [0] });
                const deletedLines = new Set<number>([1]);

                const result = formatDiscardedSummary(comments, new Map(), deletedLines);

                expect(result).toBe('1 comment and 1 deletion');
            });

            test('combines questions with comments and deletions', () => {
                const comments = new Map<number, FeedbackEntry>([[0, { text: 'C1', lines: [0] }]]);
                const questions = new Map<number, FeedbackEntry>([[1, { text: 'Q1', lines: [1] }]]);
                const deletedLines = new Set<number>([2, 3]);

                const result = formatDiscardedSummary(comments, questions, deletedLines);

                expect(result).toBe('1 question and 1 comment and 2 deletions');
            });

            test('returns empty string when no feedback', () => {
                const comments = new Map<number, FeedbackEntry>();
                const deletedLines = new Set<number>();

                const result = formatDiscardedSummary(comments, new Map(), deletedLines);

                expect(result).toBe('');
            });
        });
    });

    describe('sendDecisionViaSocket', () => {
        let originalAppendFileSync: typeof fs.appendFileSync;

        beforeEach(() => {
            // Mock fs.appendFileSync to prevent writing to real log files
            originalAppendFileSync = fs.appendFileSync;
            fs.appendFileSync = () => {}; // No-op to prevent file writes
        });

        afterEach(() => {
            // Restore fs.appendFileSync
            fs.appendFileSync = originalAppendFileSync;
        });

        describe('file mode', () => {
            test('does nothing without calling socket', () => {
                let sendDecisionCalled = false;
                const mockClient = createMockSocketClient(() => {
                    sendDecisionCalled = true;
                });

                sendDecisionViaSocket('session123', mockClient, 'file', 'accept');

                expect(sendDecisionCalled).toBe(false);
            });
        });

        describe('socket mode', () => {
            test('throws error when socket client is null', () => {
                expect(() => sendDecisionViaSocket('session123', null, 'socket', 'accept')).toThrow(
                    'Socket client not initialized',
                );
            });

            test('sends decision with message via socket', () => {
                const { client, capturedCalls } = createCapturingMockClient();

                sendDecisionViaSocket('session123', client, 'socket', 'accept', 'test message');

                expect(capturedCalls).toHaveLength(1);
                expect(capturedCalls[0]).toEqual({
                    decision: 'accept',
                    message: 'test message',
                });
            });

            test('sends decision without message via socket', () => {
                const { client, capturedCalls } = createCapturingMockClient();

                sendDecisionViaSocket('session123', client, 'socket', 'deny');

                expect(capturedCalls).toHaveLength(1);
                expect(capturedCalls[0]).toEqual({
                    decision: 'deny',
                    message: undefined,
                });
            });

            test('logs error and rethrows when socket send fails', () => {
                const mockClient = {
                    sendDecision: () => {
                        throw new Error('Network error');
                    },
                } as unknown as PlandersonSocketClient;

                const logWrites: Array<{ file: string; data: string }> = [];
                setWriteFunction((file: string, data: string) => {
                    logWrites.push({ file, data });
                });

                try {
                    expect(() =>
                        sendDecisionViaSocket('session123', mockClient, 'socket', 'accept', 'plan.md'),
                    ).toThrow('Network error');
                } finally {
                    resetWriteFunction();
                }

                // Should have written to both activity.log and error.log
                expect(logWrites.length).toBe(2);
                expect(logWrites[0].data).toContain('socket.errored');
                expect(logWrites[1].data).toContain('Network error');
            });

            test('handles both accept and deny decisions', () => {
                const { client, capturedCalls } = createCapturingMockClient();

                sendDecisionViaSocket('session1', client, 'socket', 'accept');
                sendDecisionViaSocket('session2', client, 'socket', 'deny', 'needs work');

                expect(capturedCalls).toHaveLength(2);
                expect(capturedCalls[0].decision).toBe('accept');
                expect(capturedCalls[1].decision).toBe('deny');
                expect(capturedCalls[1].message).toBe('needs work');
            });
        });
    });
});
