import { Text } from 'ink';
import React from 'react';

import { COLORS } from '~/utils/config/constants';

interface ChoiceListProps {
    selectedIndex: 0 | 1;
}

export const ChoiceList: React.FC<ChoiceListProps> = ({ selectedIndex }) => {
    return (
        <>
            <Text>
                <Text color={selectedIndex === 0 ? COLORS.TITLE : undefined}>{selectedIndex === 0 ? '❯ ' : '  '}</Text>
                <Text color={COLORS.MUTED}>1. </Text>
                <Text color={selectedIndex === 0 ? COLORS.TITLE : 'white'}>Yes</Text>
            </Text>
            <Text>
                <Text color={selectedIndex === 1 ? COLORS.TITLE : undefined}>{selectedIndex === 1 ? '❯ ' : '  '}</Text>
                <Text color={COLORS.MUTED}>2. </Text>
                <Text color={selectedIndex === 1 ? COLORS.TITLE : 'white'}>No</Text>
            </Text>
        </>
    );
};
