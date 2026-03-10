import React from 'react';

import { InlinePane } from '~/components/shared/InlinePane';
import { TextInput } from '~/components/shared/TextInput';
import { useInputMaxWidth } from '~/hooks/useInputMaxWidth';

interface CommentInputProps {
    currentCommentText: string;
    inputCursor: number;
}

export const CommentInput: React.FC<CommentInputProps> = ({ currentCommentText, inputCursor }) => {
    const maxWidth = useInputMaxWidth();

    return (
        <InlinePane title="Comment">
            <TextInput text={currentCommentText} cursorPosition={inputCursor} maxWidth={maxWidth} />
        </InlinePane>
    );
};
