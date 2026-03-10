import { useApp, useInput } from 'ink';
import { Box, Text } from 'ink';
import React from 'react';

import { View } from '~/components/shared/View';
import { COLORS } from '~/utils/config/constants';

interface ErrorViewProps {
    error: string;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ error }) => {
    const { exit } = useApp();

    // Forces view to stay open until user presses any key
    // Otherwise error message is shown for a split second and then disappears
    useInput(() => {
        exit();
    });

    return (
        <View
            title="Error"
            titleColor={COLORS.ERROR}
            footer={
                <Box paddingX={1}>
                    <Text color={COLORS.SUBTLE} italic>
                        Press any key to exit
                    </Text>
                </Box>
            }
        >
            <Text color="red">{error}</Text>
        </View>
    );
};
