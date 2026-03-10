import * as os from 'os';
import * as path from 'path';

/**
 * Get the base directory for Planderson files (sockets, registry, logs, etc.)
 * Uses PLANDERSON_BASE_DIR env var when set (dev mode via dev/planderson wrapper),
 * otherwise falls back to ~/.planderson (prod).
 */
export const getPlandersonBaseDir = (): string => {
    return process.env.PLANDERSON_BASE_DIR ?? path.join(os.homedir(), '.planderson');
};

/**
 * Gets absolute path to init.sh.
 */
export const getPlandersonInitScriptPath = (): string => {
    return path.join(getPlandersonBaseDir(), 'integrations', 'tmux', 'init.sh');
};
