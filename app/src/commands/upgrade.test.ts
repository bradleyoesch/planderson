import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as childProcess from 'child_process';

import * as settingsModule from '~/utils/config/settings';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

import {
    categorizeVersionBump,
    fetchLatestVersion,
    isNewerVersion,
    RELEASES_URL,
    runSilentUpgrade,
    runUpgrade,
    shouldAutoUpgrade,
    stripVersionPrefix,
} from './upgrade';

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

    describe('categorizeVersionBump', () => {
        test('returns patch when only patch differs', () => {
            expect(categorizeVersionBump('1.2.4', '1.2.3')).toBe('patch');
        });

        test('returns minor when minor differs', () => {
            expect(categorizeVersionBump('1.3.0', '1.2.3')).toBe('minor');
        });

        test('returns major when major differs', () => {
            expect(categorizeVersionBump('2.0.0', '1.9.9')).toBe('major');
        });
    });

    describe('shouldAutoUpgrade', () => {
        test('returns false when setting is none', () => {
            expect(shouldAutoUpgrade('none', '1.2.4', '1.2.3')).toBe(false);
        });

        test('returns true for patch bump with setting patch', () => {
            expect(shouldAutoUpgrade('patch', '1.2.4', '1.2.3')).toBe(true);
        });

        test('returns false for minor bump with setting patch', () => {
            expect(shouldAutoUpgrade('patch', '1.3.0', '1.2.3')).toBe(false);
        });

        test('returns false for major bump with setting minor', () => {
            expect(shouldAutoUpgrade('minor', '2.0.0', '1.9.9')).toBe(false);
        });

        test('returns true for major bump with setting all', () => {
            expect(shouldAutoUpgrade('all', '2.0.0', '1.9.9')).toBe(true);
        });

        test('returns true for minor bump with setting minor', () => {
            expect(shouldAutoUpgrade('minor', '1.3.0', '1.2.3')).toBe(true);
        });
    });

    describe('runSilentUpgrade', () => {
        test('returns success when spawn exits with code 0', async () => {
            const mockOn = mock((event: string, cb: (code: number) => void) => {
                if (event === 'close') cb(0);
                return mockChild;
            });
            const mockChild = { on: mockOn };
            spyOn(childProcess, 'spawn').mockReturnValue(mockChild as unknown as ReturnType<typeof childProcess.spawn>);

            const result = await runSilentUpgrade();
            expect(result).toBe('success');
        });

        test('returns failure when spawn exits with non-zero code', async () => {
            const mockOn = mock((event: string, cb: (code: number) => void) => {
                if (event === 'close') cb(1);
                return mockChild;
            });
            const mockChild = { on: mockOn };
            spyOn(childProcess, 'spawn').mockReturnValue(mockChild as unknown as ReturnType<typeof childProcess.spawn>);

            const result = await runSilentUpgrade();
            expect(result).toBe('failure');
        });
    });

    describe('runUpgrade', () => {
        let consoleLogs: string[];
        let consoleWarns: string[];
        let originalConsoleLog: typeof console.log;
        let originalConsoleWarn: typeof console.warn;
        let originalProcessExit: typeof process.exit;

        beforeEach(() => {
            consoleLogs = [];
            consoleWarns = [];
            originalConsoleLog = console.log;
            originalConsoleWarn = console.warn;
            originalProcessExit = process.exit;

            console.log = (msg: string) => {
                consoleLogs.push(msg);
            };
            console.warn = (msg: string) => {
                consoleWarns.push(msg);
            };
            process.exit = mock(() => {
                throw new Error('process.exit called');
            }) as unknown as typeof process.exit;
        });

        afterEach(() => {
            console.log = originalConsoleLog;
            console.warn = originalConsoleWarn;
            process.exit = originalProcessExit;
            mock.restore();
        });

        test('shows releases link when already on latest', async () => {
            const currentVer = (await import('../../../package.json')).version;
            globalThis.fetch = mock(() =>
                Promise.resolve({
                    url: `https://github.com/bradleyoesch/planderson/releases/tag/v${currentVer}`,
                } as Response),
            ) as unknown as typeof fetch;
            spyOn(settingsModule, 'loadSettings').mockReturnValue(DEFAULT_SETTINGS);

            try {
                await runUpgrade();
            } catch {
                // process.exit throws in test
            }

            expect(consoleLogs.some((l) => l.includes(RELEASES_URL))).toBe(true);
        });

        test('shows tip when autoUpgradeVersion is none', async () => {
            const currentVer = (await import('../../../package.json')).version;
            globalThis.fetch = mock(() =>
                Promise.resolve({
                    url: `https://github.com/bradleyoesch/planderson/releases/tag/v${currentVer}`,
                } as Response),
            ) as unknown as typeof fetch;
            spyOn(settingsModule, 'loadSettings').mockReturnValue({
                ...DEFAULT_SETTINGS,
                autoUpgradeVersion: 'none',
            });

            try {
                await runUpgrade();
            } catch {
                // process.exit throws in test
            }

            expect(consoleLogs.some((l) => l.includes('planderson settings --autoUpgradeVersion all'))).toBe(true);
        });

        test('does not show tip when autoUpgradeVersion is all', async () => {
            const currentVer = (await import('../../../package.json')).version;
            globalThis.fetch = mock(() =>
                Promise.resolve({
                    url: `https://github.com/bradleyoesch/planderson/releases/tag/v${currentVer}`,
                } as Response),
            ) as unknown as typeof fetch;
            spyOn(settingsModule, 'loadSettings').mockReturnValue({
                ...DEFAULT_SETTINGS,
                autoUpgradeVersion: 'all',
            });

            try {
                await runUpgrade();
            } catch {
                // process.exit throws in test
            }

            expect(consoleLogs.some((l) => l.includes('planderson settings --autoUpgradeVersion all'))).toBe(false);
        });
    });
});
