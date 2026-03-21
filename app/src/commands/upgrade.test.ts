import { describe, expect, mock, test } from 'bun:test';

import { fetchLatestVersion, isNewerVersion, stripVersionPrefix } from './upgrade';

describe('commands upgrade', () => {
    describe('stripVersionPrefix', () => {
        test('strips v prefix', () => expect(stripVersionPrefix('v0.3.0')).toBe('0.3.0'));
        test('no-ops without v prefix', () => expect(stripVersionPrefix('0.3.0')).toBe('0.3.0'));
    });

    describe('isNewerVersion', () => {
        test('returns true when patch is higher', () => expect(isNewerVersion('1.2.4', '1.2.3')).toBe(true));
        test('returns true when minor is higher', () => expect(isNewerVersion('1.3.0', '1.2.3')).toBe(true));
        test('returns true when major is higher', () => expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true));
        test('returns false when versions are equal', () => expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false));
        test('returns false when latest is older', () => expect(isNewerVersion('1.2.2', '1.2.3')).toBe(false));
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
