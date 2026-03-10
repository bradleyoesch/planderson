import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import React from 'react';

import { App } from '~/App';
import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys, typeKey, waitFor } from '~/test-utils/ink-helpers';
import { DEFAULT_APP_PROPS } from '~/test-utils/integration-defaults';
import {
    areLinesDeleted,
    areLinesNotDeleted,
    countDeletedLines,
    getCursorLine,
    hasCursorHighlight,
    isLineDeleted,
    isLineNotDeleted,
} from '~/test-utils/visual-assertions';

/**
 * Integration tests for delete behavior
 *
 * These tests verify deletion behavior through explicit assertions about
 * visual state (strikethrough, colors, cursor position) rather than snapshots.
 *
 * Benefits:
 * - Tests don't break on cosmetic changes (header text, borders, etc.)
 * - Assertions clearly document what behavior is being verified
 * - More maintainable - only checks what matters for delete functionality
 */
describe('feedback deletions integration', () => {
    afterEach(() => {
        // Ink rendering accumulates handlers across tests, must cleanup for test isolation
        cleanup();
    });

    test('single line not deleted -> press x -> deleted', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'delete-1.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        // Wait for content to load
        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        const frameBefore = lastFrame()!;

        // Verify initial state: Line 1 is NOT deleted, cursor is on Line 1
        expect(frameBefore).toContain('Line 1');
        expect(isLineNotDeleted(frameBefore, 'Line 1')).toBe(true);
        expect(getCursorLine(frameBefore)).toBe('Line 1');

        // Press 'x' to delete current line
        await typeKey(stdin, 'x');
        await waitFor(() => {
            const frameAfter = lastFrame()!;
            // Verify: Line 1 is now deleted (has strikethrough and delete color)
            expect(frameAfter).toContain('Line 1');
            expect(isLineDeleted(frameAfter, 'Line 1')).toBe(true);
            expect(hasCursorHighlight(frameAfter, 'Line 1')).toBe(true);
            // Other lines should remain undeleted
            expect(isLineNotDeleted(frameAfter, 'Line 2')).toBe(true);
            expect(isLineNotDeleted(frameAfter, 'Line 3')).toBe(true);
            expect(isLineNotDeleted(frameAfter, 'Line 4')).toBe(true);
        });
    });

    test('single line deleted -> press x -> not deleted (toggle)', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'delete-2.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Press 'x' to delete
        await typeKey(stdin, 'x');
        await waitFor(() => expect(isLineDeleted(lastFrame()!, 'Line 1')).toBe(true));

        // Press 'x' again to undelete (toggle)
        await typeKey(stdin, 'x');
        await waitFor(() => {
            const frameUndeleted = lastFrame()!;
            // Verify: Line 1 is back to normal (no deletion formatting)
            expect(frameUndeleted).toContain('Line 1');
            expect(isLineNotDeleted(frameUndeleted, 'Line 1')).toBe(true);
            expect(hasCursorHighlight(frameUndeleted, 'Line 1')).toBe(true);
        });
    });

    test('multi-line all not deleted -> press x -> all deleted', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'delete-3.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Select 3 lines with Shift+Down (Line 1, Line 2, Line 3)
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        const frameBeforeDelete = lastFrame()!;

        // Verify all selected lines are NOT deleted initially
        expect(areLinesNotDeleted(frameBeforeDelete, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);

        // Press 'x' - all not deleted, so should delete all selected
        await typeKey(stdin, 'x');
        await waitFor(() => {
            const frameAfterDelete = lastFrame()!;
            // Verify all 3 selected lines are now deleted
            expect(areLinesDeleted(frameAfterDelete, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);
            expect(countDeletedLines(frameAfterDelete)).toBe(3);
            // Line 4 should remain undeleted (not selected)
            expect(isLineNotDeleted(frameAfterDelete, 'Line 4')).toBe(true);
            // Cursor should be on the last selected line (Line 3)
            expect(getCursorLine(frameAfterDelete)).toBe('Line 3');
        });
    });

    test('multi-line all deleted -> press x -> all not deleted (toggle)', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'delete-4.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Delete first 3 lines individually
        await typeKey(stdin, 'x'); // Delete line 1
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, 'x'); // Delete line 2
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, 'x'); // Delete line 3

        // Verify all 3 lines are deleted
        const frameAllDeleted = lastFrame()!;
        expect(areLinesDeleted(frameAllDeleted, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);

        // Go back to line 1 and select all 3 deleted lines
        await typeKey(stdin, Keys.UP_ARROW);
        await typeKey(stdin, Keys.UP_ARROW);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Press 'x' - all selected lines are deleted, so should undelete all
        await typeKey(stdin, 'x');
        await waitFor(() => {
            const frameAfterToggle = lastFrame()!;
            // Verify all 3 lines are back to normal (not deleted)
            expect(areLinesNotDeleted(frameAfterToggle, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);
            expect(countDeletedLines(frameAfterToggle)).toBe(0);
        });
    });

    test('multi-line mixed (some deleted) -> press x -> all deleted', async () => {
        const file = useTempPlanFile('Line 1\nLine 2\nLine 3\nLine 4', 'delete-5.md');
        const { lastFrame, stdin } = render(<App {...DEFAULT_APP_PROPS} filepath={file} />);

        await waitFor(() => expect(lastFrame()).toContain('Line 1'));

        // Delete lines 1 and 2
        await typeKey(stdin, 'x'); // Delete line 1
        await typeKey(stdin, Keys.DOWN_ARROW);
        await typeKey(stdin, 'x'); // Delete line 2
        await waitFor(() => {
            const frameMixedState = lastFrame()!;
            // Verify mixed state: lines 1 and 2 deleted, line 3 not deleted
            expect(isLineDeleted(frameMixedState, 'Line 1')).toBe(true);
            expect(isLineDeleted(frameMixedState, 'Line 2')).toBe(true);
            expect(isLineNotDeleted(frameMixedState, 'Line 3')).toBe(true);
        });

        // Go back to line 1 and select lines 1-3 (mixed: 1,2 deleted; 3 not deleted)
        await typeKey(stdin, Keys.UP_ARROW);
        await typeKey(stdin, Keys.SHIFT_DOWN);
        await typeKey(stdin, Keys.SHIFT_DOWN);

        // Press 'x' - line 3 is not deleted (ANY not deleted), so should delete ALL
        await typeKey(stdin, 'x');
        await waitFor(() => {
            const frameAllDeleted = lastFrame()!;
            // Verify all 3 selected lines are now deleted
            expect(areLinesDeleted(frameAllDeleted, ['Line 1', 'Line 2', 'Line 3'])).toBe(true);
            expect(countDeletedLines(frameAllDeleted)).toBe(3);
        });
    });
});
