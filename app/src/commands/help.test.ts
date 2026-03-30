import { describe, expect, test } from 'bun:test';

import { buildHelpText } from './help';

describe('commands help', () => {
    describe('buildHelpText', () => {
        test('returns a string', () => {
            expect(typeof buildHelpText()).toBe('string');
        });

        test('contains usage line with planderson and all commands', () => {
            const output = buildHelpText();

            expect(output).toContain('planderson');
            expect(output).toContain('hook');
            expect(output).toContain('settings');
            expect(output).toContain('tui');
        });

        test('contains KEYBINDINGS section header', () => {
            const output = buildHelpText();

            expect(output).toContain('KEYBINDINGS');
        });

        test('contains keybinding section labels', () => {
            const output = buildHelpText();

            expect(output).toContain('Feedback');
            expect(output).toContain('Navigation');
            expect(output).toContain('Decision');
            expect(output).toContain('Other');
            expect(output).not.toContain('Commands');
        });

        test('contains specific keybindings', () => {
            const output = buildHelpText();

            expect(output).toContain('↑/↓');
            expect(output).toContain(':wq');
            expect(output).toContain('Enter');
            expect(output).toContain('Esc');
            expect(output).toContain('?');
        });

        test('contains settings reference', () => {
            const output = buildHelpText();

            expect(output).toContain('settings');
        });

        test('contains tmux integration info', () => {
            const output = buildHelpText();

            expect(output).toContain('tmux');
            expect(output).toContain('Replaces current pane with TUI and restores on exit');
        });

        test('contains completions command', () => {
            const output = buildHelpText();

            expect(output).toContain('completions');
            expect(output).toContain('Output shell completion script for bash or zsh');
        });

        test('contains setup command', () => {
            const output = buildHelpText();

            expect(output).toContain('setup');
            expect(output).toContain('Interactive onboarding and configuration');
        });

        test('contains flags', () => {
            const output = buildHelpText();

            expect(output).toContain('-h');
            expect(output).toContain('--help');
            expect(output).toContain('-v');
            expect(output).toContain('--version');
        });

        test('keybindings are aligned with consistent column spacing', () => {
            const output = buildHelpText();

            expect(output).toMatch(/↑\/↓\s+Move cursor up\/down/);
            expect(output).toMatch(/:wq\s+Submit decision/);
        });
    });
});
