// NOTE: The completion script strings below must stay in sync with install.sh

const BASH_SCRIPT = `_planderson_complete() {
    local cmds="help hook settings tui tmux upgrade completions"
    COMPREPLY=($(compgen -W "$cmds" -- "\${COMP_WORDS[COMP_CWORD]}"))
}
complete -F _planderson_complete planderson`;

const ZSH_SCRIPT = `#compdef planderson
_planderson() {
    local -a commands
    commands=(
        'help:Show help and keybindings'
        'hook:Process plan events from Claude Code hooks'
        'settings:View and update settings'
        'tui:Launch the plan viewer TUI'
        'tmux:Replace current pane with TUI and restore on exit'
        'upgrade:Upgrade planderson to the latest version'
        'completions:Output shell completion script'
    )
    _describe 'command' commands
}
compdef _planderson planderson`;

const detectShell = (): 'bash' | 'zsh' | null => {
    const shell = process.env.SHELL ?? '';
    if (shell.includes('bash')) return 'bash';
    if (shell.includes('zsh')) return 'zsh';
    return null;
};

export const runCompletions = (args: string[]): void => {
    const shellArg = args[0];
    let shell: 'bash' | 'zsh' | null = null;

    if (shellArg) {
        if (shellArg === 'bash') shell = 'bash';
        else if (shellArg === 'zsh') shell = 'zsh';
        else {
            console.error(`Unknown shell: '${shellArg}'. Use 'bash' or 'zsh'.`);
            process.exit(2);
        }
    } else {
        shell = detectShell();
        if (!shell) {
            console.error(`Unsupported shell. Use: planderson completions [bash|zsh]`);
            process.exit(2);
        }
    }

    console.log(shell === 'bash' ? BASH_SCRIPT : ZSH_SCRIPT);
    process.exit(0);
};

if (import.meta.main) {
    runCompletions(process.argv.slice(2));
}
