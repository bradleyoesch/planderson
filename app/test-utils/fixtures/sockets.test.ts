import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import { useTestSocket, waitForSocket } from './sockets';

describe('fixtures sockets', () => {
    describe('useTestSocket', () => {
        test('returns unique socket path with session hash', () => {
            const { path: socketPath, sessionId } = useTestSocket();

            expect(socketPath).toContain('planderson-test');
            expect(socketPath).toContain('.sock');
            expect(socketPath).toContain(sessionId);
        });

        test('returns socket path with custom test name', () => {
            const { path: socketPath } = useTestSocket('custom-test');

            expect(socketPath).toContain('custom-test');
        });

        test('ensures socket directory exists', () => {
            const { path: socketPath } = useTestSocket();
            const dir = path.dirname(socketPath);

            expect(fs.existsSync(dir)).toBe(true);
        });

        test('returns unique paths per call', () => {
            const socket1 = useTestSocket();
            const socket2 = useTestSocket();

            expect(socket1.path).not.toBe(socket2.path);
            expect(socket1.sessionId).not.toBe(socket2.sessionId);
        });

        test('does not create the socket file', () => {
            const { path: socketPath } = useTestSocket();

            expect(fs.existsSync(socketPath)).toBe(false);
        });

        test('uses default name format without test name', () => {
            const { path: socketPath, sessionId } = useTestSocket();
            const filename = path.basename(socketPath);

            expect(filename).toBe(`test-${sessionId}.sock`);
        });
    });

    describe('waitForSocket', () => {
        const socketFiles: string[] = [];

        afterEach(() => {
            socketFiles.splice(0).forEach((p) => {
                try {
                    fs.unlinkSync(p);
                } catch {
                    // ignore
                }
            });
        });

        test('resolves when a Unix socket file is created at the path', async () => {
            const socketPath = path.join(os.tmpdir(), `planderson-wait-test-${Date.now()}.sock`);

            const waitPromise = waitForSocket(socketPath);

            // Create a real socket file after a short delay
            await new Promise<void>((resolve) => setTimeout(resolve, 50));
            const server = net.createServer();
            socketFiles.push(socketPath);
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));

            await expect(waitPromise).resolves.toBeUndefined();

            await new Promise<void>((resolve) => server.close(() => resolve()));
        });

        test('does not resolve for a plain file at the socket path', async () => {
            const socketPath = path.join(os.tmpdir(), `planderson-wait-dummy-${Date.now()}.sock`);
            fs.writeFileSync(socketPath, 'dummy');
            socketFiles.push(socketPath);

            await expect(waitForSocket(socketPath, 100)).rejects.toThrow('not ready');
        });

        test('rejects after timeoutMs when socket never becomes available', async () => {
            const socketPath = path.join(os.tmpdir(), `planderson-wait-never-${Date.now()}.sock`);

            await expect(waitForSocket(socketPath, 100)).rejects.toThrow('not ready');
        });
    });
});
