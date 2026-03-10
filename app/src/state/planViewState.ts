import { PlanViewMode } from '~/utils/config/constants';

/**
 * Feedback entry with text and line range
 */
export interface FeedbackEntry {
    text: string;
    lines: number[]; // All lines this feedback applies to (always includes the key line)
}

/**
 * Consolidated state for PlanView component
 */
export interface PlanViewState {
    // Viewport
    viewportHeight: number; // Available height for content rendering (set by views based on their UI chrome)

    // Navigation
    cursorLine: number;
    selectionAnchor: number | null;
    scrollOffset: number; // 0-indexed line at top of viewport

    // Feedback
    comments: Map<number, FeedbackEntry>;
    questions: Map<number, FeedbackEntry>; // Line-specific questions
    deletedLines: Set<number>;

    // Input modes
    mode: PlanViewMode;

    // Input buffers
    commandText: string;
    currentCommentText: string;
    currentQuestionText: string;

    // Input cursor position (shared across all input modes)
    inputCursor: number;

    // Comment context
    currentCommentLine: number | null;
    currentCommentLines: number[];

    // Question context
    currentQuestionLine: number | null;
    currentQuestionLines: number[];

    // Confirmation selection
    confirmSelectedIndex: number;
}

export const createInitialState = (): PlanViewState => {
    return {
        viewportHeight: 1,
        cursorLine: 0,
        selectionAnchor: null,
        scrollOffset: 0,
        comments: new Map(),
        questions: new Map(),
        deletedLines: new Set(),
        mode: 'plan',
        commandText: '',
        currentCommentText: '',
        currentQuestionText: '',
        inputCursor: 0,
        currentCommentLine: null,
        currentCommentLines: [],
        currentQuestionLine: null,
        currentQuestionLines: [],
        confirmSelectedIndex: 0,
    };
};
