import { describe, expect, test } from 'bun:test';

import { useTestSocket } from '~/test-utils/fixtures';

import { connectAndRespond, readStream, spawnHook } from './helpers';

/**
 * Happy path integration tests for the Claude Code hook.
 * Tests the core workflows that users interact with regularly.
 *
 * Focus: Does the hook work correctly for normal use cases?
 */

describe('claude-hook hook-happy-path integration', () => {
    describe('Core Workflows', () => {
        test('accepts plan successfully', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan content\nLine 2\nLine 3' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
            expect(response.hookSpecificOutput.decision.message).toBeUndefined();
        }, 10000);

        test('deny decision includes message in output', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const message = 'This needs more detail on line 5';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', message, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Plan denied:');
            expect(response.hookSpecificOutput.decision.message).toContain(message);
        }, 10000);

        test('denies plan without message', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', undefined, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toBe('Plan denied via Planderson');
        }, 10000);
    });

    describe('Non-ExitPlanMode Tools', () => {
        test('allows Bash tool without blocking', async () => {
            const hookInput = {
                tool_name: 'Bash',
                tool_input: { command: 'ls' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
            expect(response.hookSpecificOutput.decision.message).toBeUndefined();
        }, 5000);

        test('allows multiple different non-ExitPlanMode tools', async () => {
            const toolNames = ['Bash', 'Read', 'Write', 'Edit', 'Grep'];

            await toolNames.reduce(async (promise, toolName) => {
                await promise;
                const hookInput = {
                    tool_name: toolName,
                    tool_input: {},
                    hook_event_name: 'PermissionRequest',
                };

                const hookProcess = spawnHook();
                hookProcess.stdin.write(JSON.stringify(hookInput));
                hookProcess.stdin.end();

                const stdout = await readStream(hookProcess.stdout);
                const response = JSON.parse(stdout);

                expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
            }, Promise.resolve());
        }, 10000);
    });

    describe('Large Plans', () => {
        test('handles large plan content (realistic upper bound)', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const largePlan = 'x'.repeat(50000);
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: largePlan },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'accept', undefined, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
        }, 15000);
    });

    describe('Special Characters', () => {
        test('handles unicode characters in plan', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: '🎉 Test plan with émojis and 中文' },
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

        test('deny message with newlines passes through unchanged', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const message = 'Comments:\nLine 1: Issue here\nLine 5: Another issue';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', message, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.message).toContain(message);
        }, 10000);
    });
});
