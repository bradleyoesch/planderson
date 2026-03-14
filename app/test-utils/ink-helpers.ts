/**
 * ANSI Escape Codes for Simulating Keyboard Input in Ink Tests
 *
 * Use with ink-testing-library's stdin.write() to simulate real user input.
 *
 * Example:
 * ```typescript
 * const { stdin } = render(<MyComponent />);
 * stdin.write(Keys.UP_ARROW);
 * stdin.write(Keys.ENTER);
 * stdin.write('c'); // regular character
 * ```
 */

export const Keys = {
    // Arrow Keys
    UP_ARROW: '\x1b[A',
    DOWN_ARROW: '\x1b[B',
    RIGHT_ARROW: '\x1b[C',
    LEFT_ARROW: '\x1b[D',

    // Shift + Arrow Keys
    SHIFT_UP: '\x1b[1;2A',
    SHIFT_DOWN: '\x1b[1;2B',
    SHIFT_RIGHT: '\x1b[1;2C',
    SHIFT_LEFT: '\x1b[1;2D',

    // Alt + Arrow Keys (word jumping)
    ALT_LEFT: '\x1b\x1b[D',
    ALT_RIGHT: '\x1b\x1b[C',

    // Mac Option + Character (Emacs/readline standard)
    OPT_B: '\x1bb', // Option+b - jump word left
    OPT_F: '\x1bf', // Option+f - jump word right
    OPT_D: '\x1bd', // Option+d - delete word backward

    // Special Keys
    ENTER: '\r',
    ESCAPE: '\x1b',
    TAB: '\t',
    BACKSPACE: '\x7f',
    ALT_BACKSPACE: '\x1b\x7f',
    DELETE: '\x1b[3~',
    ALT_DELETE: '\x1b\x1b[3~', // Option+Delete - delete word backward

    // Ctrl Combinations
    CTRL_A: '\x01',
    CTRL_C: '\x03',
    CTRL_D: '\x04',
    CTRL_E: '\x05',
    CTRL_K: '\x0b',
    CTRL_U: '\x15',
    CTRL_W: '\x17',
    CTRL_Z: '\x1a',

    // Function Keys
    F1: '\x1bOP',
    F2: '\x1bOQ',
    F3: '\x1bOR',
    F4: '\x1bOS',

    // Navigation Keys
    HOME: '\x1b[H',
    END: '\x1b[F',
    PAGE_UP: '\x1b[5~',
    PAGE_DOWN: '\x1b[6~',
} as const;

/**
 * Helper to type text character by character
 */
export const typeText = async function (
    stdin: { write: (data: string) => void },
    text: string,
    options?: { delayMs?: number; enter?: boolean },
): Promise<void> {
    const delayMs = options?.delayMs ?? 5;
    const enter = options?.enter ?? false;

    await [...text].reduce(async (promise, char) => {
        stdin.write(char);
        await promise;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }, Promise.resolve());

    if (enter) {
        // Wait to ensure prior text dispatches have flushed through React before Enter is processed
        await new Promise((resolve) => setTimeout(resolve, 50));
        stdin.write(Keys.ENTER);
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
};

/**
 * Helper to press a special key (from Keys constant) with optional delay
 * Use this for Keys.DOWN_ARROW, Keys.ENTER, etc.
 */
export const typeKey = async function (
    stdin: { write: (data: string) => void },
    key: string,
    options?: { delayMs?: number },
): Promise<void> {
    const delayMs = options?.delayMs ?? 50;

    stdin.write(key);

    if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
};

/**
 * Helper to press a key multiple times
 * Uses a for loop for clarity - each key press waits before the next one
 * Defaults to 5ms delay (faster than single typeKey's 50ms, appropriate for rapid sequences)
 */
export const typeKeys = async function (
    stdin: { write: (data: string) => void },
    key: string,
    count: number,
    options?: { delayMs?: number },
): Promise<void> {
    const delayMs = options?.delayMs ?? 5;

    // eslint-disable-next-line no-restricted-syntax
    for (let i = 0; i < count; i++) {
        await typeKey(stdin, key, { delayMs });
    }
};

/**
 * Extract visible text from terminal output, removing ANSI codes
 */
export const stripAnsi = (str: string): string => {
    return str.replaceAll(/\x1b\[[\d;]*m/g, '');
};

/**
 * Retry an assertion until it passes or timeout.
 * Combines waiting and asserting — no separate expect() needed.
 */
export const waitFor = async (
    assertion: () => void | Promise<void>,
    timeoutMs = 5000,
    pollIntervalMs = 10,
): Promise<void> => {
    const startTime = Date.now();
    while (true) {
        try {
            await assertion();
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            return;
        } catch (e) {
            if (Date.now() - startTime > timeoutMs) {
                throw e;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
};

/**
 * Small delay to allow React/Ink to process updates
 */
export const waitForRender = async function (ms = 0): Promise<void> {
    if (ms > 0) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
    // Even with 0ms, this creates a microtask that allows React to update
    return Promise.resolve();
};
