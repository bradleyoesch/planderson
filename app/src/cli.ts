import { spawnSync } from 'child_process';
import path from 'path';

import { version } from '../../package.json';
import { runCompletions, runHelp, runHook, runSettings, runTui, runUpgrade } from './commands';
import { getPlandersonBaseDir } from './utils/io/paths';

const KNOWN_COMMANDS = new Set(['help', 'hook', 'settings', 'tui', 'tmux', 'upgrade', 'completions']);

export const parseSubcommand = (args: string[]): { command: string; remainingArgs: string[] } => {
    const first = args[0];

    if (!first) {
        return { command: 'help', remainingArgs: [] };
    }

    if (first === '--version' || first === '-v') {
        return { command: 'version', remainingArgs: [] };
    }

    if (first === 'help' || first === '--help' || first === '-h') {
        return { command: 'help', remainingArgs: [] };
    }

    if (KNOWN_COMMANDS.has(first)) {
        return { command: first, remainingArgs: args.slice(1) };
    }

    return { command: first, remainingArgs: [] };
};

const runTmux = (args: string[]): void => {
    const scriptPath = path.join(getPlandersonBaseDir(), 'integrations', 'tmux', 'init.sh');
    spawnSync('bash', [scriptPath, ...args], { stdio: 'inherit' });
};

export const main = async (args: string[]): Promise<void> => {
    const { command, remainingArgs } = parseSubcommand(args);

    switch (command) {
        case 'help':
            runHelp();
            break;
        case 'hook':
            await runHook();
            break;
        case 'settings':
            runSettings(remainingArgs);
            break;
        case 'tmux':
            runTmux(remainingArgs);
            break;
        case 'tui':
            runTui(remainingArgs);
            break;
        case 'upgrade':
            await runUpgrade();
            break;
        case 'completions':
            runCompletions(remainingArgs);
            break;
        case 'version':
            console.log(version);
            process.exit(0);
            break;
        default:
            console.log(`planderson: '${command}' is not a planderson command. See 'planderson --help'`);
            process.exit(2);
    }
};

if (import.meta.main) {
    void main(process.argv.slice(2));
}
