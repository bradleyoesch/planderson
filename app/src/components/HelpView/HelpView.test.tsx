import { describe, expect, mock, test } from 'bun:test';
import React from 'react';

import { stripAnsi } from '~/test-utils/ink-helpers';
import { renderWithTerminalProvider as render } from '~/test-utils/render-helpers';

import { HelpView } from './HelpView';

describe('HelpView', () => {
    // Wrap with TerminalProvider

    /** Asserts that a line exists in the output containing both the key and description */
    const expectOnSameLine = (output: string, key: string, description: string) => {
        const lines = stripAnsi(output).split('\n');
        const matchingLine = lines.find((line) => line.includes(key) && line.includes(description));
        expect(matchingLine).toBeDefined();
    };

    describe('Content Sections', () => {
        test('should render keybindings title', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);

            expect(lastFrame()).toContain('Keybindings');
        });

        test('should show feedback section', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);
            const output = lastFrame()!;

            expect(output).toContain('Feedback');
            expectOnSameLine(output, 'c', 'Add/edit comment');
            expectOnSameLine(output, 'q/z', 'Add/edit question');
            expectOnSameLine(output, 'x/Del', 'Toggle delete line');
        });

        test('should show navigation section', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);
            const output = lastFrame()!;

            expect(output).toContain('Navigation');
            expectOnSameLine(output, '↑/↓', 'Move cursor up/down');
            expectOnSameLine(output, ':n', 'Jump to line n');
            expectOnSameLine(output, ':+n', 'Jump forward n lines');
            expectOnSameLine(output, ':-n', 'Jump backward n lines');
        });

        test('should show decision section', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);
            const output = lastFrame()!;

            expect(output).toContain('Decision');
            expectOnSameLine(output, 'Enter', 'Submit decision');
            expectOnSameLine(output, ':wq', 'Submit decision');
            expectOnSameLine(output, ':wq!', '(force)');
            expectOnSameLine(output, ':q', 'Quit/cancel');
            expectOnSameLine(output, ':q!', 'Quit/cancel (force)');
            expectOnSameLine(output, 'Esc', 'Quit/cancel');
        });

        test('should show other section', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);
            const output = lastFrame()!;

            expect(output).toContain('Other');
            expectOnSameLine(output, '?', 'Show help');
            expectOnSameLine(output, ':h', 'Show help');
            expectOnSameLine(output, ':help', 'Show help');
        });

        test('should not show commands section', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);

            expect(lastFrame()).not.toContain('Commands');
        });

        test('should show return instruction in footer', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);

            expect(lastFrame()).toContain('Press ?, Enter, or Escape to return to plan view');
        });
    });

    describe('Layout', () => {
        test('should format keybindings with consistent whitespace', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);
            const output = stripAnsi(lastFrame()!);

            expect(output).toMatch(/↑\/↓\s+Move cursor up\/down/);
            expect(output).toMatch(/:wq\s+Submit decision/);
            expect(output).toMatch(/:q\s+Quit\/cancel/);
        });

        test('should separate sections with blank lines', () => {
            const { lastFrame } = render(<HelpView onExit={mock(() => {})} />);
            const output = lastFrame()!;

            expect(output).toMatch(/Feedback[\S\s]*?\n\n.*Navigation/);
            expect(output).toMatch(/Navigation[\S\s]*?\n\n.*Decision/);
            expect(output).toMatch(/Decision[\S\s]*?\n\n.*Other/);
        });
    });
});
