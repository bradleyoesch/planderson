/**
 * Provides a sanitized environment for tests that prevents interference
 * with the developer's real tmux session.
 *
 * Use this when spawning processes in tests that might interact with tmux.
 */

/**
 * Returns a safe environment object for tests that explicitly clears
 * TMUX and TMUX_PANE variables to prevent spawned processes from
 * interacting with the developer's actual tmux session.
 *
 * @param overrides - Additional environment variables to set or override
 * @returns Environment object safe for test process spawning
 *
 * @example
 * ```typescript
 * execSync('command', {
 *     env: getSafeTestEnv({ HOME: TEST_HOME }),
 * });
 * ```
 */
export const getSafeTestEnv = (
    overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> => {
    return {
        ...process.env,
        TMUX: undefined, // Clear real tmux socket
        TMUX_PANE: undefined, // Clear real pane ID
        ...overrides,
    };
};
