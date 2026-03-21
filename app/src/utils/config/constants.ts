// Color constants
export const COLORS = {
    ACCENT: '#1b988c', // Teal/turquoise for top line
    APPROVE: '#ab7df6', // Purplish-pink for approve actions
    CURSOR_BG: '#505050', // Medium grey background for cursor line (more noticeable)
    DELETED: '#666666', // Grey color for deleted lines
    DENY: '#ff6b6b', // Red for deny actions
    QUESTION: '#ffd93d', // Yellow for questions
    MUTED: '#8e8e8e', // Light gray for confirmation UI numbers and help text
    SUBTLE: '#606060', // Medium gray for path and separators
    SUBTLE_2: '#323232', // Medium gray for path and separators
    TITLE: '#aeb8fd', // Light lavender for title text
    WARNING: '#ffd93d', // Yellow for warnings/exit
    ERROR: '#ff6b6b', // Red for errors
    CODE: '#aeb8fd', // Purple (matches TITLE) for inline code
    LINK: '#207fe6', // Blue for links
    H1_COLOR: '#8b8b8b', // Grey for H1 headings
    UPDATE: '#ffbe00', // Amber for update notifications
} as const;

// Syntax highlighting colors for code blocks
export const SYNTAX_COLORS = {
    BLUE: '#0087ff',
    LIGHT_GREEN: '#a6e22e',
    LIGHT_GREY: '#878787',
    RED: '#e74848',
    TEAL: '#20c2df',
    WHITE: '#ffffff',
    YELLOW: '#ffff00',
} as const;

/* eslint-disable @typescript-eslint/naming-convention */
export const TOKEN_COLORS: Record<string, string> = {
    'hljs-addition': SYNTAX_COLORS.LIGHT_GREEN, // Diff additions
    'hljs-deletion': SYNTAX_COLORS.RED, // Diff deletions

    'hljs-comment': SYNTAX_COLORS.LIGHT_GREY, // Comments
    'hljs-doctag': SYNTAX_COLORS.BLUE, // Doc tags

    'hljs-attribute': SYNTAX_COLORS.WHITE, // CSS attributes
    'hljs-name': SYNTAX_COLORS.BLUE, // Tag names
    'hljs-property': SYNTAX_COLORS.WHITE, // HTML properties
    'hljs-selector-attr': SYNTAX_COLORS.YELLOW, // CSS attr selectors
    'hljs-selector-class': SYNTAX_COLORS.WHITE, // CSS classes
    'hljs-selector-id': SYNTAX_COLORS.WHITE, // CSS IDs
    'hljs-selector-pseudo': SYNTAX_COLORS.WHITE, // CSS pseudo
    'hljs-selector-tag': SYNTAX_COLORS.YELLOW, // CSS selectors

    'hljs-attr': SYNTAX_COLORS.WHITE, // Object keys, html attributes
    'hljs-built_in': SYNTAX_COLORS.TEAL, // Built-ins
    'hljs-bullet': SYNTAX_COLORS.WHITE, // List bullets
    'hljs-class': SYNTAX_COLORS.TEAL, // Class names
    'hljs-formula': SYNTAX_COLORS.BLUE, // Formulas
    'hljs-function': SYNTAX_COLORS.LIGHT_GREEN, // Function calls
    'hljs-keyword': SYNTAX_COLORS.BLUE, // const, function, if, etc.
    'hljs-link': SYNTAX_COLORS.BLUE, // Links
    'hljs-literal': SYNTAX_COLORS.BLUE, // true, false, null
    'hljs-meta-string': SYNTAX_COLORS.YELLOW, // Meta strings
    'hljs-meta': SYNTAX_COLORS.BLUE, // Meta
    'hljs-number': SYNTAX_COLORS.LIGHT_GREEN, // Numbers, hexes, px
    'hljs-operator': SYNTAX_COLORS.LIGHT_GREY, // =, +, -, etc.
    'hljs-params': SYNTAX_COLORS.WHITE, // Parameters
    'hljs-punctuation': SYNTAX_COLORS.LIGHT_GREY, // Brackets, commas
    'hljs-quote': SYNTAX_COLORS.LIGHT_GREEN, // Quotes
    'hljs-regexp': SYNTAX_COLORS.RED, // Regex
    'hljs-section': SYNTAX_COLORS.RED, // Sections
    'hljs-string': SYNTAX_COLORS.YELLOW, // String literals
    'hljs-symbol': SYNTAX_COLORS.YELLOW, // Symbols
    'hljs-template-variable': SYNTAX_COLORS.WHITE, // Template vars
    'hljs-title': SYNTAX_COLORS.WHITE, // Function names
    'hljs-type': SYNTAX_COLORS.TEAL, // Types
    'hljs-variable': SYNTAX_COLORS.WHITE, // Variable names
};
/* eslint-enable @typescript-eslint/naming-convention */

// Mode determination
export type PlandersonMode = 'socket' | 'file';

// View modes - determines what to render
export type ViewMode = 'plan' | 'error' | 'help'; // Replace views (full screen)
export type PlanViewMode =
    | 'plan'
    | 'help'
    | 'command'
    | 'comment'
    | 'question'
    | 'confirm-approve'
    | 'confirm-deny'
    | 'confirm-cancel';
