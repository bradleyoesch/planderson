/**
 * Text navigation utilities for input modes
 * Provides word-boundary detection and cursor positioning for advanced keyboard navigation
 */

import { wrapLine } from '~/utils/rendering/line-wrapping';

/**
 * Find the start position of the previous word from cursor position
 * Mid-word behavior: Alt+Left jumps to start of current word
 * Word boundary: whitespace (spaces/tabs)
 *
 * @param text - The input text
 * @param cursor - Current cursor position
 * @returns The position of the start of the previous word
 */
export const findPrevWordStart = (text: string, cursor: number): number => {
    if (cursor <= 0) return 0;

    let pos = cursor - 1;

    // Skip trailing whitespace
    while (pos > 0 && /\s/.test(text[pos])) {
        pos--;
    }

    // Skip word characters to find start
    while (pos > 0 && !/\s/.test(text[pos])) {
        pos--;
    }

    // Move to start of word (after whitespace)
    if (pos > 0 && /\s/.test(text[pos])) {
        pos++;
    }

    return pos;
};

/**
 * Find the start position of the next word from cursor position
 * Mid-word behavior: Alt+Right jumps to start of next word
 * Word boundary: whitespace (spaces/tabs)
 *
 * @param text - The input text
 * @param cursor - Current cursor position
 * @returns The position of the start of the next word
 */
export const findNextWordStart = (text: string, cursor: number): number => {
    if (cursor >= text.length) return text.length;

    let pos = cursor;

    // If we're in a word, skip to the end of it
    while (pos < text.length && !/\s/.test(text[pos])) {
        pos++;
    }

    // Skip whitespace to find start of next word
    while (pos < text.length && /\s/.test(text[pos])) {
        pos++;
    }

    return pos;
};

/**
 * Find start position for word deletion (Ctrl+W, Alt+Backspace)
 * Deletes from cursor back to start of word, including trailing whitespace
 *
 * @param text - The input text
 * @param cursor - Current cursor position
 * @param minPosition - Minimum position (0 for comment/question, 1 for command mode)
 * @returns The position to delete from
 */
/**
 * Compute the flat-string start position of each wrapped segment.
 * Uses the same indexOf-based algorithm as TextInput.tsx to handle
 * discarded spaces and trimmed continuations from wrapLine.
 */
const computeFlatStarts = (
    text: string,
    maxWidth: number,
): { segments: { content: string }[]; flatStarts: number[] } => {
    const segments = wrapLine(text, maxWidth);
    const { flatStarts } = segments.reduce<{ flatStarts: number[]; searchPos: number }>(
        (acc, seg) => {
            const found = text.indexOf(seg.content, acc.searchPos);
            const start = found >= 0 ? found : acc.searchPos;
            return { flatStarts: [...acc.flatStarts, start], searchPos: start + seg.content.length };
        },
        { flatStarts: [], searchPos: 0 },
    );
    return { segments, flatStarts };
};

/**
 * Find the cursor position after pressing the up arrow in a wrapped text input.
 * Moves to the same column on the previous wrapped segment.
 * When already on the first segment, returns 0 (beginning of input).
 *
 * @param text - The full input text
 * @param cursor - Current cursor position in flat-string coordinates
 * @param maxWidth - Maximum width used for wrapping
 * @returns New cursor position
 */
/**
 * Find the flat-string start position of the wrapped segment the cursor is on.
 *
 * @param text - The full input text
 * @param cursor - Current cursor position in flat-string coordinates
 * @param maxWidth - Maximum width used for wrapping
 * @returns Flat-string index of the start of the current wrapped segment
 */
export const findCurrentLineStart = (text: string, cursor: number, maxWidth: number): number => {
    const { segments, flatStarts } = computeFlatStarts(text, maxWidth);
    const segIdx = segments.reduce((best, _, i) => (flatStarts[i] <= cursor ? i : best), 0);
    const lineStart = flatStarts[segIdx];
    // If lineStart points to a '\n' separator (happens when an empty segment from a blank line
    // gets flatStart assigned to the preceding newline), advance past it so Ctrl+U never
    // crosses a newline boundary.
    return lineStart < text.length && text[lineStart] === '\n' ? lineStart + 1 : lineStart;
};

/**
 * Find the flat-string end position of the wrapped segment the cursor is on.
 *
 * @param text - The full input text
 * @param cursor - Current cursor position in flat-string coordinates
 * @param maxWidth - Maximum width used for wrapping
 * @returns Flat-string index of the end of the current wrapped segment
 */
export const findCurrentLineEnd = (text: string, cursor: number, maxWidth: number): number => {
    const { segments, flatStarts } = computeFlatStarts(text, maxWidth);
    const segIdx = segments.reduce((best, _, i) => (flatStarts[i] <= cursor ? i : best), 0);
    if (segIdx === segments.length - 1) return text.length;
    return flatStarts[segIdx] + segments[segIdx].content.length;
};

export const findCursorPositionUp = (text: string, cursor: number, maxWidth: number): number => {
    const { segments, flatStarts } = computeFlatStarts(text, maxWidth);
    const segIdx = segments.reduce((best, _, i) => (flatStarts[i] <= cursor ? i : best), 0);
    if (segIdx === 0) return 0;
    const colInSeg = cursor - flatStarts[segIdx];
    const newPos = flatStarts[segIdx - 1] + Math.min(colInSeg, segments[segIdx - 1].content.length);
    // When segments are adjacent (word-break kept trailing char), newPos may equal flatStarts[segIdx].
    // TextInput's (flatStarts[i] <= cursor) would render it on the current segment, not the previous one.
    // Subtract 1 to keep within the previous segment's territory.
    return newPos >= flatStarts[segIdx] ? flatStarts[segIdx] - 1 : newPos;
};

/**
 * Find the cursor position after pressing the down arrow in a wrapped text input.
 * Moves to the same column on the next wrapped segment.
 * When already on the last segment, returns text.length (end of input).
 *
 * @param text - The full input text
 * @param cursor - Current cursor position in flat-string coordinates
 * @param maxWidth - Maximum width used for wrapping
 * @returns New cursor position
 */
export const findCursorPositionDown = (text: string, cursor: number, maxWidth: number): number => {
    const { segments, flatStarts } = computeFlatStarts(text, maxWidth);
    const segIdx = segments.reduce((best, _, i) => (flatStarts[i] <= cursor ? i : best), 0);
    if (segIdx === segments.length - 1) return text.length;
    const colInSeg = cursor - flatStarts[segIdx];
    return flatStarts[segIdx + 1] + Math.min(colInSeg, segments[segIdx + 1].content.length);
};

export const findWordDeleteStart = (text: string, cursor: number, minPosition: number = 0): number => {
    if (cursor <= minPosition) return minPosition;

    let pos = cursor - 1;

    // Skip trailing whitespace
    while (pos >= minPosition && /\s/.test(text[pos])) {
        pos--;
    }

    // Skip word characters
    while (pos >= minPosition && !/\s/.test(text[pos])) {
        pos--;
    }

    return Math.max(minPosition, pos + 1);
};
