import { render } from 'ink';
import React from 'react';

import { App } from '~/App';
import { parseArguments } from '~/utils/cli/args';
import { PlandersonMode } from '~/utils/config/constants';
import { DEFAULT_SETTINGS, loadSettings, Settings } from '~/utils/config/settings';
import { generateId } from '~/utils/id';
import { logError } from '~/utils/io/logger';
import { createWriteInterceptor } from '~/utils/io/stdout-interceptor';

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
    // createWriteInterceptor handles two log-update write patterns — see stdout-interceptor.ts.
    const interceptWrite = createWriteInterceptor((data) => process.stdout.write(data));
    const stdout = Object.create(process.stdout, {
        rows: { get: () => (process.stdout.rows ?? 24) + 1 },
        write: {
            value: interceptWrite,
            writable: true,
        },
    }) as typeof process.stdout;

    // Position cursor at top-left before first render so the interceptor's first-render
    // path writes content from row 1. Without this, the shell cursor may be at the last
    // row after the user pressed Enter, and stripping '\n' alone would leave content below
    // the visible area. In the tmux respawn-pane path this is already at row 1 (no-op).
    process.stdout.write('\x1b[H');

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
