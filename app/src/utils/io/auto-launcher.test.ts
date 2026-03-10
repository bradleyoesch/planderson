import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { isAutoLaunchAvailable } from './auto-launcher';

describe('io auto-launcher', () => {
    describe('isAutoLaunchAvailable', () => {
        let originalTmux: string | undefined;
        let originalTmuxPane: string | undefined;

        beforeEach(() => {
            originalTmux = process.env.TMUX;
            originalTmuxPane = process.env.TMUX_PANE;
        });

        afterEach(() => {
            process.env.TMUX = originalTmux;
            process.env.TMUX_PANE = originalTmuxPane;
        });

        test('returns true when both TMUX and TMUX_PANE are set', () => {
            process.env.TMUX = '/tmp/tmux-1000/default,12345,0';
            process.env.TMUX_PANE = '%0';

            const result = isAutoLaunchAvailable();

            expect(result).toBe(true);
        });

        test('returns false when TMUX is missing', () => {
            delete process.env.TMUX;
            process.env.TMUX_PANE = '%0';

            const result = isAutoLaunchAvailable();

            expect(result).toBe(false);
        });

        test('returns false when TMUX_PANE is missing', () => {
            process.env.TMUX = '/tmp/tmux-1000/default,12345,0';
            delete process.env.TMUX_PANE;

            const result = isAutoLaunchAvailable();

            expect(result).toBe(false);
        });

        test('returns false when both TMUX and TMUX_PANE are missing', () => {
            delete process.env.TMUX;
            delete process.env.TMUX_PANE;

            const result = isAutoLaunchAvailable();

            expect(result).toBe(false);
        });

        test('returns false when TMUX is empty string', () => {
            process.env.TMUX = '';
            process.env.TMUX_PANE = '%0';

            const result = isAutoLaunchAvailable();

            expect(result).toBe(false);
        });

        test('returns false when TMUX_PANE is empty string', () => {
            process.env.TMUX = '/tmp/tmux-1000/default,12345,0';
            process.env.TMUX_PANE = '';

            const result = isAutoLaunchAvailable();

            expect(result).toBe(false);
        });
    });
});
