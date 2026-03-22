import { Text } from 'ink';
import React from 'react';

import { CodeLine } from '~/components/PlanView/Plan/CodeLine';
import { StyledText } from '~/components/shared/StyledText';
import { usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { COLORS } from '~/utils/config/constants';
import { FeedbackMetadata, LineMetadata } from '~/utils/rendering/line-wrapping';
import { getHeadingColor } from '~/utils/rendering/markdown/markdown';
import { trimWrappedSegment } from '~/utils/rendering/text';

interface WrappedFeedbackProps {
    feedback: FeedbackMetadata;
}

/**
 * Component that renders wrapped feedback (comment or question) with proper styling.
 * Each segment is trimmed and joined with newlines to prevent trailing spaces.
 */
export const WrappedFeedback: React.FC<WrappedFeedbackProps> = ({ feedback }) => {
    const color = feedback.type === 'comment' ? COLORS.ACCENT : COLORS.QUESTION;

    // Trim each segment so that wrapped spaces aren't rendered, e.g.
    // |end of the|
    // | line     |
    return (
        <Text color={color} italic>
            {feedback.segments.map((segment) => segment.content.trim()).join('\n')}
        </Text>
    );
};

export interface WrappedLineProps {
    lineMetadata: LineMetadata;
    isSelected: boolean;
    isDeleted: boolean;
    terminalWidth: number;
}

/**
 * Component that renders a line with wrapping applied.
 * If the line has multiple wrapped segments, joins them with newlines.
 * Applies line-level formatting (headings, blockquotes, HR) when formatting metadata is present.
 * Each wrapped segment is trimmed to prevent leading/trailing spaces.
 */
export const WrappedLine: React.FC<WrappedLineProps> = ({ lineMetadata, isSelected, isDeleted, terminalWidth }) => {
    const { paddingX } = usePlanViewStaticContext();

    // All lines should have formattedSegments and formatting from wrapParsedLine
    if (!lineMetadata.formattedSegments || !lineMetadata.formatting) {
        throw new Error('WrappedLine requires formattedSegments and formatting metadata');
    }

    const { formatting, formattedSegments } = lineMetadata;

    // Handle horizontal rule - extend full width minus padding
    if (formatting.type === 'hr') {
        const hrWidth = terminalWidth - paddingX * 2;
        return <Text color={COLORS.SUBTLE}>{'─'.repeat(hrWidth)}</Text>;
    }

    // Handle code blocks
    if (formatting.type === 'code' && formatting.codeMetadata) {
        return (
            <CodeLine
                wrappedSegments={formattedSegments}
                metadata={formatting.codeMetadata}
                isHighlighted={isSelected}
                isDeleted={isDeleted}
            />
        );
    }

    // Handle blockquote
    if (formatting.type === 'blockquote') {
        const depth = formatting.blockquoteDepth ?? 1; // Default to depth 1
        const prefix = '│ '.repeat(depth); // Dynamic repetition based on depth

        return (
            <Text color={COLORS.SUBTLE}>
                {formattedSegments.map((wrappedSeg, idx) => (
                    <React.Fragment key={idx}>
                        {prefix}
                        {trimWrappedSegment(wrappedSeg.segments, { trimStart: idx > 0 }).map((textSeg, segIdx) => (
                            <StyledText
                                key={segIdx}
                                segment={textSeg}
                                isHighlighted={isSelected}
                                isDeleted={isDeleted}
                            />
                        ))}
                        {idx < formattedSegments.length - 1 && '\n'}
                    </React.Fragment>
                ))}
            </Text>
        );
    }

    // Handle heading
    if (formatting.type === 'heading' && formatting.headingLevel) {
        const headingColor = getHeadingColor(formatting.headingLevel);
        const isH1 = formatting.headingLevel === 1;
        return (
            <Text color={headingColor} bold italic={isH1} underline={isH1}>
                {formattedSegments.map((wrappedSeg, idx) => (
                    <React.Fragment key={idx}>
                        {trimWrappedSegment(wrappedSeg.segments, { trimStart: idx > 0 }).map((textSeg, segIdx) => (
                            <StyledText
                                key={segIdx}
                                segment={textSeg}
                                isHighlighted={isSelected}
                                isDeleted={isDeleted}
                            />
                        ))}
                        {idx < formattedSegments.length - 1 && '\n'}
                    </React.Fragment>
                ))}
            </Text>
        );
    }

    // Normal line with formatted segments
    return (
        <>
            {formattedSegments.map((wrappedSeg, idx) => (
                <React.Fragment key={idx}>
                    {trimWrappedSegment(wrappedSeg.segments, { trimStart: idx > 0 }).map((textSeg, segIdx) => (
                        <StyledText key={segIdx} segment={textSeg} isHighlighted={isSelected} isDeleted={isDeleted} />
                    ))}
                    {idx < formattedSegments.length - 1 && '\n'}
                </React.Fragment>
            ))}
        </>
    );
};
