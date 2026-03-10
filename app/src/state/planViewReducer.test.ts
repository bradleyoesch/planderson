import { describe, expect, test } from 'bun:test';

import { PlanViewAction } from './planViewActions';
import { planViewReducer } from './planViewReducer';
import { createInitialState, PlanViewState } from './planViewState';

describe('planViewReducer', () => {
    describe('Viewport actions', () => {
        test('SET_VIEWPORT_HEIGHT updates viewport height', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'SET_VIEWPORT_HEIGHT', height: 25 };
            const newState = planViewReducer(state, action);

            expect(newState.viewportHeight).toBe(25);
        });

        test('SET_VIEWPORT_HEIGHT enforces minimum height of 1', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'SET_VIEWPORT_HEIGHT', height: 0 };
            const newState = planViewReducer(state, action);

            expect(newState.viewportHeight).toBe(1);
        });
    });

    describe('Navigation actions', () => {
        test('MOVE_CURSOR updates cursor line', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'MOVE_CURSOR', line: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.cursorLine).toBe(5);
            expect(newState.selectionAnchor).toBe(null);
        });

        test('MOVE_CURSOR preserves existing selection', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                cursorLine: 3,
                selectionAnchor: 2,
            };
            const action: PlanViewAction = { type: 'MOVE_CURSOR', line: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.cursorLine).toBe(5);
            expect(newState.selectionAnchor).toBe(2); // Selection preserved
        });

        test('START_SELECTION sets anchor and cursor', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'START_SELECTION', line: 3 };
            const newState = planViewReducer(state, action);

            expect(newState.selectionAnchor).toBe(3);
            expect(newState.cursorLine).toBe(3);
        });

        test('EXTEND_SELECTION updates cursor but keeps anchor', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                selectionAnchor: 2,
                cursorLine: 2,
            };
            const action: PlanViewAction = { type: 'EXTEND_SELECTION', line: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.selectionAnchor).toBe(2);
            expect(newState.cursorLine).toBe(5);
        });

        test('CLEAR_SELECTION removes anchor but keeps cursor', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                selectionAnchor: 2,
                cursorLine: 5,
            };
            const action: PlanViewAction = { type: 'CLEAR_SELECTION' };
            const newState = planViewReducer(state, action);

            expect(newState.selectionAnchor).toBe(null);
            expect(newState.cursorLine).toBe(5);
        });

        test('SET_SCROLL_OFFSET updates scroll offset', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'SET_SCROLL_OFFSET', offset: 10 };
            const newState = planViewReducer(state, action);

            expect(newState.scrollOffset).toBe(10);
        });

        describe('JUMP_TO_LINE', () => {
            test('jumps to target within viewport without scrolling', () => {
                const state: PlanViewState = {
                    ...createInitialState(),
                    cursorLine: 5,
                    scrollOffset: 0, // Viewing lines 0-14
                };

                const action: PlanViewAction = {
                    type: 'JUMP_TO_LINE',
                    targetLine: 8,
                    viewportHeight: 15,
                };

                const newState = planViewReducer(state, action);
                expect(newState.cursorLine).toBe(8);
                expect(newState.scrollOffset).toBe(0); // No scroll needed (8 is within 0-14)
                expect(newState.selectionAnchor).toBeNull();
            });

            test('scrolls up when jumping above viewport', () => {
                const state: PlanViewState = {
                    ...createInitialState(),
                    cursorLine: 20,
                    scrollOffset: 15, // Viewing lines 15-29 (viewport height 15)
                };

                const action: PlanViewAction = {
                    type: 'JUMP_TO_LINE',
                    targetLine: 5,
                    viewportHeight: 15,
                };

                const newState = planViewReducer(state, action);
                expect(newState.cursorLine).toBe(5);
                expect(newState.scrollOffset).toBe(5); // Target becomes first visible line
            });

            test('scrolls down when jumping below viewport', () => {
                const state: PlanViewState = {
                    ...createInitialState(),
                    cursorLine: 5,
                    scrollOffset: 0, // Viewing lines 0-14 (viewport height 15)
                };

                const action: PlanViewAction = {
                    type: 'JUMP_TO_LINE',
                    targetLine: 30,
                    viewportHeight: 15,
                };

                const newState = planViewReducer(state, action);
                expect(newState.cursorLine).toBe(30);
                expect(newState.scrollOffset).toBe(16); // 30 - 15 + 1 = target at bottom
            });

            test('jumps to first line', () => {
                const state: PlanViewState = {
                    ...createInitialState(),
                    cursorLine: 50,
                    scrollOffset: 40,
                };

                const action: PlanViewAction = {
                    type: 'JUMP_TO_LINE',
                    targetLine: 0,
                    viewportHeight: 15,
                };

                const newState = planViewReducer(state, action);
                expect(newState.cursorLine).toBe(0);
                expect(newState.scrollOffset).toBe(0); // First line at top
            });

            test('jumps to last line with small viewport', () => {
                const state: PlanViewState = {
                    ...createInitialState(),
                    cursorLine: 0,
                    scrollOffset: 0,
                };

                const action: PlanViewAction = {
                    type: 'JUMP_TO_LINE',
                    targetLine: 99, // Last line (index 99)
                    viewportHeight: 10,
                };

                const newState = planViewReducer(state, action);
                expect(newState.cursorLine).toBe(99);
                expect(newState.scrollOffset).toBe(90); // 99 - 10 + 1 = last line at bottom
            });

            test('clears selection on jump', () => {
                const state: PlanViewState = {
                    ...createInitialState(),
                    cursorLine: 5,
                    selectionAnchor: 3,
                    scrollOffset: 0,
                };

                const action: PlanViewAction = {
                    type: 'JUMP_TO_LINE',
                    targetLine: 10,
                    viewportHeight: 15,
                };

                const newState = planViewReducer(state, action);
                expect(newState.selectionAnchor).toBeNull();
                expect(newState.cursorLine).toBe(10);
            });
        });
    });

    describe('Mode actions', () => {
        test('ENTER_MODE sets mode and clears selection', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                selectionAnchor: 2,
                cursorLine: 5,
            };
            const action: PlanViewAction = { type: 'ENTER_MODE', mode: 'command' };
            const newState = planViewReducer(state, action);

            expect(newState.mode).toBe('command');
            expect(newState.selectionAnchor).toBe(null);
        });

        test('ENTER_MODE updates viewportHeight when provided', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'ENTER_MODE', mode: 'help', viewportHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.mode).toBe('help');
            expect(newState.viewportHeight).toBe(30);
        });

        test('EXIT_MODE resets all input state', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                commandText: ':a',
                currentCommentText: 'Some comment',
                currentCommentLine: 5,
                currentCommentLines: [5, 6],
            };
            const action: PlanViewAction = { type: 'EXIT_MODE' };
            const newState = planViewReducer(state, action);

            expect(newState.mode).toBe('plan');
            expect(newState.commandText).toBe('');
            expect(newState.currentCommentText).toBe('');
            expect(newState.currentCommentLine).toBe(null);
            expect(newState.currentCommentLines).toEqual([]);
        });

        test('EXIT_MODE updates viewportHeight when provided', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'help',
                viewportHeight: 30,
            };
            const action: PlanViewAction = { type: 'EXIT_MODE', viewportHeight: 20 };
            const newState = planViewReducer(state, action);

            expect(newState.mode).toBe('plan');
            expect(newState.viewportHeight).toBe(20);
        });
    });

    describe('Input actions', () => {
        test('SET_COMMAND_TEXT updates command text', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'SET_COMMAND_TEXT', text: ':a' };
            const newState = planViewReducer(state, action);

            expect(newState.commandText).toBe(':a');
        });

        test('APPEND_INPUT appends to command text in command mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':a',
                inputCursor: 2, // At end of ':a'
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: '!', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.commandText).toBe(':a!');
            expect(newState.inputCursor).toBe(3);
        });

        test('APPEND_INPUT does nothing in non-input mode', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: 'x', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });

        test('BACKSPACE_INPUT removes last char from command (keeps ":")', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':ab',
                inputCursor: 3, // At end of ':ab'
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.commandText).toBe(':a');
            expect(newState.inputCursor).toBe(2);
        });

        test('BACKSPACE_INPUT does not remove ":" from command', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':',
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.commandText).toBe(':');
        });
    });

    describe('Feedback - Comments', () => {
        test('ADD_COMMENT adds comment to map', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'ADD_COMMENT', line: 3, text: 'Test comment' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.get(3)).toEqual({ text: 'Test comment', lines: [3] });
            expect(newState.comments).not.toBe(state.comments); // Immutability
        });

        test('ADD_COMMENT overwrites existing comment', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                comments: new Map([[3, { text: 'Old comment', lines: [3] }]]),
            };
            const action: PlanViewAction = { type: 'ADD_COMMENT', line: 3, text: 'New comment' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.get(3)).toEqual({ text: 'New comment', lines: [3] });
        });

        test('REMOVE_COMMENT removes comment from map', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                comments: new Map([
                    [3, { text: 'Comment 1', lines: [3] }],
                    [5, { text: 'Comment 2', lines: [5] }],
                ]),
            };
            const action: PlanViewAction = { type: 'REMOVE_COMMENT', line: 3 };
            const newState = planViewReducer(state, action);

            expect(newState.comments.has(3)).toBe(false);
            expect(newState.comments.get(5)).toEqual({ text: 'Comment 2', lines: [5] });
            expect(newState.comments).not.toBe(state.comments); // Immutability
        });

        test('REMOVE_COMMENT on non-existent comment still returns new state', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'REMOVE_COMMENT', line: 99 };
            const newState = planViewReducer(state, action);

            expect(newState.comments.has(99)).toBe(false);
            expect(newState.comments).not.toBe(state.comments); // Immutability maintained
        });

        test('START_COMMENT enters comment mode with line context', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_COMMENT',
                line: 5,
                lines: [5],
            };
            const newState = planViewReducer(state, action);

            expect(newState.mode).toBe('comment');
            expect(newState.currentCommentLine).toBe(5);
            expect(newState.currentCommentLines).toEqual([5]);
            expect(newState.currentCommentText).toBe('');
            expect(newState.selectionAnchor).toBe(null);
        });

        test('START_COMMENT loads existing comment text', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_COMMENT',
                line: 5,
                lines: [5],
                existingText: 'Existing comment',
            };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('Existing comment');
        });

        test('START_COMMENT preserves selection', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                selectionAnchor: 2,
                cursorLine: 5,
            };
            const action: PlanViewAction = {
                type: 'START_COMMENT',
                line: 5,
                lines: [5, 6],
            };
            const newState = planViewReducer(state, action);

            // Selection should persist to show user which lines the comment applies to (Issue #68)
            expect(newState.selectionAnchor).toBe(2);
        });

        test('START_COMMENT updates viewportHeight when provided', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_COMMENT',
                line: 5,
                lines: [5],
                viewportHeight: 25,
            };
            const newState = planViewReducer(state, action);

            expect(newState.viewportHeight).toBe(25);
        });

        test('SAVE_COMMENT saves non-empty comment', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: 'New comment',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.get(5)).toEqual({ text: 'New comment', lines: [5] });
            expect(newState.mode).toBe('plan');
            expect(newState.currentCommentLine).toBe(null);
            expect(newState.currentCommentLines).toEqual([]);
            expect(newState.currentCommentText).toBe('');
        });

        test('SAVE_COMMENT removes comment if text is empty', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                comments: new Map([[5, { text: 'Old comment', lines: [5] }]]),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: '',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.has(5)).toBe(false);
        });

        test('SAVE_COMMENT removes comment if text is whitespace only', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                comments: new Map([[5, { text: 'Old comment', lines: [5] }]]),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: '   ',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.has(5)).toBe(false);
        });

        test('SAVE_COMMENT does nothing if currentCommentLine is null', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: null,
                currentCommentText: 'Some text',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });

        test('SAVE_COMMENT updates viewportHeight when provided', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: 'Comment',
                viewportHeight: 15,
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT', viewportHeight: 20 };
            const newState = planViewReducer(state, action);

            expect(newState.viewportHeight).toBe(20);
        });

        test('CANCEL_COMMENT exits without saving', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: 'Unsaved comment',
            };
            const action: PlanViewAction = { type: 'CANCEL_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.has(5)).toBe(false);
            expect(newState.mode).toBe('plan');
            expect(newState.currentCommentLine).toBe(null);
            expect(newState.currentCommentLines).toEqual([]);
            expect(newState.currentCommentText).toBe('');
        });

        test('CANCEL_COMMENT updates viewportHeight when provided', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: 'Comment',
                viewportHeight: 25,
            };
            const action: PlanViewAction = { type: 'CANCEL_COMMENT', viewportHeight: 20 };
            const newState = planViewReducer(state, action);

            expect(newState.viewportHeight).toBe(20);
        });

        test('SAVE_COMMENT stores feedback at first selected line with full range', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 4,
                currentCommentLines: [2, 3, 4],
                currentCommentText: 'test',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.get(2)).toEqual({ text: 'test', lines: [2, 3, 4] });
            expect(newState.comments.has(3)).toBe(false);
            expect(newState.comments.has(4)).toBe(false);
        });

        test('SAVE_COMMENT deletes feedback if ranges overlap', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                comments: new Map([[1, { text: 'existing', lines: [1, 2, 3] }]]),
                mode: 'comment',
                currentCommentLine: 1,
                currentCommentLines: [2, 3, 4],
                currentCommentText: '',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.size).toBe(0);
        });

        test('SAVE_COMMENT does not delete non-overlapping feedback', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                comments: new Map([[1, { text: 'existing', lines: [1, 2] }]]),
                mode: 'comment',
                currentCommentLine: 4,
                currentCommentLines: [4, 5],
                currentCommentText: '',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.get(1)).toEqual({ text: 'existing', lines: [1, 2] });
        });

        test('SAVE_COMMENT stores single-line feedback with lines array of one', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [],
                currentCommentText: 'test',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.get(5)).toEqual({ text: 'test', lines: [5] });
        });

        test('SAVE_COMMENT sorts lines in ascending order', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 2,
                currentCommentLines: [4, 2, 3],
                currentCommentText: 'test',
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.comments.get(2)).toEqual({ text: 'test', lines: [2, 3, 4] });
        });

        test('SAVE_COMMENT preserves cursor and anchor from upward selection', () => {
            // User was at line 4, pressed Shift+Up to line 2 → cursor=2, anchor=4
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 2,
                currentCommentLines: [2, 3, 4],
                currentCommentText: 'test',
                cursorLine: 2,
                selectionAnchor: 4,
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.cursorLine).toBe(2); // cursor preserved — Up goes to 1, Down goes to 3
            expect(newState.selectionAnchor).toBe(4); // anchor preserved
        });

        test('SAVE_COMMENT preserves cursor and anchor from downward selection', () => {
            // User was at line 2, pressed Shift+Down to line 4 → cursor=4, anchor=2
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 2,
                currentCommentLines: [2, 3, 4],
                currentCommentText: 'test',
                cursorLine: 4,
                selectionAnchor: 2,
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.cursorLine).toBe(4); // cursor preserved — Down goes to 5
            expect(newState.selectionAnchor).toBe(2); // anchor preserved
        });

        test('SAVE_COMMENT clears selection for single-line comment', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: 'test',
                cursorLine: 5,
                selectionAnchor: null,
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.cursorLine).toBe(5);
            expect(newState.selectionAnchor).toBe(null);
        });

        test('SET_COMMENT_TEXT updates comment text', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'SET_COMMENT_TEXT', text: 'New text' };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('New text');
        });

        test('APPEND_INPUT appends to comment text in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Hello',
                inputCursor: 5, // At end of 'Hello'
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: '!', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('Hello!');
            expect(newState.inputCursor).toBe(6);
        });

        test('BACKSPACE_INPUT removes last char from comment', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Hello',
                inputCursor: 5, // At end of 'Hello'
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('Hell');
            expect(newState.inputCursor).toBe(4);
        });

        test('BACKSPACE_INPUT handles empty comment text', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: '',
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('');
        });
    });

    describe('Feedback - Questions', () => {
        test('ADD_QUESTION adds question to map', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'ADD_QUESTION', line: 5, text: 'Why this?' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.get(5)).toEqual({ text: 'Why this?', lines: [5] });
            expect(newState.questions.size).toBe(1);
            expect(newState.questions).not.toBe(state.questions); // Immutability
        });

        test('ADD_QUESTION overwrites existing question', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                questions: new Map([[5, { text: 'Old question', lines: [5] }]]),
            };
            const action: PlanViewAction = { type: 'ADD_QUESTION', line: 5, text: 'New question' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.get(5)).toEqual({ text: 'New question', lines: [5] });
            expect(newState.questions.size).toBe(1);
        });

        test('START_QUESTION enters question mode with line context', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'START_QUESTION', line: 3, lines: [3, 4], existingText: '' };
            const newState = planViewReducer(state, action);

            expect(newState.mode).toBe('question');
            expect(newState.currentQuestionLine).toBe(3);
            expect(newState.currentQuestionLines).toEqual([3, 4]);
            expect(newState.currentQuestionText).toBe('');
        });

        test('START_QUESTION prefills existing question text', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_QUESTION',
                line: 5,
                lines: [5],
                existingText: 'Existing?',
            };
            const newState = planViewReducer(state, action);

            expect(newState.currentQuestionText).toBe('Existing?');
        });

        test('START_QUESTION preserves selection', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                selectionAnchor: 1,
                cursorLine: 3,
            };
            const action: PlanViewAction = {
                type: 'START_QUESTION',
                line: 3,
                lines: [3, 4],
            };
            const newState = planViewReducer(state, action);

            // Selection should persist to show user which lines the question applies to (Issue #68)
            expect(newState.selectionAnchor).toBe(1);
        });

        test('START_QUESTION updates viewportHeight when provided', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_QUESTION',
                line: 5,
                lines: [5],
                viewportHeight: 25,
            };
            const newState = planViewReducer(state, action);

            expect(newState.viewportHeight).toBe(25);
        });

        test('SAVE_QUESTION saves line-specific question', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 2,
                currentQuestionLines: [2],
                currentQuestionText: 'Why?',
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.get(2)).toEqual({ text: 'Why?', lines: [2] });
            expect(newState.mode).toBe('plan');
            expect(newState.currentQuestionLine).toBe(null);
            expect(newState.currentQuestionText).toBe('');
        });

        test('SAVE_QUESTION removes line-specific question when empty', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                questions: new Map([[2, { text: 'Existing', lines: [2] }]]),
                mode: 'question',
                currentQuestionLine: 2,
                currentQuestionLines: [2],
                currentQuestionText: '   ',
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.has(2)).toBe(false);
        });

        test('SAVE_QUESTION updates viewportHeight when provided', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 2,
                currentQuestionLines: [2],
                currentQuestionText: 'Why?',
                viewportHeight: 15,
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION', viewportHeight: 20 };
            const newState = planViewReducer(state, action);

            expect(newState.viewportHeight).toBe(20);
        });

        test('CANCEL_QUESTION exits without saving', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 5,
                currentQuestionLines: [5],
                currentQuestionText: 'Unsaved',
            };
            const action: PlanViewAction = { type: 'CANCEL_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.has(5)).toBe(false);
            expect(newState.mode).toBe('plan');
            expect(newState.currentQuestionLine).toBe(null);
            expect(newState.currentQuestionText).toBe('');
        });

        test('CANCEL_QUESTION updates viewportHeight when provided', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 5,
                currentQuestionLines: [5],
                currentQuestionText: 'Question',
                viewportHeight: 25,
            };
            const action: PlanViewAction = { type: 'CANCEL_QUESTION', viewportHeight: 20 };
            const newState = planViewReducer(state, action);

            expect(newState.viewportHeight).toBe(20);
        });

        test('APPEND_INPUT appends to question text in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Why',
                inputCursor: 3, // At end of 'Why'
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: '?', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentQuestionText).toBe('Why?');
            expect(newState.inputCursor).toBe(4);
        });

        test('BACKSPACE_INPUT removes last character from question', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Why?',
                inputCursor: 4, // At end of 'Why?'
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentQuestionText).toBe('Why');
            expect(newState.inputCursor).toBe(3);
        });

        test('SAVE_QUESTION stores feedback at first selected line with full range', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 4,
                currentQuestionLines: [2, 3, 4],
                currentQuestionText: 'test',
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.get(2)).toEqual({ text: 'test', lines: [2, 3, 4] });
            expect(newState.questions.has(3)).toBe(false);
            expect(newState.questions.has(4)).toBe(false);
        });

        test('SAVE_QUESTION deletes feedback if ranges overlap', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                questions: new Map([[1, { text: 'existing', lines: [1, 2, 3] }]]),
                mode: 'question',
                currentQuestionLine: 1,
                currentQuestionLines: [2, 3, 4],
                currentQuestionText: '',
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.size).toBe(0);
        });

        test('SAVE_QUESTION does not delete non-overlapping feedback', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                questions: new Map([[1, { text: 'existing', lines: [1, 2] }]]),
                mode: 'question',
                currentQuestionLine: 4,
                currentQuestionLines: [4, 5],
                currentQuestionText: '',
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.get(1)).toEqual({ text: 'existing', lines: [1, 2] });
        });

        test('SAVE_QUESTION stores single-line feedback with lines array of one', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 5,
                currentQuestionLines: [],
                currentQuestionText: 'test',
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.get(5)).toEqual({ text: 'test', lines: [5] });
        });

        test('SAVE_QUESTION sorts lines in ascending order', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 2,
                currentQuestionLines: [4, 2, 3],
                currentQuestionText: 'test',
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.questions.get(2)).toEqual({ text: 'test', lines: [2, 3, 4] });
        });

        test('SAVE_QUESTION preserves cursor and anchor from upward selection', () => {
            // User was at line 5, pressed Shift+Up to line 3 → cursor=3, anchor=5
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 3,
                currentQuestionLines: [3, 4, 5],
                currentQuestionText: 'Why?',
                cursorLine: 3,
                selectionAnchor: 5,
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.cursorLine).toBe(3); // cursor preserved — Up goes to 2, Down goes to 4
            expect(newState.selectionAnchor).toBe(5); // anchor preserved
        });

        test('SAVE_QUESTION preserves cursor and anchor from downward selection', () => {
            // User was at line 3, pressed Shift+Down to line 5 → cursor=5, anchor=3
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 3,
                currentQuestionLines: [3, 4, 5],
                currentQuestionText: 'Why?',
                cursorLine: 5,
                selectionAnchor: 3,
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.cursorLine).toBe(5); // cursor preserved — Down goes to 6
            expect(newState.selectionAnchor).toBe(3); // anchor preserved
        });

        test('SAVE_QUESTION clears selection for single-line question', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 2,
                currentQuestionLines: [2],
                currentQuestionText: 'Why?',
                cursorLine: 2,
                selectionAnchor: null,
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.cursorLine).toBe(2);
            expect(newState.selectionAnchor).toBe(null);
        });
    });

    describe('Feedback - Deletion', () => {
        test('TOGGLE_DELETE_LINES deletes multiple lines', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                deletedLines: new Set([3]), // Line 3 already deleted
            };
            const action: PlanViewAction = { type: 'TOGGLE_DELETE_LINES', lines: [3, 5, 7], shouldDelete: true };
            const newState = planViewReducer(state, action);

            expect(newState.deletedLines.has(3)).toBe(true); // Still deleted
            expect(newState.deletedLines.has(5)).toBe(true); // Now deleted
            expect(newState.deletedLines.has(7)).toBe(true); // Now deleted
            expect(newState.deletedLines).not.toBe(state.deletedLines); // Immutability
        });

        test('TOGGLE_DELETE_LINES undeletes multiple lines', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                deletedLines: new Set([3, 5, 7, 9]),
            };
            const action: PlanViewAction = { type: 'TOGGLE_DELETE_LINES', lines: [3, 5, 7], shouldDelete: false };
            const newState = planViewReducer(state, action);

            expect(newState.deletedLines.has(3)).toBe(false); // Undeleted
            expect(newState.deletedLines.has(5)).toBe(false); // Undeleted
            expect(newState.deletedLines.has(7)).toBe(false); // Undeleted
            expect(newState.deletedLines.has(9)).toBe(true); // Still deleted
        });
    });

    describe('Input Cursor - MOVE_INPUT_CURSOR_LEFT', () => {
        test('moves cursor left by 1 in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Hello',
                inputCursor: 5,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_LEFT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(4);
        });

        test('moves cursor left by 1 in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Why?',
                inputCursor: 3,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_LEFT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(2);
        });

        test('moves cursor left by 1 in command mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abc',
                inputCursor: 3,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_LEFT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(2);
        });

        test('stops at position 0 in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Test',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_LEFT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('stops at position 0 in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Test',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_LEFT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('stops at position 1 in command mode (colon boundary)', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':a',
                inputCursor: 1,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_LEFT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(1); // Cannot move before colon
        });

        test('does nothing in non-input mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'plan',
                inputCursor: 5,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_LEFT' };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });
    });

    describe('Input Cursor - MOVE_INPUT_CURSOR_RIGHT', () => {
        test('moves cursor right by 1 in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Hello',
                inputCursor: 2,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_RIGHT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(3);
        });

        test('moves cursor right by 1 in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Why?',
                inputCursor: 1,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_RIGHT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(2);
        });

        test('moves cursor right by 1 in command mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abc',
                inputCursor: 2,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_RIGHT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(3);
        });

        test('stops at text.length in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Test',
                inputCursor: 4,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_RIGHT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(4); // Cannot move past text end
        });

        test('stops at text.length in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Why?',
                inputCursor: 4,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_RIGHT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(4);
        });

        test('stops at text.length in command mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':ab',
                inputCursor: 3,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_RIGHT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(3);
        });

        test('does nothing in non-input mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'plan',
                inputCursor: 2,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_RIGHT' };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });
    });

    describe('Input Cursor - SET_INPUT_CURSOR', () => {
        test('sets cursor to specific position', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Hello World',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'SET_INPUT_CURSOR', position: 6 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(6);
        });

        test('clamps cursor to 0 minimum in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Test',
                inputCursor: 2,
            };
            const action: PlanViewAction = { type: 'SET_INPUT_CURSOR', position: -5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('clamps cursor to 0 minimum in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Test',
                inputCursor: 2,
            };
            const action: PlanViewAction = { type: 'SET_INPUT_CURSOR', position: -1 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('clamps cursor to 1 minimum in command mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abc',
                inputCursor: 2,
            };
            const action: PlanViewAction = { type: 'SET_INPUT_CURSOR', position: 0 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(1); // Cannot go before colon
        });

        test('clamps cursor to text.length maximum', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Short',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'SET_INPUT_CURSOR', position: 100 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(5); // Length of "Short"
        });

        test('handles empty text', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: '',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'SET_INPUT_CURSOR', position: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0); // Clamped to empty text length
        });

        test('does nothing in non-input mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'plan',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'SET_INPUT_CURSOR', position: 5 };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });
    });

    describe('Input Cursor - APPEND_INPUT with cursor', () => {
        test('inserts at cursor position in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Helo',
                inputCursor: 2, // Between 'e' and 'l'
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: 'l', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('Hello');
            expect(newState.inputCursor).toBe(3); // Cursor advanced
        });

        test('inserts at cursor position in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Wy?',
                inputCursor: 1, // After 'W'
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: 'h', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentQuestionText).toBe('Why?');
            expect(newState.inputCursor).toBe(2);
        });

        test('inserts at cursor position in command mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':ad',
                inputCursor: 2, // Between 'a' and 'd'
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: 'b', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.commandText).toBe(':abd');
            expect(newState.inputCursor).toBe(3);
        });

        test('inserts at start when cursor is 0', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'ello',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: 'H', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('Hello');
            expect(newState.inputCursor).toBe(1);
        });

        test('inserts at end when cursor is at text.length', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Hell',
                inputCursor: 4,
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: 'o', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('Hello');
            expect(newState.inputCursor).toBe(5);
        });

        test('advances cursor after insertion', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'abc',
                inputCursor: 1,
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: 'X', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('aXbc');
            expect(newState.inputCursor).toBe(2); // Advanced from 1 to 2
        });

        test('advances cursor by full length of multi-char input in comment mode', () => {
            // Ink delivers buffered characters as a single string when typing fast
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: '',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: '123', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('123');
            expect(newState.inputCursor).toBe(3); // Advanced by 3, not 1
        });

        test('advances cursor by full length of multi-char input in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: '',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: '456', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentQuestionText).toBe('456');
            expect(newState.inputCursor).toBe(3);
        });

        test('advances cursor by full length of multi-char input in command mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':',
                inputCursor: 1,
            };
            const action: PlanViewAction = { type: 'APPEND_INPUT', char: 'ab', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.commandText).toBe(':ab');
            expect(newState.inputCursor).toBe(3);
        });
    });

    describe('Input Cursor - BACKSPACE_INPUT with cursor', () => {
        test('deletes character before cursor in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Hello',
                inputCursor: 4, // After 'l', before 'o'
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('Helo');
            expect(newState.inputCursor).toBe(3); // Cursor moved back
        });

        test('deletes character before cursor in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Why?',
                inputCursor: 2, // After 'h', before 'y'
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentQuestionText).toBe('Wy?');
            expect(newState.inputCursor).toBe(1);
        });

        test('deletes character before cursor in command mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abc',
                inputCursor: 3, // After 'b', before 'c'
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.commandText).toBe(':ac');
            expect(newState.inputCursor).toBe(2);
        });

        test('does nothing when cursor at position 0 in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'Test',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('Test'); // No change
            expect(newState.inputCursor).toBe(0);
        });

        test('does nothing when cursor at position 0 in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'Test',
                inputCursor: 0,
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentQuestionText).toBe('Test');
            expect(newState.inputCursor).toBe(0);
        });

        test('does nothing when cursor at position 1 in command mode (colon)', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abc',
                inputCursor: 1,
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.commandText).toBe(':abc'); // Cannot delete colon
            expect(newState.inputCursor).toBe(1);
        });

        test('moves cursor back after deletion', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'aXbc',
                inputCursor: 2, // After 'X'
            };
            const action: PlanViewAction = { type: 'BACKSPACE_INPUT', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('abc');
            expect(newState.inputCursor).toBe(1); // Moved back from 2 to 1
        });
    });

    describe('Input Cursor - Mode initialization', () => {
        test('START_COMMENT initializes cursor to end of existing text', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_COMMENT',
                line: 5,
                lines: [5],
                existingText: 'Existing',
            };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(8); // Length of "Existing"
        });

        test('START_COMMENT initializes cursor to 0 when no existing text', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_COMMENT',
                line: 5,
                lines: [5],
            };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('START_QUESTION initializes cursor to end of existing text', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_QUESTION',
                line: 3,
                lines: [3],
                existingText: 'Why?',
            };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(4); // Length of "Why?"
        });

        test('START_QUESTION initializes cursor to 0 when no existing text', () => {
            const state = createInitialState();
            const action: PlanViewAction = {
                type: 'START_QUESTION',
                line: 3,
                lines: [3],
            };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('ENTER_MODE initializes cursor to 1 when entering command mode', () => {
            const state = createInitialState();
            const action: PlanViewAction = { type: 'ENTER_MODE', mode: 'command' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(1); // After colon
        });

        test('ENTER_MODE does not change cursor for other modes', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                inputCursor: 5,
            };
            const action: PlanViewAction = { type: 'ENTER_MODE', mode: 'help' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(5); // Unchanged
        });
    });

    describe('Input Cursor - Mode exit', () => {
        test('EXIT_MODE resets cursor to 0', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                inputCursor: 10,
            };
            const action: PlanViewAction = { type: 'EXIT_MODE' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('SAVE_COMMENT resets cursor to 0', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: 'Comment',
                inputCursor: 7,
            };
            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('CANCEL_COMMENT resets cursor to 0', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 5,
                currentCommentLines: [5],
                currentCommentText: 'Comment',
                inputCursor: 4,
            };
            const action: PlanViewAction = { type: 'CANCEL_COMMENT' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('SAVE_QUESTION resets cursor to 0', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 3,
                currentQuestionLines: [3],
                currentQuestionText: 'Why?',
                inputCursor: 4,
            };
            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('CANCEL_QUESTION resets cursor to 0', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 3,
                currentQuestionLines: [3],
                currentQuestionText: 'Question',
                inputCursor: 8,
            };
            const action: PlanViewAction = { type: 'CANCEL_QUESTION' };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });
    });

    describe('Overlap prevention (Bug fix: duplicate feedback entries)', () => {
        test('SAVE_COMMENT removes overlapping single-line comments before saving multi-select', () => {
            // Setup: State with single-line comments at lines 1 and 2
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 0,
                currentCommentLines: [0, 1, 2],
                currentCommentText: 'Multi-line comment',
                comments: new Map([
                    [1, { text: 'Old comment on line 2', lines: [1] }],
                    [2, { text: 'Old comment on line 3', lines: [2] }],
                ]),
            };

            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            // Should only have one entry (the multi-select comment at line 0)
            expect(newState.comments.size).toBe(1);
            expect(newState.comments.get(0)).toEqual({
                text: 'Multi-line comment',
                lines: [0, 1, 2],
            });
            // Old comments should be removed
            expect(newState.comments.has(1)).toBe(false);
            expect(newState.comments.has(2)).toBe(false);
        });

        test('SAVE_QUESTION removes overlapping single-line questions before saving multi-select', () => {
            // Setup: State with single-line questions at lines 1 and 2
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionLine: 0,
                currentQuestionLines: [0, 1, 2],
                currentQuestionText: 'Multi-line question',
                questions: new Map([
                    [1, { text: 'Old question on line 2', lines: [1] }],
                    [2, { text: 'Old question on line 3', lines: [2] }],
                ]),
            };

            const action: PlanViewAction = { type: 'SAVE_QUESTION' };
            const newState = planViewReducer(state, action);

            // Should only have one entry (the multi-select question at line 0)
            expect(newState.questions.size).toBe(1);
            expect(newState.questions.get(0)).toEqual({
                text: 'Multi-line question',
                lines: [0, 1, 2],
            });
            // Old questions should be removed
            expect(newState.questions.has(1)).toBe(false);
            expect(newState.questions.has(2)).toBe(false);
        });

        test('SAVE_COMMENT removes partially overlapping comments', () => {
            // Setup: Existing multi-line comment on 1-3, adding new multi-line on 2-4
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 1,
                currentCommentLines: [1, 2, 3],
                currentCommentText: 'New comment on lines 2-4',
                comments: new Map([[0, { text: 'Old comment on lines 1-3', lines: [0, 1, 2] }]]),
            };

            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            // Should only have one entry (old comment removed due to overlap)
            expect(newState.comments.size).toBe(1);
            expect(newState.comments.get(1)).toEqual({
                text: 'New comment on lines 2-4',
                lines: [1, 2, 3],
            });
            expect(newState.comments.has(0)).toBe(false);
        });

        test('SAVE_COMMENT preserves non-overlapping comments', () => {
            // Setup: Existing comment on line 5, adding new multi-line on 1-3
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentLine: 0,
                currentCommentLines: [0, 1, 2],
                currentCommentText: 'New comment on lines 1-3',
                comments: new Map([[4, { text: 'Comment on line 5', lines: [4] }]]),
            };

            const action: PlanViewAction = { type: 'SAVE_COMMENT' };
            const newState = planViewReducer(state, action);

            // Should have both entries (no overlap)
            expect(newState.comments.size).toBe(2);
            expect(newState.comments.get(0)).toEqual({
                text: 'New comment on lines 1-3',
                lines: [0, 1, 2],
            });
            expect(newState.comments.get(4)).toEqual({
                text: 'Comment on line 5',
                lines: [4],
            });
        });
    });

    describe('Input Cursor - MOVE_INPUT_CURSOR_UP', () => {
        // Uses "abcde fghij" with maxWidth=5 → segments ["abcde","fghij"], flatStarts=[0,6]

        test('moves cursor to same column on previous line in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'abcde fghij',
                inputCursor: 9, // col 3 of "fghij"
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_UP', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(3); // col 3 of "abcde"
        });

        test('clamps cursor to beginning when already on first line in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'abcde fghij',
                inputCursor: 3, // col 3 of "abcde" (first segment)
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_UP', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('moves cursor to same column on previous line in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'abcde fghij',
                inputCursor: 9, // col 3 of "fghij"
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_UP', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(3);
        });

        test('clamps cursor to beginning when already on first line in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'abcde fghij',
                inputCursor: 3,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_UP', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(0);
        });

        test('does nothing in plan mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'plan',
                inputCursor: 5,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_UP', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });

        test('moves cursor to same column on previous line in command mode', () => {
            // ':abcde fghij' with maxWidth=6 → segments [':abcde','fghij'], flatStarts=[0,7]
            // cursor=9 (col 2 of 'fghij') → UP → col 2 of ':abcde' = 2
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abcde fghij',
                inputCursor: 9,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_UP', maxWidth: 6 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(2);
        });

        test('clamps cursor to minPos=1 when moving up from first line in command mode', () => {
            // cursor on first segment, UP returns 0 from findCursorPositionUp, clamped to minPos=1
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abcde fghij',
                inputCursor: 1,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_UP', maxWidth: 6 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(1);
        });
    });

    describe('Input Cursor - MOVE_INPUT_CURSOR_DOWN', () => {
        // Uses "abcde fghij" with maxWidth=5 → segments ["abcde","fghij"], flatStarts=[0,6]

        test('moves cursor to same column on next line in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'abcde fghij',
                inputCursor: 3, // col 3 of "abcde"
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(9); // col 3 of "fghij"
        });

        test('clamps cursor to end when already on last line in comment mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'abcde fghij',
                inputCursor: 9, // col 3 of "fghij" (last segment)
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(11); // text.length
        });

        test('moves cursor to same column on next line in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'abcde fghij',
                inputCursor: 3, // col 3 of "abcde"
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(9);
        });

        test('clamps cursor to end when already on last line in question mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'question',
                currentQuestionText: 'abcde fghij',
                inputCursor: 9,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(11);
        });

        test('does nothing in plan mode', () => {
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'plan',
                inputCursor: 5,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth: 5 };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });

        test('moves cursor to same column on next line in command mode', () => {
            // ':abcde fghij' with maxWidth=6 → segments [':abcde','fghij'], flatStarts=[0,7]
            // cursor=2 (col 2 of ':abcde') → DOWN → col 2 of 'fghij' = 7+2 = 9
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abcde fghij',
                inputCursor: 2,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth: 6 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(9);
        });

        test('clamps cursor to end when on last line in command mode', () => {
            // cursor on last segment, DOWN returns text.length
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'command',
                commandText: ':abcde fghij',
                inputCursor: 9,
            };
            const action: PlanViewAction = { type: 'MOVE_INPUT_CURSOR_DOWN', maxWidth: 6 };
            const newState = planViewReducer(state, action);

            expect(newState.inputCursor).toBe(12); // ':abcde fghij'.length
        });
    });

    describe('DELETE_INPUT_TO_START', () => {
        test('with maxWidth and cursor on second wrapped line, only deletes current line prefix', () => {
            // 'a'.repeat(85) with maxWidth=78 → segment[0]='a'*78 (flatStart=0), segment[1]='a'*7 (flatStart=78)
            // cursor=85 (end of text, on segment 1) → lineStart=78
            // delete: text.slice(0, 78) + text.slice(85) = 'a'.repeat(78)
            const text = 'a'.repeat(85);
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: text,
                inputCursor: 85,
            };
            const action: PlanViewAction = { type: 'DELETE_INPUT_TO_START', maxWidth: 78, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('a'.repeat(78));
            expect(newState.inputCursor).toBe(78);
        });

        test('with maxWidth and cursor mid-second segment, only deletes from current line start to cursor', () => {
            // 'a'.repeat(85) with maxWidth=78 → segment[1]='a'*7 (flatStart=78)
            // cursor=80 (col 2 of segment 1) → lineStart=78
            // delete: text.slice(0, 78) + text.slice(80) = 'a'*78 + 'a'*5 = 83 a's
            const text = 'a'.repeat(85);
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: text,
                inputCursor: 80,
            };
            const action: PlanViewAction = { type: 'DELETE_INPUT_TO_START', maxWidth: 78, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('a'.repeat(83));
            expect(newState.inputCursor).toBe(78);
        });

        test('with maxWidth and cursor on empty line created by newlines, is a no-op', () => {
            // "hello\n\nworld": cursor=6 is on the empty line (2nd \n)
            // Without fix: lineStart=5 (\n), guard 6<=5 false → deletes \n at pos 5 (WRONG)
            // With fix: lineStart=6, guard 6<=6 → no-op
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: 'hello\n\nworld',
                inputCursor: 6,
            };
            const action: PlanViewAction = { type: 'DELETE_INPUT_TO_START', maxWidth: 78, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });

        test('with maxWidth and cursor at line start, is a no-op', () => {
            // cursor=78 is exactly at flatStarts[1]=78 → lineStart=78 → no-op
            const text = 'a'.repeat(85);
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: text,
                inputCursor: 78,
            };
            const action: PlanViewAction = { type: 'DELETE_INPUT_TO_START', maxWidth: 78, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });

        test('with single-line text, deletes from cursor to start', () => {
            const text = 'hello world';
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: text,
                inputCursor: 6,
            };
            const action: PlanViewAction = { type: 'DELETE_INPUT_TO_START', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('world');
            expect(newState.inputCursor).toBe(0);
        });
    });

    describe('DELETE_INPUT_TO_END', () => {
        test('with maxWidth and cursor mid-first segment, only deletes to end of current segment', () => {
            // 'a'.repeat(85) with maxWidth=78 → segment[0]='a'*78 (end=78), segment[1]='a'*7
            // cursor=5 → lineEnd=78
            // delete: text.slice(0, 5) + text.slice(78) = 'a'*5 + 'a'*7 = 12 a's
            const text = 'a'.repeat(85);
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: text,
                inputCursor: 5,
            };
            const action: PlanViewAction = { type: 'DELETE_INPUT_TO_END', maxWidth: 78, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('a'.repeat(12));
            expect(newState.inputCursor).toBe(5);
        });

        test('with maxWidth and cursor at segment end (discarded space), is a no-op', () => {
            // "abcde fghij" with maxWidth=5 → segments ["abcde","fghij"], flatStarts=[0,6]
            // cursor=5 is the discarded space → maps to segment 0, lineEnd=0+5=5
            // cursor(5) >= lineEnd(5) → no-op
            const text = 'abcde fghij';
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: text,
                inputCursor: 5,
            };
            const action: PlanViewAction = { type: 'DELETE_INPUT_TO_END', maxWidth: 5, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState).toBe(state);
        });

        test('with single-line text, deletes from cursor to end', () => {
            const text = 'hello world';
            const state: PlanViewState = {
                ...createInitialState(),
                mode: 'comment',
                currentCommentText: text,
                inputCursor: 5,
            };
            const action: PlanViewAction = { type: 'DELETE_INPUT_TO_END', maxWidth: 80, terminalHeight: 30 };
            const newState = planViewReducer(state, action);

            expect(newState.currentCommentText).toBe('hello');
            expect(newState.inputCursor).toBe(5);
        });
    });

    describe('MOVE_CONFIRM_SELECTION', () => {
        test('down from 0 moves to 1', () => {
            const state = createInitialState();
            const newState = planViewReducer(state, { type: 'MOVE_CONFIRM_SELECTION', direction: 'down' });
            expect(newState.confirmSelectedIndex).toBe(1);
        });

        test('down from 1 stays at 1 (clamp)', () => {
            const state: PlanViewState = { ...createInitialState(), confirmSelectedIndex: 1 };
            const newState = planViewReducer(state, { type: 'MOVE_CONFIRM_SELECTION', direction: 'down' });
            expect(newState.confirmSelectedIndex).toBe(1);
        });

        test('up from 1 moves to 0', () => {
            const state: PlanViewState = { ...createInitialState(), confirmSelectedIndex: 1 };
            const newState = planViewReducer(state, { type: 'MOVE_CONFIRM_SELECTION', direction: 'up' });
            expect(newState.confirmSelectedIndex).toBe(0);
        });

        test('up from 0 stays at 0 (clamp)', () => {
            const state = createInitialState();
            const newState = planViewReducer(state, { type: 'MOVE_CONFIRM_SELECTION', direction: 'up' });
            expect(newState.confirmSelectedIndex).toBe(0);
        });
    });

    describe('ENTER_MODE resets confirmSelectedIndex', () => {
        test('resets to 0 when entering confirm-approve', () => {
            const state: PlanViewState = { ...createInitialState(), confirmSelectedIndex: 1 };
            const newState = planViewReducer(state, { type: 'ENTER_MODE', mode: 'confirm-approve' });
            expect(newState.confirmSelectedIndex).toBe(0);
        });

        test('resets to 0 when entering confirm-deny', () => {
            const state: PlanViewState = { ...createInitialState(), confirmSelectedIndex: 1 };
            const newState = planViewReducer(state, { type: 'ENTER_MODE', mode: 'confirm-deny' });
            expect(newState.confirmSelectedIndex).toBe(0);
        });

        test('resets to 0 when entering confirm-cancel', () => {
            const state: PlanViewState = { ...createInitialState(), confirmSelectedIndex: 1 };
            const newState = planViewReducer(state, { type: 'ENTER_MODE', mode: 'confirm-cancel' });
            expect(newState.confirmSelectedIndex).toBe(0);
        });

        test('does not reset when entering non-confirm mode', () => {
            const state: PlanViewState = { ...createInitialState(), confirmSelectedIndex: 1 };
            const newState = planViewReducer(state, { type: 'ENTER_MODE', mode: 'command' });
            expect(newState.confirmSelectedIndex).toBe(1);
        });
    });

    describe('Atomic viewport height updates', () => {
        // These tests verify that text-mutation actions update viewportHeight in the same
        // reducer call, eliminating the 2-frame flicker on input wrap/unwrap.
        // maxWidth=20 and terminalHeight=30 are used throughout.
        // calculateViewportHeight('comment', 30, N) = 30 - 3 (header) - (3 + N) (footer) = 24 - N
        // 1 input line → viewportHeight=23; 2 input lines → viewportHeight=22; etc.

        const maxWidth = 20;
        const terminalHeight = 30;

        const commentState = (text: string, cursor: number, viewportHeight: number): PlanViewState => ({
            ...createInitialState(),
            mode: 'comment',
            currentCommentLine: 0,
            currentCommentLines: [0],
            currentCommentText: text,
            inputCursor: cursor,
            viewportHeight,
        });

        const questionState = (text: string, cursor: number, viewportHeight: number): PlanViewState => ({
            ...createInitialState(),
            mode: 'question',
            currentQuestionLine: 0,
            currentQuestionLines: [0],
            currentQuestionText: text,
            inputCursor: cursor,
            viewportHeight,
        });

        const commandState = (text: string, cursor: number, viewportHeight: number): PlanViewState => ({
            ...createInitialState(),
            mode: 'command',
            commandText: text,
            inputCursor: cursor,
            viewportHeight,
        });

        describe('APPEND_INPUT', () => {
            test('updates viewportHeight when text wraps to 2 lines (cursor overflow)', () => {
                // 'a'.repeat(19): 1 segment, posInSeg=19 < maxWidth=20 → 1 visual line
                // After appending 'a': text='a'*20, cursor=20, posInSeg=20 >= maxWidth → cursorOverflows → 2 lines
                const state = commentState('a'.repeat(19), 19, 23);
                const newState = planViewReducer(state, {
                    type: 'APPEND_INPUT',
                    char: 'a',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(22);
            });

            test('updates viewportHeight when text wraps to 2 lines in question mode', () => {
                const state = questionState('a'.repeat(19), 19, 23);
                const newState = planViewReducer(state, {
                    type: 'APPEND_INPUT',
                    char: 'a',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(22);
            });

            test('updates viewportHeight when text wraps to 2 lines in command mode', () => {
                // command footer = inputLineCount (no +3), so viewportHeight = 30 - 3 - N
                // ':' + 'a'*18 = 19 chars at cursor=19: 1 segment, no overflow → 1 line → 26
                // After appending 'a': ':' + 'a'*19 = 20 chars, cursor=20, cursorOverflows → 2 lines → 25
                const state = commandState(`:${'a'.repeat(18)}`, 19, 26);
                const newState = planViewReducer(state, {
                    type: 'APPEND_INPUT',
                    char: 'a',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(25);
            });
        });

        describe('BACKSPACE_INPUT', () => {
            test('updates viewportHeight when wrap collapses from cursor overflow', () => {
                // text='a'*20, cursor=20: cursorOverflows=true → 2 lines, viewportHeight=22
                // After backspace: text='a'*19, cursor=19: 1 line → viewportHeight=23
                const state = commentState('a'.repeat(20), 20, 22);
                const newState = planViewReducer(state, {
                    type: 'BACKSPACE_INPUT',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(23);
            });

            test('updates viewportHeight when wrap collapses from 3 to 2 lines', () => {
                // text='a'*41, cursor=21: 3 segments ('a'*20, 'a'*20, 'a'), cursor in seg1 posInSeg=1
                //   → no overflow → 3 lines, viewportHeight=21
                // After backspace: text='a'*40, cursor=20: 2 segments, cursor at flatStart of seg1 posInSeg=0
                //   → no overflow → 2 lines, viewportHeight=22
                const state = commentState('a'.repeat(41), 21, 21);
                const newState = planViewReducer(state, {
                    type: 'BACKSPACE_INPUT',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(22);
            });
        });

        describe('DELETE_INPUT_FORWARD', () => {
            test('updates viewportHeight when deletion removes a wrap', () => {
                // text='a'*21, cursor=0: 2 segments → 2 lines, viewportHeight=22
                // DELETE_INPUT_FORWARD: removes char at cursor=0, text='a'*20, cursor=0
                // 'a'*20 at cursor=0: posInSeg=0, no overflow → 1 segment, 1 line → viewportHeight=23
                const state = commentState('a'.repeat(21), 0, 22);
                const newState = planViewReducer(state, {
                    type: 'DELETE_INPUT_FORWARD',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(23);
            });
        });

        describe('DELETE_INPUT_WORD_BACKWARD', () => {
            test('updates viewportHeight when deletion collapses a wrap', () => {
                // text='a'*41 at cursor=41: 3 segments → 3 lines, viewportHeight=21
                // findWordDeleteStart skips all 'a's → deleteFrom=0, newText='', cursor=0
                // countInputVisualLines('', 0, 20) = 1 → viewportHeight=23
                const state = commentState('a'.repeat(41), 41, 21);
                const newState = planViewReducer(state, {
                    type: 'DELETE_INPUT_WORD_BACKWARD',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(23);
            });
        });

        describe('DELETE_INPUT_TO_START', () => {
            test('updates viewportHeight when deletion collapses from 3 to 2 lines', () => {
                // text='a'*41, cursor=21: 3 segments, cursor in seg1 at posInSeg=1 → 3 lines, viewportHeight=21
                // DELETE_INPUT_TO_START: lineStart=20 (flatStart of seg1 where cursor lives)
                //   newText = 'a'*20 + 'a'*20 = 'a'*40, cursor=20
                //   'a'*40 at cursor=20: seg1 posInSeg=0 → no overflow → 2 lines, viewportHeight=22
                const state = commentState('a'.repeat(41), 21, 21);
                const newState = planViewReducer(state, {
                    type: 'DELETE_INPUT_TO_START',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(22);
            });
        });

        describe('DELETE_INPUT_TO_END', () => {
            test('updates viewportHeight when deletion removes a wrap', () => {
                // text='a'*21, cursor=0: 2 segments, cursor at 0 in segment 0
                //   lineEnd of cursor=0 in seg 0 ('a'*20): findCurrentLineEnd returns 20
                //   DELETE_INPUT_TO_END: newText = '' + 'a'*21.slice(20) = 'a'
                //   Wait, text.slice(0, 0) + text.slice(lineEnd=20) = '' + 'a' = 'a'
                //   'a' at cursor=0: 1 segment, posInSeg=0 < 1 → 1 line → viewportHeight=23
                const state = commentState('a'.repeat(21), 0, 22);
                const newState = planViewReducer(state, {
                    type: 'DELETE_INPUT_TO_END',
                    maxWidth,
                    terminalHeight,
                });
                expect(newState.viewportHeight).toBe(23);
            });
        });
    });
});
