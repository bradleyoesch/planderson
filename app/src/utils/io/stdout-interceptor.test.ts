import { describe, expect, test } from 'bun:test';

import { createWriteInterceptor } from './stdout-interceptor';

/**
 * Unit tests for the stdout write interceptor.
 *
 * The core invariant: log-update always appends '\n' to content. That trailing '\n'
 * scrolls the terminal when content fills all rows. The interceptor strips it.
 *
 * Two cases:
 *   First render  - eraseLines(0) = "" → data is plain content + '\n' (no \x1b[2K prefix)
 *   Later renders - eraseLines(N) → data starts with '\x1b[2K'
 */
describe('io stdout-interceptor', () => {
    describe('first render (log-update eraseLines(0) = "")', () => {
        test('strips trailing \\n to prevent terminal scroll', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            // log-update first render: eraseLines(0)="" → just content + '\n'
            intercept('line1\nline2\nline3\n');

            expect(written).toHaveLength(1);
            const result = written[0] as string;
            expect(result).not.toEndWith('\n');
        });

        test('preserves content and appends \\x1b[K\\x1b[J to clear stale content', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            intercept('line1\nline2\nline3\n');

            const result = written[0] as string;
            expect(result).toStartWith('line1\nline2\nline3');
            expect(result).toEndWith('\x1b[K\x1b[J');
        });

        test('only applies to first render, not subsequent non-\x1b[2K writes', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            // First render — intercepted
            intercept('first\n');
            written.length = 0;

            // Second write with no \x1b[2K — falls through unchanged
            intercept('other write\n');

            expect(written[0]).toBe('other write\n');
        });
    });

    describe('subsequent renders (log-update eraseLines(N) starts with \\x1b[2K)', () => {
        test('strips trailing \\n to prevent terminal scroll', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            // Advance past first render
            intercept('first\n');
            written.length = 0;

            // eraseLines(3): 2 cursor-ups + content + '\n'
            const eraseLines3 = '\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[G';
            intercept(`${eraseLines3}line1\nline2\nline3\n`);

            const result = written[0] as string;
            expect(result).not.toEndWith('\n');
        });

        test('uses cursor-reposition (\\x1b[...F or \\r) instead of erase sequences', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            intercept('first\n');
            written.length = 0;

            // eraseLines(3) has 2 cursor-ups → linesUp = 1 → \x1b[1F
            const eraseLines3 = '\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[G';
            intercept(`${eraseLines3}line1\nline2\nline3\n`);

            const result = written[0] as string;
            expect(result).toStartWith('\x1b[1F');
            // Must not start with an erase sequence
            expect(result).not.toStartWith('\x1b[2K');
        });

        test('adds \\x1b[K to each line to clear stale characters', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            intercept('first\n');
            written.length = 0;

            const eraseLines3 = '\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[G';
            intercept(`${eraseLines3}line1\nline2\nline3\n`);

            const result = written[0] as string;
            // Each internal newline should be preceded by \x1b[K
            expect(result).toContain('\x1b[K\n');
            expect(result).toEndWith('\x1b[K\x1b[J');
        });

        test('works when called without a prior first render (isFirstRender already cleared by \x1b[2K)', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            // Direct \x1b[2K write without prior first-render write — still handled correctly
            const eraseLines1 = '\x1b[2K\x1b[G';
            intercept(`${eraseLines1}content\n`);

            const result = written[0] as string;
            expect(result).not.toEndWith('\n');
            expect(result).toEndWith('\x1b[K\x1b[J');
        });
    });

    describe('binary data', () => {
        test('passes Uint8Array through unchanged', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            const data = new Uint8Array([1, 2, 3]);
            intercept(data);

            expect(written[0]).toBe(data);
        });
    });

    describe('edge cases', () => {
        test('string without trailing \\n falls through unchanged', () => {
            const written: (string | Uint8Array)[] = [];
            const intercept = createWriteInterceptor((d) => {
                written.push(d);
                return true;
            });

            intercept('no newline here');

            expect(written[0]).toBe('no newline here');
        });

        test('returns the rawWrite return value', () => {
            const intercept = createWriteInterceptor(() => false);
            expect(intercept('content\n')).toBe(false);
        });
    });
});
