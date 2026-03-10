import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

import { useTestSocket } from './sockets';

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
});
