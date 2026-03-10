import { Text } from 'ink';
import React from 'react';

import { COLORS } from '~/utils/config/constants';
import type { TextSegment } from '~/utils/rendering/markdown/markdown';

export interface StyledTextProps {
    segment: TextSegment;
    isHighlighted?: boolean;
    isDeleted?: boolean;
}

/**
 * Renders a TextSegment with Ink Text props (bold, italic, color, etc.).
 * Avoids ANSI escape codes entirely, using only Ink's built-in styling.
 * When isDeleted is true, skips syntax highlighting colors to show deleted state.
 */
export const StyledText: React.FC<StyledTextProps> = ({ segment, isHighlighted = false, isDeleted = false }) => {
    const { text, bold, italic, strikethrough, code, link, color, backgroundColor: segmentBg } = segment;

    // Determine color - skip syntax highlighting if deleted
    let textColor: string | undefined = undefined;
    if (!isDeleted) {
        textColor = color;
        if (link) {
            textColor = COLORS.LINK;
        } else if (code && !color) {
            // Only use default code color if no syntax highlighting color is set
            textColor = COLORS.CODE;
        }
    }

    // Determine background color - use segment's background if provided
    // Code now uses same background as regular text (no CODE_BG)
    // Only apply cursor background when highlighted
    const backgroundColor = segmentBg ?? (isHighlighted ? COLORS.CURSOR_BG : undefined);

    return (
        <Text
            bold={bold}
            italic={italic}
            strikethrough={strikethrough}
            color={textColor}
            backgroundColor={backgroundColor}
        >
            {text}
        </Text>
    );
};
