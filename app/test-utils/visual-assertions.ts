/**
 * Visual assertion helpers for integration tests
 *
 * These helpers extract semantic meaning from ANSI-formatted terminal output,
 * allowing tests to verify visual states without coupling to exact ANSI codes.
 *
 * Structure:
 * - Internal helpers (line finding, ANSI checking)
 * - Highlighting (cursor/selection - share same visual representation)
 * - Deletion state (strikethrough formatting)
 * - Feedback markers (comments, questions)
 * - UI modes (input screens)
 * - Aggregate checks (any feedback, any deletion)
 */

import { ANSI, COLORS } from '~/test-utils/ansi-assertions';
import { stripAnsi } from '~/test-utils/ink-helpers';

// ============================================================================
// Constants
// ============================================================================

const MARKERS = {
    COMMENT: '💬',
    QUESTION: '❓',
} as const;

// ============================================================================
// Internal helpers
// ============================================================================

const escapeRegex = (str: string): string => str.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');

const findLine = (frame: string, lineContent: string): string | undefined => {
    return frame.split('\n').find((line) => line.includes(lineContent));
};

const findLineIndex = (frame: string, lineContent: string): number => {
    return frame.split('\n').findIndex((line) => line.includes(lineContent));
};

const splitLines = (frame: string): string[] => frame.split('\n');

// ============================================================================
// Highlighting (Cursor & Selection)
// Note: Cursor and selection share the same visual representation (background)
// ============================================================================

/**
 * Check if a line has highlight (cursor or selection)
 */
export const hasCursorHighlight = (frame: string, lineContent: string): boolean => {
    const line = findLine(frame, lineContent);
    return !!line && line.includes(ANSI.CURSOR_HIGHLIGHT);
};

/**
 * Alias for cursor highlight - selection uses same visual representation
 */
export const hasSelectionHighlight = hasCursorHighlight;

/**
 * Get the first highlighted line (cursor position)
 */
export const getCursorLine = (frame: string): string | null => {
    const line = splitLines(frame).find((l) => l.includes(ANSI.CURSOR_HIGHLIGHT));
    return line ? stripAnsi(line).trim() : null;
};

/**
 * Get all highlighted lines (multi-line selection)
 */
export const getSelectedLines = (frame: string): string[] => {
    return splitLines(frame)
        .filter((line) => line.includes(ANSI.CURSOR_HIGHLIGHT))
        .map((line) => stripAnsi(line).trim())
        .filter((line) => line.length > 0);
};

/**
 * Count highlighted lines
 */
export const countSelectedLines = (frame: string): number => getSelectedLines(frame).length;

/**
 * Check if any lines are highlighted
 */
export const hasSelection = (frame: string): boolean => countSelectedLines(frame) > 0;

/**
 * Check if all specified lines are highlighted
 */
export const areLinesSelected = (frame: string, lineContents: string[]): boolean => {
    return lineContents.every((content) => hasCursorHighlight(frame, content));
};

// ============================================================================
// Deletion state (strikethrough + color)
// ============================================================================

/**
 * Check if a line has strikethrough formatting
 */
export const hasStrikethrough = (frame: string, lineContent: string): boolean => {
    const line = findLine(frame, lineContent);
    if (!line) return false;

    const pattern = new RegExp(
        `${escapeRegex(ANSI.STRIKETHROUGH)}[^]*?${escapeRegex(lineContent)}[^]*?${escapeRegex(ANSI.STRIKETHROUGH_END)}`,
    );
    return pattern.test(line);
};

/**
 * Check if a line is deleted (strikethrough + delete color)
 */
export const isLineDeleted = (frame: string, lineContent: string): boolean => {
    const line = findLine(frame, lineContent);
    return !!line && line.includes(ANSI.STRIKETHROUGH) && line.includes(COLORS.DELETED);
};

/**
 * Check if a line is NOT deleted
 */
export const isLineNotDeleted = (frame: string, lineContent: string): boolean => {
    const line = findLine(frame, lineContent);
    return !!line && !line.includes(ANSI.STRIKETHROUGH) && !line.includes(COLORS.DELETED);
};

/**
 * Get all deleted line contents
 */
export const getDeletedLines = (frame: string): string[] => {
    return splitLines(frame)
        .filter((line) => line.includes(ANSI.STRIKETHROUGH) && line.includes(COLORS.DELETED))
        .map((line) => stripAnsi(line))
        .filter((line) => line.trim().length > 0);
};

/**
 * Count deleted lines
 */
export const countDeletedLines = (frame: string): number => getDeletedLines(frame).length;

/**
 * Check if all specified lines are deleted
 */
export const areLinesDeleted = (frame: string, lineContents: string[]): boolean => {
    return lineContents.every((content) => isLineDeleted(frame, content));
};

/**
 * Check if all specified lines are NOT deleted
 */
export const areLinesNotDeleted = (frame: string, lineContents: string[]): boolean => {
    return lineContents.every((content) => isLineNotDeleted(frame, content));
};

/**
 * Check if cursor is on a deleted line
 */
export const isCursorOnDeletedLine = (frame: string, lineContent: string): boolean => {
    return hasCursorHighlight(frame, lineContent) && isLineDeleted(frame, lineContent);
};

/**
 * Check if cursor is on a normal line
 */
export const isCursorOnNormalLine = (frame: string, lineContent: string): boolean => {
    return hasCursorHighlight(frame, lineContent) && isLineNotDeleted(frame, lineContent);
};

// ============================================================================
// Feedback markers (comments & questions)
// ============================================================================

/**
 * Check if a line has a comment marker (💬) above it
 * Checks consecutive feedback lines immediately above (stops at first non-feedback line)
 */
export const hasComment = (frame: string, lineContent: string): boolean => {
    const lines = splitLines(frame);
    const index = lines.findIndex((line) => line.includes(lineContent));
    if (index <= 0) return false;

    // Get lines above target, reverse to check from closest to farthest
    const linesAbove = lines.slice(0, index).reverse();

    // Find first non-feedback line
    const isFeedbackLine = (line: string) => line.includes(MARKERS.QUESTION) || line.includes(MARKERS.COMMENT);
    const firstNonFeedbackIndex = linesAbove.findIndex((line) => !isFeedbackLine(line));

    // Get only consecutive feedback lines (or all if no non-feedback line found)
    const consecutiveFeedback = firstNonFeedbackIndex === -1 ? linesAbove : linesAbove.slice(0, firstNonFeedbackIndex);

    return consecutiveFeedback.some((line) => line.includes(MARKERS.COMMENT));
};

/**
 * Check if a line has a question marker (❓) above it
 * Checks consecutive feedback lines immediately above (stops at first non-feedback line)
 */
export const hasQuestion = (frame: string, lineContent: string): boolean => {
    const lines = splitLines(frame);
    const index = lines.findIndex((line) => line.includes(lineContent));
    if (index <= 0) return false;

    // Get lines above target, reverse to check from closest to farthest
    const linesAbove = lines.slice(0, index).reverse();

    // Find first non-feedback line
    const isFeedbackLine = (line: string) => line.includes(MARKERS.QUESTION) || line.includes(MARKERS.COMMENT);
    const firstNonFeedbackIndex = linesAbove.findIndex((line) => !isFeedbackLine(line));

    // Get only consecutive feedback lines (or all if no non-feedback line found)
    const consecutiveFeedback = firstNonFeedbackIndex === -1 ? linesAbove : linesAbove.slice(0, firstNonFeedbackIndex);

    return consecutiveFeedback.some((line) => line.includes(MARKERS.QUESTION));
};

/**
 * Get all feedback types for a line
 * Returns an object indicating which feedback types exist on the line
 */
export const getFeedbackForLine = (
    frame: string,
    lineContent: string,
): { hasComment: boolean; hasQuestion: boolean; isDeleted: boolean } => {
    return {
        hasComment: hasComment(frame, lineContent),
        hasQuestion: hasQuestion(frame, lineContent),
        isDeleted: isLineDeleted(frame, lineContent),
    };
};

/**
 * Get comment text for a line (null if none)
 */
export const getCommentText = (frame: string, lineContent: string): string | null => {
    const lines = splitLines(frame);
    const index = findLineIndex(frame, lineContent);
    if (index <= 0) return null;

    const lineAbove = stripAnsi(lines[index - 1]);
    if (!lineAbove.includes(MARKERS.COMMENT)) return null;

    const match = lineAbove.match(/💬\s*(.+)/);
    return match ? match[1].trim() : null;
};

/**
 * Get question text for a line (null if none)
 */
export const getQuestionText = (frame: string, lineContent: string): string | null => {
    const lines = splitLines(frame);
    const index = findLineIndex(frame, lineContent);
    if (index <= 0) return null;

    const lineAbove = stripAnsi(lines[index - 1]);
    if (!lineAbove.includes(MARKERS.QUESTION)) return null;

    const match = lineAbove.match(/💭\s*(.+)/);
    return match ? match[1].trim() : null;
};

/**
 * Count comment markers
 */
export const countComments = (frame: string): number => {
    return (frame.match(/💬/g) || []).length;
};

/**
 * Count question markers
 */
export const countQuestions = (frame: string): number => {
    return (frame.match(/❓/g) || []).length;
};

// ============================================================================
// UI modes (input screens)
// ============================================================================

/**
 * Check if in comment input mode
 */
export const isInCommentMode = (frame: string): boolean => frame.includes('Comment');

/**
 * Check if in question input mode
 */
export const isInQuestionMode = (frame: string): boolean => frame.includes('Question');

// ============================================================================
// Aggregate semantic checks
// ============================================================================

/**
 * Check if any deletions exist
 */
export const hasDeletion = (frame: string): boolean => countDeletedLines(frame) > 0;

/**
 * Check if any feedback exists (comments, questions, or deletions)
 */
export const hasFeedback = (frame: string): boolean => {
    return countComments(frame) > 0 || countQuestions(frame) > 0 || hasDeletion(frame);
};

// ============================================================================
// Rendered line helpers
// ============================================================================

/**
 * Get all non-empty terminal lines, stripped of ANSI codes and trimmed.
 * Use when you need to assert exact line content or line ordering.
 *
 * @example
 * const lines = getRenderedLines(frame);
 * expect(lines[0]).toBe('hello');
 * expect(lines[1]).toBe('worldly');
 */
export const getRenderedLines = (frame: string): string[] =>
    splitLines(frame)
        .map((l) => stripAnsi(l).trim())
        .filter((l) => l.length > 0);

// ============================================================================
// Input cursor helpers (for TextInput component in input modes)
// ============================================================================

/**
 * Check if input cursor block (█) appears at the end of text
 * Used when cursor is at end of line in input fields
 */
export const hasInputCursorAtEnd = (frame: string, text: string): boolean => {
    return stripAnsi(frame).includes(`${text}${ANSI.INPUT_CURSOR_BLOCK}`);
};

/**
 * Check if input cursor is on a specific character (inverted colors)
 * Used when cursor is in the middle of text in input fields
 *
 * @param frame - The terminal output with ANSI codes
 * @param textBefore - The text that appears before the cursor
 * @param char - The character that should be under the cursor
 */
export const hasInputCursorOnChar = (frame: string, textBefore: string, char: string): boolean => {
    // Pattern: textBefore + white background + black foreground + character
    const pattern = new RegExp(
        `${escapeRegex(textBefore)}${escapeRegex(ANSI.INPUT_CURSOR_BG)}${escapeRegex(ANSI.INPUT_CURSOR_FG)}${escapeRegex(char)}`,
    );
    return pattern.test(frame);
};

/**
 * Check if input shows only the cursor block (empty input)
 */
export const hasOnlyInputCursor = (frame: string): boolean => {
    const lines = splitLines(frame);
    const inputLine = lines.find((line) => line.includes(ANSI.INPUT_CURSOR_BLOCK));
    return !!inputLine && stripAnsi(inputLine).trim() === ANSI.INPUT_CURSOR_BLOCK;
};
