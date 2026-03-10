#!/usr/bin/env bun
/**
 * Integration tests for page navigation (Space = page down, b = page up)
 *
 * These tests validate paging behavior with real rendering:
 * - Space pages down by viewport height
 * - b pages up by viewport height
 * - Boundary conditions (top/bottom)
 * - Page navigation with multi-line selection (focus on PAGE POSITION)
 *
 * NOTE: These tests focus on PAGE POSITION. For tests that focus on SELECTION STATE,
 * see tests/integration/ui/feedback/multi-line-selection.integration.test.tsx
 *
 * Run with: bun run test:integration
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, stripAnsi, typeKey, typeKeys, typeText, waitFor, waitForRender } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';

describe('navigation page-jumping integration', () => {
    afterEach(() => {
        cleanup();
    });

    /*
     * NOTE: we want to use regex matching to avoid false positives like matching "Line 1" on "Line 11"
     * But to do that, we need to strip the ANSI codes from the output.
     */

    // Basic page navigation
    test('Space pages down from top of plan', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'page-nav-1.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render, then wait for viewportHeight state update
        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
        await waitForRender(50); // Prevents race condition when running many tests

        await typeKey(stdin, ' ', { delayMs: 100 });

        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).not.toMatch(/Content Line 1\n/);
            expect(after).toMatch(/Content Line 30\n/);
            expect(after).not.toMatch(/Content Line 99\n/);
        });
    });

    test('Space at bottom of content stops at last line', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'page-nav-3.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render, then wait for viewportHeight state update
        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
        await waitForRender(50); // Prevents race condition when running many tests

        // Press Space many times to get near/past the end
        await typeKeys(stdin, ' ', 10);

        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).not.toMatch(/Content Line 1\n/);
            expect(after).not.toMatch(/Content Line 30\n/);
            expect(after).toMatch(/Content Line 100\n/);
        });
    });

    test('b pages up after scrolling down', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'page-nav-2.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render, then wait for viewportHeight state update
        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
        await waitForRender(50); // Prevents race condition when running many tests

        // Page down first
        await typeKey(stdin, ' ');

        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).not.toMatch(/Content Line 1\n/);
            expect(after).toMatch(/Content Line 30\n/);
            expect(after).not.toMatch(/Content Line 100\n/);
        });

        // Page back up
        await typeKey(stdin, 'b');

        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).toMatch(/Content Line 1\n/);
            expect(after).not.toMatch(/Content Line 30\n/);
            expect(after).not.toMatch(/Content Line 100\n/);
        });
    });

    test('b at top of content stays at first line', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'page-nav-4.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render, then wait for viewportHeight state update
        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
        await waitForRender(50); // Prevents race condition when running many tests

        // Press b from the initial position (already at top)
        await typeKey(stdin, 'b');

        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
    });

    // Page navigation with multi-line selection (focus on PAGE POSITION)
    // These tests complement multi-line-selection tests that focus on SELECTION STATE
    // (tests/integration/ui/feedback/multi-line-selection.integration.test.tsx)
    test('Space still pages down when in multi-line selection', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'page-nav-5.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render, then wait for viewportHeight state update
        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
        await waitForRender(50); // Prevents race condition when running many tests

        // Create a multi-line selection with Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Press Space to page down (should clear selection and page)
        await typeKey(stdin, ' ');

        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).not.toMatch(/Content Line 1\n/);
            expect(after).toMatch(/Content Line 30\n/);
            expect(after).not.toMatch(/Content Line 100\n/);
        });
    });

    test('b still pages up when in multi-line selection', async () => {
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'page-nav-b-selection.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render, then wait for viewportHeight state update
        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
        await waitForRender(50); // Prevents race condition when running many tests

        // Page down first using Space
        await typeKey(stdin, ' ');

        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).not.toMatch(/Content Line 1\n/);
            expect(after).toMatch(/Content Line 30\n/);
        });

        // Create small multi-line selection with Shift+Up
        await typeKey(stdin, Keys.SHIFT_UP);
        await typeKey(stdin, Keys.SHIFT_UP);

        // Press b to page up (should clear selection and page)
        await typeKey(stdin, 'b');

        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).toMatch(/Content Line 1\n/);
            expect(after).not.toMatch(/Content Line 30\n/);
        });
    });

    test('Space after Shift+Down does not change page position', async () => {
        // NOTE: Cannot distinguish Shift+Space from Space at readline level (CSI u limitation)
        // This test uses regular space to verify PAGE POSITION behavior when selection is active.
        // For SELECTION STATE behavior, see "Space still pages down when in multi-line selection" above.
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'page-nav-space-position.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render, then wait for viewportHeight state update
        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
        await waitForRender(50); // Prevents race condition when running many tests

        // Create multi-line selection with Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Pre-condition: on page 1, Content Line 1 visible
        const beforeFrame = stripAnsi(lastFrame()!);
        expect(beforeFrame).toMatch(/Content Line 1\n/);
        expect(beforeFrame).not.toMatch(/Content Line 30\n/);

        // Press Space - in this test we focus on page position
        await typeKey(stdin, ' ');

        // Post-condition: verify page position changed (paged down)
        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).not.toMatch(/Content Line 1\n/); // Not on page 1 anymore
            expect(after).toMatch(/Content Line 30\n/); // Paged down
        });
    });

    test('Capital B does not change page position', async () => {
        // This test focuses on PAGE POSITION.
        // See multi-line-selection.integration.test.tsx "Capital B maintains multi-line selection"
        // for the complementary test that focuses on SELECTION STATE.
        const lines = Array.from({ length: 100 }, (_, i) => `Content Line ${i + 1}`).join('\n');
        const file = useTempPlanFile(lines, 'page-nav-capital-b.md');

        const { stdin, lastFrame } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for initial render, then wait for viewportHeight state update
        await waitFor(() => expect(stripAnsi(lastFrame()!)).toMatch(/Content Line 1\n/));
        await waitForRender(50); // Prevents race condition when running many tests

        // Page down first to have somewhere to page back from
        await typeKey(stdin, ' ');

        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).not.toMatch(/Content Line 1\n/);
            expect(after).toMatch(/Content Line 30\n/);
        });

        // Create multi-line selection with Shift+Down
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Pre-condition: on page 2
        const beforeFrame = stripAnsi(lastFrame()!);
        expect(beforeFrame).toMatch(/Content Line 30\n/);
        expect(beforeFrame).not.toMatch(/Content Line 1\n/);

        // Press capital B (Shift+b) - focus on page position staying the same
        await typeText(stdin, 'B');

        // Post-condition: still on page 2 (did not page up)
        await waitFor(() => {
            const after = stripAnsi(lastFrame()!);
            expect(after).not.toMatch(/Content Line 1\n/); // Did not page up
            expect(after).toMatch(/Content Line 30\n/); // Still on page 2
        });
    });
});
