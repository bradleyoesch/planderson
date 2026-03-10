export interface Keybinding {
    key: string;
    description: string;
}

export const feedbackKeybindings: Keybinding[] = [
    { key: 'c', description: 'Add/edit comment for line(s)' },
    { key: 'q/z', description: 'Add/edit question for line(s)' },
    { key: 'x/Del', description: 'Toggle delete line' },
];

export const navigationKeybindings: Keybinding[] = [
    { key: '↑/↓', description: 'Move cursor up/down one line' },
    { key: 'Shift+↑/↓', description: 'Extend selection up/down (multi-line)' },
    { key: 'Space', description: 'Page down' },
    { key: 'b', description: 'Page up' },
    { key: ':n', description: 'Jump to line n (e.g., :99)' },
    { key: ':+n', description: 'Jump forward n lines (e.g., :+5)' },
    { key: ':-n', description: 'Jump backward n lines (e.g., :-3)' },
];

export const decisionKeybindings: Keybinding[] = [
    { key: 'Enter', description: 'Submit decision (approve or deny with feedback)' },
    { key: ':wq', description: 'Submit decision (approve or deny with feedback)' },
    { key: ':wq!', description: 'Submit decision (approve or deny with feedback) (force)' },
    { key: ':q', description: 'Quit/cancel' },
    { key: ':q!', description: 'Quit/cancel (force)' },
    { key: 'Esc', description: 'Quit/cancel' },
];

export const otherKeybindings: Keybinding[] = [
    { key: '?', description: 'Show help' },
    { key: ':h', description: 'Show help' },
    { key: ':help', description: 'Show help' },
];
