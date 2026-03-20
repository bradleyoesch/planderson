import { afterEach } from 'bun:test';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import type { Readable, Writable } from 'stream';

type HookProcess = ChildProcess & { stdin: Writable; stdout: Readable; stderr: Readable };

/**
 * Shared test helpers for Claude Code hook integration tests.
 */

export const HOOK_PATH = path.join(__dirname, '../../../src/commands/hook.ts');

/**
 * Spawns the hook subprocess with an isolated HOME directory.
 * Prevents tests from reading or writing ~/.planderson/settings.json.
 * The temp HOME directory is auto-cleaned after each test.
 *
 * Defaults: TMUX and TMUX_PANE are cleared to prevent tmux auto-launch.
 * Override via extraEnv to test tmux-specific behavior.
 */
export const spawnHook = (extraEnv: Record<string, string | undefined> = {}, baseDir?: string): HookProcess => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'planderson-test-home-'));
    afterEach(() => {
        if (fs.existsSync(fakeHome)) {
            fs.rmSync(fakeHome, { recursive: true, force: true });
        }
    });

    if (baseDir) {
        const plandersonDir = path.join(fakeHome, '.planderson');
        fs.mkdirSync(plandersonDir, { recursive: true });
        fs.writeFileSync(path.join(plandersonDir, 'dev.json'), JSON.stringify({ baseDir }));
    }

    return spawn('bun', [HOOK_PATH], {
        env: {
            ...process.env,
            HOME: fakeHome,
            TMUX: undefined,
            TMUX_PANE: undefined,
            ...extraEnv,
        },
    }) as HookProcess;
};

/**
 * Helper to read all data from a stream
 */
export const readStream = (stream: Readable): Promise<string> => {
    return new Promise((resolve) => {
        let data = '';
        stream.on('data', (chunk) => {
            data += chunk.toString();
        });
        stream.on('end', () => {
            resolve(data);
        });
    });
};

/**
 * Helper to create a mock TUI client that connects to a socket,
 * requests the plan, and sends a decision.
 */
export const connectAndRespond = async function (
    socketPath: string,
    decision: 'accept' | 'deny',
    message?: string,
    delayMs = 100,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            const client = net.connect(socketPath);
            let buffer = '';

            client.on('connect', () => {
                client.write(`${JSON.stringify({ type: 'get_plan' })}\n`);
            });

            client.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                lines.forEach((line) => {
                    if (line.trim() === '') return;

                    try {
                        const msg = JSON.parse(line);
                        if (msg.type === 'plan') {
                            const response = {
                                type: 'decision',
                                decision,
                                ...(message && { message }),
                            };
                            client.write(`${JSON.stringify(response)}\n`);
                            client.end();
                            resolve();
                        }
                    } catch {
                        // Ignore parse errors
                    }
                });
            });

            client.on('error', reject);
        }, delayMs);
    });
};
