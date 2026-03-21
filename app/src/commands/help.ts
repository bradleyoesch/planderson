import {
    decisionKeybindings,
    feedbackKeybindings,
    navigationKeybindings,
    otherKeybindings,
} from '~/utils/config/keybindings';

const formatSection = (title: string, lines: string[]): string => {
    return [title, ...lines, ''].join('\n');
};

const formatKeybindingGroup = (label: string, keybindings: { key: string; description: string }[]): string => {
    const maxKeyLength = Math.max(...keybindings.map((kb) => kb.key.length));
    const lines = keybindings.map((kb) => `    ${kb.key.padEnd(maxKeyLength)}  ${kb.description}`);
    return [`  ${label}`, ...lines, ''].join('\n');
};

export const buildHelpText = (): string => {
    const parts: string[] = [];

    parts.push('Planderson - plan viewer TUI for Claude Code');
    parts.push('');

    parts.push(formatSection('USAGE', ['  planderson <command> [--version] [-h | --help]']));

    parts.push(
        formatSection('COMMANDS', [
            '  hook      Process plan events from Claude Code hooks',
            '  tui       Launch the plan viewer TUI',
            '  settings  View and update settings',
            '  tmux      Replaces current pane with TUI and restores on exit',
            '  upgrade   Upgrade planderson to the latest version',
        ]),
    );

    const keybindingGroups = [
        formatKeybindingGroup('Feedback', feedbackKeybindings),
        formatKeybindingGroup('Navigation', navigationKeybindings),
        formatKeybindingGroup('Decision', decisionKeybindings),
        formatKeybindingGroup('Other', otherKeybindings),
    ].join('\n');

    parts.push(`KEYBINDINGS\n${keybindingGroups}`);

    parts.push(formatSection('FLAGS', ['  -h, --help     Show this help message', '  -v, --version  Show version']));

    return parts.join('\n');
};

export const runHelp = (): void => {
    console.log(buildHelpText());
    process.exit(0);
};

if (import.meta.main) {
    runHelp();
}
