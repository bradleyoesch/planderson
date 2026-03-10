import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { debounce } from './debounce';

describe('utils debounce', () => {
    let callCount = 0;
    let lastArgs: any[] = [];

    const testFn = (...args: any[]) => {
        callCount++;
        lastArgs = args;
    };

    beforeEach(() => {
        callCount = 0;
        lastArgs = [];
    });

    afterEach(() => {
        // Clean up any pending timers
        // Bun automatically cleans up timers after test
    });

    test('delays function execution until wait period elapses', async () => {
        const debounced = debounce(testFn, 100);

        debounced('test1');
        expect(callCount).toBe(0);

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(callCount).toBe(0);

        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(callCount).toBe(1);
        expect(lastArgs).toEqual(['test1']);
    });

    test('cancels previous call if invoked again within wait period', async () => {
        const debounced = debounce(testFn, 100);

        debounced('test1');
        await new Promise((resolve) => setTimeout(resolve, 50));

        debounced('test2');
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Should still be 0 (neither call has executed)
        expect(callCount).toBe(0);

        await new Promise((resolve) => setTimeout(resolve, 60));

        // Only second call should execute
        expect(callCount).toBe(1);
        expect(lastArgs).toEqual(['test2']);
    });

    test('executes multiple times if wait period elapses between calls', async () => {
        const debounced = debounce(testFn, 50);

        debounced('test1');
        await new Promise((resolve) => setTimeout(resolve, 60));

        expect(callCount).toBe(1);
        expect(lastArgs).toEqual(['test1']);

        debounced('test2');
        await new Promise((resolve) => setTimeout(resolve, 60));

        expect(callCount).toBe(2);
        expect(lastArgs).toEqual(['test2']);
    });

    test('preserves function arguments', async () => {
        const debounced = debounce(testFn, 50);

        debounced('arg1', 'arg2', 123);
        await new Promise((resolve) => setTimeout(resolve, 60));

        expect(callCount).toBe(1);
        expect(lastArgs).toEqual(['arg1', 'arg2', 123]);
    });
});
