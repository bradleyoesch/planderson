export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'chore', // Maintenance tasks (deps, build, CI, etc.)
                'docs', // Documentation changes
                'feat', // New feature
                'fix', // Bug fix
                'perf', // Performance improvements
                'refactor', // Code refactoring
                'revert', // Revert a previous commit
                'style', // Code style changes (formatting, missing semi-colons, etc.)
                'test', // Adding or updating tests
            ],
        ],
        'scope-enum': [
            2,
            'always',
            [
                'deps', // Dependency updates
                'docs', // Documentation
                'hook', // Claude Code hook integration
                'markdown', // Markdown parsing/rendering
                'plugin', // Claude Code plugin distribution
                'socket', // Socket IPC communication
                'state', // State management (reducer, actions)
                'test', // Testing infrastructure
                'tmux', // tmux integration scripts
                'ui', // UI components (Plan, InlineView, HelpView, etc.)
            ],
        ],
        'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
        'subject-empty': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'header-max-length': [2, 'always', 120],
    },
};
