import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import fs from 'fs';
import * as os from 'os';
import path from 'path';

import { useTempDir } from '~/test-utils/fixtures';
import { resetWriteFunction, setWriteFunction } from '~/utils/io/logger';

import * as settings from './settings';
import { DEFAULT_SETTINGS } from './settings';

describe('config settings', () => {
    let settingsPath: string;
    const testSessionId = 'test-session';
    let tempHomeDir: string;

    beforeEach(() => {
        // Use temp directory as fake home to prevent reading/writing real settings files
        tempHomeDir = useTempDir();

        // Mock home dir so getPlandersonBaseDir() falls back to tempHomeDir/.planderson
        spyOn(os, 'homedir').mockReturnValue(tempHomeDir);

        // Silence the logger
        setWriteFunction(() => {});

        // Now getSettingsPath() will return tempHomeDir/.planderson/settings.json
        settingsPath = settings.getSettingsPath();

        // Pre-create the .planderson dir so tests can write directly to settingsPath
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    });

    afterEach(() => {
        resetWriteFunction();
        // Cleanup handled by useTempDir fixture
        mock.restore();
    });

    describe('getSettingsPath', () => {
        test('returns path in .planderson directory', () => {
            const result = settings.getSettingsPath();
            expect(result).toContain('.planderson');
            expect(result).toContain('settings.json');
        });

        test('returns absolute path', () => {
            const result = settings.getSettingsPath();
            expect(path.isAbsolute(result)).toBe(true);
        });
    });

    describe('loadSettings', () => {
        test('returns defaults when file does not exist', () => {
            const result = settings.loadSettings(testSessionId);
            expect(result).toEqual(DEFAULT_SETTINGS);
        });

        test('loads valid settings from file', () => {
            fs.writeFileSync(
                settingsPath,
                JSON.stringify({
                    approveAction: 'exit',
                }),
            );

            const result = settings.loadSettings(testSessionId);
            expect(result).toEqual({
                approveAction: 'exit',
                launchMode: 'manual',
            });
        });

        test('applies defaults for missing fields', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({}));

            const result = settings.loadSettings(testSessionId);
            expect(result).toEqual(DEFAULT_SETTINGS);
        });

        test('throws error for malformed JSON', () => {
            fs.writeFileSync(settingsPath, 'not valid json {{{');

            expect(() => settings.loadSettings(testSessionId)).toThrow('Invalid JSON in settings.json');
        });

        test('throws error for invalid schema', () => {
            fs.writeFileSync(
                settingsPath,
                JSON.stringify({
                    approveAction: 'not-valid',
                }),
            );

            expect(() => settings.loadSettings(testSessionId)).toThrow('Invalid settings.json');
        });

        test('throws descriptive error with field path for Zod errors', () => {
            fs.writeFileSync(
                settingsPath,
                JSON.stringify({
                    approveAction: 'not-valid',
                }),
            );

            try {
                settings.loadSettings(testSessionId);
                throw new Error('Expected settings.loadSettings(testSessionId) to throw');
            } catch (err) {
                expect(err instanceof Error).toBe(true);
                expect((err as Error).message).toContain('Invalid settings.json');
                expect((err as Error).message).toContain('approveAction');
            }
        });

        test('hot-reloads settings on each call', () => {
            fs.writeFileSync(
                settingsPath,
                JSON.stringify({
                    approveAction: 'approve',
                }),
            );
            const result1 = settings.loadSettings(testSessionId);
            expect(result1.approveAction).toBe('approve');

            fs.writeFileSync(
                settingsPath,
                JSON.stringify({
                    approveAction: 'exit',
                }),
            );
            const result2 = settings.loadSettings(testSessionId);
            expect(result2.approveAction).toBe('exit');
        });

        test('handles unknown fields gracefully', () => {
            fs.writeFileSync(
                settingsPath,
                JSON.stringify({
                    approveAction: 'exit',
                    unknownField: 'should be ignored',
                }),
            );

            const result = settings.loadSettings(testSessionId);
            expect(result).toEqual({
                approveAction: 'exit',
                launchMode: 'manual',
            });
            expect(result).not.toHaveProperty('unknownField');
        });

        test('throws error for non-object JSON', () => {
            fs.writeFileSync(settingsPath, JSON.stringify('string value'));

            expect(() => settings.loadSettings(testSessionId)).toThrow('Invalid settings.json');
        });

        test('throws error for array JSON', () => {
            fs.writeFileSync(settingsPath, JSON.stringify([1, 2, 3]));

            expect(() => settings.loadSettings(testSessionId)).toThrow('Invalid settings.json');
        });
    });

    describe('DEFAULT_SETTINGS', () => {
        test('has expected default values', () => {
            expect(DEFAULT_SETTINGS).toEqual({
                approveAction: 'approve',
                launchMode: 'manual',
            });
        });

        test('matches SettingsSchema defaults', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({}));

            const result = settings.loadSettings(testSessionId);
            expect(result).toEqual(DEFAULT_SETTINGS);
        });
    });

    describe('PLANDERSON_BASE_DIR settings', () => {
        afterEach(() => {
            delete process.env.PLANDERSON_BASE_DIR;
        });

        test('loads settings from PLANDERSON_BASE_DIR/settings.json when PLANDERSON_BASE_DIR is set', () => {
            const customBase = path.join(tempHomeDir, 'custom-base');
            fs.mkdirSync(customBase, { recursive: true });
            fs.writeFileSync(path.join(customBase, 'settings.json'), JSON.stringify({ launchMode: 'auto-tmux' }));
            process.env.PLANDERSON_BASE_DIR = customBase;

            const result = settings.loadSettings(testSessionId);
            expect(result.launchMode).toBe('auto-tmux');
        });

        test('loads settings from ~/.planderson/settings.json when PLANDERSON_BASE_DIR not set', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({ launchMode: 'manual' }));

            const result = settings.loadSettings(testSessionId);
            expect(result.launchMode).toBe('manual');
        });

        test('reads from PLANDERSON_BASE_DIR, not ~/.planderson, when PLANDERSON_BASE_DIR is set', () => {
            // prod path has different value
            fs.writeFileSync(settingsPath, JSON.stringify({ launchMode: 'auto-tmux' }));

            const customBase = path.join(tempHomeDir, 'custom-base');
            fs.mkdirSync(customBase, { recursive: true });
            fs.writeFileSync(path.join(customBase, 'settings.json'), JSON.stringify({ launchMode: 'manual' }));
            process.env.PLANDERSON_BASE_DIR = customBase;

            const result = settings.loadSettings(testSessionId);
            expect(result.launchMode).toBe('manual');
        });

        test('returns defaults when PLANDERSON_BASE_DIR settings file does not exist', () => {
            const customBase = path.join(tempHomeDir, 'empty-base');
            fs.mkdirSync(customBase, { recursive: true });
            process.env.PLANDERSON_BASE_DIR = customBase;

            const result = settings.loadSettings(testSessionId);
            expect(result).toEqual(DEFAULT_SETTINGS);
        });
    });

    describe('launchMode setting', () => {
        test('defaults to manual when not specified', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({}));

            const result = settings.loadSettings(testSessionId);
            expect(result.launchMode).toBe('manual');
        });

        test('accepts auto-tmux value', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({ launchMode: 'auto-tmux' }));

            const result = settings.loadSettings(testSessionId);
            expect(result.launchMode).toBe('auto-tmux');
        });

        test('rejects invalid launch mode values', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({ launchMode: 'invalid' }));

            expect(() => settings.loadSettings(testSessionId)).toThrow('Invalid settings.json');
        });
    });

    describe('approveAction setting', () => {
        test('defaults to approve when not specified', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({}));

            const result = settings.loadSettings(testSessionId);
            expect(result.approveAction).toBe('approve');
        });

        test('accepts exit value', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({ approveAction: 'exit' }));

            const result = settings.loadSettings(testSessionId);
            expect(result.approveAction).toBe('exit');
        });

        test('rejects invalid approveAction values', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({ approveAction: 'invalid' }));

            expect(() => settings.loadSettings(testSessionId)).toThrow('Invalid settings.json');
        });
    });

    describe('saveSettings', () => {
        afterEach(() => {
            delete process.env.PLANDERSON_BASE_DIR;
        });

        test('creates file when none exists', () => {
            const result = settings.saveSettings(testSessionId, { launchMode: 'auto-tmux' });

            expect(fs.existsSync(settingsPath)).toBe(true);
            expect(result.launchMode).toBe('auto-tmux');
        });

        test('merges with existing settings, preserving unspecified keys', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({ launchMode: 'auto-tmux', approveAction: 'exit' }));

            settings.saveSettings(testSessionId, { launchMode: 'manual' });

            const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            expect(saved.launchMode).toBe('manual');
            expect(saved.approveAction).toBe('exit');
        });

        test('only overwrites specified keys', () => {
            fs.writeFileSync(settingsPath, JSON.stringify({ launchMode: 'auto-tmux', approveAction: 'exit' }));

            settings.saveSettings(testSessionId, { approveAction: 'approve' });

            const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            expect(saved.launchMode).toBe('auto-tmux');
            expect(saved.approveAction).toBe('approve');
        });

        test('throws on invalid value', () => {
            expect(() => settings.saveSettings(testSessionId, { launchMode: 'notvalid' as 'auto-tmux' })).toThrow(
                'Invalid settings.json',
            );
        });

        test('creates parent directory if missing', () => {
            // settingsPath is inside tempHomeDir/.planderson/ — remove it to test creation
            fs.rmSync(path.dirname(settingsPath), { recursive: true, force: true });

            settings.saveSettings(testSessionId, { launchMode: 'auto-tmux' });

            expect(fs.existsSync(settingsPath)).toBe(true);
        });

        test('returns validated settings object', () => {
            const result = settings.saveSettings(testSessionId, { approveAction: 'exit' });

            expect(result).toMatchObject({ approveAction: 'exit', launchMode: 'manual' });
        });

        test('writes to PLANDERSON_BASE_DIR/settings.json when PLANDERSON_BASE_DIR is set', () => {
            const customBase = path.join(tempHomeDir, 'custom-base');
            fs.mkdirSync(customBase, { recursive: true });
            process.env.PLANDERSON_BASE_DIR = customBase;

            settings.saveSettings(testSessionId, { launchMode: 'auto-tmux' });

            const customSettingsPath = path.join(customBase, 'settings.json');
            expect(fs.existsSync(customSettingsPath)).toBe(true);
            const saved = JSON.parse(fs.readFileSync(customSettingsPath, 'utf-8'));
            expect(saved.launchMode).toBe('auto-tmux');
        });
    });

    describe('SETTINGS_DOCS', () => {
        test('has an entry for every Settings key', () => {
            const schemaKeys = Object.keys(settings.DEFAULT_SETTINGS) as (keyof settings.Settings)[];
            schemaKeys.forEach((key) => {
                expect(settings.SETTINGS_DOCS).toHaveProperty(key);
            });
        });

        test('each entry has validValues and description', () => {
            Object.values(settings.SETTINGS_DOCS).forEach((doc) => {
                expect(Array.isArray(doc.validValues)).toBe(true);
                expect(doc.validValues.length).toBeGreaterThan(0);
                expect(typeof doc.validValues[0].value).toBe('string');
                expect(typeof doc.validValues[0].description).toBe('string');
                expect(typeof doc.description).toBe('string');
                expect(doc.description.length).toBeGreaterThan(0);
            });
        });

        test('launchMode validValues match schema', () => {
            expect(settings.SETTINGS_DOCS.launchMode.validValues).toEqual([
                {
                    value: 'manual',
                    description: 'Requires manual launch of TUI either directly or through integrations',
                },
                { value: 'auto-tmux', description: 'Automatically launches TUI in tmux pane when a plan is ready' },
            ]);
        });

        test('approveAction validValues match schema', () => {
            expect(settings.SETTINGS_DOCS.approveAction.validValues).toEqual([
                { value: 'approve', description: 'Submits the plan for Claude to continue executing' },
                {
                    value: 'exit',
                    description: 'On approve, exits the TUI',
                },
            ]);
        });
    });
});
