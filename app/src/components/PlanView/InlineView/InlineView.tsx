import { Text } from 'ink';
import React from 'react';

import { usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { COLORS, PlanViewMode } from '~/utils/config/constants';

import { ConfirmApprove } from './confirmations/ConfirmApprove';
import { ConfirmCancel } from './confirmations/ConfirmCancel';
import { ConfirmDeny } from './confirmations/ConfirmDeny';
import { CommandInput } from './inputs/CommandInput';
import { CommentInput } from './inputs/CommentInput';
import { QuestionInput } from './inputs/QuestionInput';

// Maximum height when inline mode is active (single line for command/input)
export const MAX_INLINE_HEIGHT = 1;

const PlanFooter: React.FC = () => {
    const { latestVersion } = usePlanViewStaticContext();
    if (!latestVersion) return null;
    return (
        <Text color={COLORS.UPDATE}>
            Update available! Run: <Text bold>planderson upgrade</Text>
        </Text>
    );
};

interface InlineViewProps {
    mode: PlanViewMode;
    commandText: string;
    currentCommentText: string;
    currentQuestionText: string;
    inputCursor: number;
}

export const InlineView: React.FC<InlineViewProps> = ({
    mode,
    commandText,
    currentCommentText,
    currentQuestionText,
    inputCursor,
}) => {
    switch (mode) {
        case 'plan':
            // Normal plan view - show update notification if available, otherwise blank line via layout
            return <PlanFooter />;
        case 'help':
            // Help mode is handled by PlanView directly (renders HelpView)
            // Return null since no inline footer is needed
            return null;
        case 'command':
            return <CommandInput commandText={commandText} inputCursor={inputCursor} />;
        case 'comment':
            return <CommentInput currentCommentText={currentCommentText} inputCursor={inputCursor} />;
        case 'question':
            return <QuestionInput currentQuestionText={currentQuestionText} inputCursor={inputCursor} />;
        case 'confirm-approve':
            return <ConfirmApprove />;
        case 'confirm-deny':
            return <ConfirmDeny />;
        case 'confirm-cancel':
            return <ConfirmCancel />;
    }
};
