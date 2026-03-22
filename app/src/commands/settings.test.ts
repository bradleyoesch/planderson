import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import fs from 'fs';
import * as os from 'os';
import path from 'path';

import { useTempDir } from '~/test-utils/fixtures';
import { SETTINGS_DOCS } from '~/utils/config/settings';
import { resetWriteFunction, setWriteFunction } from '~/utils/io/logger';

import { runSettings } from './settings';

describe('commands settings', () => {
    let logs: string[];
    let errors: string[];

    beforeEach(() => {
        logs = [];
        errors = [];

        const tempDir = useTempDir();
        spyOn(os, 'homedir').mockReturnValue(tempDir);
        fs.mkdirSync(path.join(tempDir, '.planderson'), { recursive: true });

        setWriteFunction(() => {});

        spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.map(String).join(' '));
        });
        spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            errors.push(args.map(String).join(' '));
        });
        spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw { isExit: true, exitCode: code ?? 0 };
        }) as (code?: number) => never);
    });

    afterEach(() => {
        resetWriteFunction();
        mock.restore();
    });

    const run = (args: string[]): number => {
        try {
            runSettings(args);
            return -1;
        } catch (e: unknown) {
            const err = e as { isExit?: boolean; exitCode?: number };
            if (err?.isExit) return err.exitCode ?? 0;
            throw e;
        }
    };

    const output = (): string => logs.join('\n');
    const errorOutput = (): string => errors.join('\n');

    describe('display mode', () => {
        test('exits 0 when no args provided', () => {
            expect(run([])).toBe(0);
        });

        test('output contains all settings keys', () => {
            run([]);

            expect(output()).toContain('launchMode');
            expect(output()).toContain('approveAction');
        });

        test('output contains hint to view a setting', () => {
            run([]);

            expect(output()).toContain('To view a setting: `planderson settings --<key>`');
        });

        test('output contains hint to set a setting', () => {
            run([]);

            expect(output()).toContain('To set a setting: `planderson settings --<key> <value>`');
        });

        test('all descriptions start at the same column', () => {
            run([]);

            const settingRows = output()
                .split('\n')
                .filter((line) => line.startsWith('  ') && !line.startsWith('  To ') && line.trim().length > 0);

            const descriptionColumns = settingRows
                .map((line) => {
                    const doc = Object.values(SETTINGS_DOCS).find((d) => line.endsWith(d.description));
                    if (!doc) return null;
                    return line.lastIndexOf(doc.description);
                })
                .filter((col): col is number => col !== null);

            expect(descriptionColumns.length).toBeGreaterThan(0);
            expect(new Set(descriptionColumns).size).toBe(1);
        });
    });

    describe('detail mode', () => {
        test('exits 0 for launchMode', () => {
            expect(run(['--launchMode'])).toBe(0);
        });

        test('shows launchMode header', () => {
            run(['--launchMode']);

            expect(output()).toContain('launchMode');
        });

        test('shows Current value label', () => {
            run(['--launchMode']);

            expect(output()).toContain('Current value');
        });

        test('shows Valid values label', () => {
            run(['--launchMode']);

            expect(output()).toContain('Valid values');
        });

        test('shows Description label', () => {
            run(['--launchMode']);

            expect(output()).toContain('Description');
        });

        test('shows per-value descriptions for launchMode', () => {
            run(['--launchMode']);

            expect(output()).toContain('Automatically launches TUI in tmux pane when a plan is ready');
            expect(output()).toContain('Requires manual launch of TUI either directly or through integrations');
        });

        test('shows To update hint for launchMode', () => {
            run(['--launchMode']);

            expect(output()).toContain('To update:');
            expect(output()).toContain('planderson settings --launchMode <value>');
        });

        test('exits 0 for approveAction', () => {
            expect(run(['--approveAction'])).toBe(0);
        });

        test('shows approveAction detail with per-value descriptions', () => {
            run(['--approveAction']);

            expect(output()).toContain('approveAction');
            expect(output()).toContain('Current value');
            expect(output()).toContain('Valid values');
            expect(output()).toContain('Description');
            expect(output()).toContain('Submits the plan for Claude to continue executing');
            expect(output()).toContain('planderson settings --approveAction <value>');
        });
    });

    describe('detail mode with unknown key', () => {
        test('exits 1 for unknown setting', () => {
            expect(run(['--unknownKey'])).toBe(1);
        });

        test('error output contains Unknown setting message', () => {
            run(['--unknownKey']);

            expect(errorOutput()).toContain("Unknown setting: 'unknownKey'");
        });
    });

    describe('update mode', () => {
        test('exits 0 when setting is updated successfully', () => {
            expect(run(['--launchMode', 'auto-tmux'])).toBe(0);
        });

        test('shows success message with key and value', () => {
            run(['--launchMode', 'auto-tmux']);

            expect(output()).toContain('launchMode');
            expect(output()).toContain('auto-tmux');
        });

        test('exits 1 for invalid value', () => {
            expect(run(['--launchMode', 'invalid'])).toBe(1);
        });
    });
});
