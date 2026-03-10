import { describe, expect, test } from 'bun:test';

import { readStream, spawnHook } from './helpers';

/**
 * Input validation integration tests for the Claude Code hook.
 * Tests handling of invalid, malformed, and missing input data.
 *
 * Focus: Does the hook properly validate and reject bad input?
 */

describe('claude-hook hook-validation integration', () => {
    describe('Plan Content Validation', () => {
        test('rejects empty plan content', async () => {
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: '' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('No plan content');
        }, 5000);

        test('rejects missing plan field', async () => {
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {},
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('No plan content');
        }, 5000);
    });

    describe('JSON Parsing Errors', () => {
        test('handles malformed JSON gracefully', async () => {
            const malformedInput = '{ "tool_name": "ExitPlanMode", invalid json }';

            const hookProcess = spawnHook();

            hookProcess.stdin.write(malformedInput);
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('parse');
        }, 5000);
    });

    describe('Schema Validation Errors', () => {
        test('rejects missing required tool_name field', async () => {
            const invalidInput = {
                // Missing tool_name
                tool_input: { plan: 'Test' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(invalidInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Invalid hook input');
        }, 5000);

        test('rejects wrong field type (number instead of string)', async () => {
            const invalidInput = {
                tool_name: 123, // Should be string
                tool_input: { plan: 'Test' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(invalidInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 5000);

        test('rejects wrong field type (array instead of string)', async () => {
            const invalidInput = {
                tool_name: ['invalid', 'array'],
                tool_input: { plan: 'Test' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(invalidInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            // Error message should be user-friendly, not expose internal details
            expect(response.hookSpecificOutput.decision.message).toBeTruthy();
            expect(response.hookSpecificOutput.decision.message).not.toContain('ZodError');
            expect(response.hookSpecificOutput.decision.message).not.toContain('_def');
        }, 5000);

        test('rejects null values', async () => {
            const invalidInput = {
                tool_name: null,
                tool_input: null,
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(invalidInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 10000);

        test('rejects array instead of object', async () => {
            const invalidInput = ['ExitPlanMode', 'test'];

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(invalidInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 5000);
    });

    describe('Input Size Limits', () => {
        test('rejects oversized stdin input (>10MB)', async () => {
            // Create input that exceeds 10MB limit
            const hugePlan = 'x'.repeat(11 * 1024 * 1024);
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: hugePlan },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            // Suppress stdin errors (EPIPE is expected)
            hookProcess.stdin.on('error', () => {
                // Expected - hook closes stdin when limit exceeded
            });

            let writeError = false;
            try {
                hookProcess.stdin.write(JSON.stringify(hookInput));
            } catch {
                writeError = true;
            }

            hookProcess.stdin.end();

            // Wait for process to exit
            const exitCode = await new Promise<number>((resolve) => {
                hookProcess.on('exit', (code) => resolve(code || 0));
            });

            // Either write failed (EPIPE) or hook exited with error code
            expect(writeError || exitCode > 0).toBe(true);
        }, 30000);

        test('accepts input just under size limit (<10MB)', async () => {
            // Create input just under 10MB limit
            const largePlan = 'x'.repeat(9 * 1024 * 1024);
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: largePlan },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_TIMEOUT_SECONDS: '2' });

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);

            // Should parse successfully (even though it will timeout)
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 30000);
    });

    describe('Error Message Quality', () => {
        test('provides clear message for empty plan', async () => {
            const hookInput = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: '' },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(hookInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const response = JSON.parse(stdout);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('No plan content');
        }, 5000);
    });
});
