#!/usr/bin/env bun
/**
 * Integration tests for line jumping behavior (:N command mode)
 *
 * These tests validate the complete line jumping workflow:
 * - Absolute jumps (:1, :50, :99999)
 * - Relative jumps (:+10, :-5)
 * - Viewport scrolling when jumping out of view
 * - Command mode integration
 * - Edge cases and error handling
 *
 * Run with: bun run test:integration
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, typeKeys, typeText, waitFor, waitForRender } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';

describe('navigation line-jumping integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    /**
     * Scenario 1: Jump to middle of long plan
     * REQUIREMENT: :50 should jump to line 50 and scroll viewport to show it
     */
    test('jumps to line 50 in 100-line plan and scrolls viewport', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-middle.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Initially should show top of file
        const output = lastFrame()!;
        expect(output).toContain('Content Line 1');
        expect(output).not.toContain('Content Line 50');

        // Enter command mode and type :50
        await typeKey(stdin, ':');
        await typeText(stdin, '50', { enter: true });

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 50');
            expect(output).not.toContain('Content Line 1');
        });
    });

    /**
     * Scenario 2: Jump to first line
     * REQUIREMENT: :1 should jump to line 1 and scroll to top
     */
    test('jumps to first line with :1', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-first.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Navigate down to middle of document
        await typeKeys(stdin, Keys.DOWN_ARROW, 50);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).not.toContain('Content Line 1');
            expect(output).toContain('Content Line 50');
        });

        // Jump to first line with :1
        await typeKey(stdin, ':');
        await typeText(stdin, '1', { enter: true });

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 1');
            expect(output).not.toContain('Content Line 50');
        });
    });

    /**
     * Scenario 3: Jump beyond last line (clamps to last line)
     * REQUIREMENT: :99999 should jump to last line (vim $ behavior)
     */
    test('jumps to last line with :99999 (clamps to last)', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-last.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Initially at top
        const output = lastFrame()!;
        expect(output).toContain('Content Line 1');

        // Jump to "line 99999" which should clamp to line 100
        await typeKey(stdin, ':');
        await typeText(stdin, '99999', { enter: true });

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 100');
            expect(output).not.toContain('Content Line 2\n');
            expect(output).not.toContain('Content Line 5\n');
        });
    });

    /**
     * Scenario 4: Relative jump forward
     * REQUIREMENT: :+20 should jump 20 lines down from current position
     */
    test('relative jump :+20 scrolls down correctly', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-relative-forward.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Move to line 30 first
        await typeKeys(stdin, Keys.DOWN_ARROW, 29);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 30'));

        // Jump +20 (to line 50)
        await typeKey(stdin, ':');
        await typeText(stdin, '+20', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('Content Line 50'));
    });

    /**
     * Scenario 5: Relative jump backward
     * REQUIREMENT: :-10 should jump 10 lines up from current position
     */
    test('relative jump :-10 scrolls up correctly', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-relative-backward.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Move to line 50 first
        await typeKeys(stdin, Keys.DOWN_ARROW, 49);
        await waitForRender(100);

        // Jump -10 (to line 40)
        await typeKey(stdin, ':');
        await typeText(stdin, '-10', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('Content Line 40'));
    });

    /**
     * Scenario 6: Escape cancels jump
     * REQUIREMENT: Typing :50 then Escape should not change cursor position
     */
    test('escape cancels line jump without changing position', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-cancel.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Initially at top
        const output = lastFrame()!;
        expect(output).toContain('Content Line 1');

        // Enter command mode and type :50 but cancel with Escape
        await typeKey(stdin, ':');
        await typeText(stdin, '50');

        // Cancel with Escape
        await typeKey(stdin, Keys.ESCAPE);

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 1');
            expect(output).not.toContain('Content Line 50');
        });
    });

    /**
     * Scenario 7: Invalid command is ignored
     * REQUIREMENT: :abc should be silently ignored (vim behavior)
     */
    test('invalid line number command is ignored', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-invalid.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Initially at top
        const output = lastFrame()!;
        expect(output).toContain('Content Line 1');

        // Try invalid command :abc
        await typeKey(stdin, ':');
        await typeText(stdin, 'abc', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));
    });

    /**
     * Scenario 8: Jump within viewport (no scroll)
     * REQUIREMENT: Jumping to a line already visible should not scroll
     */
    test('jump within viewport moves cursor without scrolling', async () => {
        // Create 50-line plan
        const lines = Array.from({ length: 50 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-within-viewport.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Initially shows lines 1-~20 (depending on terminal height)
        const output = lastFrame()!;
        expect(output).toContain('Content Line 1');
        expect(output).toContain('Content Line 10');

        // Jump to line 10 (within initial viewport)
        await typeKey(stdin, ':');
        await typeText(stdin, '10', { enter: true });

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 1');
            expect(output).toContain('Content Line 10');
        });
    });

    /**
     * Scenario 9: Jump to line in short plan
     * REQUIREMENT: Line jumping should work correctly in plans shorter than viewport
     */
    test('jump to line in short plan (content < viewport)', async () => {
        // Create 10-line plan (shorter than typical viewport)
        const lines = Array.from({ length: 10 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-short.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Jump to line 8
        await typeKey(stdin, ':');
        await typeText(stdin, '8', { enter: true });

        await waitFor(() => {
            const output = lastFrame()!;
            expect(output).toContain('Content Line 8');
            expect(output).toContain('Content Line 1');
        });
    });

    /**
     * Scenario 10: Jump to :0 (clamps to line 1)
     * REQUIREMENT: :0 should clamp to first line (index 0)
     */
    test('jump to :0 clamps to first line', async () => {
        // Create 50-line plan
        const lines = Array.from({ length: 50 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-zero.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Move down first
        await typeKeys(stdin, Keys.DOWN_ARROW, 20);
        await waitForRender(100);

        // Jump to :0 (should go to line 1)
        await typeKey(stdin, ':');
        await typeText(stdin, '0', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));
    });

    /**
     * Scenario 11: Rapid successive jumps
     * REQUIREMENT: Multiple jumps in succession should all work correctly
     */
    test('handles multiple successive jumps', async () => {
        // Create 100-line plan
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'line-jump-successive.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Content Line 1'));

        // Jump to line 50
        await typeKey(stdin, ':');
        await typeText(stdin, '50', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('Content Line 50'));

        // Jump to line 80
        await typeKey(stdin, ':');
        await typeText(stdin, '80', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('Content Line 80'));

        // Jump back to line 20
        await typeKey(stdin, ':');
        await typeText(stdin, '20', { enter: true });

        await waitFor(() => expect(lastFrame()).toContain('Content Line 20'));
    });
});
