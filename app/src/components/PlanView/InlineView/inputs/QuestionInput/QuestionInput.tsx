import React from 'react';

import { InlinePane } from '~/components/shared/InlinePane';
import { TextInput } from '~/components/shared/TextInput';
import { useInputMaxWidth } from '~/hooks/useInputMaxWidth';

interface QuestionInputProps {
    currentQuestionText: string;
    inputCursor: number;
}

export const QuestionInput: React.FC<QuestionInputProps> = ({ currentQuestionText, inputCursor }) => {
    const maxWidth = useInputMaxWidth();

    return (
        <InlinePane title="Question">
            <TextInput text={currentQuestionText} cursorPosition={inputCursor} maxWidth={maxWidth} />
        </InlinePane>
    );
};
