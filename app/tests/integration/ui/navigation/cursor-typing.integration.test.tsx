import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, stripAnsi, typeKey, typeText, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import { isInCommandMode } from '~/test-utils/view-assertions';
import { isInCommentMode, isInQuestionMode } from '~/test-utils/visual-assertions';

describe('navigation cursor-typing integration', () => {
    afterEach(() => {
        cleanup();
    });

    describe('Command Mode (:)', () => {
        describe('Word Jumping', () => {
            test('Alt+Left jumps to previous word start', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-word-left.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'jump 99');
                await waitFor(() => expect(isInCommandMode(lastFrame()!)).toBe(true));

                await typeKey(stdin, Keys.ALT_LEFT);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':jump XX99'));
            });

            test('Alt+Right jumps to next word start', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-word-right.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'jump 99');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.ALT_RIGHT);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':jump XX99'));
            });

            test('Alt+Left respects minimum position 1 (after colon)', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-word-left-min.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'test');
                await typeKey(stdin, Keys.ALT_LEFT);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':XXtest'));
            });
        });

        describe('Line Navigation', () => {
            test('Ctrl+A moves cursor to position 1 (after colon)', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-ctrl-a.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'hello');
                await typeKey(stdin, Keys.CTRL_A);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':XXhello'));
            });

            test('Ctrl+E moves cursor to end of text', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-ctrl-e.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'hello');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.CTRL_E);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':helloXX'));
            });
        });

        describe('Advanced Deletions', () => {
            test('Ctrl+W preserves colon in command mode', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-ctrl-w.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'test');
                await typeKey(stdin, Keys.CTRL_W);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain(':');
                    expect(frame).not.toContain('test');
                });
            });

            test('Alt+Backspace preserves colon in command mode', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-alt-backspace.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'test');
                await typeKey(stdin, Keys.ALT_BACKSPACE);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain(':');
                    expect(frame).not.toContain('test');
                });
            });

            test('Ctrl+U preserves colon and deletes to position 1', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-ctrl-u.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.CTRL_U);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':world'));
            });

            test('Ctrl+K deletes from cursor to end', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-ctrl-k.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.CTRL_K);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':hello'));
            });

            test('Ctrl+W is no-op at position 1', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-ctrl-w-noop.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeKey(stdin, Keys.CTRL_W);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':'));
            });

            test('Option+Delete preserves colon in command mode', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-opt-delete.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'test word');
                await typeKey(stdin, Keys.ALT_DELETE);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain(':test');
                    expect(frame).not.toContain('word');
                });
            });

            test('Ctrl+D deletes forward without moving cursor', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-ctrl-d.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.CTRL_D);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':hllo world'));
            });
        });

        describe('Mac-specific keybindings', () => {
            test('Option+b jumps to previous word start', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-opt-b.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'jump 99');
                await typeKey(stdin, Keys.OPT_B);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':jump XX99'));
            });

            test('Option+f jumps to next word start', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-opt-f.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'jump 99');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.OPT_F);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':jump XX99'));
            });

            test('Option+d deletes word backward preserving colon', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-opt-d.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'test word');
                await typeKey(stdin, Keys.OPT_D);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain(':test');
                    expect(frame).not.toContain('word');
                });
            });
        });

        describe('Basic cursor movement', () => {
            test('Left arrow moves cursor left', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-left-arrow.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'hello');
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':helXXlo'));
            });

            test('Right arrow moves cursor right', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-right-arrow.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'hello');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':heXXllo'));
            });

            test('Left arrow respects minimum position 1', async () => {
                const file = useTempPlanFile('Line 1', 'cmd-left-min.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'h');
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW); // Try to go before colon
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain(':XXh'));
            });
        });

        describe('Text Overflow (Wrapping)', () => {
            test('accepts characters beyond terminal width and wraps to next line', async () => {
                // terminalWidth=80 in test env; effective width = 80 (command mode uses full terminalWidth, no padding)
                // ':' is a break char so wrapLine puts it on its own line, then 'x's wrap at 80 per line
                const file = useTempPlanFile('Line 1', 'cmd-char-limit.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);
                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeKey(stdin, ':');
                await typeText(stdin, 'x'.repeat(80)); // exceeds terminal width, wraps
                await waitFor(() => expect(isInCommandMode(lastFrame()!)).toBe(true));

                const frame = stripAnsi(lastFrame()!);
                // All characters accepted (no hard cap)
                expect(frame).toContain('x'.repeat(78)); // first wrapped line of x's
                expect(frame).toContain('x'.repeat(2)); // second line with remaining x's
            });
        });
    });

    describe('Comment Mode (c)', () => {
        describe('Word Jumping', () => {
            test('Alt+Left jumps to previous word start', async () => {
                const file = useTempPlanFile('Line 1', 'comment-word-left.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world test');
                await typeKey(stdin, Keys.ALT_LEFT);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello world XXtest'));
            });

            test('Alt+Left can reach position 0', async () => {
                const file = useTempPlanFile('Line 1', 'comment-word-left-zero.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'test');
                await typeKey(stdin, Keys.ALT_LEFT);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('XXtest'));
            });
        });

        describe('Line Navigation', () => {
            test('Ctrl+A moves cursor to position 0', async () => {
                const file = useTempPlanFile('Line 1', 'comment-ctrl-a.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('XXhello world'));
            });

            test('Ctrl+E moves cursor to end of text', async () => {
                const file = useTempPlanFile('Line 1', 'comment-ctrl-e.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.CTRL_E);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello worldXX'));
            });
        });

        describe('Advanced Deletions', () => {
            test('Ctrl+W can delete to position 0', async () => {
                const file = useTempPlanFile('Line 1', 'comment-ctrl-w.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'test');
                await typeKey(stdin, Keys.CTRL_W);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).not.toContain('test');
                });
            });

            test('Ctrl+U can delete to position 0', async () => {
                const file = useTempPlanFile('Line 1', 'comment-ctrl-u.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.CTRL_U);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('world'));
            });

            test('Ctrl+K deletes from cursor to end', async () => {
                const file = useTempPlanFile('Line 1', 'comment-ctrl-k.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.CTRL_K);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello'));
            });

            test('Alt+Backspace deletes word backward', async () => {
                const file = useTempPlanFile('Line 1', 'comment-alt-backspace.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.ALT_BACKSPACE);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain('hello');
                    expect(frame).not.toContain('world');
                });
            });

            test('Option+Delete deletes word backward', async () => {
                const file = useTempPlanFile('Line 1', 'comment-opt-delete.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.ALT_DELETE);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain('hello');
                    expect(frame).not.toContain('world');
                });
            });

            test('Ctrl+D deletes forward without moving cursor', async () => {
                const file = useTempPlanFile('Line 1', 'comment-ctrl-d.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.CTRL_D);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hllo world'));
            });

            test('Ctrl+U in comment mode with wrapped text preserves text on other wrapped lines', async () => {
                // terminalWidth=80, paddingX=1 → maxWidth=78
                // Type 85 a's: wraps to line1=78 a's (flatStart=0), line2=7 a's (flatStart=78)
                // Cursor at end (pos 85, on line 2). Ctrl+U → deletes line2 prefix → 78 a's remain.
                const file = useTempPlanFile('Line 1', 'comment-ctrl-u-wrapped.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'a'.repeat(85));

                await typeKey(stdin, Keys.CTRL_U);

                await waitFor(() => {
                    const frame = stripAnsi(lastFrame()!);
                    expect(frame).toContain('a'.repeat(78));
                    expect(frame).not.toContain('a'.repeat(79));
                });
            });

            test('Ctrl+K in comment mode with wrapped text preserves text on other wrapped lines', async () => {
                // terminalWidth=80, paddingX=1 → maxWidth=78
                // Type 85 a's: line1=78 a's, line2=7 a's
                // Move cursor to pos 5 (on line 1). Ctrl+K → deletes rest of line1 → 5 + 7 = 12 a's remain.
                const file = useTempPlanFile('Line 1', 'comment-ctrl-k-wrapped.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'a'.repeat(85));
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);

                await typeKey(stdin, Keys.CTRL_K);

                await waitFor(() => {
                    const frame = stripAnsi(lastFrame()!);
                    expect(frame).toContain('a'.repeat(12));
                    expect(frame).not.toContain('a'.repeat(13));
                });
            });
        });

        describe('Mac-specific keybindings', () => {
            test('Option+b jumps to previous word start', async () => {
                const file = useTempPlanFile('Line 1', 'comment-opt-b.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world test');
                await typeKey(stdin, Keys.OPT_B);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello world XXtest'));
            });

            test('Option+f jumps to next word start', async () => {
                const file = useTempPlanFile('Line 1', 'comment-opt-f.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world test');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.OPT_F);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello XXworld test'));
            });

            test('Option+d deletes word backward', async () => {
                const file = useTempPlanFile('Line 1', 'comment-opt-d.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.OPT_D);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain('hello');
                    expect(frame).not.toContain('world');
                });
            });
        });

        describe('Basic cursor movement', () => {
            test('Left arrow moves cursor left', async () => {
                const file = useTempPlanFile('Line 1', 'comment-left-arrow.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello');
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('helXXlo'));
            });

            test('Right arrow moves cursor right', async () => {
                const file = useTempPlanFile('Line 1', 'comment-right-arrow.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'c');
                await waitFor(() => expect(isInCommentMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('heXXllo'));
            });
        });
    });

    describe('Question Mode (q)', () => {
        describe('Word Jumping', () => {
            test('Alt+Left jumps to previous word start', async () => {
                const file = useTempPlanFile('Line 1', 'question-word-left.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world test');
                await typeKey(stdin, Keys.ALT_LEFT);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello world XXtest'));
            });

            test('Alt+Right jumps to next word start', async () => {
                const file = useTempPlanFile('Line 1', 'question-word-right.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world test');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.ALT_RIGHT);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello XXworld test'));
            });

            test('Alt+Left can reach position 0', async () => {
                const file = useTempPlanFile('Line 1', 'question-word-left-zero.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'test');
                await typeKey(stdin, Keys.ALT_LEFT);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('XXtest'));
            });
        });

        describe('Line Navigation', () => {
            test('Ctrl+A moves cursor to position 0', async () => {
                const file = useTempPlanFile('Line 1', 'question-ctrl-a.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('XXhello world'));
            });

            test('Ctrl+E moves cursor to end of text', async () => {
                const file = useTempPlanFile('Line 1', 'question-ctrl-e.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.CTRL_E);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello worldXX'));
            });
        });

        describe('Advanced Deletions', () => {
            test('Ctrl+W can delete to position 0', async () => {
                const file = useTempPlanFile('Line 1', 'question-ctrl-w.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'test');
                await typeKey(stdin, Keys.CTRL_W);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).not.toContain('test');
                });
            });

            test('Ctrl+U can delete to position 0', async () => {
                const file = useTempPlanFile('Line 1', 'question-ctrl-u.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.CTRL_U);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('world'));
            });

            test('Ctrl+K deletes from cursor to end', async () => {
                const file = useTempPlanFile('Line 1', 'question-ctrl-k.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.CTRL_K);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello'));
            });

            test('Alt+Backspace deletes word backward', async () => {
                const file = useTempPlanFile('Line 1', 'question-alt-backspace.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.ALT_BACKSPACE);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain('hello');
                    expect(frame).not.toContain('world');
                });
            });

            test('Option+Delete deletes word backward', async () => {
                const file = useTempPlanFile('Line 1', 'question-opt-delete.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.ALT_DELETE);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain('hello');
                    expect(frame).not.toContain('world');
                });
            });

            test('Ctrl+D deletes forward without moving cursor', async () => {
                const file = useTempPlanFile('Line 1', 'question-ctrl-d.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.CTRL_D);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hllo world'));
            });
        });

        describe('Mac-specific keybindings', () => {
            test('Option+b jumps to previous word start', async () => {
                const file = useTempPlanFile('Line 1', 'question-opt-b.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world test');
                await typeKey(stdin, Keys.OPT_B);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello world XXtest'));
            });

            test('Option+f jumps to next word start', async () => {
                const file = useTempPlanFile('Line 1', 'question-opt-f.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world test');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.OPT_F);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('hello XXworld test'));
            });

            test('Option+d deletes word backward', async () => {
                const file = useTempPlanFile('Line 1', 'question-opt-d.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello world');
                await typeKey(stdin, Keys.OPT_D);

                await waitFor(() => {
                    const frame = lastFrame()!;
                    expect(frame).toContain('hello');
                    expect(frame).not.toContain('world');
                });
            });
        });

        describe('Basic cursor movement', () => {
            test('Left arrow moves cursor left', async () => {
                const file = useTempPlanFile('Line 1', 'question-left-arrow.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello');
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeKey(stdin, Keys.LEFT_ARROW);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('helXXlo'));
            });

            test('Right arrow moves cursor right', async () => {
                const file = useTempPlanFile('Line 1', 'question-right-arrow.md');
                const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('Line 1'), 10000);

                await typeText(stdin, 'q');
                await waitFor(() => expect(isInQuestionMode(lastFrame()!)).toBe(true));

                await typeText(stdin, 'hello');
                await typeKey(stdin, Keys.CTRL_A);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeKey(stdin, Keys.RIGHT_ARROW);
                await typeText(stdin, 'XX');

                await waitFor(() => expect(stripAnsi(lastFrame()!)).toContain('heXXllo'));
            });
        });
    });
});
