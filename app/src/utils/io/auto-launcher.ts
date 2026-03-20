import { spawn } from 'child_process';

import { logError, logEvent } from './logger';
import { getPlandersonInitScriptPath } from './paths';

/**
 * Attempts to auto-launch Planderson TUI in tmux.
 * Fire-and-forget: spawns and returns immediately.
 * Graceful degradation: errors are logged but don't throw.
 *
 * @param sessionId - Session ID for log correlation (passed to spawned script)
 * @returns true if spawn succeeded, false if failed
 */
export const tryAutoLaunch = (sessionId: string): boolean => {
    try {
        const scriptPath = getPlandersonInitScriptPath();
        const args: string[] = ['--session', sessionId];

        logEvent(__filename, sessionId, 'autolaunch.spawn.starting', `script=${scriptPath} args=${args.join(' ')}`);

        // Fire-and-forget spawn
        // Child inherits environment (TMUX, PATH, HOME, etc.) from parent automatically
        const child = spawn(scriptPath, args, {
            detached: true, // Don't wait for child
            stdio: 'ignore', // Don't pipe stdio (prevents blocking)
        });

        child.unref(); // Parent doesn't wait for child to exit

        logEvent(__filename, sessionId, 'autolaunch.spawn.succeeded', `pid=${child.pid}`);
        return true;
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logError(__filename, sessionId, 'autolaunch.spawn.failed', error);
        return false;
    }
};

/**
 * Checks if auto-launch is available (in tmux).
 */
export const isAutoLaunchAvailable = (): boolean => {
    return Boolean(process.env.TMUX && process.env.TMUX_PANE);
};
