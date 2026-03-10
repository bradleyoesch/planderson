import { render } from 'ink';
import React from 'react';

import { App } from '~/App';
import { parseArguments } from '~/utils/cli/args';
import { PlandersonMode } from '~/utils/config/constants';
import { DEFAULT_SETTINGS, loadSettings, Settings } from '~/utils/config/settings';
import { generateId } from '~/utils/id';
import { logError } from '~/utils/io/logger';

export const runTui = (args: string[]): void => {
    // Parse command line arguments to determine environment
    const { registryId, sessionId: sessionIdArg, filepath } = parseArguments(args);
    const sessionId = sessionIdArg ?? generateId();

    // Mode determination
    const MODE: PlandersonMode = filepath !== null ? 'file' : 'socket';

    // Load settings at entry point - use defaults on error
    let settings: Settings = DEFAULT_SETTINGS;
    const error: Error | null = null;

    try {
        settings = loadSettings(sessionId);
    } catch {
        // use default settings
    }

    // Log unhandled exceptions before Bun/Node crashes silently.
    // The shell script's EXIT trap guarantees pane restore regardless of exit code.
    process.on('uncaughtException', (err: Error) => {
        logError(__filename, sessionId, 'process.uncaught_exception', err);
        process.exit(1);
    });

    // Ink fires clearTerminal (full screen erase) when outputHeight >= stdout.rows.
    // Our root box uses minHeight=terminalHeight, so outputHeight always equals stdout.rows,
    // causing a full erase+redraw on every keystroke — visible as flicker.
    // rows+1 makes the check false for normal renders; genuine overflow (outputHeight
    // exceeds terminalHeight by ≥1) still triggers clearTerminal correctly.
    //
    // log-update (Ink's incremental renderer) writes eraseLines(N) + content as one
    // stdout.write() call. eraseLines blanks lines from bottom-to-top, which tmux renders
    // progressively — creating the visible blank flash. We intercept log-update writes and
    // replace them with cursor-reposition + overwrite, which has no blank intermediate state:
    // the cursor jumps to the top of the content area, and new content overwrites old
    // character-by-character with \x1b[K clearing each line end to avoid stale chars.
    //
    // Detection: log-update writes start with \x1b[2K (eraseLine from ansi-escapes).
    // eraseLines(N) ends with \x1b[G (cursorLeft); content follows. log-update always
    // appends '\n' to content (str + '\n'), which scrolls the terminal when content fills
    // all rows. We strip that trailing '\n' and adjust cursor-up by -1 accordingly:
    // log-update tracks cursor as being at row N+1 (after '\n'), so eraseLines(N+1) emits
    // N cursor-ups. Without the '\n', cursor is at row N, so we only need N-1 ups.
    const stdout = Object.create(process.stdout, {
        rows: { get: () => (process.stdout.rows ?? 24) + 1 },
        write: {
            value(data: Uint8Array | string): boolean {
                if (typeof data === 'string' && data.startsWith('\x1b[2K')) {
                    const sepIndex = data.indexOf('\x1b[G');
                    if (sepIndex < 0) return process.stdout.write(data);
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
                    return process.stdout.write(
                        `${cursorToStart}${contentToWrite.replaceAll('\n', '\x1b[K\n')}\x1b[K\x1b[J`,
                    );
                }
                return process.stdout.write(typeof data === 'string' ? data : data);
            },
            writable: true,
        },
    }) as typeof process.stdout;

    // Render the app
    render(
        <App
            sessionId={sessionId}
            mode={MODE}
            filepath={filepath}
            settings={settings}
            error={error}
            registryId={registryId}
        />,
        { stdout },
    );
};

if (import.meta.main) {
    runTui(process.argv.slice(2));
}
