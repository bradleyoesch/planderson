import { Box, Text, useInput } from 'ink';
import React from 'react';

import { View } from '~/components/shared/View';
import { usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { COLORS } from '~/utils/config/constants';
import {
    decisionKeybindings,
    feedbackKeybindings,
    type Keybinding,
    navigationKeybindings,
    otherKeybindings,
} from '~/utils/config/keybindings';

interface HelpViewProps {
    onExit: () => void;
}

const padKeybindings = (keybindings: Keybinding[]): Keybinding[] => {
    if (keybindings.length === 0) {
        return [];
    }

    const maxKeyLength = Math.max(...keybindings.map((kb) => kb.key.length));

    return keybindings.map((kb) => ({
        key: kb.key.padEnd(maxKeyLength),
        description: kb.description,
    }));
};

/**
 * Renders a section of keybindings with aligned descriptions
 */
const KeybindingSection: React.FC<{ title: string; keybindings: Keybinding[] }> = ({ title, keybindings }) => {
    const paddedKeybindings = padKeybindings(keybindings);

    return (
        <Box flexDirection="column">
            <Text color={COLORS.TITLE} bold>
                {title}
            </Text>
            {paddedKeybindings.map((kb, index) => (
                <Text key={index}>
                    {' '}
                    <Text color={COLORS.ACCENT}>{kb.key}</Text> {kb.description}
                </Text>
            ))}
            <Text>{'\n'}</Text>
        </Box>
    );
};

export const HelpView: React.FC<HelpViewProps> = ({ onExit }) => {
    const { paddingX } = usePlanViewStaticContext();

    // Handle keyboard input - ?, Enter, or Escape returns to plan view
    useInput((input, key) => {
        if (input === '?' || key.return || key.escape) {
            onExit();
        }
    });

    return (
        <View
            title="Keybindings"
            footer={
                <Box paddingX={paddingX}>
                    <Text color={COLORS.SUBTLE} italic>
                        Press ?, Enter, or Escape to return to plan view
                    </Text>
                </Box>
            }
        >
            <Box flexDirection="column">
                <KeybindingSection title="Feedback" keybindings={feedbackKeybindings} />
                <KeybindingSection title="Navigation" keybindings={navigationKeybindings} />
                <KeybindingSection title="Decision" keybindings={decisionKeybindings} />
                <KeybindingSection title="Other" keybindings={otherKeybindings} />
            </Box>
        </View>
    );
};
