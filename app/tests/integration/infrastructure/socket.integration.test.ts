import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';

import { PlandersonSocketClient, PlandersonSocketServer } from '~/lib/socket-ipc';
import { useTempDir, useTestSocket } from '~/test-utils/fixtures';

describe('infrastructure socket integration', () => {
    describe('PlandersonSocketServer', () => {
        describe('Lifecycle', () => {
            test('should start server and create socket file', async () => {
                const socketInfo = useTestSocket('ipc-lifecycle-start');
                const server = new PlandersonSocketServer(socketInfo.path);

                await server.start('test plan content');

                expect(fs.existsSync(socketInfo.path)).toBe(true);

                await server.close();
            });

            test('should create directory if it does not exist', async () => {
                const testDir = useTempDir();
                const socketPath = path.join(testDir, 'nested', 'dir', 'test.sock');
                const server = new PlandersonSocketServer(socketPath);

                await server.start('test plan');

                expect(fs.existsSync(socketPath)).toBe(true);

                await server.close();
            });

            test('should remove existing socket file on start', async () => {
                const socketInfo = useTestSocket('ipc-lifecycle-remove');
                const server = new PlandersonSocketServer(socketInfo.path);

                // Create a file at socket path
                fs.writeFileSync(socketInfo.path, 'old socket');
                expect(fs.existsSync(socketInfo.path)).toBe(true);

                await server.start('new plan');

                // Socket should be recreated
                expect(fs.existsSync(socketInfo.path)).toBe(true);

                await server.close();
            });

            test('should clean up socket file on close', async () => {
                const socketInfo = useTestSocket('ipc-lifecycle-close');
                const server = new PlandersonSocketServer(socketInfo.path);

                await server.start('test plan');
                expect(fs.existsSync(socketInfo.path)).toBe(true);

                await server.close();
                expect(fs.existsSync(socketInfo.path)).toBe(false);
            });
        });

        describe('Connection handling', () => {
            test('should accept client connection and respond to get_plan', async () => {
                const socketInfo = useTestSocket('ipc-conn-accept');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan content');

                const client = net.connect(socketInfo.path);
                const response = await new Promise<string>((resolve) => {
                    client.on('data', (data) => {
                        resolve(data.toString());
                    });
                    client.write('{"type":"get_plan"}\n');
                });

                expect(response).toContain('"type":"plan"');
                expect(response).toContain('"content":"test plan content"');

                client.end();
                await server.close();
            });

            test('should reject second client when one is already connected', async () => {
                const socketInfo = useTestSocket('ipc-conn-reject');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const client1 = net.connect(socketInfo.path);
                await new Promise((resolve) => client1.on('connect', resolve));

                // First client requests plan
                client1.write('{"type":"get_plan"}\n');
                await new Promise((resolve) => client1.on('data', resolve));

                // Second client tries to connect
                const client2 = net.connect(socketInfo.path);
                const errorReceived = await new Promise<boolean>((resolve) => {
                    client2.on('data', (data) => {
                        const message = data.toString();
                        resolve(message.includes('Another client is already connected'));
                    });
                    setTimeout(() => resolve(false), 1000);
                });

                expect(errorReceived).toBe(true);

                client1.end();
                client2.end();
                await server.close();
            });

            test('should replace stale connection with new client', async () => {
                const socketInfo = useTestSocket('ipc-conn-stale');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const client1 = net.connect(socketInfo.path);
                await new Promise((resolve) => client1.on('connect', resolve));

                // Request plan to establish connection
                client1.write('{"type":"get_plan"}\n');
                await new Promise((resolve) => client1.on('data', resolve));

                // Destroy first client to make it stale
                client1.destroy();

                // Wait for connection to be fully destroyed
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Second client should be accepted
                const client2 = net.connect(socketInfo.path);
                const response = await new Promise<string>((resolve) => {
                    client2.on('data', (data) => {
                        resolve(data.toString());
                    });
                    client2.write('{"type":"get_plan"}\n');
                });

                expect(response).toContain('"type":"plan"');

                client2.end();
                await server.close();
            });

            test('should handle malformed JSON from client and recover', async () => {
                const socketInfo = useTestSocket('ipc-conn-malformed');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const client = net.connect(socketInfo.path);
                await new Promise((resolve) => client.on('connect', resolve));

                // Send malformed JSON - server should respond with error
                client.write('not valid json\n');

                const errorResponse = await new Promise<string>((resolve) => {
                    client.once('data', (data) => resolve(data.toString()));
                });
                expect(errorResponse).toContain('Failed to parse message');

                // Connection should still be alive - send valid request
                client.write('{"type":"get_plan"}\n');

                const planResponse = await new Promise<string>((resolve) => {
                    client.once('data', (data) => resolve(data.toString()));
                });
                expect(planResponse).toContain('"type":"plan"');
                expect(planResponse).toContain('test plan');

                client.end();
                await server.close();
            });
        });

        describe('Decision handling', () => {
            test('should receive and return accept decision', async () => {
                const socketInfo = useTestSocket('ipc-decision-accept');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const decisionPromise = server.waitForDecision(5);

                // Connect client and send decision
                const client = net.connect(socketInfo.path);
                await new Promise((resolve) => client.on('connect', resolve));

                client.write('{"type":"get_plan"}\n');
                await new Promise((resolve) => client.on('data', resolve));

                client.write('{"type":"decision","decision":"accept"}\n');

                const decision = await decisionPromise;
                expect(decision).toEqual({ type: 'decision', decision: 'accept' });

                await server.close();
            });

            test('should receive and return deny decision with message', async () => {
                const socketInfo = useTestSocket('ipc-decision-deny');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const decisionPromise = server.waitForDecision(5);

                const client = net.connect(socketInfo.path);
                await new Promise((resolve) => client.on('connect', resolve));

                client.write('{"type":"get_plan"}\n');
                await new Promise((resolve) => client.on('data', resolve));

                client.write('{"type":"decision","decision":"deny","message":"needs work"}\n');

                const decision = await decisionPromise;
                expect(decision).toEqual({
                    type: 'decision',
                    decision: 'deny',
                    message: 'needs work',
                });

                await server.close();
            });

            test('should timeout when client disconnects without decision', async () => {
                const socketInfo = useTestSocket('ipc-decision-timeout');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const decisionPromise = server.waitForDecision(1); // 1 second timeout

                const client = net.connect(socketInfo.path);
                await new Promise((resolve) => client.on('connect', resolve));

                client.write('{"type":"get_plan"}\n');
                await new Promise((resolve) => client.on('data', resolve));

                // Client disconnects without sending decision
                client.destroy();

                const decision = await decisionPromise;
                expect(decision.type).toBe('error');
                if (decision.type === 'error') {
                    expect(decision.error).toContain('Timeout');
                }

                await server.close();
            });

            test('should throw when waitForDecision called before start', async () => {
                const server = new PlandersonSocketServer('/tmp/not-started.sock');

                expect(() => server.waitForDecision(1)).toThrow('Server not started');
            });
        });
    });

    describe('PlandersonSocketClient', () => {
        describe('Connection', () => {
            test('should connect to server', async () => {
                const socketInfo = useTestSocket('client-connect');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const client = new PlandersonSocketClient(socketInfo.path);
                await client.connect();

                client.close();
                await server.close();
            });

            test('should reject connection to non-existent socket', async () => {
                const testDir = useTempDir();
                const socketPath = path.join(testDir, 'nonexistent.sock');
                const client = new PlandersonSocketClient(socketPath);

                await expect(client.connect()).rejects.toThrow();
            });
        });

        describe('getPlan', () => {
            test('should retrieve plan content from server', async () => {
                const socketInfo = useTestSocket('client-getplan');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('my test plan content');

                const client = new PlandersonSocketClient(socketInfo.path);
                await client.connect();

                const plan = await client.getPlan();

                expect(plan).toBe('my test plan content');

                client.close();
                await server.close();
            });

            test('should handle plan with special characters and unicode', async () => {
                const socketInfo = useTestSocket('client-getplan-special');
                const specialPlan =
                    '# 🎉 Plan\n\nPlan with\nnewlines and "quotes"\n- 中文 characters\n- spëcial çhars\n- émojis';
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start(specialPlan);

                const client = new PlandersonSocketClient(socketInfo.path);
                await client.connect();

                const plan = await client.getPlan();

                expect(plan).toBe(specialPlan);

                client.close();
                await server.close();
            });

            test('should throw when not connected', async () => {
                const client = new PlandersonSocketClient('/tmp/nonexistent.sock');

                await expect(client.getPlan()).rejects.toThrow('Not connected');
            });
        });

        describe('sendDecision', () => {
            test('should send accept decision', async () => {
                const socketInfo = useTestSocket('client-send-accept');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const client = new PlandersonSocketClient(socketInfo.path);
                await client.connect();
                await client.getPlan();

                const decisionPromise = server.waitForDecision(5);

                client.sendDecision('accept');

                const decision = await decisionPromise;
                expect(decision).toEqual({ type: 'decision', decision: 'accept' });

                client.close();
                await server.close();
            });

            test('should send deny decision with message', async () => {
                const socketInfo = useTestSocket('client-send-deny');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const client = new PlandersonSocketClient(socketInfo.path);
                await client.connect();
                await client.getPlan();

                const decisionPromise = server.waitForDecision(5);

                client.sendDecision('deny', 'needs improvement');

                const decision = await decisionPromise;
                expect(decision).toEqual({
                    type: 'decision',
                    decision: 'deny',
                    message: 'needs improvement',
                });

                client.close();
                await server.close();
            });

            test('should not include message field when message is empty string', async () => {
                const socketInfo = useTestSocket('client-send-empty-msg');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const client = new PlandersonSocketClient(socketInfo.path);
                await client.connect();
                await client.getPlan();

                const decisionPromise = server.waitForDecision(5);

                client.sendDecision('accept', '');

                const decision = await decisionPromise;
                expect(decision).toEqual({ type: 'decision', decision: 'accept' });
                expect(decision).not.toHaveProperty('message');

                client.close();
                await server.close();
            });

            test('should throw when not connected', () => {
                const client = new PlandersonSocketClient('/tmp/test.sock');

                expect(() => client.sendDecision('accept')).toThrow('Not connected');
            });
        });

        describe('close', () => {
            test('should close connection cleanly', async () => {
                const socketInfo = useTestSocket('client-close');
                const server = new PlandersonSocketServer(socketInfo.path);
                await server.start('test plan');

                const client = new PlandersonSocketClient(socketInfo.path);
                await client.connect();
                await client.getPlan();

                expect(() => client.close()).not.toThrow();

                await server.close();
            });

            test('should handle close when not connected', () => {
                const client = new PlandersonSocketClient('/tmp/test.sock');

                expect(() => client.close()).not.toThrow();
            });
        });
    });

    describe('Full workflow integration', () => {
        test('should complete full workflow: connect → getPlan → accept', async () => {
            const socketInfo = useTestSocket('integ-full-accept');
            const server = new PlandersonSocketServer(socketInfo.path);
            await server.start('integration test plan');

            const client = new PlandersonSocketClient(socketInfo.path);

            // Connect
            await client.connect();

            // Get plan
            const plan = await client.getPlan();
            expect(plan).toBe('integration test plan');

            // Send decision
            const decisionPromise = server.waitForDecision(5);
            client.sendDecision('accept');

            // Verify decision received
            const decision = await decisionPromise;
            expect(decision).toEqual({ type: 'decision', decision: 'accept' });

            client.close();
            await server.close();
        });

        test('should complete full workflow: connect → getPlan → deny with feedback', async () => {
            const socketInfo = useTestSocket('integ-full-deny');
            const server = new PlandersonSocketServer(socketInfo.path);
            await server.start('integration test plan');

            const client = new PlandersonSocketClient(socketInfo.path);
            await client.connect();
            const plan = await client.getPlan();
            expect(plan).toBe('integration test plan');

            const decisionPromise = server.waitForDecision(5);
            client.sendDecision('deny', 'More details needed in step 3');

            const decision = await decisionPromise;
            expect(decision).toEqual({
                type: 'decision',
                decision: 'deny',
                message: 'More details needed in step 3',
            });

            client.close();
            await server.close();
        });

        test('should handle multiple sequential workflows on same socket', async () => {
            const socketInfo = useTestSocket('integ-sequential');
            let server = new PlandersonSocketServer(socketInfo.path);
            await server.start('first plan');

            // First workflow
            const client1 = new PlandersonSocketClient(socketInfo.path);
            await client1.connect();
            const plan1 = await client1.getPlan();
            expect(plan1).toBe('first plan');

            const decision1Promise = server.waitForDecision(5);
            client1.sendDecision('accept');
            await decision1Promise;
            client1.close();

            // Wait a bit for cleanup
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Restart server with new plan
            await server.close();
            server = new PlandersonSocketServer(socketInfo.path);
            await server.start('second plan');

            // Second workflow
            const client2 = new PlandersonSocketClient(socketInfo.path);
            await client2.connect();
            const plan2 = await client2.getPlan();
            expect(plan2).toBe('second plan');

            const decision2Promise = server.waitForDecision(5);
            client2.sendDecision('deny', 'needs revision');
            const decision2 = await decision2Promise;
            expect(decision2.type).toBe('decision');
            if (decision2.type === 'decision') {
                expect(decision2.message).toBe('needs revision');
            }

            client2.close();
            await server.close();
        });

        test('should handle large plan content in full workflow', async () => {
            const socketInfo = useTestSocket('integ-large-plan');
            const largePlan = 'x'.repeat(100000);
            const server = new PlandersonSocketServer(socketInfo.path);
            await server.start(largePlan);

            const client = new PlandersonSocketClient(socketInfo.path);
            await client.connect();
            const plan = await client.getPlan();
            expect(plan).toBe(largePlan);

            const decisionPromise = server.waitForDecision(5);
            client.sendDecision('accept');
            await decisionPromise;

            client.close();
            await server.close();
        });

        test('should reject second PlandersonSocketClient when one is already connected', async () => {
            const socketInfo = useTestSocket('integ-second-client');
            const server = new PlandersonSocketServer(socketInfo.path);
            await server.start('test plan');

            // First client connects and gets plan
            const client1 = new PlandersonSocketClient(socketInfo.path);
            await client1.connect();
            await client1.getPlan();

            // Second client connects (TCP connection succeeds)
            const client2 = new PlandersonSocketClient(socketInfo.path);
            await client2.connect();

            // Server rejects second client - getPlan receives the error
            await expect(client2.getPlan()).rejects.toThrow('Another client is already connected');

            client1.close();
            await server.close();
        }, 10000);
    });
});
