import { afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { generateId } from '~/utils/id';

// Use short path to avoid Unix socket 104-char limit
const TEST_SOCKET_DIR = path.join(os.tmpdir(), 'planderson-test');

/**
 * Ensure test socket directory exists
 */
const ensureTestSocketDir = (): void => {
    if (!fs.existsSync(TEST_SOCKET_DIR)) {
        fs.mkdirSync(TEST_SOCKET_DIR, { recursive: true });
    }
};

/**
 * Create a unique test socket path with automatic cleanup.
 * Socket file is NOT created, only the path is returned.
 * Cleanup removes socket file if it exists.
 *
 * @param testName - Optional test name to include in socket path
 * @returns Object with socket path and session hash
 */
export const useTestSocket = (
    testName?: string,
): {
    path: string;
    sessionId: string;
} => {
    ensureTestSocketDir();

    const sessionId = generateId();
    const socketName = testName ? `${testName}-${sessionId}.sock` : `test-${sessionId}.sock`;
    const socketPath = path.join(TEST_SOCKET_DIR, socketName);

    afterEach(() => {
        try {
            if (fs.existsSync(socketPath)) {
                fs.unlinkSync(socketPath);
            }
        } catch {
            // Ignore cleanup errors
        }
    });

    return { path: socketPath, sessionId };
};
