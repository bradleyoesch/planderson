import { expect, test } from 'bun:test';

export const TERMINAL_WIDTHS = {
    NARROW: 40,
    STANDARD: 80,
} as const;

export const ALL_WIDTHS = [TERMINAL_WIDTHS.NARROW, TERMINAL_WIDTHS.STANDARD] as const;

/**
 * Test a component at all standard terminal widths.
 * Generates a snapshot for each width automatically.
 */
export const testAtAllWidths = (
    testName: string,
    renderFn: (width: number) => string | undefined | Promise<string | undefined>,
): void => {
    ALL_WIDTHS.forEach((width) => {
        test(`${testName} at ${width} columns`, async () => {
            const output = await renderFn(width);
            expect(normalizeSnapshot(output)).toMatchSnapshot();
        });
    });
};

/** Trim trailing whitespace for consistent snapshot comparison. */
export const normalizeSnapshot = (output: string | undefined): string => {
    return output?.trimEnd() ?? '';
};
