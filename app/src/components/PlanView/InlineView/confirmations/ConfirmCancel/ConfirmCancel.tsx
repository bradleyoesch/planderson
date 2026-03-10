import { Box, Text } from 'ink';
import React from 'react';

import { ChoiceList } from '~/components/shared/ChoiceList';
import { InlinePane } from '~/components/shared/InlinePane';
import { usePlanViewDynamicContext } from '~/contexts/PlanViewProvider';
import { COLORS } from '~/utils/config/constants';

export const ConfirmCancel: React.FC = () => {
    const { state } = usePlanViewDynamicContext();

    return (
        <InlinePane title="Exit plan">
            <Box flexDirection="column">
                <Text>Discard feedback and exit?</Text>
                <ChoiceList selectedIndex={state.confirmSelectedIndex as 0 | 1} />
                <Box paddingTop={1}>
                    <Text color={COLORS.MUTED}>Enter to confirm · Esc to cancel</Text>
                </Box>
            </Box>
        </InlinePane>
    );
};
