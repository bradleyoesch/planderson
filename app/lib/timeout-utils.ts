/**
 * Timeout utility functions for managing timeouts with automatic cleanup.
 */

/**
 * Race a promise against a timeout with automatic cleanup.
 * The timeout is always cleared after the race completes, preventing timer leaks.
 *
 * @param promise - The promise to race
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutError - Error to reject with on timeout (or function that returns error)
 * @returns Promise that resolves/rejects with the original promise or timeout
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   new Error('Request timed out after 5 seconds')
 * );
 * ```
 */
export const withTimeout = <T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutError: Error | (() => Error),
): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    // Clamp negative and NaN timeouts to 0 to avoid runtime warnings
    // Note: Math.max(0, NaN) === NaN, so NaN must be handled explicitly
    const normalizedTimeout = Number.isNaN(timeoutMs) ? 0 : Math.max(0, timeoutMs);

    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = typeof timeoutError === 'function' ? timeoutError() : timeoutError;
            reject(error);
        }, normalizedTimeout);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId!);
    });
};

/**
 * Race a promise against a timeout with automatic cleanup, resolving with a value on timeout.
 * Similar to withTimeout, but resolves instead of rejecting on timeout.
 *
 * @param promise - The promise to race
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutValue - Value to resolve with on timeout (or function that returns value)
 * @returns Promise that resolves with the original promise result or timeout value
 *
 * @example
 * ```typescript
 * const result = await withTimeoutValue(
 *   fetchData(),
 *   5000,
 *   { type: 'error', error: 'Timeout' }
 * );
 * ```
 */
export const withTimeoutValue = <T, U = T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutValue: U | (() => U),
): Promise<T | U> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    // Clamp negative and NaN timeouts to 0 to avoid runtime warnings
    // Note: Math.max(0, NaN) === NaN, so NaN must be handled explicitly
    const normalizedTimeout = Number.isNaN(timeoutMs) ? 0 : Math.max(0, timeoutMs);

    const timeoutPromise = new Promise<U>((resolve) => {
        timeoutId = setTimeout(() => {
            const value = typeof timeoutValue === 'function' ? (timeoutValue as () => U)() : timeoutValue;
            resolve(value);
        }, normalizedTimeout);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId!);
    });
};
