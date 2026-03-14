import { describe, expect, test } from 'bun:test';

import { withTimeout, withTimeoutValue } from './timeout-utils';

describe('lib timeout-utils', () => {
    describe('withTimeout', () => {
        test('should resolve with promise value when promise completes first', async () => {
            const promise = Promise.resolve('success');

            const result = await withTimeout(promise, 1000, new Error('Timeout'));

            expect(result).toBe('success');
        });

        test('should reject with timeout error when timeout occurs first', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 1000));
            const timeoutError = new Error('Timed out');

            await expect(withTimeout(promise, 10, timeoutError)).rejects.toThrow('Timed out');
        });

        test('should accept timeout error as function', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 1000));
            const errorFn = () => new Error('Dynamic timeout error');

            await expect(withTimeout(promise, 10, errorFn)).rejects.toThrow('Dynamic timeout error');
        });

        test('should clear timeout when promise completes first', async () => {
            const promise = Promise.resolve('fast');

            const result = await withTimeout(promise, 100, new Error('Should not fire'));

            expect(result).toBe('fast');

            // Wait a bit to ensure timeout doesn't fire
            await new Promise((resolve) => setTimeout(resolve, 150));
        });

        test('should clear timeout when timeout occurs first', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 1000));

            try {
                await withTimeout(promise, 10, new Error('Timeout'));
            } catch {
                // Expected to throw
            }

            // Wait to ensure no issues after timeout
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        test('should propagate promise rejection when promise rejects before timeout', async () => {
            const promise = Promise.reject(new Error('Promise rejected'));

            await expect(withTimeout(promise, 1000, new Error('Timeout'))).rejects.toThrow('Promise rejected');
        });

        test('should clear timeout when promise rejects', async () => {
            const promise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Fast rejection')), 10);
            });

            try {
                await withTimeout(promise, 1000, new Error('Should not timeout'));
            } catch (err) {
                expect((err as Error).message).toBe('Fast rejection');
            }

            // Wait to ensure timeout was cleared and doesn't fire
            await new Promise((resolve) => setTimeout(resolve, 1100));
        });

        test('should handle immediate timeout (0ms)', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 100));

            await expect(withTimeout(promise, 0, new Error('Immediate timeout'))).rejects.toThrow('Immediate timeout');
        });

        test('should handle negative timeout as immediate timeout', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 100));

            await expect(withTimeout(promise, -1, new Error('Negative timeout'))).rejects.toThrow('Negative timeout');
        });

        test('should handle NaN timeout as immediate timeout', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 100));

            await expect(withTimeout(promise, Number.NaN, new Error('NaN timeout'))).rejects.toThrow('NaN timeout');
        });
    });

    describe('withTimeoutValue', () => {
        test('should resolve with promise value when promise completes first', async () => {
            const promise = Promise.resolve('success');

            const result = await withTimeoutValue(promise, 1000, 'timeout');

            expect(result).toBe('success');
        });

        test('should resolve with timeout value when timeout occurs first', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 1000));

            const result = await withTimeoutValue(promise, 10, 'timed out');

            expect(result).toBe('timed out');
        });

        test('should accept timeout value as function', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 1000));
            const valueFn = () => ({ type: 'timeout', message: 'Timed out' });

            const result = await withTimeoutValue(promise, 10, valueFn);

            expect(result).toEqual({ type: 'timeout', message: 'Timed out' });
        });

        test('should clear timeout when promise completes first', async () => {
            const promise = Promise.resolve({ data: 'fast' });

            const result = await withTimeoutValue(promise, 100, { data: 'slow' });

            expect(result).toEqual({ data: 'fast' });

            // Wait to ensure timeout was cleared
            await new Promise((resolve) => setTimeout(resolve, 150));
        });

        test('should propagate promise rejection when promise rejects before timeout', async () => {
            const promise = Promise.reject(new Error('Promise rejected'));

            await expect(withTimeoutValue(promise, 1000, 'timeout value')).rejects.toThrow('Promise rejected');
        });

        test('should clear timeout when promise rejects', async () => {
            const promise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Fast rejection')), 10);
            });

            try {
                await withTimeoutValue(promise, 1000, 'should not use this');
            } catch (err) {
                expect((err as Error).message).toBe('Fast rejection');
            }

            // Wait to ensure timeout was cleared and doesn't fire
            await new Promise((resolve) => setTimeout(resolve, 1100));
        });

        test('should handle immediate timeout (0ms)', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 100));

            const result = await withTimeoutValue(promise, 0, 'immediate');

            expect(result).toBe('immediate');
        });

        test('should handle negative timeout as immediate timeout', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 100));

            const result = await withTimeoutValue(promise, -1, 'negative');

            expect(result).toBe('negative');
        });

        test('should handle NaN timeout as immediate timeout', async () => {
            const promise = new Promise((resolve) => setTimeout(resolve, 100));

            const result = await withTimeoutValue(promise, Number.NaN, 'nan');

            expect(result).toBe('nan');
        });
    });
});
