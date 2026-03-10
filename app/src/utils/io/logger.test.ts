import { afterEach, describe, expect, test } from 'bun:test';

import { logError, logEvent, logRawError, resetWriteFunction, setWriteFunction } from '~/utils/io/logger';

const captureLogs = (fn: () => void): string[] => {
    const logs: string[] = [];

    setWriteFunction((_file: string, data: string) => {
        logs.push(data);
    });

    try {
        fn();
    } finally {
        resetWriteFunction();
    }

    return logs;
};

const captureLogWrites = (fn: () => void): Array<{ file: string; data: string }> => {
    const writes: Array<{ file: string; data: string }> = [];

    setWriteFunction((file: string, data: string) => {
        writes.push({ file, data });
    });

    try {
        fn();
    } finally {
        resetWriteFunction();
    }

    return writes;
};

describe('io logger', () => {
    describe('logEvent', () => {
        afterEach(() => {
            // Ensure write function is reset even if test fails
            resetWriteFunction();
        });

        test('should log INFO level for non-error events', () => {
            const logs = captureLogs(() => {
                logEvent('filename', 'test123', 'process.started');
            });

            expect(logs).toHaveLength(1);
            expect(logs[0]).toContain('INFO');
            expect(logs[0]).toContain('test123');
            expect(logs[0]).toContain('process.started');
            expect(logs[0]).toContain('filename');
        });

        test('should log INFO level for all events', () => {
            const logs = captureLogs(() => {
                logEvent('filename', 'test123', 'process.errored', 'connection failed');
            });

            expect(logs).toHaveLength(1);
            expect(logs[0]).toContain('INFO');
            expect(logs[0]).toContain('process.errored');
            expect(logs[0]).toContain('connection failed');
        });

        test('should include metadata when provided', () => {
            const logs = captureLogs(() => {
                logEvent('filename', 'test123', 'process.exited', 'user cancelled');
            });

            expect(logs[0]).toContain(' - user cancelled');
        });

        test('should include ISO timestamp within reasonable time window', () => {
            const beforeTime = new Date();
            const logs = captureLogs(() => {
                logEvent('filename', 'test123', 'process.started');
            });
            const afterTime = new Date();

            const timestamp = logs[0].split(' ')[0];
            const logTime = new Date(timestamp);

            expect(logTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(logTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });

        test('should end with newline character', () => {
            const logs = captureLogs(() => {
                logEvent('filename', 'test123', 'plan.accepted');
            });

            expect(logs[0]).toEndWith('\n');
        });

        test('should extract filename from full path', () => {
            const logs = captureLogs(() => {
                logEvent('/very/long/path/to/plan.md', 'test123', 'process.started');
            });

            expect(logs[0]).toContain('plan.md');
            expect(logs[0]).not.toContain('/very/long/path');
        });

        test('should handle file write failures gracefully without throwing', () => {
            const consoleErrors: unknown[][] = [];
            const originalConsoleError = console.error;

            console.error = (...args: unknown[]) => {
                consoleErrors.push(args);
            };

            setWriteFunction(() => {
                throw new Error('Disk full');
            });

            expect(() => {
                logEvent('filename', 'test123', 'process.started');
            }).not.toThrow();

            resetWriteFunction();
            console.error = originalConsoleError;

            expect(consoleErrors.length).toBeGreaterThan(0);
            expect(consoleErrors[0][0]).toContain('Failed to write to log file');
        });

        test('should log multiple events sequentially', () => {
            const logs = captureLogs(() => {
                logEvent('filename', 'session1', 'process.started');
                logEvent('filename', 'session1', 'plan.accepted');
                logEvent('filename', 'session1', 'process.exited');
            });

            expect(logs).toHaveLength(3);
            expect(logs[0]).toContain('process.started');
            expect(logs[1]).toContain('plan.accepted');
            expect(logs[2]).toContain('process.exited');
        });
    });

    describe('logError', () => {
        afterEach(() => {
            resetWriteFunction();
        });

        test('should write to both activity.log and error.log', () => {
            const err = new Error('Connection refused');
            const writes = captureLogWrites(() => {
                logError('filename', 'sess123', 'socket.errored', err);
            });

            expect(writes).toHaveLength(2);
            // First write is activity.log, second is error.log
            expect(writes[0].file).toContain('activity.log');
            expect(writes[1].file).toContain('error.log');
        });

        test('should include ERROR level and event in activity.log entry', () => {
            const err = new Error('test error');
            const writes = captureLogWrites(() => {
                logError('/path/to/plan.md', 'sess123', 'decision.errored', err);
            });

            expect(writes[0].data).toContain('ERROR');
            expect(writes[0].data).toContain('decision.errored');
            expect(writes[0].data).toContain('sess123');
            expect(writes[0].data).toContain('plan.md');
        });

        test('should include stacktrace in error.log entry', () => {
            const err = new Error('Stack trace test');
            const writes = captureLogWrites(() => {
                logError('filename', 'sess123', 'signal.errored', err);
            });

            expect(writes[1].data).toContain('Stack trace test');
            expect(writes[1].data).toContain('signal.errored');
            expect(writes[1].data).toContain('sess123');
            // Stack trace should contain file reference
            expect(writes[1].data).toContain('logger.test.ts');
        });

        test('should include metadata in activity.log when provided', () => {
            const err = new Error('test');
            const writes = captureLogWrites(() => {
                logError('filename', 'sess123', 'socket.errored', err, 'failed to send decision');
            });

            // Should contain both error message and metadata
            expect(writes[0].data).toContain(' - Error: test failed to send decision');
        });

        test('should not throw when write fails', () => {
            const originalConsoleError = console.error;
            console.error = () => {};

            setWriteFunction(() => {
                throw new Error('Disk full');
            });

            expect(() => {
                logError('filename', 'sess123', 'socket.errored', new Error('test'));
            }).not.toThrow();

            resetWriteFunction();
            console.error = originalConsoleError;
        });
    });

    describe('logRawError', () => {
        afterEach(() => {
            resetWriteFunction();
        });

        test('should write to error.log only', () => {
            const writes = captureLogWrites(() => {
                logRawError('Socket connection timeout');
            });

            expect(writes).toHaveLength(1);
            expect(writes[0].file).toContain('error.log');
        });

        test('should include message and timestamp', () => {
            const writes = captureLogWrites(() => {
                logRawError('Replacing stale connection');
            });

            expect(writes[0].data).toContain('Replacing stale connection');
            expect(writes[0].data).toMatch(/^\[.*T.*Z]/);
        });

        test('should include stacktrace when error is provided', () => {
            const err = new Error('Connection refused');
            const writes = captureLogWrites(() => {
                logRawError('Socket error', err);
            });

            expect(writes[0].data).toContain('Socket error');
            expect(writes[0].data).toContain('Connection refused');
            expect(writes[0].data).toContain('logger.test.ts');
        });

        test('should not throw when write fails', () => {
            const originalConsoleError = console.error;
            console.error = () => {};

            setWriteFunction(() => {
                throw new Error('Disk full');
            });

            expect(() => {
                logRawError('test message');
            }).not.toThrow();

            resetWriteFunction();
            console.error = originalConsoleError;
        });
    });
});
