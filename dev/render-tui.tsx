#!/usr/bin/env bun
/**
 * Render the TUI programmatically and capture ANSI output frame-by-frame.
 *
 * Usage:
 *   bun run render-tui -- <filepath> [--keys <seq>] [--width N] [--height N] [--output <file>]
 *
 * Examples:
 *   bun run render-tui -- dev/plan-test.md
 *   bun run render-tui -- dev/plan-test.md --keys DOWN_ARROW,DOWN_ARROW,c
 *   bun run render-tui -- dev/plan-test.md --width 40
 *   bun run render-tui -- dev/plan-test.md --keys DOWN_ARROW,c --output /tmp/frames.txt
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import { cleanup, render } from 'ink-testing-library';
import * as path from 'path';
import React from 'react';

import { App } from '~/App';
import { Keys } from '~/test-utils/ink-helpers';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderOptions {
    filepath: string;
    keys: string[]; // resolved ANSI strings
    width: number;
    height: number;
}

export interface RenderedFrame {
    label: string;
    content: string;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Parse a comma-separated key sequence string into resolved ANSI strings.
 * Named tokens (e.g. "DOWN_ARROW") are looked up in Keys; anything else is
 * passed through as-is.
 */
export const parseKeys = (keysArg: string): string[] => {
    if (!keysArg) return [];
    return keysArg
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => (token in Keys ? Keys[token as keyof typeof Keys] : token));
};

/**
 * Reverse-lookup: given an ANSI string, return the human-readable key name,
 * or a JSON-encoded fallback.
 */
export const getKeyLabel = (key: string): string => {
    const entry = Object.entries(Keys).find(([, v]) => v === key);
    return entry ? entry[0] : JSON.stringify(key);
};

// ---------------------------------------------------------------------------
// Core rendering
// ---------------------------------------------------------------------------

/**
 * Poll lastFrame() until it stops changing for stableMs, or timeoutMs elapses.
 * Prevents capturing stale frames after key presses or initial render.
 */
const waitForStableFrame = async (
    getFrame: () => string | undefined,
    { pollMs = 10, stableMs = 50, timeoutMs = 2000 } = {},
): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    let prev = getFrame() ?? '';
    let stableSince = Date.now();

    while (Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
        const current = getFrame() ?? '';
        if (current !== prev) {
            prev = current;
            stableSince = Date.now();
        } else if (Date.now() - stableSince >= stableMs) {
            return;
        }
    }
};

/**
 * Render the App with the given options, simulate key presses one at a time,
 * and return one RenderedFrame per state (initial + one per key).
 */
export const renderScenario = async (options: RenderOptions): Promise<RenderedFrame[]> => {
    const { filepath, keys, width, height } = options;

    const frames: RenderedFrame[] = [];

    try {
        const { lastFrame, stdin } = render(
            <App
                sessionId="render-tui"
                mode="file"
                filepath={filepath}
                settings={DEFAULT_SETTINGS}
                terminalWidth={width}
                terminalHeight={height}
            />,
        );

        await waitForStableFrame(lastFrame);
        frames.push({ label: 'initial', content: lastFrame() ?? '' });

        await keys.reduce(async (prev, key) => {
            await prev;
            stdin.write(key);
            await waitForStableFrame(lastFrame);
            frames.push({ label: getKeyLabel(key), content: lastFrame() ?? '' });
        }, Promise.resolve());
    } finally {
        cleanup();
    }

    return frames;
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface ParsedArgs {
    filepath: string;
    keys: string[];
    width: number;
    height: number;
    outputFile: string | null;
    watch: boolean;
}

export const parseArgs = (argv: string[]): ParsedArgs => {
    let filepath = '';
    let keysArg = '';
    let width = 80;
    let height = 24;
    let outputFile: string | null = null;
    let watch = false;

    let i = 0;
    while (i < argv.length) {
        const arg = argv[i];

        if (arg.startsWith('--keys=')) {
            keysArg = arg.slice('--keys='.length);
        } else if (arg === '--keys') {
            keysArg = argv[++i] ?? '';
        } else if (arg.startsWith('--width=')) {
            width = Number.parseInt(arg.slice('--width='.length), 10);
        } else if (arg === '--width') {
            width = Number.parseInt(argv[++i] ?? '80', 10);
        } else if (arg.startsWith('--height=')) {
            height = Number.parseInt(arg.slice('--height='.length), 10);
        } else if (arg === '--height') {
            height = Number.parseInt(argv[++i] ?? '24', 10);
        } else if (arg.startsWith('--output=')) {
            outputFile = path.resolve(arg.slice('--output='.length));
        } else if (arg === '--output') {
            outputFile = path.resolve(argv[++i] ?? '');
        } else if (arg === '--watch') {
            watch = true;
        } else if (!arg.startsWith('--')) {
            filepath = arg;
        }

        i++;
    }

    return { filepath: path.resolve(filepath), keys: parseKeys(keysArg), width, height, outputFile, watch };
};

const watchAndRender = async (argvWithoutWatch: string[]): Promise<void> => {
    const rerender = (): Promise<void> => {
        process.stdout.write('\x1b[2J\x1b[H'); // clear screen
        return new Promise<void>((resolve) => {
            const child = spawn('bun', ['run', 'render-tui', '--', ...argvWithoutWatch], {
                stdio: ['ignore', 'inherit', 'inherit'],
                env: { ...process.env, FORCE_COLOR: '1' },
            });
            child.on('close', () => resolve());
        });
    };

    await rerender();
    process.stdout.write('\n[watching app/src — Ctrl+C to stop]\n');

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const watchDir = path.resolve('app/src');

    fs.watch(watchDir, { recursive: true }, (_event, filename) => {
        if (!filename?.endsWith('.ts') && !filename?.endsWith('.tsx')) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            void rerender().then(() => {
                process.stdout.write('\n[watching app/src — Ctrl+C to stop]\n');
            });
        }, 300);
    });

    // Keep process alive
    await new Promise<never>(() => {});
};

const main = async (): Promise<void> => {
    const argv = process.argv.slice(2);
    const { filepath, keys, width, height, outputFile, watch } = parseArgs(argv);

    if (!filepath) {
        process.stderr.write(
            'Usage: bun run render-tui -- <filepath> [--keys <seq>] [--width N] [--height N] [--output <file>] [--watch]\n',
        );
        process.exit(1);
    }

    if (watch) {
        await watchAndRender(argv.filter((a) => a !== '--watch'));
        return;
    }

    const frames = await renderScenario({ filepath, keys, width, height });

    const output = frames
        .map((frame) => {
            const lineCount = frame.content.split('\n').length;
            const stats = `[lines: ${lineCount}, height: ${height}, delta: ${lineCount - height}]`;
            return `\n--- Frame: ${frame.label} ${stats} ---\n${frame.content}\n`;
        })
        .join('');

    if (outputFile) {
        fs.writeFileSync(outputFile, output, 'utf-8');
    } else {
        process.stdout.write(output);
    }
};

// ---------------------------------------------------------------------------
// Entry guard
// ---------------------------------------------------------------------------

if (import.meta.main) {
    void main();
}
