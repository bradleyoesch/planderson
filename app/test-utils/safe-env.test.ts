import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { getSafeTestEnv } from './safe-env';

describe('test-utils safe-env', () => {
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

    describe('getSafeTestEnv', () => {
        test('clears TMUX and TMUX_PANE variables', () => {
            process.env.TMUX = '/tmp/tmux-1000/default,12345,0';
            process.env.TMUX_PANE = '%123';

            const env = getSafeTestEnv();

            expect(env.TMUX).toBeUndefined();
            expect(env.TMUX_PANE).toBeUndefined();
        });

        test('preserves other environment variables', () => {
            const env = getSafeTestEnv();

            expect(env.PATH).toBe(process.env.PATH);
            expect(env.HOME).toBe(process.env.HOME);
        });

        test('applies overrides', () => {
            const env = getSafeTestEnv({
                HOME: '/tmp/test-home',
                CUSTOM_VAR: 'test-value',
            });

            expect(env.HOME).toBe('/tmp/test-home');
            expect(env.CUSTOM_VAR).toBe('test-value');
        });

        test('overrides can set values to undefined', () => {
            const env = getSafeTestEnv({
                PATH: undefined,
            });

            expect(env.PATH).toBeUndefined();
        });

        test('returns object with all process.env keys', () => {
            const env = getSafeTestEnv();

            // Should have typical env vars
            expect(typeof env).toBe('object');
            expect(Object.keys(env).length).toBeGreaterThan(0);
        });
    });
});
