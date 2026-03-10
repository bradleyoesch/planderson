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

                expect(result).toContain('Comments on the plan:');
                expect(result).toContain('Line 1: "line 1"');
                expect(result).toContain('This needs improvement');
                expect(result).toContain('Line 3: "line 3"');
                expect(result).toContain('Consider refactoring');
                expect(result).not.toContain('Delete lines:');
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

                expect(result).toContain('Delete lines:');
                expect(result).toContain('Line 2: "line 2"');
                expect(result).toContain('Line 4: "line 4"');
                expect(result).not.toContain('Comments on the plan:');
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

                expect(result).toContain('Comments on the plan:');
                expect(result).toContain('Line 1: "line 1"');
                expect(result).toContain('Fix this');
                expect(result).toContain('Delete lines:');
                expect(result).toContain('Line 3: "line 3"');
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
                const commentSection = result.split('Delete lines:')[0];
                const line2Index = commentSection.indexOf('Line 2:');
                const line4Index = commentSection.indexOf('Line 4:');
                const line6Index = commentSection.indexOf('Line 6:');
                expect(line2Index).toBeLessThan(line4Index);
                expect(line4Index).toBeLessThan(line6Index);

                // Verify deletions appear in ascending order
                const deleteSection = result.split('Delete lines:')[1];
                const del3Index = deleteSection.indexOf('Line 3:');
                const del5Index = deleteSection.indexOf('Line 5:');
                const del8Index = deleteSection.indexOf('Line 8:');
                expect(del3Index).toBeLessThan(del5Index);
                expect(del5Index).toBeLessThan(del8Index);
            });

            test('includes original line content in quotes', () => {
                const comments = new Map<number, FeedbackEntry>([[0, { text: 'Comment here', lines: [0] }]]);
                const deletedLines = new Set<number>([1]);
                const contentLines = ['const foo = "bar"', 'let x = 42'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    deletedLines,
                    contentLines,
                );

                expect(result).toContain('Line 1: "const foo = "bar""');
                expect(result).toContain('Line 2: "let x = 42"');
            });
        });

        describe('multi-line comments', () => {
            test('formats multi-line comment with range using stored lines array', () => {
                const comments = new Map([[0, { text: 'Fix this', lines: [0, 1, 2] }]]);
                const contentLines = ['line 1', 'line 2', 'line 3', 'line 4'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    new Set(),
                    contentLines,
                );

                expect(result).toContain('Lines 1-3:');
                expect(result).toContain('"line 1" "line 2" "line 3"');
                expect(result).toContain('Fix this');
            });

            test('formats non-consecutive range correctly', () => {
                const comments = new Map([[0, { text: 'Non-consecutive', lines: [0, 2, 4] }]]);
                const contentLines = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'];

                const result = formatFeedbackMessage(
                    comments,
                    new Map<number, FeedbackEntry>(),
                    new Set(),
                    contentLines,
                );

                expect(result).toContain('Lines 1-5:');
                expect(result).toContain('"line 1" "line 3" "line 5"');
                expect(result).toContain('Non-consecutive');
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

                expect(result).toContain('Line 1: "l0"');
                expect(result).toContain('Lines 3-4: "l2" "l3"');
                expect(result).toContain('Line 6: "l5"');
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

                expect(result).toContain('Questions about the plan:');
                expect(result).toContain('Line 1: "line 1"');
                expect(result).toContain('Why this approach?');
                expect(result).toContain('Line 3: "line 3"');
                expect(result).toContain('Is this needed?');
                expect(result).toContain('Do NOT call ExitPlanMode in this response');
                expect(result).toContain(
                    'Only call ExitPlanMode again after the user has explicitly asked you to proceed',
                );
                expect(result).not.toContain('Comments on the plan:');
            });

            test('formats questions before comments', () => {
                const comments = new Map<number, FeedbackEntry>([[0, { text: 'Fix this', lines: [0] }]]);
                const questions = new Map<number, FeedbackEntry>([[1, { text: 'Why?', lines: [1] }]]);
                const deletedLines = new Set<number>();
                const contentLines = ['line 1', 'line 2'];

                const result = formatFeedbackMessage(comments, questions, deletedLines, contentLines);

                // Questions section should appear before comments section
                const questionsIndex = result!.indexOf('Questions about the plan:');
                const commentsIndex = result!.indexOf('Comments on the plan:');
                expect(questionsIndex).toBeLessThan(commentsIndex);
                expect(result).toContain('still use the below feedback');
            });

            test('includes explicit instructions with questions', () => {
                const comments = new Map<number, FeedbackEntry>();
                const questions = new Map<number, FeedbackEntry>([[0, { text: 'Question', lines: [0] }]]);
                const deletedLines = new Set<number>();
                const contentLines = ['line 1'];

                const result = formatFeedbackMessage(comments, questions, deletedLines, contentLines);

                expect(result).toContain('Do NOT call ExitPlanMode in this response');
                expect(result).toContain(
                    'Only call ExitPlanMode again after the user has explicitly asked you to proceed',
                );
                expect(result).toContain('still use the below feedback');
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

                expect(result).toContain('Comments on the plan:');
                expect(result).toContain('Line 1: "undefined"');
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

                expect(result).toContain('Line 11: "undefined"');
                expect(result).toContain('Line 21: "undefined"');
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
