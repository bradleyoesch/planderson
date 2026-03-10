import { Box, Text } from 'ink';
import React from 'react';

import { ChoiceList } from '~/components/shared/ChoiceList';
import { InlinePane } from '~/components/shared/InlinePane';
import { usePlanViewDynamicContext } from '~/contexts/PlanViewProvider';
import { useSettings } from '~/contexts/SettingsContext';
import { COLORS } from '~/utils/config/constants';
import { formatFeedbackCounts, hasFeedback, joinFeedbackCounts } from '~/utils/feedback/feedback';

export const ConfirmApprove: React.FC = () => {
    const { state } = usePlanViewDynamicContext();
    const { settings } = useSettings();

    const { comments, questions, deletedLines, confirmSelectedIndex } = state;
    const hasAnyFeedback = hasFeedback(comments, questions, deletedLines);
    const isExit = settings.approveAction === 'exit';

    const title = 'Approve plan';

    let questionText: string;
    if (isExit) {
        questionText = hasAnyFeedback
            ? `Exit and discard ${joinFeedbackCounts(formatFeedbackCounts(comments, questions, deletedLines))}?`
            : 'Exit (approve manually)?';
    } else {
        questionText = hasAnyFeedback
            ? `Approve and discard ${joinFeedbackCounts(formatFeedbackCounts(comments, questions, deletedLines))}?`
            : 'Approve plan?';
    }

    return (
        <InlinePane title={title}>
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
