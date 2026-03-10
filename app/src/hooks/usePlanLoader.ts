import fs from 'fs';
import path from 'path';
import { useEffect, useRef, useState } from 'react';

import { PlandersonSocketClient } from '~/lib/socket-ipc';
import { PlandersonMode } from '~/utils/config/constants';
import { logError, logEvent } from '~/utils/io/logger';
import { getPlandersonBaseDir } from '~/utils/io/paths';
import { findActiveSocket, getSession, getSocketDir, getSocketPath } from '~/utils/io/sockets';

const RECONNECT_HINT = 'To establish a new connection, ask Claude Code to show plan in plan mode again.';

const getErrorLogPath = (): string => path.join(getPlandersonBaseDir(), 'logs', 'error.log');

/**
 * Classifies a connection error into a plain-English user-facing message.
 */
const classifyConnectionError = (err: unknown): string => {
    const code = (err as { code?: string }).code;
    const message = err instanceof Error ? err.message : String(err);
    const logHint = `Error logs: ${getErrorLogPath()}`;

    if (code === 'ENOENT') {
        return `No active session — the hook process has ended.\n\n${RECONNECT_HINT}\n\n${logHint}`;
    }
    if (code === 'ECONNREFUSED') {
        return `No active session — the hook process has ended.\n\n${RECONNECT_HINT}\n\n${logHint}`;
    }
    if (message.toLowerCase().includes('timed out')) {
        return `Connection timed out.\n\n${RECONNECT_HINT}\n\n${logHint}`;
    }
    return `Failed to connect: ${message}.\n\n${RECONNECT_HINT}\n\n${logHint}`;
};

interface UsePlanLoaderResult {
    content: string;
    error: string | null;
    isLoading: boolean;
    socketClient: PlandersonSocketClient | null;
}

export const usePlanLoader = (
    sessionId: string,
    registryId: string | null,
    mode: PlandersonMode,
    filepath: string | null,
    createSocketClient: (path: string) => PlandersonSocketClient = (p) => new PlandersonSocketClient(p),
): UsePlanLoaderResult => {
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [socketClient, setSocketClient] = useState<PlandersonSocketClient | null>(null);

    // Track socket in ref for reliable cleanup even if errors occur before setState
    const socketRef = useRef<PlandersonSocketClient | null>(null);
    // Set to true before intentional close so the disconnect callback is a no-op
    const isIntentionalCloseRef = useRef(false);

    useEffect(() => {
        const connectAndLoadPlan = async (): Promise<void> => {
            // Declare at function scope for error handling
            let socketPath: string | null = null;

            try {
                if (mode === 'file') {
                    // File mode: read directly from file
                    const planPath = path.resolve(getPlandersonBaseDir(), filepath!);
                    if (!fs.existsSync(planPath)) {
                        logError(__filename, sessionId, 'plan.errored', new Error(`Plan file not found: ${planPath}`));
                        setError(`Plan file not found: ${planPath}`);
                        return;
                    }
                    const planContent = fs.readFileSync(planPath, 'utf-8');
                    if (!planContent.trim()) {
                        setError('Plan file is empty');
                        return;
                    }
                    setContent(planContent);
                } else {
                    // Socket mode: discover active socket
                    const socketDir = getSocketDir();
                    const baseDir = getPlandersonBaseDir();

                    logEvent(
                        __filename,
                        sessionId,
                        'socket.discovery.started',
                        `base=${baseDir} registry=${registryId ?? ''}`,
                    );

                    // Strategy 1: Registry lookup (if registryId provided)
                    if (registryId) {
                        const registeredSocketId = getSession(registryId);
                        if (registeredSocketId) {
                            const registeredSocketPath = getSocketPath(registeredSocketId);
                            if (fs.existsSync(registeredSocketPath)) {
                                socketPath = registeredSocketPath;
                                logEvent(
                                    __filename,
                                    sessionId,
                                    'socket.discovery.found',
                                    `via:registry id=${registryId}`,
                                );
                            } else {
                                logEvent(
                                    __filename,
                                    sessionId,
                                    'socket.discovery.registry_stale',
                                    `registry=${registryId}`,
                                );
                            }
                        } else {
                            logEvent(
                                __filename,
                                sessionId,
                                'socket.discovery.registry_miss',
                                `via:registry registry=${registryId}`,
                            );
                        }
                    }

                    // Strategy 2: Fallback to most recent socket (when registry didn't find one)
                    if (!socketPath) {
                        const socketInfo = findActiveSocket();
                        if (socketInfo) {
                            socketPath = socketInfo.path;
                            logEvent(
                                __filename,
                                sessionId,
                                'socket.discovery.found',
                                `via:most-recent socketPath=${socketPath}`,
                            );
                        }
                    }

                    // No socket found
                    if (!socketPath) {
                        const errorMsg =
                            'No active session — no socket file found.\n\n' +
                            'Ask Claude Code to run in plan mode to start a session.\n\n' +
                            `Error logs: ${getErrorLogPath()}`;
                        logError(
                            __filename,
                            sessionId,
                            'socket.discovery.notfound',
                            new Error(`No socket discovered: ${socketDir}`),
                        );
                        setError(errorMsg);
                        return;
                    }

                    // Connect to discovered socket
                    logEvent(__filename, sessionId, 'socket.client.started', `socketPath=${socketPath}`);
                    const client = createSocketClient(socketPath);
                    socketRef.current = client; // Store immediately for cleanup

                    await client.connect();

                    logEvent(__filename, sessionId, 'socket.client.connected', `socketPath=${socketPath}`);
                    setSocketClient(client);

                    // Request plan content
                    logEvent(__filename, sessionId, 'socket.client.planrequested', `socketPath=${socketPath}`);

                    const planContent = await client.getPlan();

                    if (!planContent.trim()) {
                        setError('Received empty plan from hook');
                        return;
                    }

                    logEvent(
                        __filename,
                        sessionId,
                        'socket.client.planreceived',
                        `socketPath=${socketPath} bytes=${planContent.length}`,
                    );
                    setContent(planContent);

                    // Listen for mid-session disconnects (socket dies while user reviews plan)
                    client.listenForDisconnect((disconnectErr) => {
                        if (!isIntentionalCloseRef.current) {
                            const logHint = `Error logs: ${getErrorLogPath()}`;
                            const msg = disconnectErr
                                ? `Connection lost — the hook process likely crashed.\n\nRun Claude Code in plan mode again.\n\n${logHint}`
                                : `The session timed out.\n\nRun Claude Code in plan mode again.\n\n${logHint}`;
                            setError(msg);
                            logError(
                                __filename,
                                sessionId,
                                'socket.client.disconnected',
                                disconnectErr ?? new Error('socket closed'),
                                `socketPath=${socketPath}`,
                            );
                        }
                    });
                }
            } catch (err) {
                const errorMsg = classifyConnectionError(err);
                setError(errorMsg);

                // Log actual errors to both activity.log and error.log with stack trace
                // Use discoveredprocessId if available (the socket we tried to connect to),
                // otherwise fall back to sessionId from App state
                const error = err instanceof Error ? err : new Error(String(err));
                logError(__filename, sessionId, 'socket.client.errored', error, `socketPath=${socketPath}`);
            } finally {
                setIsLoading(false);
            }
        };

        void connectAndLoadPlan();

        // Cleanup: close socket on unmount using ref for reliable cleanup
        // Set isIntentionalCloseRef first so the disconnect callback is a no-op
        return () => {
            isIntentionalCloseRef.current = true;
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
        // This is a mount-only effect - run once on mount, don't re-run
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { content, error, isLoading, socketClient };
};
