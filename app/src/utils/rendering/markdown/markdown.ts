import { COLORS } from '~/utils/config/constants';

export interface TextSegment {
    text: string;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    link?: { text: string; url: string };
    color?: string;
    backgroundColor?: string; // For code block backgrounds
}

export interface CodeMetadata {
    language?: string; // 'typescript', 'python', etc.
    blockIndex: number; // Which code block (0-based)
    lineInBlock: number; // Line within this block (0-based)
    totalLinesInBlock: number; // Total lines in this block
    isOpening?: boolean; // Line is ``` opening fence
    isClosing?: boolean; // Line is ``` closing fence
}

export interface LineFormatting {
    type: 'normal' | 'heading' | 'blockquote' | 'hr' | 'code';
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
    blockquoteDepth?: 1 | 2 | 3 | 4 | 5;
    segments: TextSegment[];
    codeMetadata?: CodeMetadata;
}

interface ParsePattern {
    regex: RegExp;
    process: (match: RegExpExecArray) => TextSegment;
}

const parseInlineFormatting = (text: string): TextSegment[] => {
    // Handle empty text
    if (text.length === 0) {
        return [{ text: '' }];
    }

    // Define patterns in priority order (more specific first)
    const patterns: ParsePattern[] = [
        // Bold with ** (supports nesting) - must check before single *
        {
            regex: /\*\*(.+?)\*\*/g,
            process: (match) => {
                // Return array marker for nested processing
                return { text: match[1], bold: true, _isNested: true } as TextSegment & { _isNested: boolean };
            },
        },
        // Bold with __ (supports nesting) - must check before single _
        {
            regex: /__(.+?)__/g,
            process: (match) => {
                return { text: match[1], bold: true, _isNested: true } as TextSegment & { _isNested: boolean };
            },
        },
        // Italic with * (supports nesting) - use negative lookahead/behind to avoid matching **
        {
            regex: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
            process: (match) => {
                return { text: match[1], italic: true, _isNested: true } as TextSegment & { _isNested: boolean };
            },
        },
        // Italic with _ (supports nesting) - use negative lookahead/behind to avoid matching __
        {
            regex: /(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g,
            process: (match) => {
                return { text: match[1], italic: true, _isNested: true } as TextSegment & { _isNested: boolean };
            },
        },
        // Inline code (no nesting - literal content) - exclude triple backticks (code blocks)
        // Supports escaped backticks: `` becomes `
        // Pattern matches: opening `, content (non-backtick or escaped ``), closing `
        {
            regex: /(?<!`)`((?:[^`]|``)+?)`(?!`)/g,
            process: (match) => ({ text: match[1].replaceAll('``', '`'), code: true }),
        },
        // Strikethrough (supports nesting)
        {
            regex: /~~(.+?)~~/g,
            process: (match) => {
                return { text: match[1], strikethrough: true, _isNested: true } as TextSegment & { _isNested: boolean };
            },
        },
        // Links [text](url) (no nesting - literal content)
        {
            regex: /\[(.+?)]\((.+?)\)/g,
            process: (match) => ({
                text: match[1],
                link: { text: match[1], url: match[2] },
            }),
        },
    ];

    const segments: TextSegment[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        let earliestMatch: { index: number; pattern: ParsePattern; match: RegExpExecArray } | null = null;

        // Find the earliest match across all patterns
        earliestMatch = patterns.reduce<{ index: number; pattern: ParsePattern; match: RegExpExecArray } | null>(
            (earliest, pattern) => {
                pattern.regex.lastIndex = 0; // Reset regex
                const match = pattern.regex.exec(remaining);
                if (match && (earliest === null || match.index < earliest.index)) {
                    return { index: match.index, pattern, match };
                }
                return earliest;
            },
            null,
        );

        if (earliestMatch) {
            // Add plain text before match
            if (earliestMatch.index > 0) {
                segments.push({ text: remaining.substring(0, earliestMatch.index) });
            }
            // Process formatted segment
            const processed = earliestMatch.pattern.process(earliestMatch.match);

            // Check if this segment supports nesting
            if ('_isNested' in processed && processed._isNested) {
                // Recursively parse inner content
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { text: innerText, _isNested, ...outerFormatting } = processed;
                const innerSegments = parseInlineFormatting(innerText);

                // Merge outer formatting with each inner segment
                innerSegments.forEach((innerSeg) => {
                    segments.push({ ...innerSeg, ...outerFormatting });
                });
            } else {
                // No nesting, just add the segment
                segments.push(processed);
            }

            // Continue with remaining text
            remaining = remaining.substring(earliestMatch.pattern.regex.lastIndex);
        } else {
            // No more matches, add remaining text
            segments.push({ text: remaining });
            break;
        }
    }

    return segments;
};

export const parseMarkdownLine = (line: string): LineFormatting => {
    // Check for horizontal rule (3 or more dashes, asterisks, or underscores)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        return {
            type: 'hr',
            segments: [],
        };
    }

    // Check for heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
        return {
            type: 'heading',
            headingLevel: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
            segments: parseInlineFormatting(headingMatch[2]),
        };
    }

    // Check for blockquote (1-5 levels)
    const blockquoteMatch = line.match(/^(>{1,5})\s+(.*)$/);
    if (blockquoteMatch) {
        const depth = Math.min(5, blockquoteMatch[1].length) as 1 | 2 | 3 | 4 | 5;
        return {
            type: 'blockquote',
            blockquoteDepth: depth,
            segments: parseInlineFormatting(blockquoteMatch[2]),
        };
    }

    // Normal line
    return {
        type: 'normal',
        segments: parseInlineFormatting(line),
    };
};

/**
 * Returns the appropriate color for a heading based on its level.
 * H1: H1_COLOR (grey) - also gets italic + underline in Plan.tsx
 * H2-H6: undefined (normal white text)
 */
export const getHeadingColor = (level: 1 | 2 | 3 | 4 | 5 | 6): string | undefined => {
    if (level === 1) {
        return COLORS.H1_COLOR;
    }
    return undefined;
};
