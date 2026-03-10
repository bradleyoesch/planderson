import { Box, Text } from 'ink';
import React from 'react';

import { ChoiceList } from '~/components/shared/ChoiceList';
import { InlinePane } from '~/components/shared/InlinePane';
import { usePlanViewDynamicContext } from '~/contexts/PlanViewProvider';
import { COLORS } from '~/utils/config/constants';
import { formatFeedbackCounts, hasFeedback, joinFeedbackCounts } from '~/utils/feedback/feedback';

export const ConfirmDeny: React.FC = () => {
    const { state } = usePlanViewDynamicContext();
    const { comments, questions, deletedLines, confirmSelectedIndex } = state;
    const hasAnyFeedback = hasFeedback(comments, questions, deletedLines);

    const questionText = hasAnyFeedback
        ? `Send ${joinFeedbackCounts(formatFeedbackCounts(comments, questions, deletedLines))}?`
        : 'Deny without feedback?';

    return (
        <InlinePane title="Send feedback">
            <Box flexDirection="column">
                <Text>{questionText}</Text>
                <ChoiceList selectedIndex={confirmSelectedIndex as 0 | 1} />
                <Box paddingTop={1}>
                    <Text color={COLORS.MUTED}>Enter to confirm · Esc to cancel</Text>
                </Box>
            </Box>
        </InlinePane>
    );
};
