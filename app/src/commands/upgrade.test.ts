import { describe, expect, mock, test } from 'bun:test';

import { fetchLatestVersion, stripVersionPrefix } from './upgrade';

describe('commands upgrade', () => {
    describe('stripVersionPrefix', () => {
        test('strips v prefix', () => expect(stripVersionPrefix('v0.3.0')).toBe('0.3.0'));
        test('no-ops without v prefix', () => expect(stripVersionPrefix('0.3.0')).toBe('0.3.0'));
    });

    describe('fetchLatestVersion', () => {
        test('extracts version from redirect url', async () => {
            const originalFetch = globalThis.fetch;
            globalThis.fetch = mock(() =>
                Promise.resolve({ url: 'https://github.com/bradleyoesch/planderson/releases/tag/v1.2.3' } as Response),
            ) as unknown as typeof fetch;

            try {
                const result = await fetchLatestVersion();
                expect(result).toBe('1.2.3');
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        test('returns null when url has no tag segment', async () => {
            const originalFetch = globalThis.fetch;
            globalThis.fetch = mock(() => Promise.resolve({ url: '' } as Response)) as unknown as typeof fetch;

            try {
                const result = await fetchLatestVersion();
                expect(result).toBeNull();
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });
});
