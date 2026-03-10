import { describe, expect, test } from 'bun:test';

import { readStream, spawnHook } from './helpers';

/**
 * Security hardening tests for the Claude Code hook.
 * Tests handling of malicious input, injection attempts, resource exhaustion,
 * and error message sanitization.
 *
 * Focus: Is the hook secure against malicious input and attacks?
 */

describe('claude-hook hook-security integration', () => {
    describe('Path Traversal & Injection Attempts', () => {
        test('handles path traversal attempts in plan content', async () => {
            const maliciousInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {
                    plan: `../../../etc/passwd\n` + `../../secret.key\n${'x'.repeat(1000)}`,
                },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_TIMEOUT_SECONDS: '2' });

            hookProcess.stdin.write(JSON.stringify(maliciousInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);
            const stderr = await readStream(hookProcess.stderr);

            // Should not expose filesystem info in error messages
            expect(stderr).not.toContain('/etc/passwd');
            expect(stdout).not.toContain('/etc/passwd');

            // Should still return valid response
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 10000);

        test('handles script injection attempts', async () => {
            const maliciousInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {
                    plan: '\0\x01\x02\x1f<script>alert("xss")</script>\n$(rm -rf /)\n`malicious`',
                },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_TIMEOUT_SECONDS: '2' });

            hookProcess.stdin.write(JSON.stringify(maliciousInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);

            // Should return valid JSON response
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 10000);

        test('handles very long field names', async () => {
            const longFieldName = 'x'.repeat(10000);
            const maliciousInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {
                    plan: 'Test',
                    [longFieldName]: 'value',
                },
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook({ PLANDERSON_TIMEOUT_SECONDS: '2' });

            hookProcess.stdin.write(JSON.stringify(maliciousInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);

            // Should handle gracefully
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 10000);
    });

    describe('Resource Exhaustion Prevention', () => {
        test('handles deeply nested JSON', async () => {
            // Create deeply nested object
            let nested: any = { plan: 'Test' };
            Array.from({ length: 100 }).forEach(() => {
                nested = { nested };
            });

            const maliciousInput = {
                tool_name: 'ExitPlanMode',
                tool_input: nested,
                hook_event_name: 'PermissionRequest',
            };

            const hookProcess = spawnHook();

            hookProcess.stdin.write(JSON.stringify(maliciousInput));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);

            // Should handle without crashing
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 10000);

        test('handles many repeated fields', async () => {
            const manyFields: any = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test' },
                hook_event_name: 'PermissionRequest',
            };

            // Add 1000 extra fields
            Array.from({ length: 1000 }).forEach((_, i) => {
                manyFields[`field_${i}`] = `value_${i}`;
            });

            const hookProcess = spawnHook({ PLANDERSON_TIMEOUT_SECONDS: '2' });

            hookProcess.stdin.write(JSON.stringify(manyFields));
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);

            // Should handle without crashing and return valid JSON
            expect(stdout.trim().length).toBeGreaterThan(0);
            expect(() => JSON.parse(stdout)).not.toThrow();
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput).toBeDefined();
        }, 15000);
    });

    describe('Binary and Non-UTF8 Input', () => {
        test('handles binary data gracefully', async () => {
            const hookProcess = spawnHook();

            // Send binary data
            const binaryData = Buffer.from([0xff, 0xfe, 0xfd, 0x00, 0x01, 0x02]);
            hookProcess.stdin.write(binaryData);
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);

            // Should return error response
            const response = JSON.parse(stdout);
            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
        }, 5000);

        test('handles invalid UTF-8 sequences', async () => {
            const hookProcess = spawnHook();

            // Create invalid UTF-8 sequence
            const invalidUtf8 = Buffer.from([
                0x7b,
                0x22,
                0x74,
                0x6f,
                0x6f,
                0x6c,
                0x5f,
                0x6e,
                0x61,
                0x6d,
                0x65,
                0x22,
                0x3a,
                0x22,
                0x45,
                0x78,
                0x69,
                0x74,
                0x50,
                0x6c,
                0x61,
                0x6e,
                0x4d,
                0x6f,
                0x64,
                0x65,
                0x22,
                0x7d,
                0xff,
                0xfe, // Invalid UTF-8 bytes
            ]);
            hookProcess.stdin.write(invalidUtf8);
            hookProcess.stdin.end();

            const stdout = await readStream(hookProcess.stdout);

            // Should handle gracefully
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 5000);
    });

    describe('Error Message Sanitization', () => {
        test('does not expose system paths in error messages', async () => {
            const hookProcess = spawnHook();

            // Send empty input to trigger error
            hookProcess.stdin.end();

            const [exitCode, stdout, stderr] = await Promise.all([
                new Promise<number>((resolve) => {
                    hookProcess.on('exit', (code) => resolve(code || 0));
                }),
                readStream(hookProcess.stdout),
                readStream(hookProcess.stderr),
            ]);

            // Should exit with error code
            expect(exitCode).toBeGreaterThan(0);

            // Error messages should not contain full system paths
            // Note: spawnHook uses an isolated temp HOME (e.g. /var/folders/.../planderson-test-home-xxx),
            // which does not match /Users/ or /home/, so this assertion remains valid.
            const combinedOutput = stdout + stderr;
            expect(combinedOutput).not.toContain('/Users/');
            expect(combinedOutput).not.toContain('/home/');
            expect(combinedOutput).not.toContain('C:\\');
        }, 5000);
    });
});
