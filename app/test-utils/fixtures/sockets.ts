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

/**
 * Poll a socket path by attempting real connections until the server is ready.
 * Rejects if the socket does not become available within timeoutMs.
 *
 * @param socketPath - Unix socket path to wait for
 * @param timeoutMs - Maximum wait time in milliseconds (default 5000)
 */
export const waitForSocket = async (socketPath: string, timeoutMs = 5000): Promise<void> => {
    const start = Date.now();
    while (true) {
        try {
            // Check that the file exists AND is a Unix domain socket.
            // Using isSocket() rather than a probe connection avoids interfering with the server's
            // single-active-socket tracking (a probe connect would register as the active socket,
            // causing the real caller's subsequent connect to be rejected as "already connected").
            // isSocket() also correctly rejects plain files (e.g. the dummy-file race-condition test).
            if (fs.statSync(socketPath).isSocket()) return;
        } catch {
            // ENOENT or other stat errors — socket not ready yet
        }

        if (Date.now() - start > timeoutMs) {
            throw new Error(`Socket not ready at ${socketPath} after ${timeoutMs}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
};
