import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

import { saveSettings, Settings } from '~/utils/config/settings';
import { generateId } from '~/utils/id';

import { BASH_SCRIPT, detectShell, ZSH_SCRIPT } from './completions';

const TMUX_README_URL = 'https://github.com/bradleyoesch/planderson/blob/main/integrations/tmux/README.md';
const TMUX_MOUSE_URL =
    'https://github.com/bradleyoesch/planderson/blob/main/integrations/tmux/README.md#optional-tmux-mouse-and-scroll-support';

type StepResult = { step: string; result: 'configured' | 'skipped' };

const promptYN = (rl: readline.Interface, question: string): Promise<boolean> => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim().toLowerCase() === 'y');
        });
    });
};

const printSummary = (steps: StepResult[]): void => {
    console.log('');
    console.log('Setup complete.');
    console.log('');
    const labelWidth = Math.max(...steps.map((s) => s.step.length));
    steps.forEach(({ step, result }) => {
        const icon = result === 'configured' ? '✓' : '-';
        console.log(`  ${icon} ${step.padEnd(labelWidth)}  ${result}`);
    });
};

const runSettingStep = async (
    rl: readline.Interface,
    sessionId: string,
    key: keyof Settings,
    yesValue: string,
    noValue: string,
    question: string,
    summary: StepResult[],
): Promise<void> => {
    const wantsYes = await promptYN(rl, `\n${question} (y/n): `);
    const value = wantsYes ? yesValue : noValue;
    saveSettings(sessionId, { [key]: value });
    if (wantsYes) {
        console.log(`  ✓ Set ${key}: ${value}`);
    }
    summary.push({ step: key, result: wantsYes ? 'configured' : 'skipped' });
};

export const runSetup = async (): Promise<void> => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const sessionId = generateId();
    const summary: StepResult[] = [];

    console.log('Planderson setup');
    console.log('');
    console.log('Walk through recommended configuration. Press y/n for each step.');

    // Step 1: tmux integration
    const wantsTmux = await promptYN(rl, '\nSet up tmux integration? (y/n): ');
    if (wantsTmux) {
        console.log('');
        console.log('  Add to ~/.tmux.conf:');
        console.log("    bind-key g run-shell 'planderson tmux'");
        console.log('');
        console.log('  Then reload:');
        console.log('    tmux source-file ~/.tmux.conf');
        console.log('');
        console.log('  For mouse and scroll support, see:');
        console.log(`    ${TMUX_MOUSE_URL}`);
        summary.push({ step: 'tmux integration', result: 'configured' });
    } else {
        console.log(`  For more information, see: ${TMUX_README_URL}`);
        summary.push({ step: 'tmux integration', result: 'skipped' });
    }

    // Step 2: launchMode — only prompted when user set up the tmux integration
    if (wantsTmux) {
        await runSettingStep(
            rl,
            sessionId,
            'launchMode',
            'auto-tmux',
            'manual',
            'Automatically launch the TUI in tmux pane when a plan is ready?',
            summary,
        );
    }

    // Step 3: completions
    const shell = detectShell();
    if (shell) {
        const wantsCompletions = await promptYN(rl, '\nSet up shell completions? (y/n): ');
        if (wantsCompletions) {
            const completionsDir = path.join(os.homedir(), '.planderson', 'completions');
            const completionsFile = path.join(completionsDir, `planderson.${shell}`);
            fs.mkdirSync(completionsDir, { recursive: true });
            fs.writeFileSync(completionsFile, shell === 'zsh' ? ZSH_SCRIPT : BASH_SCRIPT);

            const shellConfig = shell === 'zsh' ? '~/.zshrc' : '~/.bashrc';
            console.log('');
            console.log(`  Add to ${shellConfig}:`);
            console.log(`    source ~/.planderson/completions/planderson.${shell}`);
            console.log('');
            console.log('  Then reload:');
            console.log(`    source ${shellConfig}`);
            summary.push({ step: 'completions', result: 'configured' });
        } else {
            summary.push({ step: 'completions', result: 'skipped' });
        }
    }

    // Step 4: approveAction
    await runSettingStep(
        rl,
        sessionId,
        'approveAction',
        'exit',
        'approve',
        'Change approve behavior to exit instead of submit, to allow user to perform actions like approve and clear context via claude?',
        summary,
    );

    // Step 5: autoUpgrade
    await runSettingStep(rl, sessionId, 'autoUpgrade', 'always', 'never', 'Enable auto-upgrades?', summary);

    rl.close();
    printSummary(summary);
    process.exit(0);
};

if (import.meta.main) {
    void runSetup();
}
