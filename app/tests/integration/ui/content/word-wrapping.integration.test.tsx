import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render as inkRender } from 'ink-testing-library';
import React from 'react';

import { Plan } from '~/components/PlanView/Plan/Plan';
import { PlanViewProvider } from '~/contexts/PlanViewProvider';
import { TerminalProvider } from '~/contexts/TerminalContext';
import { wrapContent, wrapMarkdownContent } from '~/test-utils/line-wrapping-helpers';
import { getRenderedLines } from '~/test-utils/visual-assertions';
import { wrapFeedback } from '~/utils/rendering/line-wrapping';

describe('content word-wrapping integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    // Renders Plan component at a specific terminal width with given lines.
    // The TerminalProvider overrides useTerminal() so PlanViewProvider wraps content at `width`.
    // Pre-computes visibleLines via wrapContent/wrapMarkdownContent to match what PlanViewProvider would produce.
    const renderPlan = (lines: string[], width: number, markdown = false) => {
        const visibleLines = markdown ? wrapMarkdownContent(lines, width, 1) : wrapContent(lines, width, 1);

        return inkRender(
            <TerminalProvider terminalWidth={width} terminalHeight={24}>
                <PlanViewProvider
                    sessionId="test-session"
                    content={lines.join('\n')}
                    onShowHelp={() => {}}
                    onApprove={() => {}}
                    onDeny={() => {}}
                    onCancel={() => {}}
                >
                    <Plan
                        visibleLines={visibleLines}
                        scrollOffset={0}
                        cursorLine={0}
                        selectionAnchor={null}
                        wrappedComments={wrapFeedback(new Map(), 'comment', width, 1)}
                        wrappedQuestions={wrapFeedback(new Map(), 'question', width, 1)}
                        deletedLines={new Set()}
                    />
                </PlanViewProvider>
            </TerminalProvider>,
        );
    };

    test('word breaks at space: second word rendered intact on new line', () => {
        // "hello worldly" at terminal width 12 → effective 10 (12 - 2*padding)
        // Word-wrap: line 1 = "hello", line 2 = "worldly"
        // Char-wrap would produce: line 1 = "hello worl", line 2 = "dy"
        const { lastFrame } = renderPlan(['hello worldly'], 12);
        const lines = getRenderedLines(lastFrame()!);

        expect(lines[0]).toBe('hello');
        expect(lines[1]).toBe('worldly');
    });

    test('word breaks at punctuation: word after comma rendered intact, not split mid-character', () => {
        // "Hi,world!" at terminal width 7 → effective 5 (7 - 2*padding)
        // Word-wrap: line 1 = "Hi,", line 2 = "world", line 3 = "!"
        // Char-wrap would produce: line 1 = "Hi,wo", line 2 = "rld!" — "world" split mid-character
        const { lastFrame } = renderPlan(['Hi,world!'], 7);
        const lines = getRenderedLines(lastFrame()!);

        expect(lines[0]).toBe('Hi,');
        expect(lines[1]).toBe('world');
        expect(lines[2]).toBe('!');
    });

    test('long single token with no break chars falls back to char-wrap', () => {
        // "aaaaaaaaaaaaaaaa" (16 chars) at effective 10 → no break chars → char-wrap fallback
        // Expected: line 1 = 10 'a's, line 2 = 6 'a's
        const { lastFrame } = renderPlan(['a'.repeat(16)], 12);
        const lines = getRenderedLines(lastFrame()!);

        expect(lines[0]).toBe('a'.repeat(10));
        expect(lines[1]).toBe('a'.repeat(6));
    });

    test('multi-line prose: no word fragments — each line starts with a complete original word', () => {
        // "The quick brown fox jumped over the lazy dog and continued"
        // At width 30 (effective 28), words should not be split across lines
        const sentence = 'The quick brown fox jumped over the lazy dog and continued';
        const originalWords = sentence.split(' ');
        const { lastFrame } = renderPlan([sentence], 30);

        const lines = getRenderedLines(lastFrame()!);

        lines.forEach((line) => {
            if (line.length === 0) return;
            const firstToken = line.split(/\s+/)[0];
            // Every line must start with a complete, unbroken word from the original
            expect(originalWords).toContain(firstToken);
        });
    });

    test('code block still char-wraps rather than word-wraps', () => {
        // "hello worldly" (13 chars) inside a code block at effective width 10 (terminal 12)
        // Char-wrap (expected for code): line 1 = "hello worl", line 2 = "dly"
        // Word-wrap (wrong for code): line 1 = "hello", line 2 = "worldly"
        const { lastFrame } = renderPlan(['```', 'hello worldly', '```'], 12, true);
        const lines = getRenderedLines(lastFrame()!);

        expect(lines).toContain('hello worl'); // char-wrap mid-word split (correct for code)
        expect(lines).toContain('dly'); // remaining 3 chars after 10-char first line
        expect(lines).not.toContain('worldly'); // word-wrap would produce this (wrong for code)
    });
});
