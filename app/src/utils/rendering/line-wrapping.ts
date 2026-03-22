import stringWidth from 'string-width';

import type { FeedbackEntry } from '~/state/planViewState';

import type { LineFormatting, TextSegment } from './markdown/markdown';

const BREAK_CHARS = new Set([
    ' ',
    '`',
    '~',
    '-',
    '_',
    '=',
    '+',
    '[',
    '{',
    ']',
    '}',
    '\\',
    '|',
    ';',
    ':',
    "'",
    '"',
    ',',
    '<',
    '.',
    '>',
    '/',
    '?',
    '!',
    '@',
    '#',
    '$',
    '%',
    '^',
    '&',
    '*',
    '(',
    ')',
]);

const isBreakChar = (char: string): boolean => BREAK_CHARS.has(char);

/**
 * Represents a single wrapped segment of a logical line (legacy format)
 */
export interface WrappedSegment {
    content: string; // Text that fits within terminal width
    segmentIndex: number; // 0-based index within this logical line
}

/**
 * Represents a wrapped segment with markdown formatting
 */
export interface WrappedSegmentWithFormatting {
    segments: TextSegment[]; // Text segments that fit within terminal width
    segmentIndex: number; // 0-based index within this logical line
}

/**
 * Metadata for a single logical line (plan line) and how it wraps
 */
export interface LineMetadata {
    planLineIndex: number; // Original line index (0-based)
    originalContent: string; // Full line content before wrapping
    renderedLineCount: number; // Terminal lines this logical line occupies
    segments: WrappedSegment[]; // Array of wrapped segments (legacy format for backward compatibility)
    formattedSegments: WrappedSegmentWithFormatting[]; // Markdown segments with formatting
    formatting: LineFormatting; // Markdown formatting information
}

/**
 * Metadata for wrapped feedback (comment or question) on a specific line
 */
export interface FeedbackMetadata {
    lineIndex: number; // Plan line index this feedback is attached to
    text: string; // Original feedback text
    segments: WrappedSegment[]; // Wrapped segments
    type: 'comment' | 'question';
}

/**
 * Wraps LineFormatting (with TextSegments) into WrappedSegmentsWithFormatting.
 * Handles splitting TextSegments across lines while preserving formatting properties.
 *
 * @param formatting - LineFormatting with TextSegments
 * @param maxWidth - Maximum visible width per wrapped segment
 * @returns Array of WrappedSegmentsWithFormatting with TextSegment arrays
 */
export const wrapLineSegments = (
    formatting: LineFormatting,
    maxWidth: number,
    wordWrap: boolean = true,
): WrappedSegmentWithFormatting[] => {
    // Handle empty segments
    if (formatting.segments.length === 0) {
        return [{ segments: [], segmentIndex: 0 }];
    }

    if (!wordWrap) {
        // Character-wrap mode (used for code blocks): original char-by-char algorithm
        const wrappedSegments: WrappedSegmentWithFormatting[] = [];
        let currentSegments: TextSegment[] = [];
        let currentWidth = 0;
        let segmentIndex = 0;

        const flushSegments = (): void => {
            if (currentSegments.length > 0) {
                wrappedSegments.push({ segments: currentSegments, segmentIndex: segmentIndex++ });
                currentSegments = [];
                currentWidth = 0;
            }
        };

        formatting.segments.forEach((textSegment) => {
            let remainingText = textSegment.text;
            while (remainingText.length > 0) {
                const chars = [...remainingText];
                let accumulatedWidth = 0;
                let accumulatedChars = 0;

                // eslint-disable-next-line no-restricted-syntax
                for (let i = 0; i < chars.length; i++) {
                    const charWidth = stringWidth(chars[i]);
                    if (
                        currentWidth + accumulatedWidth + charWidth > maxWidth &&
                        (currentSegments.length > 0 || accumulatedChars > 0)
                    ) {
                        break;
                    }
                    accumulatedWidth += charWidth;
                    accumulatedChars++;
                }

                const chunk = chars.slice(0, accumulatedChars).join('');
                if (chunk.length > 0) {
                    currentSegments.push({ ...textSegment, text: chunk });
                    currentWidth += accumulatedWidth;
                    remainingText = remainingText.substring(chunk.length);
                }

                if (currentWidth >= maxWidth || (remainingText.length > 0 && accumulatedChars === 0)) {
                    flushSegments();
                }
            }
        });

        flushSegments();
        if (wrappedSegments.length === 0) {
            wrappedSegments.push({ segments: [{ text: '' }], segmentIndex: 0 });
        }
        return wrappedSegments;
    }

    // Word-wrap mode: flatten all segments into a list of {char, segRef} pairs,
    // apply the word-wrap algorithm, then reconstruct TextSegment[] per output line.

    // Build a flat list of chars preserving which TextSegment each came from
    type FlatChar = { char: string; charWidth: number; segRef: TextSegment };
    const flat: FlatChar[] = [];
    formatting.segments.forEach((seg) => {
        [...seg.text].forEach((char) => {
            flat.push({ char, charWidth: stringWidth(char), segRef: seg });
        });
    });

    // Run the word-wrap algorithm on flat chars, producing arrays of FlatChar per output line
    const outputLines: FlatChar[][] = [];
    let currentLine: FlatChar[] = [];
    let currentWidth = 0;

    /**
     * Returns the index (in currentLine) after the last eligible break char.
     * Eligible = isBreakChar AND not immediately after ESC (avoids splitting ANSI sequences).
     * Reverses the array for a right-to-left scan using findIndex.
     */
    const findLastBreakIdx = (): number => {
        const reversed = [...currentLine].reverse();
        const revIdx = reversed.findIndex(
            (fc, i) => isBreakChar(fc.char) && !(i < reversed.length - 1 && reversed[i + 1].char === '\x1b'),
        );
        return revIdx === -1 ? -1 : currentLine.length - revIdx;
    };

    const flushLine = (): void => {
        outputLines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
    };

    flat.forEach(({ char, charWidth, segRef }) => {
        if (currentWidth + charWidth <= maxWidth) {
            currentLine.push({ char, charWidth, segRef });
            currentWidth += charWidth;
            return;
        }

        // Overflow
        if (char === ' ') {
            // Discard the overflow space and start a new line
            flushLine();
            return;
        }

        const breakIdx = findLastBreakIdx();
        if (breakIdx >= 0) {
            // Split: currentLine[0..breakIdx) stays, currentLine[breakIdx..) is continuation
            const continuation = currentLine.slice(breakIdx);
            // Trim leading spaces from continuation
            let trimStart = 0;
            while (trimStart < continuation.length && continuation[trimStart].char === ' ') {
                trimStart++;
            }
            const trimmedContinuation = continuation.slice(trimStart);

            currentLine = currentLine.slice(0, breakIdx);
            flushLine();
            currentLine = [...trimmedContinuation, { char, charWidth, segRef }];
            currentWidth = currentLine.reduce((sum, fc) => sum + fc.charWidth, 0);
        } else {
            // No break opportunity — char-wrap fallback
            flushLine();
            currentLine = [{ char, charWidth, segRef }];
            currentWidth = charWidth;
        }
    });

    if (currentLine.length > 0) {
        outputLines.push(currentLine);
    }

    // Ensure at least one output line
    if (outputLines.length === 0) {
        return [{ segments: [{ text: '' }], segmentIndex: 0 }];
    }

    // Reconstruct TextSegment[] for each output line by grouping consecutive flat chars
    // that share the same segRef
    return outputLines.map((lineChars, lineIdx) => {
        if (lineChars.length === 0) {
            return { segments: [{ text: '' }], segmentIndex: lineIdx };
        }

        const runResult = lineChars.slice(1).reduce<{ segments: TextSegment[]; runText: string; runRef: TextSegment }>(
            (acc, { char, segRef }) => {
                if (segRef === acc.runRef) {
                    acc.runText += char;
                } else {
                    acc.segments.push({ ...acc.runRef, text: acc.runText });
                    acc.runText = char;
                    acc.runRef = segRef;
                }
                return acc;
            },
            { segments: [], runText: lineChars[0].char, runRef: lineChars[0].segRef },
        );
        runResult.segments.push({ ...runResult.runRef, text: runResult.runText });
        const reconstructed = runResult.segments;

        return { segments: reconstructed, segmentIndex: lineIdx };
    });
};

/**
 * Wraps a single line into segments that fit within maxWidth.
 * Uses string-width to correctly handle emoji, CJK characters, and ANSI codes.
 *
 * @param line - The line to wrap
 * @param maxWidth - Maximum visible width per segment
 * @returns Array of wrapped segments
 */
/**
 * Legacy wrapper for backward compatibility with feedback system.
 * Wraps a plain string into WrappedSegments with content field.
 */
export const wrapLine = (line: string, maxWidth: number): { content: string; segmentIndex: number }[] => {
    // \n has zero display width (stringWidth('\n') === 0), so the main loop below would
    // silently absorb it into the current segment without ever starting a new line.
    // Pre-split here so each part is wrapped independently, then re-indexed so segment
    // indices remain contiguous across the combined result.
    if (line.includes('\n')) {
        const result: { content: string; segmentIndex: number }[] = [];
        line.split('\n').reduce((segmentOffset, part) => {
            const partSegments = wrapLine(part, maxWidth);
            partSegments.forEach((seg) => {
                result.push({ content: seg.content, segmentIndex: segmentOffset + seg.segmentIndex });
            });
            return segmentOffset + partSegments.length;
        }, 0);
        return result;
    }

    // Handle empty line
    if (line.length === 0) {
        return [{ content: '', segmentIndex: 0 }];
    }

    const segments: { content: string; segmentIndex: number }[] = [];
    let currentSegment = '';
    let currentWidth = 0;
    let segmentIndex = 0;

    const flushSegment = (): void => {
        segments.push({ content: currentSegment, segmentIndex: segmentIndex++ });
        currentSegment = '';
        currentWidth = 0;
    };

    /**
     * Returns the string end-offset (exclusive) of the last eligible break char in currentSegment.
     *
     * "Eligible" means: is in BREAK_CHARS AND is not immediately after ESC (so we don't
     * split inside ANSI escape sequences like \x1b[1m where '[' would otherwise match).
     *
     * We iterate Unicode code-points (via spread) but accumulate raw string offsets so
     * that multi-code-unit chars (emoji) map correctly back to .slice() positions.
     */
    const findLastBreakStringEnd = (): number => {
        const chars = [...currentSegment];
        return chars.reduce(
            (acc, c, i) => ({
                offset: acc.offset + c.length,
                result: isBreakChar(c) && !(i > 0 && chars[i - 1] === '\x1b') ? acc.offset + c.length : acc.result,
            }),
            { offset: 0, result: -1 },
        ).result;
    };

    // Iterate Unicode code-points (spread handles surrogate pairs correctly)
    [...line].forEach((char) => {
        const charWidth = stringWidth(char);

        if (currentWidth + charWidth <= maxWidth) {
            // Character fits — accumulate
            currentSegment += char;
            currentWidth += charWidth;
            return;
        }

        // Character would exceed maxWidth
        if (char === ' ') {
            // Space at overflow boundary: flush current line and discard the space
            // (it would become leading whitespace on the next line)
            flushSegment();
            return;
        }

        // Non-space overflow: try to find a word-break point
        const breakStringEnd = findLastBreakStringEnd();

        if (breakStringEnd >= 0) {
            // Split at the last break char (break char stays on current line)
            const before = currentSegment.slice(0, breakStringEnd);
            const continuation = currentSegment.slice(breakStringEnd).trimStart();
            currentSegment = before;
            flushSegment();
            // Start new line with the continuation + current char
            currentSegment = continuation + char;
            currentWidth = stringWidth(currentSegment);
        } else {
            // No break opportunity in current line — character-wrap fallback
            flushSegment();
            currentSegment = char;
            currentWidth = charWidth;
        }
    });

    // Flush remaining content
    if (currentSegment.length > 0 || segments.length === 0) {
        segments.push({ content: currentSegment, segmentIndex: segmentIndex });
    }

    return segments;
};

/**
 * Wraps a single parsed markdown line into LineMetadata.
 * Handles special cases for code blocks and blockquotes.
 *
 * @param formatting - Parsed markdown line
 * @param effectiveWidth - Available width for content
 * @param planLineIndex - Index of this line in the plan (default 0)
 * @returns LineMetadata with wrapped content
 */
export const wrapParsedLine = (
    formatting: LineFormatting,
    effectiveWidth: number,
    planLineIndex: number = 0,
): LineMetadata => {
    // Adjust width based on line type
    let wrapWidth = effectiveWidth;
    if (formatting.type === 'blockquote') {
        const depth = formatting.blockquoteDepth ?? 1; // Default to depth 1
        wrapWidth = effectiveWidth - depth * 2; // Each depth = 2 chars ("│ ")
    }

    const formattedSegments = wrapLineSegments(formatting, wrapWidth, formatting.type !== 'code');
    const renderedLineCount = formattedSegments.length;

    // Reconstruct originalContent from segments
    const originalContent = formatting.segments.map((seg) => seg.text).join('');

    // Create legacy segments for backward compatibility
    const legacySegments: WrappedSegment[] = formattedSegments.map(
        (fs): WrappedSegment => ({
            content: fs.segments.map((seg) => seg.text).join(''),
            segmentIndex: fs.segmentIndex,
        }),
    );

    return {
        planLineIndex,
        originalContent,
        renderedLineCount,
        segments: legacySegments,
        formattedSegments,
        formatting,
    };
};

/**
 * Wraps LineFormatting array into LineMetadata with TextSegments.
 * This is the primary function for wrapping markdown-parsed content.
 *
 * @param formattings - Array of LineFormatting (from markdown parser)
 * @param terminalWidth - Terminal width in columns
 * @param paddingX - Horizontal padding on each side
 * @returns Array of line metadata with TextSegments
 */
export const wrapContentWithFormatting = (
    formattings: LineFormatting[],
    terminalWidth: number,
    paddingX: number,
): LineMetadata[] => {
    const effectiveWidth = terminalWidth - paddingX * 2;

    return formattings.map((formatting, planLineIndex) => {
        return wrapParsedLine(formatting, effectiveWidth, planLineIndex);
    });
};

/**
 * Counts total terminal lines consumed by a range of plan lines.
 *
 * @param wrappedLines - Array of line metadata
 * @param startPlanLine - Start plan line index (inclusive)
 * @param endPlanLine - End plan line index (inclusive)
 * @returns Total terminal lines in range
 */
export const countTerminalLinesInRange = (
    wrappedLines: LineMetadata[],
    startPlanLine: number,
    endPlanLine: number,
): number => {
    if (startPlanLine > endPlanLine) {
        return 0;
    }

    let count = 0;
    wrappedLines.slice(startPlanLine, endPlanLine + 1).forEach((meta) => {
        if (meta) {
            count += meta.renderedLineCount;
        }
    });

    return count;
};

/**
 * Wraps feedback (comments/questions) into segments for proper rendering.
 * Feedback text is wrapped accounting for emoji prefix width (2 columns).
 *
 * @param feedback - Map of line index to feedback entry
 * @param type - Type of feedback ('comment' or 'question')
 * @param terminalWidth - Terminal width in columns
 * @param paddingX - Horizontal padding on each side
 * @returns Array of feedback metadata with wrapped segments
 */
export const wrapFeedback = (
    feedback: Map<number, FeedbackEntry>,
    type: 'comment' | 'question',
    terminalWidth: number,
    paddingX: number,
): FeedbackMetadata[] => {
    const result: FeedbackMetadata[] = [];

    const effectiveWidth = terminalWidth - paddingX * 2;
    const prefix = type === 'comment' ? '💬' : '❔';

    feedback.forEach((entry, lineIndex) => {
        const segments = wrapLine(`${prefix} ${entry.text}`, effectiveWidth);
        // Feedback appears above the anchor line only (not all lines in range)
        result.push({
            lineIndex,
            text: entry.text,
            segments,
            type,
        });
    });

    return result;
};

/**
 * Count the number of visual lines an input field renders for the given text,
 * cursor position, and max width.
 *
 * This mirrors the rendering logic in TextInput.tsx: when the cursor sits at the
 * end of a segment that exactly fills maxWidth (cursorOverflows), TextInput renders
 * an extra line for the cursor block. The returned count includes that extra line so
 * that viewport height calculations stay in sync with what TextInput actually renders.
 */
export const countInputVisualLines = (text: string, cursorPosition: number, maxWidth: number): number => {
    if (text.length === 0) return 1;

    const segments = wrapLine(text, maxWidth);

    // Compute the flat start offset of each segment (mirrors TextInput.tsx flatStarts logic)
    const { flatStarts } = segments.reduce<{ flatStarts: number[]; searchPos: number }>(
        (acc, seg) => {
            const found = text.indexOf(seg.content, acc.searchPos);
            const start = found >= 0 ? found : acc.searchPos;
            return { flatStarts: [...acc.flatStarts, start], searchPos: start + seg.content.length };
        },
        { flatStarts: [], searchPos: 0 },
    );

    // Find which segment contains the cursor (last segment where flatStart <= cursorPosition)
    const segIdx = segments.reduce((best, _, i) => (flatStarts[i] <= cursorPosition ? i : best), 0);
    const posInSeg = Math.min(cursorPosition - flatStarts[segIdx], segments[segIdx].content.length);

    // cursorOverflows when cursor is at end of a segment that fills the full width —
    // TextInput renders an extra line for the cursor block in this case
    const segContent = segments[segIdx].content;
    const cursorOverflows = posInSeg >= segContent.length && stringWidth(segContent) >= maxWidth;

    return segments.length + (cursorOverflows ? 1 : 0);
};
