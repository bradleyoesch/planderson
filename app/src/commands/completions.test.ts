import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { runCompletions } from './completions';

const SUBCOMMANDS = ['help', 'hook', 'settings', 'setup', 'tui', 'tmux', 'upgrade', 'completions'];

describe('commands completions', () => {
    let logs: string[];
    let errors: string[];

    beforeEach(() => {
        logs = [];
        errors = [];

        spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.map(String).join(' '));
        });
        spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            errors.push(args.map(String).join(' '));
        });
        spyOn(process.stderr, 'write').mockImplementation(() => true);
        spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw { isExit: true, exitCode: code ?? 0 };
        }) as (code?: number) => never);
    });

    afterEach(() => {
        mock.restore();
    });

    const run = (args: string[], shell?: string): number => {
        const originalShell = process.env.SHELL;
        if (shell !== undefined) process.env.SHELL = shell;
        try {
            runCompletions(args);
            return -1;
        } catch (e: unknown) {
            const err = e as { isExit?: boolean; exitCode?: number };
            if (err?.isExit) return err.exitCode ?? 0;
            throw e;
        } finally {
            if (shell !== undefined) process.env.SHELL = originalShell;
        }
    };

    const output = (): string => logs.join('\n');
    const errorOutput = (): string => errors.join('\n');

    test('exits 0 and prints bash script for "bash" arg', () => {
        expect(run(['bash'])).toBe(0);
        expect(output()).toContain('_planderson_complete');
    });

    test('exits 0 and prints zsh script for "zsh" arg', () => {
        expect(run(['zsh'])).toBe(0);
        expect(output()).toContain('#compdef planderson');
    });

    test('exits 0 and prints bash script when SHELL=/bin/bash and no arg', () => {
        expect(run([], '/bin/bash')).toBe(0);
        expect(output()).toContain('_planderson_complete');
    });

    test('exits 0 and prints zsh script when SHELL=/usr/bin/zsh and no arg', () => {
        expect(run([], '/usr/bin/zsh')).toBe(0);
        expect(output()).toContain('#compdef planderson');
    });

    test('exits 2 for unknown shell arg', () => {
        expect(run(['fish'])).toBe(2);
        expect(errorOutput()).toContain('fish');
    });

    test('exits 2 when SHELL is unrecognized and no arg given', () => {
        expect(run([], '/bin/fish')).toBe(2);
    });

    describe('bash script content', () => {
        test('contains planderson complete function', () => {
            run(['bash']);
            expect(output()).toContain('_planderson_complete');
        });

        test('contains all subcommands in completion list', () => {
            run(['bash']);
            const out = output();
            SUBCOMMANDS.forEach((cmd) => expect(out).toContain(cmd));
        });

        test('contains complete -F binding', () => {
            run(['bash']);
            expect(output()).toContain('complete -F _planderson_complete planderson');
        });
    });

    describe('zsh script content', () => {
        test('starts with #compdef planderson', () => {
            run(['zsh']);
            expect(output()).toContain('#compdef planderson');
        });

        test('contains all subcommands', () => {
            run(['zsh']);
            const out = output();
            SUBCOMMANDS.forEach((cmd) => expect(out).toContain(cmd));
        });

        test('contains compdef _planderson planderson', () => {
            run(['zsh']);
            expect(output()).toContain('compdef _planderson planderson');
        });
    });

    describe('installation hint', () => {
        let stderrWrites: string[];
        let originalIsTTY: boolean | undefined;

        beforeEach(() => {
            stderrWrites = [];
            originalIsTTY = process.stdout.isTTY;
            Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
            spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
                stderrWrites.push(String(chunk));
                return true;
            });
        });

        afterEach(() => {
            Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
        });

        const hint = (): string => stderrWrites.join('');

        test('writes setup hint to stderr for zsh', () => {
            run(['zsh']);

            expect(hint()).toContain('planderson setup');
        });

        test('writes setup hint to stderr for bash', () => {
            run(['bash']);

            expect(hint()).toContain('planderson setup');
        });

        test('hint does not appear in stdout', () => {
            run(['zsh']);

            expect(output()).not.toContain('planderson setup');
        });

        test('hint is suppressed when stdout is not a TTY', () => {
            Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

            run(['zsh']);

            expect(hint()).toBe('');
        });
    });
});
