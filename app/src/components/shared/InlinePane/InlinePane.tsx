import { Box, Text } from 'ink';
import React from 'react';

import { usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';
import { COLORS } from '~/utils/config/constants';

interface InlinePaneProps {
    title: string;
    titleColor?: string;
    children: React.ReactNode;
}

export const InlinePane: React.FC<InlinePaneProps> = ({ title, titleColor = COLORS.TITLE, children }) => {
    const { terminalWidth } = useTerminal();
    const { paddingX } = usePlanViewStaticContext();

    return (
        <Box flexDirection="column">
            <Text color={COLORS.TITLE}>{'─'.repeat(terminalWidth)}</Text>
            <Box paddingX={paddingX} paddingBottom={1}>
                <Text color={titleColor} bold>
                    {title}
                </Text>
            </Box>
            <Box paddingX={paddingX}>{children}</Box>
        </Box>
    );
};
