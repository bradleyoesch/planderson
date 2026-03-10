/**
 * Line wrapping test helpers
 *
 * Convenience wrappers for testing line wrapping with and without markdown parsing.
 */

import type { LineMetadata } from '~/utils/rendering/line-wrapping';
import { wrapContentWithFormatting } from '~/utils/rendering/line-wrapping';
import { parseMarkdownDocument } from '~/utils/rendering/markdown/document-parser';
import type { LineFormatting } from '~/utils/rendering/markdown/markdown';

/**
 * Test helper: wraps plain strings into LineMetadata without markdown parsing.
 *
 * Use this for tests that need plain text wrapping (no bold, italic, code blocks, etc.).
 * For markdown rendering tests, use wrapMarkdownContent instead.
 *
 * @param contentLines - Array of plain text lines
 * @param terminalWidth - Terminal width in columns
 * @param paddingX - Horizontal padding on each side
 * @returns Array of line metadata
 */
export const wrapContent = (contentLines: string[], terminalWidth: number, paddingX: number): LineMetadata[] => {
    // Convert plain strings to LineFormatting (no markdown parsing)
    const formattings: LineFormatting[] = contentLines.map((line) => ({
        type: 'normal' as const,
        segments: [{ text: line }],
    }));

    return wrapContentWithFormatting(formattings, terminalWidth, paddingX);
};

/**
 * Test helper: parses markdown and wraps into LineMetadata with formatting.
 *
 * Use this for tests that need markdown rendering (bold, italic, code blocks, syntax highlighting, etc.).
 * This mimics production behavior: parseMarkdownDocument → wrapContentWithFormatting.
 *
 * @param contentLines - Array of markdown text lines
 * @param terminalWidth - Terminal width in columns
 * @param paddingX - Horizontal padding on each side
 * @returns Array of line metadata with markdown formatting
 */
export const wrapMarkdownContent = (
    contentLines: string[],
    terminalWidth: number,
    paddingX: number,
): LineMetadata[] => {
    const content = contentLines.join('\n');
    const lineFormattings = parseMarkdownDocument(content);
    return wrapContentWithFormatting(lineFormattings, terminalWidth, paddingX);
};
