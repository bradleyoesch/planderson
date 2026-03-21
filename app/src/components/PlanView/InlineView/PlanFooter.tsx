import { Box, Text } from 'ink';
import React from 'react';

import { usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { COLORS } from '~/utils/config/constants';

export const PlanFooter: React.FC = () => {
    const { latestVersion } = usePlanViewStaticContext();
    if (!latestVersion) return null;
    return (
        <Box justifyContent="flex-end" paddingX={1}>
            <Text color={COLORS.MUTED} wrap="truncate">
                Update available! Run: <Text bold>planderson upgrade</Text>
            </Text>
        </Box>
    );
};
