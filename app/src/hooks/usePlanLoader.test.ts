/**
 * TESTING APPROACH: Dependency Injection + Real Filesystem
 *
 * usePlanLoader is tested using:
 * 1. spyOn(os, 'homedir') + dev.json → redirects all fs ops to a temp dir (no module mocking)
 * 2. createSocketClient factory param → inject mock socket client (5th param)
 *
 * We cannot test keyboard input or re-renders at the unit level; this hook is
 * mount-only (empty deps array), so all behaviors fire on the initial render.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import fs from 'fs';
import * as os from 'os';
import path from 'path';

import { PlandersonSocketClient } from '~/lib/socket-ipc';
import { useTempDir } from '~/test-utils/fixtures';
import { registerSession } from '~/utils/io/sockets';

import { usePlanLoader } from './usePlanLoader';

describe('usePlanLoader', () => {
    // ---------------------------------------------------------------------------
    // Test infrastructure
    // ---------------------------------------------------------------------------

    let tempBase: string;

    beforeEach(() => {
        const fakeHome = useTempDir();
        spyOn(os, 'homedir').mockReturnValue(fakeHome);

        // Write dev.json so getPlandersonBaseDir() returns tempBase
        tempBase = path.join(
            os.tmpdir(),
            `planderson-usePlanLoader-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        const plandersonDir = path.join(fakeHome, '.planderson');
        fs.mkdirSync(plandersonDir, { recursive: true });
        fs.writeFileSync(path.join(plandersonDir, 'dev.json'), JSON.stringify({ baseDir: tempBase }));

        fs.mkdirSync(path.join(tempBase, 'sockets'), { recursive: true });
        fs.mkdirSync(path.join(tempBase, 'registry'), { recursive: true });
        fs.mkdirSync(path.join(tempBase, 'logs'), { recursive: true });
    });

    afterEach(() => {
        mock.restore();
        if (fs.existsSync(tempBase)) {
            fs.rmSync(tempBase, { recursive: true, force: true });
        }
    });

    /** Creates a mock socket client with injectable behavior. */
    const makeSocketClient = (
        planContent = '# Test Plan',
    ): {
        client: {
            connect: ReturnType<typeof mock>;
            getPlan: ReturnType<typeof mock>;
            close: ReturnType<typeof mock>;
            listenForDisconnect: ReturnType<typeof mock>;
        };
        factory: (socketPath: string) => PlandersonSocketClient;
    } => {
        const client = {
            connect: mock(async () => {}),
            getPlan: mock(async () => planContent),
            close: mock(() => {}),
            listenForDisconnect: mock((_cb: (err?: Error) => void) => {}),
        };
        const factory = (_socketPath: string) => client as unknown as PlandersonSocketClient;
        return { client, factory };
    };

    /** Creates a real socket stub file in the temp sockets dir. Returns the full socket path. */
    const createSocketStub = (sessionId: string): string => {
        const socketId = `planderson-${sessionId}`;
        const socketPath = path.join(tempBase, 'sockets', `${socketId}.sock`);
        fs.writeFileSync(socketPath, '');
        return socketPath;
    };

    // ---------------------------------------------------------------------------
    // File Mode
    // ---------------------------------------------------------------------------

    test('loads plan content from file successfully', async () => {
        const planContent = '# Test Plan\n\nThis is a test plan.';
        const planFile = path.join(tempBase, 'test-plan.md');
        fs.writeFileSync(planFile, planContent);

        const { result } = renderHook(() => usePlanLoader('session', null, 'file', planFile));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.content).toBe(planContent);
        expect(result.current.error).toBeNull();
        expect(result.current.socketClient).toBeNull();
    });

    test('resolves file path relative to base directory', async () => {
        const planContent = '# Resolved Plan';
        const planFile = path.join(tempBase, 'relative-plan.md');
        fs.writeFileSync(planFile, planContent);

        // Pass just the filename — path.resolve(baseDir, filename) should find it
        const relativeFile = 'relative-plan.md';
        const { result } = renderHook(() => usePlanLoader('session', null, 'file', relativeFile));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.content).toBe(planContent);
        expect(result.current.error).toBeNull();
    });

    test('sets error when file does not exist', async () => {
        const planFile = path.join(tempBase, 'nonexistent.md');

        const { result } = renderHook(() => usePlanLoader('session', null, 'file', planFile));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.content).toBe('');
        expect(result.current.error).toContain('Plan file not found');
        expect(result.current.error).toContain(planFile);
        expect(result.current.socketClient).toBeNull();
    });

    test('sets error when file is empty or contains only whitespace', async () => {
        const planFile = path.join(tempBase, 'empty-plan.md');
        fs.writeFileSync(planFile, '   \n\t\t\n   ');

        const { result } = renderHook(() => usePlanLoader('session', null, 'file', planFile));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.content).toBe('');
        expect(result.current.error).toBe('Plan file is empty');
        expect(result.current.socketClient).toBeNull();
    });

    // ---------------------------------------------------------------------------
    // Socket Mode — Registry Discovery
    // ---------------------------------------------------------------------------

    describe('Socket Mode - Registry Discovery', () => {
        test('connects using registry when registryId matches existing socket', async () => {
            const sessionHash = 'registry-hash';
            createSocketStub(sessionHash);
            const socketId = `planderson-${sessionHash}`;
            registerSession('tmux-pane-%1', socketId);

            const { client, factory } = makeSocketClient('# From registry');
            const { result } = renderHook(() => usePlanLoader('session', 'tmux-pane-%1', 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('# From registry');
            expect(result.current.error).toBeNull();
            expect(result.current.socketClient).not.toBeNull();
            expect(client.connect).toHaveBeenCalled();
            expect(client.getPlan).toHaveBeenCalled();
        });

        test('falls back to most-recent socket when registry entry does not exist', async () => {
            const sessionHash = 'fallback-hash';
            createSocketStub(sessionHash);

            const { client, factory } = makeSocketClient('# From fallback');
            const { result } = renderHook(() => usePlanLoader('session', 'tmux-pane-%2', 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('# From fallback');
            expect(result.current.error).toBeNull();
            expect(result.current.socketClient).not.toBeNull();
            expect(client.connect).toHaveBeenCalled();
        });

        test('falls back to most-recent socket when registry socket file is gone (stale entry)', async () => {
            const staleSocketId = 'planderson-stale-hash';
            registerSession('tmux-pane-%3', staleSocketId);
            // Don't create the stale socket file

            const activeHash = 'active-hash';
            createSocketStub(activeHash);

            const { client, factory } = makeSocketClient('# From active fallback');
            const { result } = renderHook(() => usePlanLoader('session', 'tmux-pane-%3', 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('# From active fallback');
            expect(result.current.error).toBeNull();
            expect(result.current.socketClient).not.toBeNull();
            expect(client.connect).toHaveBeenCalled();
        });

        test('falls back to most-recent socket when registry file has corrupted JSON', async () => {
            const registryFile = path.join(tempBase, 'registry', 'corrupt-registry.session');
            fs.writeFileSync(registryFile, 'not valid json {{{');

            createSocketStub('fallback-hash');

            const { client, factory } = makeSocketClient('# Fallback from corruption');
            const { result } = renderHook(() => usePlanLoader('session', 'corrupt-registry', 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('# Fallback from corruption');
            expect(result.current.error).toBeNull();
            expect(client.connect).toHaveBeenCalled();
        });
    });

    // ---------------------------------------------------------------------------
    // Socket Mode — Most-Recent Socket (no registryId)
    // ---------------------------------------------------------------------------

    describe('Socket Mode - Most-Recent Fallback', () => {
        test('connects using most-recent socket when registryId is null', async () => {
            const sessionHash = 'recent-hash';
            createSocketStub(sessionHash);

            const { client, factory } = makeSocketClient('# Most recent plan');
            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('# Most recent plan');
            expect(result.current.error).toBeNull();
            expect(result.current.socketClient).not.toBeNull();
            expect(client.connect).toHaveBeenCalled();
            expect(client.getPlan).toHaveBeenCalled();
        });

        test('sets error when no active socket found', async () => {
            const { factory } = makeSocketClient();
            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('');
            expect(result.current.error).toContain('No active session');
            expect(result.current.error).toContain('run in plan mode');
            expect(result.current.error).toContain('Error logs:');
            expect(result.current.socketClient).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // Socket Mode — Plan Content Retrieval
    // ---------------------------------------------------------------------------

    describe('Socket Mode - Plan Content', () => {
        test('retrieves plan content successfully', async () => {
            const planContent = '# Successful Plan\n\nLoaded successfully.';
            createSocketStub('test-hash');

            const { client, factory } = makeSocketClient(planContent);
            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe(planContent);
            expect(result.current.error).toBeNull();
            expect(result.current.socketClient).not.toBeNull();
            expect(client.connect).toHaveBeenCalled();
            expect(client.getPlan).toHaveBeenCalled();
        });

        test('passes discovered socket path to factory', async () => {
            const sessionHash = 'path-test-hash';
            const expectedSocketPath = createSocketStub(sessionHash);

            const capturedPaths: string[] = [];
            const { client } = makeSocketClient('# Path test plan');
            const factory = (socketPath: string) => {
                capturedPaths.push(socketPath);
                return client as unknown as PlandersonSocketClient;
            };

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(capturedPaths).toHaveLength(1);
            expect(capturedPaths[0]).toBe(expectedSocketPath);
        });

        test('sets error when plan content is empty', async () => {
            createSocketStub('test-hash');

            const { client } = makeSocketClient();
            client.getPlan.mockImplementation(async () => '   \n  \n   ');
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('');
            expect(result.current.error).toBe('Received empty plan from hook');
            expect(result.current.socketClient).not.toBeNull();
        });

        test('sets error when socket connection fails', async () => {
            createSocketStub('test-hash');
            const errorMessage = 'Connection refused';

            const { client } = makeSocketClient();
            client.connect.mockImplementation(async () => {
                throw new Error(errorMessage);
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('');
            expect(result.current.error).toContain('Failed to connect: Connection refused');
            expect(result.current.error).toContain('To establish a new connection');
            expect(result.current.socketClient).toBeNull();
            expect(client.connect).toHaveBeenCalled();
            expect(client.getPlan).not.toHaveBeenCalled();
        });

        test('sets error when getPlan fails', async () => {
            createSocketStub('test-hash');
            const errorMessage = 'Timeout waiting for plan';

            const { client } = makeSocketClient();
            client.getPlan.mockImplementation(async () => {
                throw new Error(errorMessage);
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('');
            expect(result.current.error).toContain('Failed to connect: Timeout waiting for plan');
            expect(result.current.error).toContain('To establish a new connection');
            expect(client.connect).toHaveBeenCalled();
            expect(client.getPlan).toHaveBeenCalled();
        });

        test('wraps non-Error exceptions in error message', async () => {
            createSocketStub('test-hash');

            const { client } = makeSocketClient();
            client.connect.mockImplementation(async () => {
                throw 'plain string error';
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.error).toContain('Failed to connect: plain string error');
            expect(result.current.error).toContain('To establish a new connection');
        });

        test('ENOENT connection error shows user-friendly message about missing session', async () => {
            createSocketStub('test-hash');

            const { client } = makeSocketClient();
            const enoentError = Object.assign(new Error('connect ENOENT /path/to/socket'), { code: 'ENOENT' });
            client.connect.mockImplementation(async () => {
                throw enoentError;
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.error).toContain('No active session');
            expect(result.current.error).toContain('hook process has ended');
            expect(result.current.error).toContain('To establish a new connection');
            expect(result.current.error).toContain('Error logs:');
        });

        test('ECONNREFUSED connection error shows user-friendly message about dead hook process', async () => {
            createSocketStub('test-hash');

            const { client } = makeSocketClient();
            const econnRefusedError = Object.assign(new Error('connect ECONNREFUSED /path/to/socket'), {
                code: 'ECONNREFUSED',
            });
            client.connect.mockImplementation(async () => {
                throw econnRefusedError;
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.error).toContain('No active session');
            expect(result.current.error).toContain('hook process');
            expect(result.current.error).toContain('To establish a new connection');
            expect(result.current.error).toContain('Error logs:');
        });

        test('connection timeout error shows user-friendly message', async () => {
            createSocketStub('test-hash');

            const { client } = makeSocketClient();
            client.connect.mockImplementation(async () => {
                throw new Error('Connection timed out');
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.error).toContain('Connection timed out');
            expect(result.current.error).toContain('To establish a new connection');
            expect(result.current.error).toContain('Error logs:');
        });

        test('socket disconnect after plan loads shows error and transitions to error state', async () => {
            createSocketStub('test-hash');

            let capturedDisconnectCallback: ((err?: Error) => void) | null = null;
            const { client } = makeSocketClient('# Loaded Plan');
            client.listenForDisconnect.mockImplementation((cb: (err?: Error) => void) => {
                capturedDisconnectCallback = cb;
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('# Loaded Plan');
            expect(result.current.error).toBeNull();
            expect(capturedDisconnectCallback).not.toBeNull();

            act(() => {
                capturedDisconnectCallback!();
            });

            await waitFor(() => expect(result.current.error).not.toBeNull());

            expect(result.current.error).toContain('session timed out');
            expect(result.current.error).toContain('Error logs:');
        });
    });

    // ---------------------------------------------------------------------------
    // Loading State
    // ---------------------------------------------------------------------------

    describe('Loading State', () => {
        test('sets isLoading to false even when errors occur', async () => {
            createSocketStub('test-hash');

            const { client } = makeSocketClient();
            client.connect.mockImplementation(async () => {
                throw new Error('Connection error');
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.error).not.toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // Cleanup on Unmount
    // ---------------------------------------------------------------------------

    describe('Cleanup on Unmount', () => {
        test('closes socket connection on unmount', async () => {
            createSocketStub('test-hash');

            const { client, factory } = makeSocketClient('# Plan');
            const { result, unmount } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.socketClient).not.toBeNull();
            expect(client.close).not.toHaveBeenCalled();

            unmount();

            expect(client.close).toHaveBeenCalled();
        });

        test('closes socket even if connection failed', async () => {
            createSocketStub('test-hash');

            const { client } = makeSocketClient();
            client.connect.mockImplementation(async () => {
                throw new Error('Connection failed');
            });
            const factory = () => client as unknown as PlandersonSocketClient;

            const { result, unmount } = renderHook(() => usePlanLoader('session', null, 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.socketClient).toBeNull();
            expect(result.current.error).toContain('Failed to connect: Connection failed');

            unmount();

            expect(client.close).toHaveBeenCalled();
        });

        test('does not throw on unmount in file mode', async () => {
            const planFile = path.join(tempBase, 'test.md');
            fs.writeFileSync(planFile, '# Plan');

            const { result, unmount } = renderHook(() => usePlanLoader('session', null, 'file', planFile));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.socketClient).toBeNull();
            expect(() => unmount()).not.toThrow();
        });
    });

    // ---------------------------------------------------------------------------
    // registryId Parameter Behavior
    // ---------------------------------------------------------------------------

    describe('registryId Parameter', () => {
        test('handles registry IDs with special characters (tmux format)', async () => {
            const sessionHash = 'tmux-special-hash';
            const socketId = `planderson-${sessionHash}`;
            createSocketStub(sessionHash);
            registerSession('tmux-pane-%123', socketId);

            const { client, factory } = makeSocketClient('# Tmux pane plan');
            const { result } = renderHook(() => usePlanLoader('session', 'tmux-pane-%123', 'socket', null, factory));

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('# Tmux pane plan');
            expect(result.current.error).toBeNull();
            expect(client.connect).toHaveBeenCalled();
        });

        test('two different registryIds find their respective sessions', async () => {
            const hash1 = 'session-one';
            const hash2 = 'session-two';
            createSocketStub(hash1);
            createSocketStub(hash2);
            registerSession('tmux-pane-%10', `planderson-${hash1}`);
            registerSession('tmux-pane-%20', `planderson-${hash2}`);

            const { client: client1, factory: factory1 } = makeSocketClient('# Plan 1');
            const { result: result1 } = renderHook(() =>
                usePlanLoader('session-a', 'tmux-pane-%10', 'socket', null, factory1),
            );

            const { client: client2, factory: factory2 } = makeSocketClient('# Plan 2');
            const { result: result2 } = renderHook(() =>
                usePlanLoader('session-b', 'tmux-pane-%20', 'socket', null, factory2),
            );

            await waitFor(() => expect(result1.current.isLoading).toBe(false));
            await waitFor(() => expect(result2.current.isLoading).toBe(false));

            expect(result1.current.content).toBe('# Plan 1');
            expect(result2.current.content).toBe('# Plan 2');
            expect(client1.connect).toHaveBeenCalled();
            expect(client2.connect).toHaveBeenCalled();
        });

        test('empty string registryId falls back to most-recent socket', async () => {
            createSocketStub('empty-str-hash');

            const { client, factory } = makeSocketClient('# Empty string fallback');
            const { result } = renderHook(() =>
                // empty string is falsy → treated same as null
                usePlanLoader('session', '' as string | null, 'socket', null, factory),
            );

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.content).toBe('# Empty string fallback');
            expect(result.current.error).toBeNull();
            expect(client.connect).toHaveBeenCalled();
        });
    });
});
