/** ANSI escape code constants for readable test assertions */
export const ANSI = {
    /** Bold text: \x1b[1m */
    BOLD: '\x1b[1m',
    /** Italic text: \x1b[3m */
    ITALIC: '\x1b[3m',
    /** Underline text: \x1b[4m */
    UNDERLINE: '\x1b[4m',
    /** Strikethrough text: \x1b[9m */
    STRIKETHROUGH: '\x1b[9m',
    /** End strikethrough: \x1b[29m */
    STRIKETHROUGH_END: '\x1b[29m',
    /** Generic ANSI escape prefix */
    ESCAPE: '\x1b[',

    /** 24-bit foreground color: \x1b[38;2;R;G;Bm */
    fg: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
    /** 24-bit foreground color prefix (for partial matching) */
    FG_24BIT: '\x1b[38;2',
    /** 24-bit background color: \x1b[48;2;R;G;Bm */
    bg: (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`,
    /** 24-bit background color prefix (for partial matching) */
    BG_24BIT: '\x1b[48;2',
    /** End foreground color: \x1b[39m */
    FOREGROUND_END: '\x1b[39m',
    /** End background color: \x1b[49m */
    BACKGROUND_END: '\x1b[49m',

    /** Cursor/selection highlight background */
    CURSOR_HIGHLIGHT: '\x1b[48;2;80;80;80m',

    /** Input cursor - white background (for inverted character) */
    INPUT_CURSOR_BG: '\x1b[47m',
    /** Input cursor - black foreground (for inverted character) */
    INPUT_CURSOR_FG: '\x1b[30m',
    /** Input cursor - block character at end of line */
    INPUT_CURSOR_BLOCK: '█',
} as const;

/** Named application colors for readable assertions */
export const COLORS = {
    /** Subtle/grey text (#606060 -> rgb 96,96,96) */
    SUBTLE: ANSI.fg(96, 96, 96),
    /** Question text (#ffd93d -> rgb 255,217,61) */
    QUESTION: ANSI.fg(255, 217, 61),
    /** H1 heading color (#8b8b8b -> rgb 139,139,139) */
    H1: ANSI.fg(139, 139, 139),
    /** Deleted line color (#666666 -> rgb 102,102,102) */
    DELETED: ANSI.fg(102, 102, 102),
    /** Accent teal (#1b988c -> rgb 27,152,140) */
    ACCENT: ANSI.fg(27, 152, 140),
} as const;
