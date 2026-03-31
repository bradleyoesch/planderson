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

// Build XML ref elements for a set of line indices
const buildRefs = (lines: number[], contentLines: string[]): string =>
    lines
        .sort((a, b) => a - b)
        .map((line) => `    <ref line="${line + 1}">${contentLines[line]}</ref>`)
        .join('\n');

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
        const questionItems = questionEntries.map(([, entry]) => {
            const lines = entry.lines.sort((a, b) => a - b);
            return `  <question>\n${buildRefs(lines, contentLines)}\n    <feedback>${entry.text}</feedback>\n  </question>`;
        });

        const holdParts: string[] = [];
        if (comments.size > 0) holdParts.push('comments');
        if (deletedLines.size > 0) holdParts.push('deletions');

        const holdLine =
            holdParts.length > 0
                ? `\nDo not act on the ${holdParts.join(' or ')} below — hold them until the user confirms to proceed.`
                : '';
        const applyClause = holdParts.length > 0 ? ` — and when you do, apply all the feedback below` : '';

        messageParts.push(
            `<response_instructions>\n` +
                `Respond with plain text only — this response must not call ExitPlanMode or any other tool.\n` +
                `The reason: the user needs to read your answers and may ask follow-up questions before deciding to proceed.${holdLine}\n` +
                `Only call ExitPlanMode after the user explicitly tells you to continue (e.g., "proceed", "continue", "go ahead")${applyClause}.\n` +
                `</response_instructions>\n\n` +
                `<questions>\n${questionItems.join('\n')}\n</questions>`,
        );
    }

    if (comments.size > 0) {
        const commentEntries = [...comments.entries()].sort(([a], [b]) => a - b);
        const commentItems = commentEntries.map(([, entry]) => {
            const lines = entry.lines.sort((a, b) => a - b);
            return `  <comment>\n${buildRefs(lines, contentLines)}\n    <feedback>${entry.text}</feedback>\n  </comment>`;
        });
        messageParts.push(`<comments>\n${commentItems.join('\n')}\n</comments>`);
    }

    if (deletedLines.size > 0) {
        const deletionItems = [...deletedLines]
            .sort((a, b) => a - b)
            .map((line) => `  <deletion>\n    <ref line="${line + 1}">${contentLines[line]}</ref>\n  </deletion>`);
        messageParts.push(`<deletions>\n${deletionItems.join('\n')}\n</deletions>`);
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
