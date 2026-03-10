import { describe, expect, test } from 'bun:test';
import { EventEmitter } from 'events';
import * as net from 'net';

import { processMessageBuffer, serializeMessage, type SocketMessage } from './socket-ipc';

describe('lib socket-ipc', () => {
    describe('processMessageBuffer', () => {
        describe('Complete messages', () => {
            test('should extract a complete get_plan message', () => {
                const result = processMessageBuffer('', '{"type":"get_plan"}\n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'get_plan' });
                expect(result.remainingBuffer).toBe('');
            });

            test('should extract a complete plan message', () => {
                const result = processMessageBuffer('', '{"type":"plan","content":"test plan"}\n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({
                    type: 'plan',
                    content: 'test plan',
                });
                expect(result.remainingBuffer).toBe('');
            });

            test('should extract a complete decision message with accept', () => {
                const result = processMessageBuffer('', '{"type":"decision","decision":"accept"}\n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({
                    type: 'decision',
                    decision: 'accept',
                });
                expect(result.remainingBuffer).toBe('');
            });

            test('should extract a complete decision message with deny and feedback', () => {
                const result = processMessageBuffer(
                    '',
                    '{"type":"decision","decision":"deny","message":"needs improvement"}\n',
                );

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({
                    type: 'decision',
                    decision: 'deny',
                    message: 'needs improvement',
                });
                expect(result.remainingBuffer).toBe('');
            });

            test('should extract a complete error message', () => {
                const result = processMessageBuffer('', '{"type":"error","error":"connection failed"}\n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({
                    type: 'error',
                    error: 'connection failed',
                });
                expect(result.remainingBuffer).toBe('');
            });

            test('extracts multiple complete messages from one chunk', () => {
                const result = processMessageBuffer(
                    '',
                    '{"type":"get_plan"}\n{"type":"plan","content":"test"}\n{"type":"decision","decision":"accept"}\n',
                );

                expect(result.messages).toHaveLength(3);
                expect(result.messages[0]).toEqual({ type: 'get_plan' });
                expect(result.messages[1]).toEqual({ type: 'plan', content: 'test' });
                expect(result.messages[2]).toEqual({ type: 'decision', decision: 'accept' });
                expect(result.remainingBuffer).toBe('');
            });
        });

        describe('Buffer accumulation', () => {
            test('should handle incomplete message with no newline', () => {
                const result = processMessageBuffer('', '{"type":"get_plan"');

                expect(result.messages).toHaveLength(0);
                expect(result.remainingBuffer).toBe('{"type":"get_plan"');
            });

            test('should handle partial JSON at the end', () => {
                const result = processMessageBuffer('', '{"type":"plan","content":"test');

                expect(result.messages).toHaveLength(0);
                expect(result.remainingBuffer).toBe('{"type":"plan","content":"test');
            });

            test('should process complete message and keeps partial message in buffer', () => {
                const result = processMessageBuffer('', '{"type":"get_plan"}\n{"type":"plan"');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'get_plan' });
                expect(result.remainingBuffer).toBe('{"type":"plan"');
            });

            test('extracts multiple messages with partial message at the end', () => {
                const result = processMessageBuffer(
                    '',
                    '{"type":"get_plan"}\n{"type":"plan","content":"test"}\n{"type":"err',
                );

                expect(result.messages).toHaveLength(2);
                expect(result.messages[0]).toEqual({ type: 'get_plan' });
                expect(result.messages[1]).toEqual({ type: 'plan', content: 'test' });
                expect(result.remainingBuffer).toBe('{"type":"err');
            });

            test('should accumulate partial message across multiple chunks', () => {
                // First chunk: partial message
                const result1 = processMessageBuffer('', '{"type":"pla');

                expect(result1.messages).toHaveLength(0);
                expect(result1.remainingBuffer).toBe('{"type":"pla');

                // Second chunk: complete the message
                const result2 = processMessageBuffer(result1.remainingBuffer, 'n","content":"test"}\n');

                expect(result2.messages).toHaveLength(1);
                expect(result2.messages[0]).toEqual({ type: 'plan', content: 'test' });
                expect(result2.remainingBuffer).toBe('');
            });

            test('should accumulate and process multiple chunks sequentially', () => {
                // Chunk 1: Partial
                const result1 = processMessageBuffer('', '{"ty');

                expect(result1.messages).toHaveLength(0);

                // Chunk 2: Complete first message, start second
                const result2 = processMessageBuffer(result1.remainingBuffer, 'pe":"get_plan"}\n{"type":"');

                expect(result2.messages).toHaveLength(1);
                expect(result2.messages[0]).toEqual({ type: 'get_plan' });

                // Chunk 3: Complete second message
                const result3 = processMessageBuffer(result2.remainingBuffer, 'plan","content":"test"}\n');

                expect(result3.messages).toHaveLength(1);
                expect(result3.messages[0]).toEqual({ type: 'plan', content: 'test' });
                expect(result3.remainingBuffer).toBe('');
            });

            test('should complete message when newline is added to existing buffer', () => {
                const result = processMessageBuffer('{"type":"get_plan"}', '\n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'get_plan' });
                expect(result.remainingBuffer).toBe('');
            });
        });

        describe('Error handling', () => {
            test('should return error message for invalid JSON', () => {
                const result = processMessageBuffer('', '{invalid json}\n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0].type).toBe('error');
                expect((result.messages[0] as { type: 'error'; error: string }).error).toContain(
                    'Failed to parse message',
                );
            });

            test('should return error for incomplete JSON object', () => {
                const result = processMessageBuffer('', '{"type":"get_plan"\n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0].type).toBe('error');
            });

            test('should handle multiple malformed messages', () => {
                const result = processMessageBuffer('', '{bad1}\n{bad2}\n');

                expect(result.messages).toHaveLength(2);
                expect(result.messages[0].type).toBe('error');
                expect(result.messages[1].type).toBe('error');
            });

            test('should process valid messages mixed with invalid ones', () => {
                const result = processMessageBuffer('', '{bad json}\n{"type":"get_plan"}\n{more bad}\n');

                expect(result.messages).toHaveLength(3);
                expect(result.messages[0].type).toBe('error');
                expect(result.messages[1]).toEqual({ type: 'get_plan' });
                expect(result.messages[2].type).toBe('error');
            });
        });

        describe('Whitespace handling', () => {
            test('should ignore empty lines', () => {
                const result = processMessageBuffer('', '\n\n{"type":"get_plan"}\n\n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'get_plan' });
                expect(result.remainingBuffer).toBe('');
            });

            test('should ignore whitespace-only lines', () => {
                const result = processMessageBuffer('', '   \n\t\n{"type":"get_plan"}\n  \n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'get_plan' });
                expect(result.remainingBuffer).toBe('');
            });

            test('should trim whitespace from lines before parsing', () => {
                const result = processMessageBuffer('', '  {"type":"get_plan"}  \n');

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'get_plan' });
            });
        });

        describe('Special characters', () => {
            test('should handle newlines within JSON strings', () => {
                const planWithNewlines = 'line1\nline2\nline3';
                const input = `${JSON.stringify({ type: 'plan', content: planWithNewlines })}\n`;

                const result = processMessageBuffer('', input);

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'plan', content: planWithNewlines });
            });

            test('should handle unicode characters', () => {
                const unicodePlan = '🎉 Test plan with émojis and spëcial çhars 中文';
                const input = `${JSON.stringify({ type: 'plan', content: unicodePlan })}\n`;

                const result = processMessageBuffer('', input);

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'plan', content: unicodePlan });
            });

            test('should handle escaped quotes in strings', () => {
                const planWithQuotes = 'He said "hello" and she said "world"';
                const input = `${JSON.stringify({ type: 'plan', content: planWithQuotes })}\n`;

                const result = processMessageBuffer('', input);

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'plan', content: planWithQuotes });
            });
        });

        describe('Large messages', () => {
            test('should handle large plan content', () => {
                const largePlan = 'x'.repeat(10000);
                const input = `${JSON.stringify({ type: 'plan', content: largePlan })}\n`;

                const result = processMessageBuffer('', input);

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual({ type: 'plan', content: largePlan });
                expect(result.remainingBuffer).toBe('');
            });

            test('should handle large message split across chunks', () => {
                const largePlan = 'x'.repeat(10000);
                const fullMessage = `${JSON.stringify({ type: 'plan', content: largePlan })}\n`;
                const midpoint = Math.floor(fullMessage.length / 2);

                const result1 = processMessageBuffer('', fullMessage.slice(0, midpoint));

                expect(result1.messages).toHaveLength(0);

                const result2 = processMessageBuffer(result1.remainingBuffer, fullMessage.slice(midpoint));

                expect(result2.messages).toHaveLength(1);
                expect(result2.messages[0]).toEqual({ type: 'plan', content: largePlan });
            });
        });

        describe('Edge cases', () => {
            test('should handle empty buffer and empty data', () => {
                const result = processMessageBuffer('', '');

                expect(result.messages).toHaveLength(0);
                expect(result.remainingBuffer).toBe('');
            });

            test('should handle only newline characters', () => {
                const result = processMessageBuffer('', '\n\n\n');

                expect(result.messages).toHaveLength(0);
                expect(result.remainingBuffer).toBe('');
            });

            test('should handle buffer with existing content and empty new data', () => {
                const result = processMessageBuffer('{"type":"get_plan"}', '');

                expect(result.messages).toHaveLength(0);
                expect(result.remainingBuffer).toBe('{"type":"get_plan"}');
            });
        });
    });

    describe('serializeMessage', () => {
        describe('Message types', () => {
            test('should serialize get_plan message', () => {
                const message: SocketMessage = { type: 'get_plan' };
                const result = serializeMessage(message);

                expect(result).toBe('{"type":"get_plan"}\n');
            });

            test('should serialize plan message', () => {
                const message: SocketMessage = { type: 'plan', content: 'test plan content' };
                const result = serializeMessage(message);

                expect(result).toBe('{"type":"plan","content":"test plan content"}\n');
            });

            test('should serialize decision message with accept', () => {
                const message: SocketMessage = { type: 'decision', decision: 'accept' };
                const result = serializeMessage(message);

                expect(result).toBe('{"type":"decision","decision":"accept"}\n');
            });

            test('should serialize decision message with deny', () => {
                const message: SocketMessage = { type: 'decision', decision: 'deny' };
                const result = serializeMessage(message);

                expect(result).toBe('{"type":"decision","decision":"deny"}\n');
            });

            test('should serialize decision message with feedback', () => {
                const message: SocketMessage = {
                    type: 'decision',
                    decision: 'deny',
                    message: 'needs improvement',
                };
                const result = serializeMessage(message);

                expect(result).toBe('{"type":"decision","decision":"deny","message":"needs improvement"}\n');
            });

            test('should serialize error message', () => {
                const message: SocketMessage = { type: 'error', error: 'connection failed' };
                const result = serializeMessage(message);

                expect(result).toBe('{"type":"error","error":"connection failed"}\n');
            });

            test('should always end with newline', () => {
                const messages: SocketMessage[] = [
                    { type: 'get_plan' },
                    { type: 'plan', content: 'test' },
                    { type: 'decision', decision: 'accept' },
                    { type: 'error', error: 'test error' },
                ];

                messages.forEach((message) => {
                    const result = serializeMessage(message);
                    expect(result).toEndWith('\n');
                });
            });
        });

        describe('Special characters', () => {
            test('should handle special characters in content', () => {
                const message: SocketMessage = {
                    type: 'plan',
                    content: 'line1\nline2\ttab\r\nwindows',
                };

                const result = serializeMessage(message);

                expect(result).toContain('\\n');
                expect(result).toContain('\\t');
                expect(result).toEndWith('\n');
                // Verify it can be parsed back
                const parsed = JSON.parse(result.slice(0, -1));
                expect(parsed.content).toBe('line1\nline2\ttab\r\nwindows');
            });

            test('should handle unicode characters', () => {
                const message: SocketMessage = {
                    type: 'plan',
                    content: '🎉 Émojis and 中文',
                };

                const result = serializeMessage(message);

                const parsed = JSON.parse(result.slice(0, -1));
                expect(parsed.content).toBe('🎉 Émojis and 中文');
            });

            test('should handle quotes in strings', () => {
                const message: SocketMessage = {
                    type: 'plan',
                    content: 'He said "hello"',
                };

                const result = serializeMessage(message);

                const parsed = JSON.parse(result.slice(0, -1));
                expect(parsed.content).toBe('He said "hello"');
            });
        });

        describe('Large messages', () => {
            test('should handle large content', () => {
                const largeContent = 'x'.repeat(10000);
                const message: SocketMessage = { type: 'plan', content: largeContent };

                const result = serializeMessage(message);

                expect(result).toEndWith('\n');
                const parsed = JSON.parse(result.slice(0, -1));
                expect(parsed.content).toBe(largeContent);
            });
        });
    });

    describe('Round-trip serialization', () => {
        test('should survive serialize → parse cycle', () => {
            const originalMessages: SocketMessage[] = [
                { type: 'get_plan' },
                { type: 'plan', content: 'test plan with\nnewlines and "quotes"' },
                { type: 'decision', decision: 'accept' },
                { type: 'decision', decision: 'deny', message: 'feedback text' },
                { type: 'error', error: 'error message' },
            ];

            originalMessages.forEach((original) => {
                const serialized = serializeMessage(original);
                const result = processMessageBuffer('', serialized);

                expect(result.messages).toHaveLength(1);
                expect(result.messages[0]).toEqual(original);
                expect(result.remainingBuffer).toBe('');
            });
        });

        test('should handle multiple messages surviving round-trip', () => {
            const messages: SocketMessage[] = [
                { type: 'get_plan' },
                { type: 'plan', content: 'test' },
                { type: 'decision', decision: 'accept' },
            ];

            const serialized = messages.map((message) => serializeMessage(message)).join('');

            const result = processMessageBuffer('', serialized);

            expect(result.messages).toEqual(messages);
            expect(result.remainingBuffer).toBe('');
        });
    });

    describe('PlandersonSocketClient.connect()', () => {
        test('rejects immediately with ENOENT error when socket file does not exist', async () => {
            const { PlandersonSocketClient } = await import('./socket-ipc');
            const nonExistentPath = `/tmp/nonexistent-planderson-ipc-test-${Date.now()}.sock`;

            const client = new PlandersonSocketClient(nonExistentPath);

            // Bun's socket errors include 'ENOENT' in the message
            await expect(client.connect()).rejects.toThrow('ENOENT');
        });

        test('rejects with timeout error if socket does not connect within timeout', async () => {
            const FakeTimers = await import('@sinonjs/fake-timers');
            const clock = FakeTimers.install();

            try {
                const { PlandersonSocketClient } = await import('./socket-ipc');

                // Factory returns a socket that never emits 'connect' or 'error'
                const hangingSocket = Object.assign(new EventEmitter(), {
                    end: () => {},
                    destroy: () => {},
                    connect: () => {},
                }) as unknown as net.Socket;

                const client = new PlandersonSocketClient('/test/socket', () => hangingSocket);
                const connectPromise = client.connect(5000);

                // Run tick and assertion concurrently — same pattern as existing timeout tests
                // to prevent unhandled rejection race between the tick firing and the handler attaching
                const tickPromise = clock.tickAsync(5000);
                await Promise.all([expect(connectPromise).rejects.toThrow('Connection timed out'), tickPromise]);
            } finally {
                clock.uninstall();
            }
        });
    });

    describe('PlandersonSocketClient.getPlan()', () => {
        // Helper to create mock socket with event tracking
        const createMockSocket = (options: { onClose?: () => void } = {}) => {
            const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
            const mockSocket = {
                on: (event: string, handler: (...args: unknown[]) => void) => {
                    if (!handlers.has(event)) handlers.set(event, []);
                    handlers.get(event)!.push(handler);
                },
                off: (event: string, handler: (...args: unknown[]) => void) => {
                    const eventHandlers = handlers.get(event);
                    if (eventHandlers) {
                        const index = eventHandlers.indexOf(handler);
                        if (index > -1) eventHandlers.splice(index, 1);
                    }
                },
                write: () => {},
                end: () => options.onClose?.(),
                destroy: () => options.onClose?.(),
            };
            return { mockSocket, handlers };
        };

        // Helper to setup client with mock socket
        const setupMockClient = async function (options: { onClose?: () => void } = {}) {
            const { PlandersonSocketClient } = await import('./socket-ipc');
            const client = new PlandersonSocketClient('/test/socket');
            const { mockSocket, handlers } = createMockSocket(options);

            // @ts-expect-error - Injecting mock socket for testing
            client['socket'] = mockSocket;

            return { client, handlers };
        };

        describe('Event handler cleanup', () => {
            test('should remove data handler on successful plan receipt', async () => {
                const { client, handlers } = await setupMockClient();
                const planPromise = client.getPlan();

                // Verify handler was added
                expect(handlers.get('data')?.length).toBe(1);
                const dataHandler = handlers.get('data')![0];

                // Simulate plan response
                const planMessage = { type: 'plan' as const, content: 'test plan' };
                dataHandler(Buffer.from(`${JSON.stringify(planMessage)}\n`));

                const result = await planPromise;

                expect(handlers.get('data')?.length).toBe(0);
                expect(result).toBe('test plan');
            });

            test('should remove data handler on error receipt', async () => {
                const { client, handlers } = await setupMockClient();
                const planPromise = client.getPlan();

                // Verify handler was added
                expect(handlers.get('data')?.length).toBe(1);
                const dataHandler = handlers.get('data')![0];

                // Simulate error response
                const errorMessage = { type: 'error' as const, error: 'test error' };
                dataHandler(Buffer.from(`${JSON.stringify(errorMessage)}\n`));

                await expect(planPromise).rejects.toThrow('test error');

                expect(handlers.get('data')?.length).toBe(0);
            });

            test('should remove data handler on timeout', async () => {
                const FakeTimers = await import('@sinonjs/fake-timers');
                const clock = FakeTimers.install();

                try {
                    let closeCalled = false;
                    const { client, handlers } = await setupMockClient({
                        onClose: () => {
                            closeCalled = true;
                        },
                    });

                    // Start getPlan with real 10-second timeout
                    const planPromise = client.getPlan();

                    // Verify handler was added immediately after starting
                    expect(handlers.get('data')?.length).toBe(1);

                    // Fast-forward time by 10 seconds and catch rejection
                    const tickPromise = clock.tickAsync(10000);

                    // Both promises should settle
                    await Promise.all([expect(planPromise).rejects.toThrow('Timeout waiting for plan'), tickPromise]);

                    // Verify handler was removed on timeout
                    expect(handlers.get('data')?.length).toBe(0);

                    // Verify socket was closed
                    expect(closeCalled).toBe(true);
                } finally {
                    clock.uninstall();
                }
            });

            test('should prevent handler from firing after cleanup', async () => {
                const { client, handlers } = await setupMockClient();
                const planPromise = client.getPlan();
                const dataHandler = handlers.get('data')![0];

                // Simulate first plan response
                const planMessage1 = { type: 'plan' as const, content: 'first plan' };
                dataHandler(Buffer.from(`${JSON.stringify(planMessage1)}\n`));

                const result = await planPromise;

                expect(result).toBe('first plan');
                expect(handlers.get('data')?.length).toBe(0);

                // Try to trigger handler again - should not fire since it's removed
                const planMessage2 = { type: 'plan' as const, content: 'second plan' };

                // This should not cause any issues since handler is removed
                // If handler wasn't removed, this would try to resolve an already-resolved promise
                expect(() => {
                    dataHandler(Buffer.from(`${JSON.stringify(planMessage2)}\n`));
                }).not.toThrow();
            });

            test('should use isResolved flag to prevent double resolution', async () => {
                const { client, handlers } = await setupMockClient();
                const planPromise = client.getPlan();
                const dataHandler = handlers.get('data')![0];

                // Send plan message
                const planMessage = { type: 'plan' as const, content: 'test' };
                dataHandler(Buffer.from(`${JSON.stringify(planMessage)}\n`));

                // Immediately send another message (simulating race condition)
                const errorMessage = { type: 'error' as const, error: 'late error' };
                dataHandler(Buffer.from(`${JSON.stringify(errorMessage)}\n`));

                const result = await planPromise;

                expect(result).toBe('test');
            });
        });
    });

    describe('PlandersonSocketServer.waitForDecision()', () => {
        describe('Timeout cleanup', () => {
            test('should clear timeout when decision arrives first', async () => {
                const { PlandersonSocketServer } = await import('./socket-ipc');
                const server = new PlandersonSocketServer('/test/socket');

                // Mock the decision promise with immediate resolution
                const decisionMessage = { type: 'decision' as const, decision: 'accept' as const };
                server['decisionPromise'] = Promise.resolve(decisionMessage);

                const result = await server.waitForDecision(1); // 1 second timeout

                expect(result).toEqual(decisionMessage);

                // Wait a bit to ensure timeout would have fired if not cleared
                await new Promise((resolve) => setTimeout(resolve, 1100));

                // Test passes if no timeout error occurred
            });

            test('should return timeout error when no decision arrives', async () => {
                const { PlandersonSocketServer } = await import('./socket-ipc');
                const server = new PlandersonSocketServer('/test/socket');

                // Mock the decision promise with never-resolving promise
                server['decisionPromise'] = new Promise(() => {}); // Never resolves

                const result = await server.waitForDecision(0.01); // 10ms timeout

                expect(result.type).toBe('error');
                if (result.type === 'error') {
                    expect(result.error).toContain('Timeout waiting for plan approval');
                }
            });
        });
    });
});
