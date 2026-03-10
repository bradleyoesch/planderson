import { describe, expect, test } from 'bun:test';

import { parseSubcommand } from './cli';

describe('src cli', () => {
    describe('parseSubcommand', () => {
        test('returns help with no args', () => {
            const result = parseSubcommand([]);

            expect(result.command).toBe('help');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns help for help subcommand', () => {
            const result = parseSubcommand(['help']);

            expect(result.command).toBe('help');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns help for --help flag', () => {
            const result = parseSubcommand(['--help']);

            expect(result.command).toBe('help');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns help for -h flag', () => {
            const result = parseSubcommand(['-h']);

            expect(result.command).toBe('help');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns version for --version flag', () => {
            const result = parseSubcommand(['--version']);

            expect(result.command).toBe('version');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns version for -v flag', () => {
            const result = parseSubcommand(['-v']);

            expect(result.command).toBe('version');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns hook subcommand with no args', () => {
            const result = parseSubcommand(['hook']);

            expect(result.command).toBe('hook');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns hook subcommand with forwarded args', () => {
            const result = parseSubcommand(['hook', '--session', 'abc123']);

            expect(result.command).toBe('hook');
            expect(result.remainingArgs).toEqual(['--session', 'abc123']);
        });

        test('returns settings subcommand with no args', () => {
            const result = parseSubcommand(['settings']);

            expect(result.command).toBe('settings');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns settings subcommand with forwarded args', () => {
            const result = parseSubcommand(['settings', '--launchMode', 'auto-tmux']);

            expect(result.command).toBe('settings');
            expect(result.remainingArgs).toEqual(['--launchMode', 'auto-tmux']);
        });

        test('returns tui subcommand with no args', () => {
            const result = parseSubcommand(['tui']);

            expect(result.command).toBe('tui');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns tui subcommand with forwarded args', () => {
            const result = parseSubcommand(['tui', '--registry', 'tmux-pane-%1']);

            expect(result.command).toBe('tui');
            expect(result.remainingArgs).toEqual(['--registry', 'tmux-pane-%1']);
        });

        test('returns tmux subcommand with no args', () => {
            const result = parseSubcommand(['tmux']);

            expect(result.command).toBe('tmux');
            expect(result.remainingArgs).toEqual([]);
        });

        test('returns tmux subcommand with forwarded args', () => {
            const result = parseSubcommand(['tmux', '--filepath', 'path/to/file.md']);

            expect(result.command).toBe('tmux');
            expect(result.remainingArgs).toEqual(['--filepath', 'path/to/file.md']);
        });

        test('returns update subcommand with no args', () => {
            expect(parseSubcommand(['update'])).toEqual({ command: 'update', remainingArgs: [] });
        });

        test('returns original string for unknown subcommand', () => {
            const result = parseSubcommand(['unknown']);

            expect(result.command).toBe('unknown');
            expect(result.remainingArgs).toEqual([]);
        });
    });
});
