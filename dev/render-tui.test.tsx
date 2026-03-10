#!/usr/bin/env bun
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup } from 'ink-testing-library';

import { useTempPlanFile } from '~/test-utils/fixtures';
import { Keys } from '~/test-utils/ink-helpers';

import { parseArgs, parseKeys, renderScenario } from './render-tui';

const makeLines = (n: number): string => Array.from({ length: n }, (_, i) => `Line ${i + 1}`).join('\n');

describe('dev render-tui', () => {
    describe('parseKeys', () => {
        test('returns empty array for empty string', () => {
            expect(parseKeys('')).toEqual([]);
        });

        test('maps named key to ANSI code', () => {
            expect(parseKeys('DOWN_ARROW')).toEqual([Keys.DOWN_ARROW]);
        });

        test('passes raw chars through unchanged', () => {
            expect(parseKeys('c')).toEqual(['c']);
        });

        test('handles mixed named and raw keys', () => {
            expect(parseKeys('DOWN_ARROW,c,ENTER')).toEqual([Keys.DOWN_ARROW, 'c', Keys.ENTER]);
        });
    });

    describe('parseArgs', () => {
        test('watch defaults to false', () => {
            expect(parseArgs(['dev/plan.md']).watch).toBe(false);
        });

        test('--watch sets watch to true', () => {
            expect(parseArgs(['dev/plan.md', '--watch']).watch).toBe(true);
        });
    });

    describe('renderScenario', () => {
        afterEach(() => {
            cleanup();
        });

        test('returns 1 frame for no keys', async () => {
            const file = useTempPlanFile('Line 1\nLine 2\nLine 3');
            const frames = await renderScenario({ filepath: file, keys: [], width: 80, height: 24 });
            expect(frames).toHaveLength(1);
            expect(frames[0].label).toBe('initial');
            expect(frames[0].content.replaceAll(/\x1b\[[\d;]*m/g, '')).toContain('Line 1');
        });

        test('returns N+1 frames for N keys', async () => {
            const file = useTempPlanFile(makeLines(10));
            const frames = await renderScenario({
                filepath: file,
                keys: [Keys.DOWN_ARROW, Keys.DOWN_ARROW],
                width: 80,
                height: 24,
            });
            expect(frames).toHaveLength(3);
        });

        test('pressing c enters comment mode', async () => {
            const file = useTempPlanFile('Line 1\nLine 2');
            const frames = await renderScenario({ filepath: file, keys: ['c'], width: 80, height: 24 });
            // Comment mode shows "Comment" label in the mode bar
            expect(frames[1].content.replaceAll(/\x1b\[[\d;]*m/g, '')).toContain('Comment');
        });
    });
});
