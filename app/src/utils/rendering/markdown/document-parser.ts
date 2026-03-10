import type { Code, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { LineFormatting, parseMarkdownLine } from '~/utils/rendering/markdown/markdown';

import { syntaxHighlight } from './syntax-highlighter';

/**
 * Parse entire markdown document to LineFormatting array.
 * Maintains 1:1 line mapping with source for navigation/comments/deletions.
 */
export const parseMarkdownDocument = (content: string): LineFormatting[] => {
    if (content.trim() === '') {
        return [{ type: 'normal', segments: [{ text: '' }] }];
    }

    // Parse document to AST
    const processor = unified().use(remarkParse).use(remarkGfm);
    const tree = processor.parse(content);

    // Split content into source lines for mapping
    const sourceLines = content.split('\n');

    // Convert AST to LineFormatting array
    return convertAstToLines(tree, sourceLines);
};

/**
 * Convert remark AST to LineFormatting array with 1:1 line mapping
 */
const convertAstToLines = (tree: Root, sourceLines: string[]): LineFormatting[] => {
    // Initialize result array with source line count
    const result: (LineFormatting | undefined)[] = Array.from({ length: sourceLines.length });
    let blockIndex = 0; // Track code block index

    // Walk AST and populate result array
    tree.children.forEach((node) => {
        if (node.type === 'code') {
            // Check if indented code block
            if (isIndentedCodeBlock(node)) {
                processIndentedCodeBlock(node, result);
            } else {
                // Fenced code block
                processCodeBlock(node, result, sourceLines, blockIndex);
                blockIndex++;
            }
        }
        // Other node types will be handled in later tasks
    });

    // Fill remaining slots with parsed lines (non-code content)
    const filled = result.map((item, i) => {
        if (!item) {
            // Use existing line parser for non-code content
            return parseMarkdownLine(sourceLines[i]);
        }
        return item;
    });

    return filled;
};

/**
 * Process code block node and add to result array at correct line positions
 */
const processCodeBlock = (
    node: Code,
    result: (LineFormatting | undefined)[],
    sourceLines: string[],
    blockIndex: number,
): void => {
    if (!node.position) return;

    const startLine = node.position.start.line - 1; // Convert to 0-based
    const endLine = node.position.end.line - 1;
    const language = node.lang || undefined;

    // Apply syntax highlighting to code content
    const highlightedLines = syntaxHighlight(node.value, language);
    const totalLines = endLine - startLine + 1;

    // Opening fence line
    result[startLine] = {
        type: 'code',
        segments: [{ text: `\`\`\`${language || ''}`, code: true }],
        codeMetadata: {
            language,
            blockIndex,
            lineInBlock: 0,
            totalLinesInBlock: totalLines,
            isOpening: true,
        },
    };

    // Code content lines
    highlightedLines.forEach((segments, index) => {
        const lineNumber = startLine + 1 + index;
        if (lineNumber < endLine) {
            result[lineNumber] = {
                type: 'code',
                segments,
                codeMetadata: {
                    language,
                    blockIndex,
                    lineInBlock: index + 1,
                    totalLinesInBlock: totalLines,
                },
            };
        }
    });

    // Closing fence line
    result[endLine] = {
        type: 'code',
        segments: [{ text: '```', code: true }],
        codeMetadata: {
            language,
            blockIndex,
            lineInBlock: totalLines - 1,
            totalLinesInBlock: totalLines,
            isClosing: true,
        },
    };
};

/**
 * Check if a code node is an indented code block (vs fenced code block)
 * Indented blocks have no fence lines, so position spans exactly the value lines
 */
const isIndentedCodeBlock = (node: Code): boolean => {
    if (!node.position) return false;

    const valueLines = node.value.split('\n').length;
    const positionLines = node.position.end.line - node.position.start.line + 1;

    return positionLines === valueLines;
};

/**
 * Process indented code block node - render each line as normal text with inline code formatting
 */
const processIndentedCodeBlock = (node: Code, result: (LineFormatting | undefined)[]): void => {
    if (!node.position) return;

    const startLine = node.position.start.line - 1; // Convert to 0-based
    const endLine = node.position.end.line - 1;

    // Split code value into lines (remark merges consecutive indented lines)
    const codeLines = node.value.split('\n');

    // Each line of the indented code block becomes a normal line with inline code formatting
    codeLines.forEach((codeLine, index) => {
        const lineNumber = startLine + index;
        if (lineNumber <= endLine) {
            result[lineNumber] = {
                type: 'normal',
                segments: [{ text: codeLine, code: true }],
            };
        }
    });
};
