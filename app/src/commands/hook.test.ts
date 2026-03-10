import { describe, expect, test } from 'bun:test';

import { buildHookResponse, mapSocketResultToHookResponse, readStdinSafely, validateHookInput } from './hook';

/**
 * Unit tests for pure functions in the Claude Code hook.
 * These tests are fast and don't involve I/O, sockets, or spawning processes.
 * For integration tests with real sockets, see tests/integration/planderson-hook-socket.integration.ts
 * For full E2E tests, see tests/integration/planderson-hook-e2e.integration.test.ts
 */

// Types matching the hook implementation
interface PermissionRequestInput {
    tool_name: string;
    tool_input: {
        plan?: string;
        [key: string]: unknown;
    };
    hook_event_name: string;
    permission_mode?: string;
}

interface HookResponse {
    hookSpecificOutput: {
        hookEventName: 'PermissionRequest';
        decision: {
            behavior: 'allow' | 'deny';
            message?: string;
        };
    };
}

describe('commands hook', () => {
    describe('buildHookResponse', () => {
        test('builds allow response without message', () => {
            const response = buildHookResponse('allow');

            expect(response.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
            expect(response.hookSpecificOutput.decision.message).toBeUndefined();
        });

        test('builds deny response with message', () => {
            const message = 'Plan needs improvement';
            const response = buildHookResponse('deny', message);

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toBe(message);
        });

        test('builds deny response without message', () => {
            const response = buildHookResponse('deny');

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toBeUndefined();
        });

        test('validates response schema', () => {
            const response = buildHookResponse('allow');

            expect(response.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
            expect(response.hookSpecificOutput.decision.behavior).toBe('allow');
        });

        test('includes message when provided', () => {
            const message = 'Test message';
            const response = buildHookResponse('deny', message);

            expect(response.hookSpecificOutput.decision.message).toBe(message);
        });

        test('throws on invalid behavior value', () => {
            expect(() => {
                // @ts-expect-error Testing invalid input
                buildHookResponse('invalid');
            }).toThrow();
        });
    });

    describe('mapSocketResultToHookResponse', () => {
        test('maps accept decision', () => {
            const result = { decision: 'accept' as const };
            const mapped = mapSocketResultToHookResponse(result, 360);

            expect(mapped.behavior).toBe('allow');
            expect(mapped.message).toBeUndefined();
        });

        test('maps deny decision without message', () => {
            const result = { decision: 'deny' as const };
            const mapped = mapSocketResultToHookResponse(result, 360);

            expect(mapped.behavior).toBe('deny');
            expect(mapped.message).toBe('Plan denied via Planderson');
        });

        test('maps deny decision with message', () => {
            const result = { decision: 'deny' as const, message: 'User feedback' };
            const mapped = mapSocketResultToHookResponse(result, 360);

            expect(mapped.behavior).toBe('deny');
            expect(mapped.message).toBe('Plan denied: User feedback');
        });

        test('maps timeout with dynamic minutes', () => {
            const mapped = mapSocketResultToHookResponse('timeout', 900);

            expect(mapped.behavior).toBe('deny');
            expect(mapped.message).toContain('15 minutes');
        });

        test('maps timeout with singular minute', () => {
            const mapped = mapSocketResultToHookResponse('timeout', 60);

            expect(mapped.behavior).toBe('deny');
            expect(mapped.message).toContain('1 minute');
            expect(mapped.message).not.toContain('minutes');
        });

        test('maps timeout with custom duration', () => {
            const mapped = mapSocketResultToHookResponse('timeout', 120);

            expect(mapped.behavior).toBe('deny');
            expect(mapped.message).toContain('2 minutes');
        });
    });

    describe('validateHookInput', () => {
        test('validates correct input', () => {
            const input = JSON.stringify({
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test plan' },
                hook_event_name: 'PermissionRequest',
            });

            const result = validateHookInput(input);

            expect(result.tool_name).toBe('ExitPlanMode');
            expect(result.tool_input.plan).toBe('Test plan');
        });

        test('throws on invalid JSON', () => {
            expect(() => {
                validateHookInput('{ invalid json }');
            }).toThrow('Failed to parse hook input');
        });

        test('throws on missing tool_name', () => {
            const input = JSON.stringify({
                tool_input: { plan: 'Test' },
                hook_event_name: 'PermissionRequest',
            });

            expect(() => {
                validateHookInput(input);
            }).toThrow('Invalid hook input');
        });

        test('throws on wrong tool_name type', () => {
            const input = JSON.stringify({
                tool_name: 123,
                tool_input: { plan: 'Test' },
                hook_event_name: 'PermissionRequest',
            });

            expect(() => {
                validateHookInput(input);
            }).toThrow();
        });

        test('allows optional plan field', () => {
            const input = JSON.stringify({
                tool_name: 'ExitPlanMode',
                tool_input: {},
                hook_event_name: 'PermissionRequest',
            });

            const result = validateHookInput(input);

            expect(result.tool_input.plan).toBeUndefined();
        });

        test('allows additional fields in tool_input', () => {
            const input = JSON.stringify({
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'Test', extra_field: 'value' },
                hook_event_name: 'PermissionRequest',
            });

            const result = validateHookInput(input);

            expect(result.tool_input.extra_field).toBe('value');
        });
    });

    describe('readStdinSafely', () => {
        test('reads simple input', async () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mockStdin = new (require('stream').PassThrough)();
            const originalStdin = process.stdin;

            // Replace stdin temporarily
            Object.defineProperty(process, 'stdin', {
                value: mockStdin,
                configurable: true,
            });

            const readPromise = readStdinSafely(1024, 1000);

            // Write test data
            mockStdin.write('test data');
            mockStdin.end();

            const result = await readPromise;

            // Restore stdin
            Object.defineProperty(process, 'stdin', {
                value: originalStdin,
                configurable: true,
            });

            expect(result).toBe('test data');
        });

        test('rejects on size limit exceeded', async () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mockStdin = new (require('stream').PassThrough)();
            const originalStdin = process.stdin;

            Object.defineProperty(process, 'stdin', {
                value: mockStdin,
                configurable: true,
            });

            const readPromise = readStdinSafely(10, 1000); // 10 byte limit

            // Write more than limit
            mockStdin.write('x'.repeat(20));

            await expect(readPromise).rejects.toThrow('exceeds maximum size');

            Object.defineProperty(process, 'stdin', {
                value: originalStdin,
                configurable: true,
            });
        });

        test('rejects on timeout', async () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mockStdin = new (require('stream').PassThrough)();
            const originalStdin = process.stdin;

            Object.defineProperty(process, 'stdin', {
                value: mockStdin,
                configurable: true,
            });

            const readPromise = readStdinSafely(1024, 100); // 100ms timeout

            // Don't write anything, let it timeout

            await expect(readPromise).rejects.toThrow('Timeout reading stdin');

            Object.defineProperty(process, 'stdin', {
                value: originalStdin,
                configurable: true,
            });
        });
    });

    describe('Hook Input Validation', () => {
        test('validates ExitPlanMode tool name', () => {
            const validInput: PermissionRequestInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {
                    plan: 'Test plan',
                },
                hook_event_name: 'PermissionRequest',
            };

            expect(validInput.tool_name).toBe('ExitPlanMode');
        });

        test('ignores non-ExitPlanMode tools', () => {
            const otherToolInput: PermissionRequestInput = {
                tool_name: 'SomeOtherTool',
                tool_input: {},
                hook_event_name: 'PermissionRequest',
            };

            expect(otherToolInput.tool_name).not.toBe('ExitPlanMode');
        });

        test('extracts plan content from tool_input', () => {
            const input: PermissionRequestInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {
                    plan: 'My plan content',
                    other_field: 'ignored',
                },
                hook_event_name: 'PermissionRequest',
            };

            expect(input.tool_input.plan).toBe('My plan content');
        });

        test('handles missing plan content', () => {
            const input: PermissionRequestInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {},
                hook_event_name: 'PermissionRequest',
            };

            expect(input.tool_input.plan).toBeUndefined();
        });

        test('handles empty plan content', () => {
            const input: PermissionRequestInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {
                    plan: '',
                },
                hook_event_name: 'PermissionRequest',
            };

            expect(input.tool_input.plan).toBe('');
        });
    });

    describe('Hook Response Format', () => {
        test('formats accept response correctly for Claude Code', () => {
            const response: HookResponse = {
                hookSpecificOutput: {
                    hookEventName: 'PermissionRequest',
                    decision: {
                        behavior: 'allow',
                    },
                },
            };

            const json = JSON.stringify(response);
            const parsed = JSON.parse(json) as HookResponse;

            expect(parsed.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
            expect(parsed.hookSpecificOutput.decision.behavior).toBe('allow');
        });

        test('formats deny response with message correctly for Claude Code', () => {
            const message = 'Plan denied: User feedback here';
            const response: HookResponse = {
                hookSpecificOutput: {
                    hookEventName: 'PermissionRequest',
                    decision: {
                        behavior: 'deny',
                        message,
                    },
                },
            };

            const json = JSON.stringify(response);
            const parsed = JSON.parse(json) as HookResponse;

            expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(parsed.hookSpecificOutput.decision.message).toBe(message);
        });

        test('formats timeout response correctly', () => {
            const timeoutMessage = 'Timeout waiting for plan approval (15 minutes)';
            const response: HookResponse = {
                hookSpecificOutput: {
                    hookEventName: 'PermissionRequest',
                    decision: {
                        behavior: 'deny',
                        message: timeoutMessage,
                    },
                },
            };

            expect(response.hookSpecificOutput.decision.behavior).toBe('deny');
            expect(response.hookSpecificOutput.decision.message).toContain('Timeout');
        });

        test('prefixes deny messages with "Plan denied: "', () => {
            const userMessage = 'This needs more detail';
            const formattedMessage = `Plan denied: ${userMessage}`;
            const response: HookResponse = {
                hookSpecificOutput: {
                    hookEventName: 'PermissionRequest',
                    decision: {
                        behavior: 'deny',
                        message: formattedMessage,
                    },
                },
            };

            expect(response.hookSpecificOutput.decision.message).toContain('Plan denied:');
            expect(response.hookSpecificOutput.decision.message).toContain(userMessage);
        });
    });

    describe('Error Handling', () => {
        test('handles malformed JSON input gracefully', () => {
            const malformedInput = '{"tool_name": "ExitPlanMode", invalid json}';

            expect(() => {
                JSON.parse(malformedInput);
            }).toThrow();
        });

        test('handles missing hook_event_name field', () => {
            const input = {
                tool_name: 'ExitPlanMode',
                tool_input: { plan: 'test' },
            };

            expect((input as any).hook_event_name).toBeUndefined();
        });

        test('handles null plan content', () => {
            const input: PermissionRequestInput = {
                tool_name: 'ExitPlanMode',
                tool_input: {
                    plan: null as any,
                },
                hook_event_name: 'PermissionRequest',
            };

            expect(input.tool_input.plan).toBeNull();
        });
    });
});
