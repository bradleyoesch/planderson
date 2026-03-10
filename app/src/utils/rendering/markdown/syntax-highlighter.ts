import type { Element as HastElement, Root as HastRoot, Text as HastText } from 'hast';
import { common, createLowlight } from 'lowlight';

import { SYNTAX_COLORS, TOKEN_COLORS } from '~/utils/config/constants';
import { TextSegment } from '~/utils/rendering/markdown/markdown';

const lowlight = createLowlight(common);
const MAX_CODE_BLOCK_LINES = 5000;

/**
 * Apply syntax highlighting to code block content.
 * Returns array of lines, each containing colored TextSegments.
 */
export const syntaxHighlight = (code: string, language: string | undefined): TextSegment[][] => {
    const lines = code.split('\n');

    // Check line count limit
    if (lines.length > MAX_CODE_BLOCK_LINES) {
        return plainCodeSegments(code);
    }

    // No language tag → plain monospace
    if (!language) {
        return plainCodeSegments(code);
    }

    try {
        // Use lowlight to get HAST (HTML AST)
        const tree = lowlight.highlight(language, code);
        return hastToSegmentLines(tree);
    } catch {
        // Unknown language or highlighting error → fallback to plain
        return plainCodeSegments(code);
    }
};

/**
 * Convert code to plain text segments (no highlighting)
 */
const plainCodeSegments = (code: string): TextSegment[][] => {
    return code.split('\n').map((line) => [{ text: line, code: true }]);
};

/**
 * Convert HAST tree to our TextSegment format, split by lines
 */
const hastToSegmentLines = (tree: HastRoot): TextSegment[][] => {
    const allSegments = hastToSegments(tree);
    return splitSegmentsByLines(allSegments);
};

/**
 * Convert HAST tree to flat array of TextSegments
 */
const hastToSegments = (node: HastRoot | HastElement | HastText): TextSegment[] => {
    const segments: TextSegment[] = [];

    if (node.type === 'text') {
        // Plain text node - use WHITE as default color
        segments.push({ text: node.value, code: true, color: SYNTAX_COLORS.WHITE });
    } else if (node.type === 'element') {
        // Element with class name → colored segment
        const className = node.properties?.className;
        const tokenType = Array.isArray(className) ? className[0] : className;
        const color = typeof tokenType === 'string' ? TOKEN_COLORS[tokenType] : undefined;

        // Recursively process children
        node.children.forEach((child) => {
            const childSegments = hastToSegments(child as HastElement | HastText);
            childSegments.forEach((seg) => {
                segments.push({ ...seg, color: color || seg.color });
            });
        });
    } else if ('children' in node) {
        // Root node - process children
        node.children.forEach((child) => {
            segments.push(...hastToSegments(child as HastElement | HastText));
        });
    }

    return segments;
};

/**
 * Split segments array into lines based on newline characters
 */
const splitSegmentsByLines = (segments: TextSegment[]): TextSegment[][] => {
    const lines: TextSegment[][] = [];
    let currentLine: TextSegment[] = [];

    // Handle empty segments array
    if (segments.length === 0) {
        return [[{ text: '', code: true }]];
    }

    segments.forEach((segment) => {
        const text = segment.text;

        if (!text.includes('\n')) {
            // No newlines, add to current line
            currentLine.push(segment);
        } else {
            // Has newlines, split segment
            const parts = text.split('\n');

            parts.forEach((part, index) => {
                if (index > 0) {
                    // Push previous line and start new one
                    lines.push(currentLine);
                    currentLine = [];
                }

                // Always push a segment, even if empty (preserves blank lines)
                currentLine.push({ ...segment, text: part });
            });
        }
    });

    // Push final line (even if empty, to preserve blank lines at the end)
    lines.push(currentLine);

    return lines;
};
