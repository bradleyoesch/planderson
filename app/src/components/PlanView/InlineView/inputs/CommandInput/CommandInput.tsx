import React from 'react';

import { TextInput } from '~/components/shared/TextInput';
import { useTerminal } from '~/contexts/TerminalContext';

interface CommandInputProps {
    commandText: string;
    inputCursor: number;
}

export const CommandInput: React.FC<CommandInputProps> = ({ commandText, inputCursor }) => {
    // CommandInput renders directly in View's footer slot (no Box paddingX wrapper),
    // so the full terminal width is available — unlike CommentInput/QuestionInput
    // which are wrapped in InlinePane with paddingX on both sides.
    const { terminalWidth } = useTerminal();
    return <TextInput text={commandText} cursorPosition={inputCursor} maxWidth={terminalWidth} />;
};
