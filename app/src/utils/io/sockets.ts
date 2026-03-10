import * as fs from 'fs';
import * as path from 'path';

import { getPlandersonBaseDir } from './paths';

/**
 * Get the base directory for production sockets
 */
export const getSocketDir = (): string => {
    return path.join(getPlandersonBaseDir(), 'sockets');
};

/**
 * Ensure socket directory exists
 */
export const ensureSocketDir = (): void => {
    const dir = getSocketDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * Get socket path for a specific session
 */
export const getSocketId = (id: string): string => {
    return `planderson-${id}`;
};

/**
 * Get socket path for a specific session
 */
export const getSocketPath = (socketId: string): string => {
    return path.join(getSocketDir(), `${socketId}.sock`);
};

/**
 * Find the most recent active socket (Option C: Socket Discovery)
 * Returns null if no active sockets found
 */
export const findActiveSocket = (): { path: string; sessionId: string } | null => {
    const dir = getSocketDir();

    if (!fs.existsSync(dir)) {
        return null;
    }

    const files = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith('planderson-') && f.endsWith('.sock'))
        .map((f) => {
            const fullPath = path.join(dir, f);
            const sessionId = f.replace('planderson-', '').replace('.sock', '');

            try {
                const stats = fs.statSync(fullPath);
                return { path: fullPath, sessionId, mtime: stats.mtimeMs };
            } catch {
                return null;
            }
        })
        .filter(Boolean) as { path: string; sessionId: string; mtime: number }[];

    if (files.length === 0) {
        return null;
    }

    // Sort by most recent first
    files.sort((a, b) => b.mtime - a.mtime);

    const { path: socketPath, sessionId } = files[0];
    return { path: socketPath, sessionId };
};

/**
 * Get the registry directory for session tracking
 */
export const getRegistryDir = (): string => {
    return path.join(getPlandersonBaseDir(), 'registry');
};

/**
 * Ensure registry directory exists
 */
export const ensureRegistryDir = (): void => {
    const dir = getRegistryDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * Register a session for a specific registry ID (e.g., tmux-pane-%123, vscode-session-456)
 */
export const registerSession = (registryId: string, socketId: string): void => {
    ensureRegistryDir();
    const registryFile = path.join(getRegistryDir(), `${registryId}.session`);
    const data = {
        socketId,
        timestamp: Date.now(),
    };
    fs.writeFileSync(registryFile, JSON.stringify(data, null, 2));
};

/**
 * Get socket ID for a registry ID
 */
export const getSession = (registryId: string): string | null => {
    const registryFile = path.join(getRegistryDir(), `${registryId}.session`);

    if (!fs.existsSync(registryFile)) {
        return null;
    }

    try {
        const data = JSON.parse(fs.readFileSync(registryFile, 'utf-8')) as { socketId?: string };
        return data.socketId ?? null;
    } catch {
        return null;
    }
};

/**
 * Delete registry file for a specific registry ID
 */
export const cleanupRegistry = (registryId: string): void => {
    const registryFile = path.join(getRegistryDir(), `${registryId}.session`);
    try {
        if (fs.existsSync(registryFile)) {
            fs.unlinkSync(registryFile);
        }
    } catch {
        // Ignore errors
    }
};

/**
 * Clean up old registry files (older than 1 hour)
 */
export const cleanupOldRegistry = (): void => {
    const dir = getRegistryDir();

    if (!fs.existsSync(dir)) {
        return;
    }

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    fs.readdirSync(dir).forEach((file) => {
        if (!file.endsWith('.session')) {
            return;
        }

        const filePath = path.join(dir, file);

        try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > oneHour) {
                fs.unlinkSync(filePath);
            }
        } catch {
            // Ignore errors
        }
    });
};

/**
 * Clean up old socket files (older than 1 hour)
 */
export const cleanupOldSockets = (): void => {
    const dir = getSocketDir();

    if (!fs.existsSync(dir)) {
        return;
    }

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    fs.readdirSync(dir).forEach((file) => {
        if (!file.startsWith('planderson-') || !file.endsWith('.sock')) {
            return;
        }

        const socketPath = path.join(dir, file);

        try {
            const stats = fs.statSync(socketPath);
            if (now - stats.mtimeMs > oneHour) {
                fs.unlinkSync(socketPath);
            }
        } catch {
            // Ignore errors
        }
    });
};
