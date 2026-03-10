import { install, type InstalledClock } from '@sinonjs/fake-timers';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React from 'react';

import { renderWithTerminalProvider as render } from '~/test-utils/render-helpers';

import { LoadingView } from './LoadingView';

describe('LoadingView', () => {
    let clock: InstalledClock;

    beforeEach(() => {
        clock = install();
    });

    afterEach(() => {
        clock.uninstall();
    });

    describe('Delayed Rendering', () => {
        test('does not render anything initially', () => {
            const { lastFrame } = render(<LoadingView mode="socket" filepath={null} />);
            expect(lastFrame()).toBe('');
        });

        test('renders loading UI after 1 second delay', async () => {
            const { lastFrame } = render(<LoadingView mode="socket" filepath={null} />);

            await clock.tickAsync(1000);

            expect(lastFrame()).toContain('Loading Plan...');
        });

        test('cleans up timer on unmount', async () => {
            const { unmount } = render(<LoadingView mode="socket" filepath={null} />);

            // Unmount before timer fires
            unmount();

            // Should not cause errors
            await clock.tickAsync(1000);
        });
    });

    describe('Socket Mode', () => {
        test('should show socket mode message and not show file path', async () => {
            const { lastFrame } = render(<LoadingView mode="socket" filepath={null} />);

            await clock.tickAsync(1000);

            const frame = lastFrame();
            expect(frame).toContain('Connecting to Claude Code hook via socket');
            expect(frame).not.toContain('null');
            expect(frame).not.toContain('Reading from file');
        });
    });

    describe('File Mode', () => {
        test('should show file mode message with filename', async () => {
            const { lastFrame } = render(<LoadingView mode="file" filepath="test.md" />);

            await clock.tickAsync(1000);

            expect(lastFrame()).toContain('Reading from file: test.md');
        });

        test('should handle long file paths in file mode', async () => {
            const longPath = '/very/long/path/to/some/deeply/nested/directory/plan.md';
            const { lastFrame } = render(<LoadingView mode="file" filepath={longPath} />);

            await clock.tickAsync(1000);

            expect(lastFrame()).toContain(longPath);
        });

        test('should handle special characters in filename', async () => {
            const specialFile = 'plan [v2] (final).md';
            const { lastFrame } = render(<LoadingView mode="file" filepath={specialFile} />);

            await clock.tickAsync(1000);

            expect(lastFrame()).toContain(specialFile);
        });
    });
});
