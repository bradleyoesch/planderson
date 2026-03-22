import { Box, Text } from 'ink';
import React from 'react';

import { usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { COLORS } from '~/utils/config/constants';

export const PlanFooter: React.FC = () => {
    const { latestVersion, upgradedVersion } = usePlanViewStaticContext();

    if (upgradedVersion) {
        return (
            <Box justifyContent="flex-end" paddingX={1}>
                <Text color={COLORS.MUTED} wrap="truncate">
                    Upgraded to v{upgradedVersion}
                </Text>
            </Box>
        );
    }

    if (latestVersion) {
        return (
            <Box justifyContent="flex-end" paddingX={1}>
                <Text color={COLORS.MUTED} wrap="truncate">
                    Update available! Run: <Text bold>planderson upgrade</Text>
                </Text>
            </Box>
        );
    }

    return null;
};
