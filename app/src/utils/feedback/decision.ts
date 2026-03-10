import { PlandersonSocketClient } from '~/lib/socket-ipc';
import { FeedbackEntry } from '~/state/planViewState';
import { PlandersonMode } from '~/utils/config/constants';
import { logError } from '~/utils/io/logger';

// Helper to send decision via socket (no-op in file mode)
export const sendDecisionViaSocket = (
    sessionId: string,
    socketClient: PlandersonSocketClient | null,
    mode: PlandersonMode,
    decision: 'accept' | 'deny',
    message?: string,
): void => {
    if (mode === 'file') {
        // File mode: just log the decision, don't send to socket
        return;
    }

    try {
        if (!socketClient) {
            throw new Error('Socket client not initialized');
        }

        socketClient.sendDecision(decision, message);
    } catch (err) {
        logError(__filename, sessionId, 'socket.errored', err as Error, 'failed to send decision');
        throw err;
    }
};

// Format feedback message for deny action
export const formatFeedbackMessage = (
    comments: Map<number, FeedbackEntry>,
    questions: Map<number, FeedbackEntry>,
    deletedLines: Set<number>,
    contentLines: string[],
): string | undefined => {
    const messageParts: string[] = [];

    // Questions section FIRST (if present)
    if (questions.size > 0) {
        const questionEntries = [...questions.entries()].sort(([a], [b]) => a - b);
        const questionBlocks: string[] = [];

        questionEntries.forEach(([anchorLine, entry]) => {
            const lines = entry.lines.sort((a, b) => a - b); // Ensure sorted

            if (lines.length > 1) {
                // Multi-line question: show range with all quoted line contents
                const lineContents = lines.map((line) => `"${contentLines[line]}"`).join(' ');
                questionBlocks.push(`Lines ${lines[0] + 1}-${lines.at(-1)! + 1}: ${lineContents}\n${entry.text}`);
            } else {
                // Single line question: existing format
                questionBlocks.push(`Line ${anchorLine + 1}: "${contentLines[anchorLine]}"\n${entry.text}`);
            }
        });

        messageParts.push(
            `Questions about the plan:\n${questionBlocks.join('\n')}\n\n` +
                `Please answer these questions. Do NOT call ExitPlanMode in this response — ` +
                `just answer the questions with plain text and stop. ` +
                `The user will read your answers and reply in chat. ` +
                `Only call ExitPlanMode again after the user has explicitly asked you to proceed. ` +
                `When you return to plan mode, still use the below feedback.`,
        );
    }

    if (comments.size > 0) {
        const commentEntries = [...comments.entries()].sort(([a], [b]) => a - b);
        const commentBlocks: string[] = [];

        commentEntries.forEach(([anchorLine, entry]) => {
            const lines = entry.lines.sort((a, b) => a - b); // Ensure sorted

            if (lines.length > 1) {
                // Multi-line comment: show range with all quoted line contents
                const lineContents = lines.map((line) => `"${contentLines[line]}"`).join(' ');
                commentBlocks.push(`Lines ${lines[0] + 1}-${lines.at(-1)! + 1}: ${lineContents}\n${entry.text}`);
            } else {
                // Single line comment: existing format
                commentBlocks.push(`Line ${anchorLine + 1}: "${contentLines[anchorLine]}"\n${entry.text}`);
            }
        });

        messageParts.push(`Comments on the plan:\n${commentBlocks.join('\n')}`);
    }

    if (deletedLines.size > 0) {
        const deletedBlocks = [...deletedLines]
            .sort((a, b) => a - b)
            .map((line) => `Line ${line + 1}: "${contentLines[line]}"`)
            .join('\n');
        messageParts.push(`Delete lines:\n${deletedBlocks}`);
    }

    if (messageParts.length > 0) {
        return messageParts.join('\n\n');
    }

    return undefined;
};

// Format discarded feedback summary for accept action
export const formatDiscardedSummary = (
    comments: Map<number, FeedbackEntry>,
    questions: Map<number, FeedbackEntry>,
    deletedLines: Set<number>,
): string => {
    const discardedItems: string[] = [];

    if (questions.size > 0) {
        discardedItems.push(`${questions.size} question${questions.size !== 1 ? 's' : ''}`);
    }

    if (comments.size > 0) {
        discardedItems.push(`${comments.size} comment${comments.size !== 1 ? 's' : ''}`);
    }

    if (deletedLines.size > 0) {
        discardedItems.push(`${deletedLines.size} deletion${deletedLines.size !== 1 ? 's' : ''}`);
    }

    return discardedItems.join(' and ');
};
