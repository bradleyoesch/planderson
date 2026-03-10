import { Box, Text } from 'ink';
import React from 'react';
import stringWidth from 'string-width';

import { wrapLine } from '~/utils/rendering/line-wrapping';

interface TextInputProps {
    text: string;
    cursorPosition: number;
    maxWidth?: number;
}

/**
 * Shared component for rendering text input with a visible cursor.
 *
 * When `maxWidth` is provided, long text wraps visually at that width using the
 * same word-wrap algorithm as plan content. The cursor is rendered on the correct
 * wrapped segment. When absent, single-line behavior is preserved (CommandInput).
 *
 * The cursor appears as:
 * - A white block (█) when at the end of a segment (or end of text)
 * - An inverted character (white background, black text) when on a character
 */
export const TextInput: React.FC<TextInputProps> = ({ text, cursorPosition, maxWidth }) => {
    if (maxWidth !== undefined) {
        const segments = wrapLine(text, maxWidth);

        // Compute flatStart for each segment by walking through the original text.
        // text.indexOf(seg.content, searchPos) correctly handles discarded spaces and
        // trimmed continuations that wrapLine produces.
        // Build flatStarts by walking through segments with a mutable accumulator.
        // Using reduce so we can carry searchPos across iterations without a for loop.
        const { flatStarts } = segments.reduce<{ flatStarts: number[]; searchPos: number }>(
            (acc, seg) => {
                const found = text.indexOf(seg.content, acc.searchPos);
                const start = found >= 0 ? found : acc.searchPos;
                return { flatStarts: [...acc.flatStarts, start], searchPos: start + seg.content.length };
            },
            { flatStarts: [], searchPos: 0 },
        );

        // Find cursor segment: last segment where flatStart[i] <= cursorPosition.
        // This correctly maps discarded-space positions to end-of-previous-segment.
        const segIdx = segments.reduce((best, _, i) => (flatStarts[i] <= cursorPosition ? i : best), 0);

        // Clamp cursor position within the segment.
        // Clamping to seg.content.length handles the discarded-space case by placing
        // the cursor at end-of-segment rather than past it.
        const posInSeg = Math.min(cursorPosition - flatStarts[segIdx], segments[segIdx].content.length);

        // Detect overflow: cursor is at end of a segment that already fills maxWidth.
        // Rendering "segContent + █" would exceed maxWidth and cause Ink to re-wrap the line.
        const segContent = segments[segIdx].content;
        const cursorOverflows = posInSeg >= segContent.length && stringWidth(segContent) >= maxWidth;

        return (
            <Box flexDirection="column">
                {segments.flatMap((seg, idx) => {
                    if (idx !== segIdx) {
                        return (
                            <Text key={idx} color="white">
                                {seg.content}
                            </Text>
                        );
                    }
                    if (cursorOverflows) {
                        return [
                            <Text key={idx} color="white">
                                {seg.content}
                            </Text>,
                            <TextInputLine key={`${idx}-cursor`} text="" cursorPosition={0} />,
                        ];
                    }
                    return <TextInputLine key={idx} text={seg.content} cursorPosition={posInSeg} />;
                })}
            </Box>
        );
    }

    return <TextInputLine text={text} cursorPosition={cursorPosition} />;
};

/**
 * Renders a single line of text input with cursor markup.
 * Extracted to avoid duplicating cursor rendering logic between single- and multi-line modes.
 */
const TextInputLine: React.FC<{ text: string; cursorPosition: number }> = ({ text, cursorPosition }) => {
    const beforeCursor = text.slice(0, cursorPosition);
    const afterCursor = text.slice(cursorPosition + 1);

    const isAtEndOfLine = cursorPosition >= text.length;

    const charAtCursor = isAtEndOfLine
        ? '█' // White full block at end of line
        : text[cursorPosition]; // The actual character if on a character

    const cursorColor = isAtEndOfLine ? 'white' : 'black';
    const cursorBgColor = isAtEndOfLine ? undefined : 'white';

    return (
        <Text>
            <Text color="white">{beforeCursor}</Text>
            <Text color={cursorColor} backgroundColor={cursorBgColor}>
                {charAtCursor}
            </Text>
            <Text color="white">{afterCursor}</Text>
        </Text>
    );
};
