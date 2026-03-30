import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import fs from 'fs';
import * as os from 'os';
import path from 'path';
import * as readline from 'readline';

import { useTempDir } from '~/test-utils/fixtures';
import { resetWriteFunction, setWriteFunction } from '~/utils/io/logger';

import { runSetup } from './setup';

describe('commands setup', () => {
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

    const makeReadlineMock = (answers: string[]) => {
        const queue = [...answers];
        return {
            question: (_q: string, cb: (a: string) => void) => {
                cb(queue.shift() ?? '');
            },
            close: mock(() => {}),
        };
    };

    const run = async (answers: string[]): Promise<number> => {
        spyOn(readline, 'createInterface').mockReturnValue(makeReadlineMock(answers) as unknown as readline.Interface);
        try {
            await runSetup();
            return -1;
        } catch (e: unknown) {
            const err = e as { isExit?: boolean; exitCode?: number };
            if (err?.isExit) return err.exitCode ?? 0;
            throw e;
        }
    };

    const output = (): string => logs.join('\n');

    // Answers for "n to everything" (no tmux): tmux=n, approveAction=n, autoUpgrade=n
    const allSkippedAnswers = ['n', 'n', 'n'];

    describe('welcome message', () => {
        test('prints welcome message at start', async () => {
            await run(allSkippedAnswers);

            expect(output()).toContain('Planderson setup');
        });
    });

    describe('tmux integration step', () => {
        test('shows bind-key snippet when user answers y', async () => {
            // tmux=y, launchMode=n, approveAction=n, autoUpgrade=n
            await run(['y', 'n', 'n', 'n']);

            expect(output()).toContain("bind-key g run-shell 'planderson tmux'");
        });

        test('shows tmux.conf path when user answers y', async () => {
            await run(['y', 'n', 'n', 'n']);

            expect(output()).toContain('~/.tmux.conf');
        });

        test('shows reload command when user answers y', async () => {
            await run(['y', 'n', 'n', 'n']);

            expect(output()).toContain('tmux source-file');
        });

        test('shows mouse and scroll support link when user answers y', async () => {
            await run(['y', 'n', 'n', 'n']);

            expect(output()).toContain('optional-tmux-mouse-and-scroll-support');
        });

        test('shows tmux README link when user answers n', async () => {
            await run(allSkippedAnswers);

            expect(output()).toContain('integrations/tmux/README.md');
        });
    });

    describe('launchMode step', () => {
        test('is not prompted when user answers n to tmux', async () => {
            await run(allSkippedAnswers);

            expect(output()).not.toContain('launchMode');
        });

        test('is prompted when user answers y to tmux', async () => {
            // tmux=y, launchMode=n, approveAction=n, autoUpgrade=n
            await run(['y', 'n', 'n', 'n']);

            expect(output()).toContain('launchMode');
        });

        test('saves auto-tmux when user answers y', async () => {
            // tmux=y, launchMode=y, approveAction=n, autoUpgrade=n
            await run(['y', 'y', 'n', 'n']);

            expect(output()).toContain('auto-tmux');
        });

        test('shows settings hint when user answers n', async () => {
            // tmux=y, launchMode=n, approveAction=n, autoUpgrade=n
            await run(['y', 'n', 'n', 'n']);

            expect(output()).toContain('planderson settings --launchMode');
        });
    });

    describe('approveAction step', () => {
        test('is always prompted', async () => {
            await run(allSkippedAnswers);

            expect(output()).toContain('approveAction');
        });

        test('saves exit when user answers y', async () => {
            // tmux=n, approveAction=y, autoUpgrade=n
            await run(['n', 'y', 'n']);

            expect(output()).toContain('exit');
        });

        test('shows settings hint when user answers n', async () => {
            await run(allSkippedAnswers);

            expect(output()).toContain('planderson settings --approveAction');
        });
    });

    describe('autoUpgrade step', () => {
        test('is always prompted', async () => {
            await run(allSkippedAnswers);

            expect(output()).toContain('autoUpgrade');
        });

        test('saves always when user answers y', async () => {
            // tmux=n, approveAction=n, autoUpgrade=y
            await run(['n', 'n', 'y']);

            expect(output()).toContain('always');
        });

        test('shows settings hint when user answers n', async () => {
            await run(allSkippedAnswers);

            expect(output()).toContain('planderson settings --autoUpgrade');
        });
    });

    describe('summary', () => {
        test('prints setup complete message', async () => {
            await run(allSkippedAnswers);

            expect(output()).toContain('Setup complete');
        });

        test('shows configured step in summary', async () => {
            // tmux=n, approveAction=y, autoUpgrade=n
            await run(['n', 'y', 'n']);

            const out = output();
            expect(out).toContain('approveAction');
            expect(out).toContain('configured');
        });

        test('shows skipped step in summary', async () => {
            await run(allSkippedAnswers);

            const out = output();
            expect(out).toContain('approveAction');
            expect(out).toContain('skipped');
        });

        test('excludes launchMode from summary when tmux was skipped', async () => {
            await run(allSkippedAnswers);

            expect(output()).not.toContain('launchMode');
        });

        test('includes launchMode in summary when tmux was accepted', async () => {
            // tmux=y, launchMode=n, approveAction=n, autoUpgrade=n
            await run(['y', 'n', 'n', 'n']);

            expect(output()).toContain('launchMode');
        });

        test('exits with code 0', async () => {
            expect(await run(allSkippedAnswers)).toBe(0);
        });
    });
});
