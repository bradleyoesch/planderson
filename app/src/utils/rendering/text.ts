import type { TextSegment } from '~/utils/rendering/markdown/markdown';

export interface TrimOptions {
    trimStart?: boolean;
}

/**
 * Trims whitespace at line boundaries only, not at segment boundaries.
 *
 * A wrapped segment represents one visual line containing multiple TextSegments that
 * are concatenated together. We trim at the line's outer edges (first segment's start,
 * last segment's end) but preserve spaces between segments, as those are intentional
 * formatting (e.g., the space after "Hello " in: [{ text: "Hello " }, { text: "world", bold: true }]).
 *
 * @param segments - Array of text segments to trim
 * @param options - Trimming options
 * @param options.trimStart - Whether to trim leading whitespace (default: true).
 *                            Set to false to preserve indentation on first line of wrapped content.
 */
export const trimWrappedSegment = (segments: TextSegment[], options: TrimOptions = {}): TextSegment[] => {
    if (segments.length === 0) return segments;

    const { trimStart = true } = options;
    const trimmed = [...segments];

    // Trim leading space from first segment (unless disabled)
    if (trimStart && trimmed[0]) {
        trimmed[0] = { ...trimmed[0], text: trimmed[0].text.trimStart() };
    }

    // Trim trailing space from last segment
    const lastIdx = trimmed.length - 1;
    if (trimmed[lastIdx]) {
        trimmed[lastIdx] = { ...trimmed[lastIdx], text: trimmed[lastIdx].text.trimEnd() };
    }

    return trimmed;
};
