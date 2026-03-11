import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';

import { logRawError } from '~/utils/io/logger';

import { withTimeout, withTimeoutValue } from './timeout-utils';

/**
 * Message types for socket communication between hook and TUI
 */
export type SocketMessage =
    | { type: 'get_plan' }
    | { type: 'plan'; content: string }
    | { type: 'decision'; decision: 'accept' | 'deny'; message?: string }
    | { type: 'error'; error: string };

/**
 * Result of processing a buffer chunk
 */
export interface BufferProcessResult {
    messages: SocketMessage[];
    remainingBuffer: string;
}

/**
 * Process buffer and extract complete newline-delimited JSON messages.
 * Pure function - no side effects, fully testable.
 *
 * @param currentBuffer - Existing buffer from previous processing
 * @param newData - New data to append and process
 * @returns Parsed messages and remaining incomplete buffer
 */
export const processMessageBuffer = (currentBuffer: string, newData: string): BufferProcessResult => {
    const buffer = currentBuffer + newData;
    const lines = buffer.split('\n');
    const remainingBuffer = lines.pop() ?? '';

    const messages: SocketMessage[] = [];

    lines.forEach((line) => {
        if (line.trim() === '') return;

        try {
            const message = JSON.parse(line) as SocketMessage;
            messages.push(message);
        } catch (err) {
            // Invalid JSON - push error message
            messages.push({
                type: 'error',
                error: `Failed to parse message: ${String(err)}`,
            });
        }
    });

    return { messages, remainingBuffer };
};

/**
 * Serialize a message for sending over socket.
 * Pure function - no side effects, fully testable.
 *
 * @param message - Message to serialize
 * @returns Newline-delimited JSON string
 */
export const serializeMessage = (message: SocketMessage): string => {
    return `${JSON.stringify(message)}\n`;
};

/**
 * Unix socket server for the Claude Code hook.
 * Manages plan distribution and waits for TUI decisions.
 */
export class PlandersonSocketServer {
    private server: net.Server | null = null;
    private socketPath: string;
    private planContent: string = '';
    private decisionPromise: Promise<SocketMessage> | null = null;
    private decisionResolve: ((value: SocketMessage) => void) | null = null;
    private activeSocket: net.Socket | null = null;
    private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    private sessionEngaged: boolean = false; // true once get_plan received
    private readonly CONNECTION_TIMEOUT_MS = 30000; // 30 seconds

    constructor(socketPath: string) {
        this.socketPath = socketPath;
    }

    /**
     * Start the socket server and prepare to receive connections
     */
    async start(planContent: string): Promise<void> {
        this.planContent = planContent;

        // Remove existing socket file if present
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }

        // Ensure directory exists
        const dir = path.dirname(this.socketPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Create decision promise that will be resolved when TUI responds
        this.decisionPromise = new Promise((resolve) => {
            this.decisionResolve = resolve;
        });

        // Start server
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this.handleConnection(socket);
            });

            this.server.on('error', (err) => {
                reject(err);
            });

            this.server.listen(this.socketPath, () => {
                resolve();
            });
        });
    }

    /**
     * Handle incoming connection from TUI
     */
    private handleConnection(socket: net.Socket): void {
        // Check for existing active connection
        if (this.activeSocket !== null) {
            // Detect stale connections and replace them
            if (this.activeSocket.destroyed || !this.activeSocket.writable) {
                logRawError('Replacing stale socket connection with new client');
                this.activeSocket.destroy();
                this.activeSocket = null;
            } else {
                // Active connection exists - reject new one
                const errorMsg = serializeMessage({
                    type: 'error',
                    error: 'Another client is already connected',
                });
                socket.write(errorMsg);
                socket.end();
                return;
            }
        }

        this.activeSocket = socket;
        let buffer = '';

        // Set connection keepalive timeout - disconnect if no messages within 30 seconds
        this.connectionTimeout = setTimeout(() => {
            logRawError('Socket connection timeout - no messages received');
            socket.destroy();
            this.activeSocket = null;
        }, this.CONNECTION_TIMEOUT_MS);

        socket.on('data', (data) => {
            const result = processMessageBuffer(buffer, data.toString());
            buffer = result.remainingBuffer;

            result.messages.forEach((message) => {
                if (message.type === 'get_plan') {
                    // Clear timeout on first message - client is active
                    if (this.connectionTimeout !== null) {
                        clearTimeout(this.connectionTimeout);
                        this.connectionTimeout = null;
                    }

                    // Mark session as engaged so disconnect handler knows this was a real TUI
                    this.sessionEngaged = true;

                    // TUI requesting plan content
                    const response: SocketMessage = {
                        type: 'plan',
                        content: this.planContent,
                    };
                    socket.write(serializeMessage(response));
                } else if (message.type === 'decision') {
                    // TUI sending decision
                    if (this.decisionResolve !== null) {
                        this.decisionResolve(message);
                        this.decisionResolve = null;
                    }
                    socket.end();
                } else if (message.type === 'error') {
                    // Forward parsing errors to client (keep connection open for retry)
                    socket.write(serializeMessage(message));
                }
            });
        });

        socket.on('error', (err) => {
            logRawError('Socket error', err);

            if (this.activeSocket !== socket) {
                socket.destroy();
                return;
            }

            // Clear connection timeout on error
            if (this.connectionTimeout !== null) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }

            if (this.decisionResolve !== null) {
                this.decisionResolve({
                    type: 'error',
                    error: err.message,
                });
                this.decisionResolve = null;
            }
            // Force close socket on error to prevent leak
            socket.destroy();
        });

        socket.on('close', () => {
            // Only run cleanup for the currently active socket.
            // Probe connections (e.g. waitForSocket polling) may have been replaced by the
            // time their async close event fires — their events must not affect the active session.
            if (this.activeSocket !== socket) {
                return;
            }

            // Clear connection timeout on close
            if (this.connectionTimeout !== null) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }

            // Clear active socket when connection closes
            this.activeSocket = null;

            // Resolve with error only if the TUI had engaged (sent get_plan)
            // Probe connections that disconnect immediately have sessionEngaged=false
            if (this.sessionEngaged && this.decisionResolve !== null) {
                this.decisionResolve({
                    type: 'error',
                    error: 'TUI disconnected without sending a decision',
                });
                this.decisionResolve = null;
            }
            this.sessionEngaged = false;
        });
    }

    /**
     * Wait for TUI to send a decision. Blocks until decision received or timeout.
     */
    async waitForDecision(timeoutSeconds: number = 900): Promise<SocketMessage> {
        if (this.decisionPromise === null) {
            throw new Error('Server not started');
        }

        // Use withTimeoutValue utility for automatic timeout cleanup
        return withTimeoutValue(this.decisionPromise, timeoutSeconds * 1000, () => ({
            type: 'error' as const,
            error: `Timeout waiting for plan approval (${timeoutSeconds} seconds)`,
        }));
    }

    /**
     * Clean up server and socket file
     */
    async close(): Promise<void> {
        if (this.server !== null) {
            await new Promise<void>((resolve) => {
                this.server?.close(() => {
                    resolve();
                });
            });
            this.server = null;
        }

        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }
    }
}

/**
 * Unix socket client for the Planderson TUI.
 * Connects to hook's socket server to get plan and send decision.
 */
export class PlandersonSocketClient {
    private socket: net.Socket | null = null;
    private socketPath: string;
    private _createSocket: () => net.Socket;

    constructor(socketPath: string, createSocket: () => net.Socket = () => new net.Socket()) {
        this.socketPath = socketPath;
        this._createSocket = createSocket;
    }

    /**
     * Connect to the hook's socket server.
     * Rejects with a timeout error if connection is not established within timeoutMs.
     */
    async connect(timeoutMs = 5000): Promise<void> {
        const connectPromise = new Promise<void>((resolve, reject) => {
            // Attach handlers BEFORE calling connect() to avoid Bun's synchronous error emission
            const socket = this._createSocket();
            this.socket = socket;
            socket.once('error', reject);
            socket.once('connect', resolve);
            socket.connect(this.socketPath);
        });
        return withTimeout(connectPromise, timeoutMs, () => {
            this.close();
            return new Error('Connection timed out');
        });
    }

    /**
     * Register a callback to be notified when the socket closes unexpectedly.
     * Should be called after the plan is loaded to detect mid-session disconnects.
     */
    listenForDisconnect(callback: (err?: Error) => void): void {
        if (!this.socket) return;
        let lastError: Error | undefined;
        this.socket.on('error', (err) => {
            lastError = err;
        });
        this.socket.once('close', () => callback(lastError));
    }

    /**
     * Request plan content from hook
     */
    async getPlan(): Promise<string> {
        if (this.socket === null) {
            throw new Error('Not connected');
        }

        let buffer = '';
        let isResolved = false;
        let dataHandler: ((data: Buffer) => void) | null = null;

        const planPromise = new Promise<string>((resolve, reject) => {
            dataHandler = (data: Buffer): void => {
                if (isResolved) return;

                const result = processMessageBuffer(buffer, data.toString());
                buffer = result.remainingBuffer;

                result.messages.forEach((message) => {
                    if (message.type === 'plan') {
                        isResolved = true;
                        if (dataHandler !== null) {
                            this.socket?.off('data', dataHandler);
                        }
                        resolve(message.content);
                    } else if (message.type === 'error') {
                        isResolved = true;
                        if (dataHandler !== null) {
                            this.socket?.off('data', dataHandler);
                        }
                        reject(new Error(message.error));
                    }
                });
            };

            if (this.socket === null) {
                reject(new Error('Socket disconnected'));
                return;
            }

            this.socket.on('data', dataHandler);

            // Send request
            const request: SocketMessage = { type: 'get_plan' };
            this.socket.write(serializeMessage(request));
        });

        // Use withTimeout utility for automatic timeout cleanup
        return withTimeout(planPromise, 10000, () => {
            if (!isResolved) {
                isResolved = true;
                if (dataHandler !== null) {
                    this.socket?.off('data', dataHandler);
                }
                this.close(); // Close socket on timeout to prevent leak
            }
            return new Error('Timeout waiting for plan');
        });
    }

    /**
     * Send decision to hook
     */
    sendDecision(decision: 'accept' | 'deny', message?: string): void {
        if (this.socket === null) {
            throw new Error('Not connected');
        }

        const response: SocketMessage = {
            type: 'decision',
            decision,
            ...(message !== undefined && message !== '' ? { message } : {}),
        };

        this.socket.write(serializeMessage(response));
    }

    /**
     * Close connection
     */
    close(): void {
        if (this.socket !== null) {
            this.socket.end();
            this.socket = null;
        }
    }
}
