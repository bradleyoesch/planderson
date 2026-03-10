/**
 * Creates a write interceptor for Ink/log-update output that:
 *   1. Prevents terminal flicker (subsequent renders: cursor-reposition instead of erase+redraw)
 *   2. Prevents the first-render scroll (first render: strip log-update's trailing '\n')
 *
 * ## Background
 *
 * log-update (Ink's incremental renderer) always appends '\n' to content and writes:
 *   - First render:       content + '\n'               (eraseLines(0) = "")
 *   - Subsequent renders: '\x1b[2K' + ... + '\n'       (eraseLines(N) + content)
 *
 * The trailing '\n' scrolls the terminal when content fills all rows. On first render,
 * the content starts with raw color codes (not '\x1b[2K'), so without explicit handling
 * it falls through and the '\n' pushes the top border off screen.
 *
 * ## Detection
 *
 * - First render:       string, ends with '\n', does NOT start with '\x1b[2K'
 * - Subsequent renders: string, starts with '\x1b[2K'
 *
 * An `isFirstRender` flag ensures the first-render path only fires once.
 *
 * ## Subsequent render mechanics
 *
 * eraseLines(N) ends with '\x1b[G' (cursorLeft); content follows immediately.
 * We count '\x1b[1A' (cursor-up) sequences in the erase prefix and use that to
 * jump back to the start of the content area, then overwrite line-by-line.
 * '\x1b[K' clears to end-of-line to remove stale characters.
 * '\x1b[J' clears from cursor to end-of-screen after the last line.
 *
 * We strip the trailing '\n' and subtract 1 from the cursor-up count because
 * log-update accounts for the cursor being at row N+1 (after '\n'). Without '\n'
 * the cursor stays at row N, so we only need N-1 ups.
 */
export const createWriteInterceptor = (
    rawWrite: (data: string | Uint8Array) => boolean,
): ((data: string | Uint8Array) => boolean) => {
    let isFirstRender = true;

    return (data: string | Uint8Array): boolean => {
        if (typeof data !== 'string') {
            return rawWrite(data);
        }

        // Subsequent renders: eraseLines(N) starts with \x1b[2K
        if (data.startsWith('\x1b[2K')) {
            isFirstRender = false;
            const sepIndex = data.indexOf('\x1b[G');
            if (sepIndex < 0) return rawWrite(data);
            const erasePrefix = data.slice(0, sepIndex);
            // '\x1b[G' is 3 chars; content follows immediately after
            const content = data.slice(sepIndex + 3);
            // Count \x1b[1A (cursor-up) sequences in erasePrefix
            // eslint-disable-next-line no-control-regex
            const cursorUpCount = erasePrefix.match(/\x1b\[1A/g)?.length ?? 0;
            // Strip log-update's trailing '\n' to prevent terminal scroll
            const contentToWrite = content.endsWith('\n') ? content.slice(0, -1) : content;
            // Use cursorUpCount-1 because cursor is now at row N (not row N+1)
            const linesUp = cursorUpCount - 1;
            const cursorToStart = linesUp > 0 ? `\x1b[${linesUp}F` : '\r';
            // Overwrite content lines; \x1b[K clears to end-of-line to remove stale chars
            return rawWrite(`${cursorToStart}${contentToWrite.replaceAll('\n', '\x1b[K\n')}\x1b[K\x1b[J`);
        }

        // First render: eraseLines(0) = "" so there is no \x1b[2K prefix.
        // log-update writes: "" + content + '\n' = content + '\n'.
        // The cursor is at top-left (positioned before render()). Strip '\n' to prevent scroll.
        if (isFirstRender && data.endsWith('\n')) {
            isFirstRender = false;
            const contentToWrite = data.slice(0, -1);
            return rawWrite(`${contentToWrite}\x1b[K\x1b[J`);
        }

        return rawWrite(data);
    };
};
