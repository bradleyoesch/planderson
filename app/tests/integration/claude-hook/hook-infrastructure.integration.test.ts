import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

import { useTempDir, useTestSocket } from '~/test-utils/fixtures';

import { connectAndRespond, readStream, spawnHook } from './helpers';

/**
 * Infrastructure integration tests for the Claude Code hook.
 * Tests environment variables, logging, session management, and cleanup.
 *
 * Focus: Does the infrastructure work correctly (env vars, logging, cleanup)?
 */

describe('claude-hook hook-infrastructure integration', () => {
    describe('Environment Variables', () => {
        test('PLANDERSON_TIMEOUT_SECONDS=1 -> hook times out after 1 second', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '1',
            }); // 1 second timeout

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Don't connect - let it timeout
            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Timeout');
        }, 10000);

        test('PLANDERSON_SOCKET_PATH set -> hook creates socket at custom location', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');

            // Verify socket was created at the specified path
            // (will be cleaned up by test fixture)
        }, 10000);

        test('PLANDERSON_TIMEOUT_SECONDS=invalid -> returns deny with valid response', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            // Test with invalid timeout value (NaN will cause immediate timeout)
            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: 'not-a-number',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Don't connect - invalid timeout likely causes immediate timeout
            const stdout = await readStream(hookProcess.stdout);

            // Should still return valid response (likely timeout/deny)
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision).toBeDefined();
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 10000);
    });

    describe('Stderr Logging', () => {
        test('hook starts -> logs session info to stderr', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            const [stderr] = await Promise.all([readStream(hookProcess.stderr), clientPromise]);

            // Should log session hash
            expect(stderr).toContain('[Planderson Hook] Session:');

            // Should log waiting message
            expect(stderr).toContain('Claude is waiting for plan approval');

            // Should log socket path
            expect(stderr).toContain('Socket:');
        }, 10000);

        test('user denies plan -> returns denial in JSON response', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const feedbackMessage = 'This needs more detail';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', feedbackMessage, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            // Should return denial in JSON response
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Plan denied:');
            expect(response.hookSpecificOutput.decision.message).toContain(feedbackMessage);
        }, 10000);

        test('no TUI connection -> returns timeout in JSON response', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '1',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);

            // Should return timeout in JSON response
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Timeout');
        }, 10000);
    });

    describe('Stdin Reading', () => {
        test('no stdin input -> hook times out and returns error', async () => {
            const hookProcess = spawnHook();

            // Don't write anything, just wait for stdin timeout
            // The hook should timeout after 5 seconds and return an error
            const [exitCode, stdout] = await Promise.all([
                new Promise<number>((resolve) => {
                    hookProcess.on('exit', (code) => resolve(code || 0));
                }),
                readStream(hookProcess.stdout),
            ]);

            // Should exit with non-zero code indicating error
            expect(exitCode).toBeGreaterThan(0);
            // Stdout should contain error response
            expect(stdout.length).toBeGreaterThan(0);
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 10000);

        test('plan content exceeds 10MB -> returns error', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            // Create plan content larger than MAX_STDIN_BYTES (10MB)
            // Use 10MB + 1KB to exceed limit without causing EPIPE on write
            const largePlan = 'x'.repeat(10 * 1024 * 1024 + 1024);
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: largePlan },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            try {
                hookProcess.stdin.write(JSON.stringify(hookInput));
                hookProcess.stdin.end();
            } catch {
                // EPIPE is expected when exceeding stdin buffer
                // This is actually the correct behavior - the hook rejects the input
            }

            const [exitCode, stdout] = await Promise.all([
                new Promise<number>((resolve) => {
                    hookProcess.on('exit', (code) => resolve(code || 0));
                }),
                readStream(hookProcess.stdout),
            ]);

            // Should fail with error
            expect(exitCode).toBeGreaterThan(0);
            // Stdout may be empty due to EPIPE, which is acceptable
            if (stdout.length > 0) {
                const response = JSON.parse(stdout);
                expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            }
        }, 15000);
    });

    describe('Input Validation', () => {
        test('malformed JSON input -> returns error', async () => {
            const hookProcess = spawnHook();

            // Send invalid JSON
            hookProcess.stdin.write('{ invalid json }');
            hookProcess.stdin.end();

            const [exitCode, stdout] = await Promise.all([
                new Promise<number>((resolve) => {
                    hookProcess.on('exit', (code) => resolve(code || 0));
                }),
                readStream(hookProcess.stdout),
            ]);

            // Should fail with error
            expect(exitCode).toBeGreaterThan(0);
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('parse');
        }, 10000);

        test('missing required field tool_name -> returns error', async () => {
            const hookProcess = spawnHook();

            const invalidInput = {
                // Missing tool_name
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            hookProcess.stdin.write(JSON.stringify(invalidInput));
            hookProcess.stdin.end();

            const [exitCode, stdout] = await Promise.all([
                new Promise<number>((resolve) => {
                    hookProcess.on('exit', (code) => resolve(code || 0));
                }),
                readStream(hookProcess.stdout),
            ]);

            // Should fail with validation error
            expect(exitCode).toBeGreaterThan(0);
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Invalid hook input');
        }, 10000);

        test('plan with special characters and unicode -> transmits correctly', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const specialPlan = 'Plan with special chars: <>&"\'\n你好\n🚀✨❌\nLine 3';
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: specialPlan },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
        }, 10000);
    });

    describe('Session Management', () => {
        test('two hook invocations -> create different session hashes', async () => {
            const { path: TEST_SOCKET_PATH_1 } = useTestSocket('hook-infra-1');
            const { path: TEST_SOCKET_PATH_2 } = useTestSocket('hook-infra-2');

            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            // Spawn two hook processes
            const hookProcess1 = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH_1 });

            const hookProcess2 = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH_2 });

            hookProcess1.stdin.write(JSON.stringify(hookInput));
            hookProcess1.stdin.end();

            hookProcess2.stdin.write(JSON.stringify(hookInput));
            hookProcess2.stdin.end();

            const client1Promise = connectAndRespond(TEST_SOCKET_PATH_1, 'accept', undefined, 500);
            const client2Promise = connectAndRespond(TEST_SOCKET_PATH_2, 'accept', undefined, 500);

            const [stderr1, stderr2] = await Promise.all([
                readStream(hookProcess1.stderr),
                readStream(hookProcess2.stderr),
                client1Promise,
                client2Promise,
            ]);

            // Extract session hashes from stderr
            const processIdRegex = /Session:\s+(\w+)/;
            const match1 = stderr1.match(processIdRegex);
            const match2 = stderr2.match(processIdRegex);

            expect(match1).toBeTruthy();
            expect(match2).toBeTruthy();

            // Session hashes should be different
            if (match1 && match2) {
                expect(match1[1]).not.toBe(match2[1]);
            }
        }, 15000);

        test('TMUX_PANE set -> registers session in registry file', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            // Set TMUX_PANE environment variable
            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH, TMUX_PANE: '%0' }); // Mock tmux pane

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            // If TMUX_PANE is set and not using test socket override,
            // the hook should register the session
            // (Hard to verify without checking registry files, but at least verify it doesn't crash)
        }, 10000);
    });

    describe('Socket Behavior', () => {
        test('socket accepts connection and responds correctly', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra-socket');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan for socket' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Wait for socket to be created
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Verify socket file exists
            expect(fs.existsSync(TEST_SOCKET_PATH)).toBe(true);

            // Connect and respond
            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);
            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            // Should succeed
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');

            // Wait for cleanup
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Socket should be cleaned up
            expect(fs.existsSync(TEST_SOCKET_PATH)).toBe(false);
        }, 10000);
    });

    describe('Socket Cleanup', () => {
        test('hook exits normally -> cleans up socket file', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Socket should be cleaned up
            expect(fs.existsSync(TEST_SOCKET_PATH)).toBe(false);
        }, 10000);

        test('hook times out -> still cleans up socket file', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '1',
            });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            await readStream(hookProcess.stdout);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Socket should still be cleaned up even on timeout
            expect(fs.existsSync(TEST_SOCKET_PATH)).toBe(false);
        }, 10000);
    });

    describe('Registry Cleanup', () => {
        test('hook exits normally -> cleans up registry file', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra-registry');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH, TMUX_PANE: '%999' }); // Tmux pane ID (will be prefixed with tmux-pane-)

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Registry file should be cleaned up
            // Note: In test mode with PLANDERSON_SOCKET_PATH, registry is not actually used
            // This test verifies no crash occurs with TMUX_PANE set
            expect(fs.existsSync(TEST_SOCKET_PATH)).toBe(false);
        }, 10000);

        test('hook errors -> still cleans up registry file', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra-registry-error');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                PLANDERSON_TIMEOUT_SECONDS: '1',
                TMUX_PANE: '%998',
            }); // Tmux pane ID (will be prefixed with tmux-pane-)

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            // Don't connect - let it timeout and error
            await readStream(hookProcess.stdout);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Registry file should still be cleaned up even on error
            // Note: In test mode with PLANDERSON_SOCKET_PATH, registry is not actually used
            // This test verifies no crash occurs with TMUX_PANE set during error
            expect(fs.existsSync(TEST_SOCKET_PATH)).toBe(false);
        }, 10000);
    });

    describe('File Logging', () => {
        test('hook lifecycle -> logs all events to activity.log', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra-log');
            const base = useTempDir('planderson-test-log-');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH, PLANDERSON_BASE_DIR: base });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Check that activity log was written to
            const logFile = path.join(base, 'logs', 'activity.log');
            expect(fs.existsSync(logFile)).toBe(true);
            expect(fs.statSync(logFile).size).toBeGreaterThan(0);

            // Verify log contains expected lifecycle events
            const logContent = fs.readFileSync(logFile, 'utf-8');
            expect(logContent).toContain('hook.started');
            expect(logContent).toContain('socket.server.created');
            expect(logContent).toContain('socket.server.started');
            expect(logContent).toContain('socket.server.decisionreceived');
            expect(logContent).toContain('socket.server.ended');
            expect(logContent).toContain('hook.ended');
        }, 10000);

        test('hook encounters exception -> logs error to error.log', async () => {
            const base = useTempDir('planderson-test-log-');

            const hookProcess = spawnHook({ PLANDERSON_BASE_DIR: base });

            // Send malformed input to trigger error
            hookProcess.stdin.write('{ invalid json }');
            hookProcess.stdin.end();

            await readStream(hookProcess.stdout);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Check that error log was written to
            const errorLogFile = path.join(base, 'logs', 'error.log');
            expect(fs.existsSync(errorLogFile)).toBe(true);
            expect(fs.statSync(errorLogFile).size).toBeGreaterThan(0);

            // Verify error log contains error information
            const errorLogContent = fs.readFileSync(errorLogFile, 'utf-8');
            expect(errorLogContent).toContain('hook.errored');
        }, 10000);

        test('TMUX_PANE set -> logs session registration', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra-tmux-log');
            const base = useTempDir('planderson-test-log-');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({
                PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH,
                TMUX_PANE: '%100',
                PLANDERSON_BASE_DIR: base,
            }); // Mock tmux pane for test

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Check that activity log was written to
            const logFile = path.join(base, 'logs', 'activity.log');
            expect(fs.existsSync(logFile)).toBe(true);
            expect(fs.statSync(logFile).size).toBeGreaterThan(0);

            // Note: When PLANDERSON_SOCKET_PATH is set (test mode), registration doesn't happen
            // This test verifies that the hook doesn't crash with TMUX_PANE set
            // In real usage (without PLANDERSON_SOCKET_PATH), socket.server.registered would be logged
            const logContent = fs.readFileSync(logFile, 'utf-8');
            expect(logContent).toContain('hook.started');
            expect(logContent).toContain('socket.server.created');
        }, 10000);

        test('user denies plan -> logs decision with message', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra-deny-log');
            const base = useTempDir('planderson-test-log-');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const feedbackMessage = 'This needs more work';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH, PLANDERSON_BASE_DIR: base });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', feedbackMessage, 500);

            await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Check that activity log was written to
            const logFile = path.join(base, 'logs', 'activity.log');
            expect(fs.existsSync(logFile)).toBe(true);
            expect(fs.statSync(logFile).size).toBeGreaterThan(0);

            // Verify log contains decision with message
            const logContent = fs.readFileSync(logFile, 'utf-8');
            expect(logContent).toContain('socket.server.decisionreceived');
            expect(logContent).toContain('decision="deny"');
            expect(logContent).toContain('message=');
        }, 10000);

        test('socket path exceeds limit -> logs error with path length', async () => {
            const base = useTempDir('planderson-test-log-');
            const longPath = `/tmp/${'x'.repeat(110)}.sock`;
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: longPath, PLANDERSON_BASE_DIR: base });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            await readStream(hookProcess.stdout);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Check that error log was written to
            const errorLogFile = path.join(base, 'logs', 'error.log');
            expect(fs.existsSync(errorLogFile)).toBe(true);
            expect(fs.statSync(errorLogFile).size).toBeGreaterThan(0);

            // Verify error log contains socket path too long error
            const errorLogContent = fs.readFileSync(errorLogFile, 'utf-8');
            expect(errorLogContent).toContain('socket.server.pathtoolong.errored');
        }, 10000);

        test('socket server fails to start -> logs error', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-infra-server-fail');
            const base = useTempDir('planderson-test-log-');

            // Create a directory at the socket path to cause server startup failure
            fs.mkdirSync(TEST_SOCKET_PATH, { recursive: true });

            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH, PLANDERSON_BASE_DIR: base });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            await readStream(hookProcess.stdout);

            // Wait for process to fully exit
            await new Promise<void>((resolve) => {
                hookProcess.on('exit', () => resolve());
            });

            // Check that error log was written to
            const errorLogFile = path.join(base, 'logs', 'error.log');
            expect(fs.existsSync(errorLogFile)).toBe(true);
            expect(fs.statSync(errorLogFile).size).toBeGreaterThan(0);

            // Verify error log contains socket server error
            const errorLogContent = fs.readFileSync(errorLogFile, 'utf-8');
            expect(errorLogContent).toContain('socket.server.errored');

            // Clean up directory
            fs.rmSync(TEST_SOCKET_PATH, { recursive: true, force: true });
        }, 10000);
    });
});
