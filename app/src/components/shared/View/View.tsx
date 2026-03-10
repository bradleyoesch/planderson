import { Box, Text } from 'ink';
import React from 'react';

import { useTerminal } from '~/contexts/TerminalContext';
import { COLORS } from '~/utils/config/constants';

interface ViewProps {
    title?: string;
    titleColor?: string;
    paddingX?: number;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const View: React.FC<ViewProps> = ({ title, titleColor = COLORS.TITLE, paddingX = 1, children, footer }) => {
    const { terminalHeight, terminalWidth } = useTerminal();

    return (
        <Box flexDirection="column" minHeight={terminalHeight} justifyContent="space-between">
            <Box flexDirection="column">
                {title && (
                    <Box flexDirection="column">
                        <Text color={COLORS.ACCENT}>{'─'.repeat(terminalWidth)}</Text>
                        <Box paddingX={paddingX}>
                            <Text color={titleColor} bold>
                                {title}
                            </Text>
                        </Box>
                        <Text color={COLORS.SUBTLE}>{'-'.repeat(terminalWidth)}</Text>
                    </Box>
                )}
                <Box paddingX={paddingX}>{children}</Box>
            </Box>
            {footer}
        </Box>
    );
};
