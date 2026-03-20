#!/usr/bin/env bun
// Permission hook: intercepts ExitPlanMode, starts socket server, blocks until Planderson responds

import { z } from 'zod';

import { PlandersonSocketServer } from '~/lib/socket-ipc';
import { loadSettings } from '~/utils/config/settings';
import { generateId } from '~/utils/id';
import { isAutoLaunchAvailable, tryAutoLaunch } from '~/utils/io/auto-launcher';
import { logError, logEvent } from '~/utils/io/logger';
import {
    cleanupOldRegistry,
    cleanupOldSockets,
    ensureSocketDir,
    getSocketId,
    getSocketPath,
    registerSession,
} from '~/utils/io/sockets';

// Constants with environment variable overrides for testing
const DEFAULT_TIMEOUT_SECONDS =
    process.env.PLANDERSON_TIMEOUT_SECONDS !== undefined && process.env.PLANDERSON_TIMEOUT_SECONDS !== ''
        ? Number.parseInt(process.env.PLANDERSON_TIMEOUT_SECONDS, 10)
        : 900;
const MAX_STDIN_BYTES = 10 * 1024 * 1024; // 10MB limit
const STDIN_TIMEOUT_MS = 5000; // 5 second timeout for reading stdin
const MAX_SOCKET_PATH_LENGTH = 104; // macOS/BSD limit for Unix domain sockets

// Zod schemas for runtime validation
const PermissionRequestInputSchema = z.object({
    tool_name: z.string(),
    tool_input: z
        .object({
            plan: z.string().optional(),
        })
        .passthrough(),
    hook_event_name: z.string(),
    permission_mode: z.string().optional(),
});

const HookResponseSchema = z.object({
    hookSpecificOutput: z.object({
        hookEventName: z.literal('PermissionRequest'),
        decision: z.object({
            behavior: z.enum(['allow', 'deny']),
            message: z.string().optional(),
        }),
    }),
});

type PermissionRequestInput = z.infer<typeof PermissionRequestInputSchema>;
type HookResponse = z.infer<typeof HookResponseSchema>;

interface PlandersonResponse {
    decision: 'accept' | 'deny';
    message?: string;
}

/**
 * Builds a properly formatted hook response for Claude Code.
 *
 * @param behavior - Whether to allow or deny the action
 * @param message - Optional message to include (typically for denials)
 * @returns Validated hook response object
 */
export const buildHookResponse = (behavior: 'allow' | 'deny', message?: string): HookResponse => {
    const response: HookResponse = {
        hookSpecificOutput: {
            hookEventName: 'PermissionRequest',
            decision: {
                behavior,
                ...(message !== undefined && message !== '' ? { message } : {}),
            },
        },
    };

    // Validate response before returning
    return HookResponseSchema.parse(response);
};

/**
 * Reads stdin safely with timeout and size limits.
 * Prevents hanging indefinitely and memory exhaustion from oversized input.
 *
 * @param maxBytes - Maximum bytes to read (default: 10MB)
 * @param timeoutMs - Timeout in milliseconds (default: 5 seconds)
 * @returns Promise resolving to stdin content as UTF-8 string
 * @throws Error if timeout exceeded or size limit reached
 */
export const readStdinSafely = async function (
    maxBytes: number = MAX_STDIN_BYTES,
    timeoutMs: number = STDIN_TIMEOUT_MS,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let totalSize = 0;

        const timeout = setTimeout(() => {
            process.stdin.destroy();
            reject(new Error('Timeout reading stdin'));
        }, timeoutMs);

        process.stdin.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;
            if (totalSize > maxBytes) {
                clearTimeout(timeout);
                process.stdin.destroy();
                reject(new Error(`Input exceeds maximum size of ${maxBytes} bytes`));
                return;
            }
            chunks.push(chunk);
        });

        process.stdin.on('end', () => {
            clearTimeout(timeout);
            try {
                const content = Buffer.concat(chunks).toString('utf-8');
                resolve(content);
            } catch (err) {
                reject(new Error(`Failed to decode stdin as UTF-8: ${String(err)}`));
            }
        });

        process.stdin.on('error', (err) => {
            clearTimeout(timeout);
            reject(new Error(`Error reading stdin: ${err.message}`));
        });
    });
};

/**
 * Validates and parses hook input from Claude Code.
 *
 * @param input - Raw input string (JSON)
 * @returns Validated PermissionRequestInput object
 * @throws ZodError if validation fails
 */
export const validateHookInput = (input: string): PermissionRequestInput => {
    try {
        const parsed: unknown = JSON.parse(input);
        return PermissionRequestInputSchema.parse(parsed);
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'issues' in err) {
            // Zod error
            const zodError = err as { issues: Array<{ path: Array<string | number>; message: string }> };
            const details = zodError.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Invalid hook input: ${details}`);
        }
        throw new Error(`Failed to parse hook input: ${String(err)}`);
    }
};

/**
 * Maps socket result to hook decision response.
 * Pure function - no side effects, easily testable.
 *
 * @param result - Result from socket communication ('timeout' or PlandersonResponse)
 * @param timeoutSeconds - Timeout duration to include in message
 * @returns Object with behavior and optional message for hook response
 */
export const mapSocketResultToHookResponse = (
    result: PlandersonResponse | 'timeout',
    timeoutSeconds: number,
): { behavior: 'allow' | 'deny'; message?: string } => {
    if (result === 'timeout') {
        const minutes = Math.round(timeoutSeconds / 60);
        return {
            behavior: 'deny',
            message: `Timeout waiting for plan approval (${minutes} ${minutes === 1 ? 'minute' : 'minutes'})`,
        };
    }

    if (result.decision === 'accept') {
        return { behavior: 'allow' };
    }

    // Denied by user
    return {
        behavior: 'deny',
        message: result.message ? `Plan denied: ${result.message}` : 'Plan denied via Planderson',
    };
};

/**
 * Waits for decision from Planderson TUI via Unix socket.
 * Blocks until TUI connects, sends decision, or timeout occurs.
 *
 * @param planContent - Full plan text to share with TUI
 * @param timeoutSeconds - How long to wait before timing out
 * @returns Promise resolving to PlandersonResponse or 'timeout'
 *
 * @remarks
 * - Timeout is handled specially to provide user-friendly message
 * - Socket errors include specific error details in response
 * - Socket is cleaned up even if errors occur (via try/finally)
 * - Logs user instructions to stderr for visibility
 */
const waitForDecisionViaSocket = async function (
    sessionId: string,
    planContent: string,
    timeoutSeconds: number = DEFAULT_TIMEOUT_SECONDS,
): Promise<PlandersonResponse | 'timeout' | 'no-op'> {
    // Create socket path unique to this run (with env var override for testing)
    const socketId = getSocketId(sessionId);
    const socketPath =
        process.env.PLANDERSON_SOCKET_PATH ??
        (() => {
            ensureSocketDir();
            cleanupOldSockets(); // Remove old sockets on startup
            cleanupOldRegistry(); // Remove old registry files on startup
            return getSocketPath(socketId);
        })();

    // Check socket path length (Unix domain socket limit on macOS is 104 chars)
    if (socketPath.length > MAX_SOCKET_PATH_LENGTH) {
        const errorMsg = `Socket path too long (${socketPath.length} > ${MAX_SOCKET_PATH_LENGTH} chars)`;
        logError(__filename, sessionId, 'socket.server.pathtoolong.errored', new Error(`${errorMsg}: ${socketPath}`));

        // Deny with helpful message that ideally will get relayed to the user
        const denyMessage = `Cannot use Planderson TUI: ${errorMsg}).\n\nSolutions:\n  • Use shorter worktree names\n  • Work from a shallower directory\n  • Disable Planderson hook\n  • Set PLANDERSON_SOCKET_PATH to /tmp`;
        // At this point can only allow or deny, so we deny and defer to user to handle
        const response = buildHookResponse('deny', denyMessage);
        return outputResponseAndExit(response, 0);
    }

    // Create socket server
    const server = new PlandersonSocketServer(socketPath);
    logEvent(__filename, sessionId, 'socket.server.created', `socketPath=${socketPath}`);

    // Register socket with registry ID (if running in tmux)
    // In the future, can register with other integrations
    // Only register if not using test override
    const tmuxPaneRaw = process.env.TMUX_PANE;
    if (tmuxPaneRaw && !process.env.PLANDERSON_SOCKET_PATH) {
        // Prefix tmux pane ID to make registry files self-documenting
        const registryId = `tmux-pane-${tmuxPaneRaw}`;
        registerSession(registryId, socketId);
        logEvent(
            __filename,
            sessionId,
            'socket.server.registered',
            `registered registry ${registryId} with socket ${socketId}`,
        );
    }

    try {
        // Start server with plan content
        await server.start(planContent);
        logEvent(__filename, sessionId, 'socket.server.started', `waiting for TUI (${timeoutSeconds}s timeout)`);

        // Load settings — path driven by getPlandersonBaseDir() (dev.json override or ~/.planderson)
        const settings = loadSettings(sessionId);

        // Log waiting message to stderr (stdout is for JSON response only)
        console.error(`\n[Planderson Hook] Session: ${sessionId}`);
        console.error('Claude is waiting for plan approval...');

        // Attempt auto-launch if enabled and available
        if (settings.launchMode === 'auto-tmux' && isAutoLaunchAvailable()) {
            logEvent(__filename, sessionId, 'autolaunch.started', 'launch mode: auto-tmux, tmux detected');
            const launched = tryAutoLaunch(sessionId);

            if (!launched) {
                // Fall back to manual instruction
                logError(
                    __filename,
                    sessionId,
                    'autolaunch.failed',
                    new Error('Auto-launch spawn failed, falling back to manual mode'),
                );
            }
            // Success: spawned fire-and-forget, no stderr output needed
        } else {
            // Manual mode or not in tmux
            const reason = settings.launchMode === 'manual' ? 'launch mode: manual' : 'not in tmux';
            logEvent(__filename, sessionId, 'autolaunch.skipped', reason);
        }

        console.error(`Socket: ${socketPath}\n`);

        // Wait for decision from TUI (blocks until TUI connects and responds)
        const result = await server.waitForDecision(timeoutSeconds);

        if (result.type === 'decision') {
            const message = result.message ? `message="${result.message}"` : 'no message';
            logEvent(
                __filename,
                sessionId,
                'socket.server.decisionreceived',
                `decision="${result.decision}", ${message}`,
            );
            return {
                decision: result.decision,
                message: result.message,
            };
        } else if (result.type === 'no-op') {
            logEvent(__filename, sessionId, 'socket.server.noop', 'TUI exited without decision');
            return 'no-op';
        } else if (result.type === 'error') {
            logError(__filename, sessionId, 'socket.server.errored', new Error(result.error));

            if (result.error.includes('Timeout')) {
                return 'timeout';
            }

            return {
                decision: 'deny',
                message: `Socket communication error: ${result.error}`,
            };
        }

        console.error('Unexpected result type from socket');
        logError(__filename, sessionId, 'socket.server.errored', new Error('Unexpected result type'));
        return {
            decision: 'deny',
            message: 'Internal hook error: unexpected result type',
        };
    } catch (err) {
        // Handle socket creation/startup errors
        const errorMsg = err instanceof Error ? err.message : String(err);
        const error = err instanceof Error ? err : new Error(errorMsg);
        logError(__filename, sessionId, 'socket.server.errored', error);

        const denyMessage = `Cannot use Planderson TUI: Socket server failed to start.\n\nError: ${errorMsg}\n\nTry:\n  • Check directory permissions\n  • Run: bun run clean:sockets\n  • Disable Planderson hook if issue persists`;
        const response = buildHookResponse('deny', denyMessage);
        return outputResponseAndExit(response, 0);
    } finally {
        // Always clean up socket, even on error
        await server.close();
        logEvent(__filename, sessionId, 'socket.server.ended');
    }
};

/**
 * Writes hook response to stdout and exits.
 * Validates response structure before output.
 *
 * @param response - Hook response to output
 * @param exitCode - Process exit code (0 for success, 1 for error)
 */
const outputResponseAndExit = (response: HookResponse, exitCode: number = 0): never => {
    try {
        // Validate response structure matches schema
        HookResponseSchema.parse(response);

        // Output JSON with newline for cleaner output
        const jsonOutput = `${JSON.stringify(response)}\n`;
        process.stdout.write(jsonOutput);

        process.exit(exitCode);
    } catch (err) {
        console.error(`Failed to output hook response: ${String(err)}`);
        process.exit(1);
    }
};

/**
 * Main hook logic.
 * Reads stdin, validates input, handles ExitPlanMode interception,
 * communicates with Planderson TUI, and returns decision to Claude Code.
 */
const main = async function (): Promise<void> {
    // Generate unique id for this process run
    const sessionId = generateId();

    try {
        logEvent(__filename, sessionId, 'hook.started', `timeout=${DEFAULT_TIMEOUT_SECONDS}s`);
        // Read hook input from stdin safely (with timeout and size limits)
        const input = await readStdinSafely();

        // Validate and parse hook input
        const hookInput = validateHookInput(input);

        // Only intercept ExitPlanMode tool - allow all others
        if (hookInput.tool_name !== 'ExitPlanMode') {
            const response = buildHookResponse('allow');
            return outputResponseAndExit(response, 0);
        }

        // Extract plan content from hook input
        const planContent = hookInput.tool_input?.plan ?? '';

        if (planContent === '') {
            logError(__filename, sessionId, 'hook.plan.errored', new Error('No plan content in hook input'));
            const response = buildHookResponse('deny', 'No plan content provided - cannot proceed with approval');
            return outputResponseAndExit(response, 1);
        }

        // Wait for Planderson decision via Unix socket (blocks until TUI responds)
        const result = await waitForDecisionViaSocket(sessionId, planContent);

        if (result === 'no-op') {
            logEvent(__filename, sessionId, 'hook.ended', 'behavior=no-op');
            process.exit(0); // No JSON output = allow in Claude Code
        }

        // Map socket result to hook response
        const { behavior, message } = mapSocketResultToHookResponse(result, DEFAULT_TIMEOUT_SECONDS);

        // Log completion before exit
        logEvent(__filename, sessionId, 'hook.ended', `behavior=${behavior}`);

        // Build and output response
        const response = buildHookResponse(behavior, message);
        return outputResponseAndExit(response, 0);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logError(__filename, sessionId, 'hook.errored', error);

        // Try to send deny response even on error
        try {
            const response = buildHookResponse('deny', `Hook error: ${String(err)}`);
            return outputResponseAndExit(response, 1);
        } catch (outputErr) {
            // If we can't even output a response, just exit
            console.error(`Failed to output error response: ${String(outputErr)}`);
            process.exit(1);
        }
    }
};

export const runHook = async (): Promise<void> => {
    await main();
};

// Only run main if this is the main module (not being imported for testing)
if (import.meta.main) {
    void main();
}
