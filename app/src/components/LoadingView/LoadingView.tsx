import { Text } from 'ink';
import React, { useEffect, useState } from 'react';

import { View } from '~/components/shared/View';
import { COLORS, PlandersonMode } from '~/utils/config/constants';

interface LoadingViewProps {
    mode: PlandersonMode;
    filepath: string | null;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ mode, filepath }) => {
    const [showLoading, setShowLoading] = useState(false);

    useEffect(() => {
        // Wait 1 second before showing loading spinner to avoid visual flicker
        // for fast loads
        const timer = setTimeout(() => {
            setShowLoading(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    // Don't render anything for the first second
    if (!showLoading) {
        return null;
    }

    return (
        <View>
            <Text color={COLORS.ACCENT} bold>
                Loading Plan...
            </Text>
            <Text color={COLORS.SUBTLE}>
                {mode === 'file' ? `Reading from file: ${filepath}` : 'Connecting to Claude Code hook via socket'}
            </Text>
        </View>
    );
};
