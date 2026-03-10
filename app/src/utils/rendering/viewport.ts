import { PlanViewMode } from '~/utils/config/constants';
import { countTerminalLinesInRange, FeedbackMetadata, LineMetadata } from '~/utils/rendering/line-wrapping';

const HEADER_HEIGHT = 3;

/**
 * Calculate footer height based on mode and number of input lines.
 * comment/question footer = 3 (separator + title + padding) + inputLineCount.
 * All other modes use fixed heights unaffected by input line count.
 */
const getFooterHeight = (mode: PlanViewMode, inputLineCount: number = 1): number => {
    if (mode === 'plan' || mode === 'help') return 1;
    if (mode === 'command') return inputLineCount;
    if (mode === 'comment' || mode === 'question') return 3 + inputLineCount;
    // confirm-approve, confirm-deny, confirm-cancel:
    // InlinePane (separator + title + blank) = 3, question + 2 choices + blank + help = 5
    return 8;
};

/**
 * Calculate viewport height for plan content based on mode, terminal height, and input line count.
 * inputLineCount defaults to 1 (single-line input). Pass the number of wrapped lines in the
 * active comment/question input to dynamically shrink the plan viewport.
 */
export const calculateViewportHeight = (
    mode: PlanViewMode,
    terminalHeight: number,
    inputLineCount: number = 1,
): number => {
    const footerHeight = getFooterHeight(mode, inputLineCount);
    return Math.max(1, terminalHeight - HEADER_HEIGHT - footerHeight);
};

/**
 * Count how many feedback lines (comments/questions) will be rendered in a given range.
 * This accounts for the extra lines shown above content lines with feedback.
 * Uses pre-wrapped feedback to avoid re-wrapping.
 *
 * Logic matches Plan.tsx rendering:
 * - A feedback item is shown if:
 *   1. The previous line is before the start (not visible), AND this line has feedback, OR
 *   2. This line's feedback is different from the previous line's feedback
 *
 * @param startLine - Start of range (inclusive)
 * @param endLine - End of range (exclusive)
 * @param wrappedComments - Pre-wrapped comment feedback
 * @param wrappedQuestions - Pre-wrapped question feedback
 * @returns Number of terminal lines consumed by feedback items
 */
export const countFeedbackLines = (
    startLine: number,
    endLine: number,
    wrappedComments: FeedbackMetadata[],
    wrappedQuestions: FeedbackMetadata[],
): number => {
    let count = 0;

    // Create maps for quick lookup by line index
    const commentsByLine = new Map<number, FeedbackMetadata>();
    wrappedComments.forEach((comment) => {
        commentsByLine.set(comment.lineIndex, comment);
    });

    const questionsByLine = new Map<number, FeedbackMetadata>();
    wrappedQuestions.forEach((question) => {
        questionsByLine.set(question.lineIndex, question);
    });

    // Convert for loop to array method
    Array.from({ length: endLine - startLine }, (_, idx) => startLine + idx).forEach((i) => {
        const commentFeedback = commentsByLine.get(i);
        const questionFeedback = questionsByLine.get(i);
        const prevIndex = i - 1;

        // Check if this is the start of a comment range
        // Show comment if: previous is out of range OR comment text changed
        const shouldShowComment =
            commentFeedback &&
            (prevIndex < startLine || commentsByLine.get(i)?.text !== commentsByLine.get(prevIndex)?.text);

        // Check if this is the start of a question range
        // Show question if: previous is out of range OR question text changed
        const shouldShowQuestion =
            questionFeedback &&
            (prevIndex < startLine || questionsByLine.get(i)?.text !== questionsByLine.get(prevIndex)?.text);

        if (shouldShowComment) {
            // Use pre-computed segment count (already accounts for wrapping)
            count += commentFeedback.segments.length;
        }

        if (shouldShowQuestion) {
            // Use pre-computed segment count (already accounts for wrapping)
            count += questionFeedback.segments.length;
        }
    });

    return count;
};

/**
 * Calculate the maximum scroll offset that allows showing content in the viewport.
 * Accounts for line wrapping and feedback lines.
 *
 * @param wrappedLines - Array of line metadata
 * @param viewportHeight - Available terminal lines for content
 * @param wrappedComments - Pre-wrapped comment feedback
 * @param wrappedQuestions - Pre-wrapped question feedback
 * @returns Maximum scroll offset (logical line index)
 */
export const calculateMaxScroll = (
    wrappedLines: LineMetadata[],
    viewportHeight: number,
    wrappedComments: FeedbackMetadata[],
    wrappedQuestions: FeedbackMetadata[],
): number => {
    const contentLength = wrappedLines.length;

    if (contentLength === 0) {
        return 0;
    }

    // If all content fits in viewport, no scrolling needed
    const feedbackLines = countFeedbackLines(0, contentLength, wrappedComments, wrappedQuestions);
    const totalTerminalLines = wrappedLines.reduce((sum, line) => sum + line.renderedLineCount, 0);
    const totalContentLines = totalTerminalLines + feedbackLines;

    if (totalContentLines <= viewportHeight) {
        return 0;
    }

    // Find the maximum scroll offset where remaining content fits in viewport
    let startLine = contentLength - 1;

    while (startLine > 0) {
        // Calculate terminal lines from startLine to end
        const terminalLines = countTerminalLinesInRange(wrappedLines, startLine, contentLength - 1);

        // Add feedback lines
        const feedbackLines = countFeedbackLines(startLine, contentLength, wrappedComments, wrappedQuestions);

        const totalLines = terminalLines + feedbackLines;

        // If we can fit within viewport, this is our maxScroll
        if (totalLines <= viewportHeight) {
            break;
        }

        startLine--;
    }

    return startLine;
};
