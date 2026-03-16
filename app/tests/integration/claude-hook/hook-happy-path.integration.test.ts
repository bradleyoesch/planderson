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

        test('denies plan with feedback message', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const feedbackMessage = 'This needs more detail on line 5';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', feedbackMessage, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Plan denied:');
            expect(response.hookSpecificOutput.decision.message).toContain(feedbackMessage);
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

    describe('Formatted Feedback Messages', () => {
        test('hook passes formatted comments section through to output', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Step 1\nStep 2\nStep 3' },
                hook_event_name: 'PermissionRequest',
            };

            const formattedMessage = 'Comments on the plan:\nLine 1: "Step 1"\nneeds more detail';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });
            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', formattedMessage, 500);
            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Comments on the plan:');
            expect(response.hookSpecificOutput.decision.message).toContain('Line 1: "Step 1"');
            expect(response.hookSpecificOutput.decision.message).toContain('needs more detail');
        }, 10000);

        test('hook passes formatted questions section with LLM instructions through to output', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Step 1\nStep 2\nStep 3' },
                hook_event_name: 'PermissionRequest',
            };

            const formattedMessage =
                'Questions about the plan:\nLine 1: "Step 1"\nwhat is the timeline?\n\n' +
                'Please answer these questions. Do NOT call ExitPlanMode in this response — ' +
                'just answer the questions with plain text and stop.';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });
            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', formattedMessage, 500);
            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Questions about the plan:');
            expect(response.hookSpecificOutput.decision.message).toContain('Do NOT call ExitPlanMode');
        }, 10000);

        test('hook passes formatted deletions section through to output', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Step 1\nStep 2\nStep 3' },
                hook_event_name: 'PermissionRequest',
            };

            const formattedMessage = 'Delete lines:\nLine 2: "Step 2"';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });
            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', formattedMessage, 500);
            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Delete lines:');
            expect(response.hookSpecificOutput.decision.message).toContain('Line 2: "Step 2"');
        }, 10000);
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

        test('handles newlines in feedback message', async () => {
            const { path: TEST_SOCKET_PATH } = useTestSocket('hook-happy');
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            };

            const feedbackMessage = 'Comments:\nLine 1: Issue here\nLine 5: Another issue';

            const hookProcess = spawnHook({ PLANDERSON_SOCKET_PATH: TEST_SOCKET_PATH });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const clientPromise = connectAndRespond(TEST_SOCKET_PATH, 'deny', feedbackMessage, 500);

            const [stdout] = await Promise.all([readStream(hookProcess.stdout), clientPromise]);

            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.message).toContain(feedbackMessage);
        }, 10000);
    });
});
