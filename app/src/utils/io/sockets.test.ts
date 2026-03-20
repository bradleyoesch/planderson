import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import fs from 'fs';
import * as os from 'os';
import path from 'path';

import { useTempDir } from '~/test-utils/fixtures';

import { getPlandersonBaseDir } from './paths';
import {
    cleanupOldRegistry,
    cleanupOldSockets,
    cleanupRegistry,
    ensureRegistryDir,
    ensureSocketDir,
    findActiveSocket,
    getRegistryDir,
    getSession,
    getSocketDir,
    getSocketId,
    getSocketPath,
    registerSession,
} from './sockets';

describe('io sockets', () => {
    let testSocketDir: string;
    let testRegistryDir: string;

    beforeEach(() => {
        const tempHomeDir = useTempDir();
        spyOn(os, 'homedir').mockReturnValue(tempHomeDir);

        // No dev.json → getPlandersonBaseDir() falls back to tempHomeDir/.planderson
        const plandersonDir = path.join(tempHomeDir, '.planderson');
        testSocketDir = path.join(plandersonDir, 'sockets');
        testRegistryDir = path.join(plandersonDir, 'registry');

        fs.mkdirSync(testSocketDir, { recursive: true });
        fs.mkdirSync(testRegistryDir, { recursive: true });
        fs.mkdirSync(path.join(plandersonDir, 'logs'), { recursive: true });
    });

    afterEach(() => {
        mock.restore();
    });

    describe('getPlandersonBaseDir', () => {
        test('returns ~/.planderson when no dev.json exists', () => {
            const baseDir = getPlandersonBaseDir();
            expect(baseDir).toBe(path.join(os.homedir(), '.planderson'));
        });

        test('returns absolute path', () => {
            const baseDir = getPlandersonBaseDir();
            expect(path.isAbsolute(baseDir)).toBe(true);
        });
    });

    describe('getSocketDir', () => {
        test('returns path in sockets directory', () => {
            const result = getSocketDir();
            expect(result).toContain('sockets');
            expect(result).toBe(path.join(getPlandersonBaseDir(), 'sockets'));
        });

        test('returns absolute path', () => {
            const result = getSocketDir();
            expect(path.isAbsolute(result)).toBe(true);
        });
    });

    describe('ensureSocketDir', () => {
        test('creates socket directory if it does not exist', () => {
            const dir = getSocketDir();
            // Clean up first if it exists
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }

            ensureSocketDir();

            expect(fs.existsSync(dir)).toBe(true);
            expect(fs.statSync(dir).isDirectory()).toBe(true);
        });

        test('does nothing if directory already exists', () => {
            ensureSocketDir();
            const stat1 = fs.statSync(getSocketDir());

            ensureSocketDir();

            const stat2 = fs.statSync(getSocketDir());
            expect(stat2.ino).toBe(stat1.ino); // Same inode = same directory
        });
    });

    describe('getSocketId and getSocketPath', () => {
        test('getSocketId adds planderson prefix', () => {
            const result = getSocketId('abc1234');
            expect(result).toBe('planderson-abc1234');
        });

        test('getSocketPath returns path with socket ID', () => {
            const socketId = getSocketId('abc1234');
            const result = getSocketPath(socketId);
            expect(result).toContain('planderson-abc1234.sock');
        });

        test('formats socket filename correctly', () => {
            const socketId = getSocketId('test123');
            const result = getSocketPath(socketId);
            expect(path.basename(result)).toBe('planderson-test123.sock');
        });

        test('getSocketPath accepts socket ID directly', () => {
            const result = getSocketPath('planderson-direct123');
            expect(path.basename(result)).toBe('planderson-direct123.sock');
        });
    });

    describe('findActiveSocket', () => {
        test('returns single socket file', () => {
            const socketPath = path.join(testSocketDir, 'planderson-session1.sock');
            fs.writeFileSync(socketPath, '');

            const result = findActiveSocket();
            expect(result).not.toBeNull();
        });

        test('ignores files without .sock extension', () => {
            const dir = getSocketDir();
            ensureSocketDir();

            // Create non-socket files
            fs.writeFileSync(path.join(dir, 'planderson-session1.txt'), '');
            fs.writeFileSync(path.join(dir, 'random.sock'), '');

            const result = findActiveSocket();
            // Should not find these files
            if (result) {
                expect(result.sessionId).not.toBe('session1');
                expect(result.sessionId).not.toBe('random');
            }
        });

        test('extracts session hash correctly from filename', () => {
            const filename = 'planderson-abc1234.sock';
            const match = filename.match(/planderson-(.+)\.sock/);
            expect(match).not.toBeNull();
            expect(match![1]).toBe('abc1234');
        });
    });

    describe('getRegistryDir', () => {
        test('returns path in registry directory', () => {
            const result = getRegistryDir();
            expect(result).toContain('registry');
            expect(result).toBe(path.join(getPlandersonBaseDir(), 'registry'));
        });

        test('returns absolute path', () => {
            const result = getRegistryDir();
            expect(path.isAbsolute(result)).toBe(true);
        });
    });

    describe('ensureRegistryDir', () => {
        test('creates registry directory if it does not exist', () => {
            const dir = getRegistryDir();
            // Clean up first if it exists
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }

            ensureRegistryDir();

            expect(fs.existsSync(dir)).toBe(true);
            expect(fs.statSync(dir).isDirectory()).toBe(true);
        });

        test('does nothing if directory already exists', () => {
            ensureRegistryDir();
            const stat1 = fs.statSync(getRegistryDir());

            ensureRegistryDir();

            const stat2 = fs.statSync(getRegistryDir());
            expect(stat2.ino).toBe(stat1.ino);
        });
    });

    describe('registerSession and getSession', () => {
        test('creates registry file with session data', () => {
            registerSession('0.1', 'session123');

            const registryFile = path.join(getRegistryDir(), '0.1.session');
            expect(fs.existsSync(registryFile)).toBe(true);

            const content = JSON.parse(fs.readFileSync(registryFile, 'utf-8')) as {
                socketId: string;
                timestamp: number;
            };
            expect(content.socketId).toBe('session123');
            expect(content.timestamp).toBeGreaterThan(0);
        });

        test('overwrites existing registry file for same ID', () => {
            registerSession('0.2', 'session123');
            registerSession('0.2', 'session456');

            const registryFile = path.join(getRegistryDir(), '0.2.session');
            const content = JSON.parse(fs.readFileSync(registryFile, 'utf-8')) as { socketId: string };
            expect(content.socketId).toBe('session456');
        });

        test('creates separate files for different registry IDs', () => {
            registerSession('0.3', 'session123');
            registerSession('0.4', 'session456');

            const file1 = path.join(getRegistryDir(), '0.3.session');
            const file2 = path.join(getRegistryDir(), '0.4.session');

            expect(fs.existsSync(file1)).toBe(true);
            expect(fs.existsSync(file2)).toBe(true);

            const content1 = JSON.parse(fs.readFileSync(file1, 'utf-8')) as { socketId: string };
            const content2 = JSON.parse(fs.readFileSync(file2, 'utf-8')) as { socketId: string };

            expect(content1.socketId).toBe('session123');
            expect(content2.socketId).toBe('session456');
        });

        test('returns session hash from registry file', () => {
            registerSession('0.5', 'session123');

            const result = getSession('0.5');
            expect(result).toBe('session123');
        });

        test('handles registry IDs with special characters (tmux format)', () => {
            registerSession('tmux-pane-%123', 'session-abc');
            registerSession('tmux-pane-%1374', 'session-def');

            expect(getSession('tmux-pane-%123')).toBe('session-abc');
            expect(getSession('tmux-pane-%1374')).toBe('session-def');

            const file1 = path.join(getRegistryDir(), 'tmux-pane-%123.session');
            const file2 = path.join(getRegistryDir(), 'tmux-pane-%1374.session');
            expect(fs.existsSync(file1)).toBe(true);
            expect(fs.existsSync(file2)).toBe(true);
        });

        test('works with non-tmux registry IDs', () => {
            const testIds = ['vscode-session-123', 'ssh-session-abc', 'custom-id-xyz'];

            testIds.forEach((id) => {
                registerSession(id, `session-${id}`);
                expect(getSession(id)).toBe(`session-${id}`);

                const registryFile = path.join(getRegistryDir(), `${id}.session`);
                expect(fs.existsSync(registryFile)).toBe(true);
            });
        });

        test('returns null when registry file does not exist', () => {
            const result = getSession('nonexistent');
            expect(result).toBeNull();
        });

        test('returns null when registry file is malformed', () => {
            ensureRegistryDir();
            const registryFile = path.join(getRegistryDir(), '0.6.session');
            fs.writeFileSync(registryFile, 'not valid json');

            const result = getSession('0.6');
            expect(result).toBeNull();
        });

        test('returns null when sessionId is missing', () => {
            ensureRegistryDir();
            const registryFile = path.join(getRegistryDir(), '0.7.session');
            fs.writeFileSync(registryFile, JSON.stringify({ timestamp: Date.now() }));

            const result = getSession('0.7');
            expect(result).toBeNull();
        });
    });

    describe('cleanupRegistry', () => {
        test('deletes registry file for registry ID', () => {
            registerSession('0.8', 'session123');
            const registryFile = path.join(getRegistryDir(), '0.8.session');
            expect(fs.existsSync(registryFile)).toBe(true);

            cleanupRegistry('0.8');

            expect(fs.existsSync(registryFile)).toBe(false);
        });

        test('does nothing when registry file does not exist', () => {
            expect(() => cleanupRegistry('nonexistent')).not.toThrow();
        });

        test('does not affect other registry files', () => {
            registerSession('0.9', 'session1');
            registerSession('0.10', 'session2');

            cleanupRegistry('0.9');

            expect(fs.existsSync(path.join(getRegistryDir(), '0.9.session'))).toBe(false);
            expect(fs.existsSync(path.join(getRegistryDir(), '0.10.session'))).toBe(true);
        });
    });

    describe('cleanupOldRegistry', () => {
        test('removes registry files older than 1 hour', () => {
            ensureRegistryDir();
            const dir = getRegistryDir();

            // Create old file (2 hours ago)
            const oldFile = path.join(dir, '0.11.session');
            fs.writeFileSync(oldFile, JSON.stringify({ sessionId: 'old' }));
            const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
            fs.utimesSync(oldFile, twoHoursAgo / 1000, twoHoursAgo / 1000);

            // Create recent file
            const recentFile = path.join(dir, '0.12.session');
            fs.writeFileSync(recentFile, JSON.stringify({ sessionId: 'recent' }));

            cleanupOldRegistry();

            expect(fs.existsSync(oldFile)).toBe(false);
            expect(fs.existsSync(recentFile)).toBe(true);
        });

        test('keeps files at exactly 1 hour old (not older)', () => {
            ensureRegistryDir();
            const dir = getRegistryDir();

            const file = path.join(dir, '0.13.session');
            fs.writeFileSync(file, JSON.stringify({ sessionId: 'threshold' }));

            // Set to exactly 1 hour ago minus 100ms (so it's not quite > 1 hour)
            const justUnderOneHour = Date.now() - (60 * 60 * 1000 - 100);
            fs.utimesSync(file, justUnderOneHour / 1000, justUnderOneHour / 1000);

            cleanupOldRegistry();

            // File should be kept (not older than 1 hour)
            expect(fs.existsSync(file)).toBe(true);
        });

        test('ignores non-.session files', () => {
            ensureRegistryDir();
            const dir = getRegistryDir();

            // Create non-session file (old)
            const otherFile = path.join(dir, 'other.txt');
            fs.writeFileSync(otherFile, 'content');
            const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
            fs.utimesSync(otherFile, twoHoursAgo / 1000, twoHoursAgo / 1000);

            cleanupOldRegistry();

            // Non-.session file should not be deleted
            expect(fs.existsSync(otherFile)).toBe(true);
        });
    });

    describe('cleanupOldSockets', () => {
        test('removes socket files older than 1 hour', () => {
            ensureSocketDir();
            const dir = getSocketDir();

            // Create old socket (2 hours ago)
            const oldSocket = path.join(dir, 'planderson-old123.sock');
            fs.writeFileSync(oldSocket, '');
            const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
            fs.utimesSync(oldSocket, twoHoursAgo / 1000, twoHoursAgo / 1000);

            // Create recent socket
            const recentSocket = path.join(dir, 'planderson-recent456.sock');
            fs.writeFileSync(recentSocket, '');

            cleanupOldSockets();

            expect(fs.existsSync(oldSocket)).toBe(false);
            expect(fs.existsSync(recentSocket)).toBe(true);
        });

        test('keeps sockets at exactly 1 hour old (not older)', () => {
            ensureSocketDir();
            const dir = getSocketDir();

            const socket = path.join(dir, 'planderson-threshold.sock');
            fs.writeFileSync(socket, '');

            // Set to exactly 1 hour ago minus 100ms (so it's not quite > 1 hour)
            const justUnderOneHour = Date.now() - (60 * 60 * 1000 - 100);
            fs.utimesSync(socket, justUnderOneHour / 1000, justUnderOneHour / 1000);

            cleanupOldSockets();

            // Socket should be kept (not older than 1 hour)
            expect(fs.existsSync(socket)).toBe(true);
        });

        test('ignores files without planderson- prefix', () => {
            ensureSocketDir();
            const dir = getSocketDir();

            // Create non-planderson file (old)
            const otherFile = path.join(dir, 'other-session.sock');
            fs.writeFileSync(otherFile, '');
            const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
            fs.utimesSync(otherFile, twoHoursAgo / 1000, twoHoursAgo / 1000);

            cleanupOldSockets();

            expect(fs.existsSync(otherFile)).toBe(true);
        });

        test('ignores files without .sock extension', () => {
            ensureSocketDir();
            const dir = getSocketDir();

            // Create non-.sock file (old)
            const otherFile = path.join(dir, 'planderson-session.txt');
            fs.writeFileSync(otherFile, '');
            const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
            fs.utimesSync(otherFile, twoHoursAgo / 1000, twoHoursAgo / 1000);

            cleanupOldSockets();

            expect(fs.existsSync(otherFile)).toBe(true);
        });
    });
});
