/**
 * Debounce function - delays execution until after wait period has elapsed
 * since last call. Useful for rate-limiting expensive operations like resize handlers.
 */
// eslint-disable-next-line func-style
export function debounce<T extends (...args: never[]) => void>(
    func: T,
    wait: number,
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function debounced(...args: Parameters<T>) {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
        }, wait);
    };
}
