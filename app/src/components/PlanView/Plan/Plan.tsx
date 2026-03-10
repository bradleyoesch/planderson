import { Box, Text } from 'ink';
import React from 'react';

import { useTerminal } from '~/contexts/TerminalContext';
import { COLORS } from '~/utils/config/constants';
import { FeedbackMetadata, LineMetadata } from '~/utils/rendering/line-wrapping';

import { WrappedFeedback, WrappedLine } from './WrappedLine';

// Helper to calculate which lines are selected
const getSelectedLines = (cursorLine: number, selectionAnchor: number | null): Set<number> => {
    if (selectionAnchor === null) {
        return new Set([cursorLine]);
    }
    const start = Math.min(cursorLine, selectionAnchor);
    const end = Math.max(cursorLine, selectionAnchor);
    const selected = new Set<number>();
    // Build array and convert to Set to avoid for loop
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    range.forEach((i) => {
        selected.add(i);
    });
    return selected;
};

export interface PlanProps {
    visibleLines: LineMetadata[]; // Viewport-limited slice with wrapping metadata
    scrollOffset: number; // Starting line index of visible range
    cursorLine: number;
    selectionAnchor: number | null;
    wrappedComments: FeedbackMetadata[]; // Pre-wrapped comments with segments
    wrappedQuestions: FeedbackMetadata[]; // Pre-wrapped questions with segments
    deletedLines: Set<number>;
}

export const Plan: React.FC<PlanProps> = ({
    visibleLines,
    scrollOffset,
    cursorLine,
    selectionAnchor,
    wrappedComments,
    wrappedQuestions,
    deletedLines,
}) => {
    const { terminalWidth } = useTerminal();
    const selectedLines = getSelectedLines(cursorLine, selectionAnchor);

    // Create maps for quick lookup of feedback by line index
    const commentsByLine = new Map<number, FeedbackMetadata>();
    wrappedComments.forEach((comment) => {
        commentsByLine.set(comment.lineIndex, comment);
    });

    const questionsByLine = new Map<number, FeedbackMetadata>();
    wrappedQuestions.forEach((question) => {
        questionsByLine.set(question.lineIndex, question);
    });

    return (
        <Box flexDirection="column">
            {/* Render content line by line */}
            <>
                {visibleLines.map((lineMetadata, visibleIndex) => {
                    // Map visible index to original index
                    const originalIndex = scrollOffset + visibleIndex;

                    const isSelected = selectedLines.has(originalIndex);
                    const questionFeedback = questionsByLine.get(originalIndex);
                    const commentFeedback = commentsByLine.get(originalIndex);
                    const isDeleted = deletedLines.has(originalIndex);

                    // Check if this is the start of a question range
                    const prevOriginalIndex = originalIndex - 1;
                    const shouldShowQuestion =
                        questionFeedback &&
                        (prevOriginalIndex < scrollOffset ||
                            questionsByLine.get(originalIndex)?.text !== questionsByLine.get(prevOriginalIndex)?.text);

                    // Check if this is the start of a comment range
                    const shouldShowComment =
                        commentFeedback &&
                        (prevOriginalIndex < scrollOffset ||
                            commentsByLine.get(originalIndex)?.text !== commentsByLine.get(prevOriginalIndex)?.text);

                    return (
                        <React.Fragment key={originalIndex}>
                            {shouldShowQuestion && <WrappedFeedback feedback={questionFeedback} />}
                            {shouldShowComment && <WrappedFeedback feedback={commentFeedback} />}
                            <Text
                                backgroundColor={isSelected ? COLORS.CURSOR_BG : undefined}
                                strikethrough={isDeleted}
                                color={isDeleted ? COLORS.DELETED : undefined}
                            >
                                <WrappedLine
                                    lineMetadata={lineMetadata}
                                    isSelected={isSelected}
                                    isDeleted={isDeleted}
                                    terminalWidth={terminalWidth}
                                />
                                {/* Blank lines render as space to create visual gap, but not HR lines */}
                                {lineMetadata.originalContent.trim() === '' &&
                                    lineMetadata.formatting?.type !== 'hr' &&
                                    ' '}
                            </Text>
                        </React.Fragment>
                    );
                })}
            </>
        </Box>
    );
};
