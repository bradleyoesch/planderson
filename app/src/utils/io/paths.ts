import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Get the base directory for Planderson files (sockets, registry, logs, etc.)
 * In dev mode, `bun run dev:set` writes ~/.planderson/dev.json with the worktree path.
 * Otherwise falls back to ~/.planderson (prod).
 */
export const getPlandersonBaseDir = (): string => {
    const devConfigPath = path.join(os.homedir(), '.planderson', 'dev.json');
    try {
        if (fs.existsSync(devConfigPath)) {
            const data = JSON.parse(fs.readFileSync(devConfigPath, 'utf-8')) as { baseDir?: string };
            if (data.baseDir) return data.baseDir;
        }
    } catch {
        /* fall through to default */
    }
    return path.join(os.homedir(), '.planderson');
};

/**
 * Gets absolute path to init.sh.
 */
export const getPlandersonInitScriptPath = (): string => {
    return path.join(getPlandersonBaseDir(), 'integrations', 'tmux', 'init.sh');
};
