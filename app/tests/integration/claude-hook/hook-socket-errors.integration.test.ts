import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as net from 'net';

import { useTestSocket, waitForSocket } from '~/test-utils/fixtures';

import { readStream, spawnHook } from './helpers';

/**
 * Socket communication error tests for the Claude Code hook.
 * Tests edge cases in socket communication: disconnections, invalid messages,
 * concurrent connections, and race conditions.
 *
 * Focus: Does the hook handle communication problems gracefully?
 */

describe('claude-hook hook-socket-errors integration', () => {
    describe('Timeout Scenarios', () => {
        test('times out when no TUI connects', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '2',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Timeout');
        }, 15000);

        test('includes timeout duration in timeout message', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '2',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Timeout');
            expect(response.hookSpecificOutput.decision.message).toMatch(/\d+\s+minute/);
        }, 10000);
    });

    describe('Connection Errors', () => {
        test('handles TUI disconnecting immediately', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '3',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Connect and immediately disconnect
            setTimeout(() => {
                const client = net.connect(TEST_SOCKET_PATH);
                client.on('connect', () => {
                    client.destroy();
                });
                client.on('error', () => {
                    // Suppress error
                });
            }, 200);

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            // Should timeout or return error
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 10000);

        test('handles TUI disconnecting during plan transmission', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const largePlan = 'x'.repeat(100000);
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: largePlan },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '3',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Connect, start reading, then disconnect
            await waitForSocket(TEST_SOCKET_PATH);
            const client = net.connect(TEST_SOCKET_PATH);
            client.on('connect', () => {
                client.write(`${JSON.stringify({ type: 'get_plan' })}\n`);
                // Disconnect after brief delay
                setTimeout(() => client.destroy(), 50);
            });
            client.on('error', () => {
                // Suppress error
            });

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            // Should handle gracefully
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 10000);
    });

    describe('Invalid Messages', () => {
        test('ignores invalid JSON from TUI', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '3',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Send invalid JSON
            await waitForSocket(TEST_SOCKET_PATH);
            const client = net.connect(TEST_SOCKET_PATH);
            client.on('connect', () => {
                client.write('{ invalid json }\n');
                // Wait a bit then send valid response
                setTimeout(() => {
                    client.write(`${JSON.stringify({ type: 'get_plan' })}\n`);
                    client.on('data', () => {
                        client.write(`${JSON.stringify({ type: 'decision', decision: 'accept' })}\n`);
                        client.end();
                    });
                }, 100);
            });
            client.on('error', () => {
                // Suppress error
            });

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            // Should still work (invalid message is ignored, valid one accepted)
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
        }, 10000);

        test('ignores messages with wrong type', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '3',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Send wrong message type
            await waitForSocket(TEST_SOCKET_PATH);
            const client = net.connect(TEST_SOCKET_PATH);
            client.on('connect', () => {
                client.write(`${JSON.stringify({ type: 'unknown_type' })}\n`);
                // Wait then send proper request
                setTimeout(() => {
                    client.write(`${JSON.stringify({ type: 'get_plan' })}\n`);
                    client.on('data', () => {
                        client.write(`${JSON.stringify({ type: 'decision', decision: 'accept' })}\n`);
                        client.end();
                    });
                }, 100);
            });
            client.on('error', () => {
                // Suppress error
            });

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            // Should ignore wrong type and process valid one
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
        }, 10000);

        test('rejects decision with missing required fields', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '3',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Send decision without required decision field
            setTimeout(() => {
                const client = net.connect(TEST_SOCKET_PATH);
                client.on('connect', () => {
                    client.write(`${JSON.stringify({ type: 'get_plan' })}\n`);
                    client.on('data', () => {
                        // Missing 'decision' field
                        client.write(`${JSON.stringify({ type: 'decision' })}\n`);
                        client.end();
                    });
                });
                client.on('error', () => {
                    // Suppress error
                });
            }, 200);

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            // Should timeout or return error due to invalid decision
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 10000);
    });

    describe('Concurrent Connections', () => {
        test('handles multiple simultaneous connections', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '3',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Track second client rejection in a promise
            const secondClientPromise = new Promise<boolean>((resolve) => {
                setTimeout(() => {
                    const firstClient = net.connect(TEST_SOCKET_PATH);
                    firstClient.on('connect', () => {
                        firstClient.write(`${JSON.stringify({ type: 'get_plan' })}\n`);
                        firstClient.on('data', (data) => {
                            const message = JSON.parse(data.toString().trim());
                            if (message.type === 'plan') {
                                // Try to connect a second client while first is active
                                const secondClient = net.connect(TEST_SOCKET_PATH);
                                let secondClientGotError = false;
                                secondClient.on('data', (errorData) => {
                                    const errorMsg = JSON.parse(errorData.toString().trim());
                                    if (errorMsg.type === 'error' && errorMsg.error.includes('already connected')) {
                                        secondClientGotError = true;
                                    }
                                });
                                secondClient.on('close', () => {
                                    // Send decision only after second client is done to avoid race:
                                    // if decision arrives before second client connects, activeSocket
                                    // is cleared and the second client is accepted instead of rejected.
                                    firstClient.write(`${JSON.stringify({ type: 'decision', decision: 'accept' })}\n`);
                                    firstClient.end();
                                    resolve(secondClientGotError);
                                });
                            }
                        });
                    });
                }, 200);
            });

            const [stdout, secondClientGotError] = await Promise.all([
                readStream(hookProcess.stdout),
                secondClientPromise,
            ]);

            const response = JSON.parse(stdout);

            // First client's decision should succeed
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
            // Second client should have been rejected
            expect(secondClientGotError).toBe(true);
        }, 10000);
    });

    describe('Race Conditions', () => {
        test('handles TUI connecting before server fully starts', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Try to connect very quickly (may fail initially, should retry)
            setTimeout(() => {
                let attempt = 0;
                const tryConnect = () => {
                    attempt++;
                    const client = net.connect(TEST_SOCKET_PATH);

                    client.on('connect', () => {
                        client.write(`${JSON.stringify({ type: 'get_plan' })}\n`);
                        client.on('data', () => {
                            client.write(`${JSON.stringify({ type: 'decision', decision: 'accept' })}\n`);
                            client.end();
                        });
                    });

                    client.on('error', () => {
                        // Retry if socket not ready yet
                        if (attempt < 10) {
                            setTimeout(tryConnect, 50);
                        }
                    });
                };

                tryConnect();
            }, 10); // Very short delay

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
        }, 10000);

        test('handles socket file already existing', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            // Create dummy socket file
            fs.writeFileSync(TEST_SOCKET_PATH, 'dummy content');

            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '2',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Should clean up old file and create new socket
            await waitForSocket(TEST_SOCKET_PATH);
            const client = net.connect(TEST_SOCKET_PATH);
            client.on('connect', () => {
                client.write(`${JSON.stringify({ type: 'get_plan' })}\n`);
                client.on('data', () => {
                    client.write(`${JSON.stringify({ type: 'decision', decision: 'accept' })}\n`);
                    client.end();
                });
            });
            client.on('error', () => {
                // Suppress error
            });

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
        }, 10000);
    });

    describe('Socket Infrastructure Errors', () => {
        test('denies when socket path exceeds maximum length', async () => {
            // macOS/BSD has 104 character limit for Unix domain socket paths
            const longPath = `/tmp/${'x'.repeat(110)}.sock`;
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: longPath, PLANDERSON_TIMEOUT_SECONDS: '2' });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Socket path too long');
            expect(response.hookSpecificOutput.decision.message).toContain('104');
        }, 10000);

        test('denies when socket server fails to start', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            // Create a directory at the socket path to cause server startup failure
            fs.mkdirSync(TEST_SOCKET_PATH, { recursive: true });

            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '2',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Socket server failed to start');

            // Clean up directory
            fs.rmSync(TEST_SOCKET_PATH, { recursive: true, force: true });
        }, 10000);

        test('includes helpful error details in socket startup failure message', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-socket-errors');
            // Create a directory to cause failure
            fs.mkdirSync(TEST_SOCKET_PATH, { recursive: true });

            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '2',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Socket server failed to start');
            // Should include helpful suggestions
            expect(response.hookSpecificOutput.decision.message).toMatch(/permissions|clean:sockets|Disable/);

            // Clean up directory
            fs.rmSync(TEST_SOCKET_PATH, { recursive: true, force: true });
        }, 10000);
    });
});
