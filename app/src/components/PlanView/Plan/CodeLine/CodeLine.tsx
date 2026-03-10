import { Text } from 'ink';
import React from 'react';

import { StyledText } from '~/components/shared/StyledText';
import { COLORS } from '~/utils/config/constants';
import type { WrappedSegmentWithFormatting } from '~/utils/rendering/line-wrapping';
import type { CodeMetadata } from '~/utils/rendering/markdown/markdown';

interface CodeLineProps {
    wrappedSegments: WrappedSegmentWithFormatting[];
    metadata: CodeMetadata;
    isHighlighted: boolean;
    isDeleted: boolean;
}

/**
 * Component for rendering code block lines with syntax highlighting.
 * Handles fence markers (opening/closing) and code content differently.
 * Supports multi-line wrapping by iterating through all wrapped segments.
 * When isDeleted is true, skips syntax highlighting to show deleted state.
 */
export const CodeLine: React.FC<CodeLineProps> = ({ wrappedSegments, metadata, isHighlighted, isDeleted }) => {
    // Opening or closing fence: render in dim grey (single line, never wraps)
    if (metadata.isOpening || metadata.isClosing) {
        return (
            <Text dimColor backgroundColor={isHighlighted ? COLORS.CURSOR_BG : undefined}>
                {wrappedSegments[0].segments.map((s) => s.text).join('')}
            </Text>
        );
    }

    // Code content: use same background as regular text (no CODE_BG)
    // Only apply cursor background when highlighted
    const backgroundColor = isHighlighted ? COLORS.CURSOR_BG : undefined;

    // Wrap all segments in a Text component so newlines work correctly
    return (
        <Text backgroundColor={backgroundColor}>
            {wrappedSegments.map((wrappedSeg, idx) => {
                const segments = wrappedSeg.segments;
                const hasContent = segments.length > 0 && segments.some((seg) => seg.text.length > 0);

                // Handle blank lines: Ink renders 1 space for lines with background color
                // Only add newline between segments, no manual space needed
                if (!hasContent) {
                    const content = idx < wrappedSegments.length - 1 ? '\n' : '';
                    return <React.Fragment key={idx}>{content}</React.Fragment>;
                }

                return (
                    <React.Fragment key={idx}>
                        {segments.map((segment, segIdx) => (
                            <StyledText key={segIdx} segment={{ ...segment, backgroundColor }} isDeleted={isDeleted} />
                        ))}
                        {idx < wrappedSegments.length - 1 && '\n'}
                    </React.Fragment>
                );
            })}
        </Text>
    );
};
