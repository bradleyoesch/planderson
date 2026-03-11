import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { getSafeTestEnv } from '~/test-utils/safe-env';

/**
 * Integration tests for global installation process.
 *
 * These tests execute the real install.sh script and hook wrapper
 * in an isolated environment (temp HOME, cleared TMUX vars) to prevent
 * interference with actual ~/.planderson/ installation or development tmux session.
 */
describe('installation global-install integration', () => {
    const PROJECT_ROOT = join(__dirname, '../../../..');
    let TEST_HOME: string;
    let originalHome: string;

    beforeAll(() => {
        // Build binary once per test run (skip if already built)
        if (!existsSync(join(PROJECT_ROOT, 'build', 'planderson'))) {
            try {
                execSync('bun run build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
            } catch (error) {
                console.error('Failed to build binaries:', error);
                throw error;
            }
        }
    });

    beforeEach(() => {
        // Unique HOME per test eliminates concurrent install collision
        TEST_HOME = mkdtempSync(join(tmpdir(), 'planderson-test-home-'));
        originalHome = process.env.HOME!;
        process.env.HOME = TEST_HOME;
    });

    afterEach(() => {
        process.env.HOME = originalHome;
        rmSync(TEST_HOME, { recursive: true, force: true });
    });

    test('run install script -> creates all required directories and files', () => {
        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        const installDir = join(TEST_HOME, '.planderson');

        expect(existsSync(installDir)).toBe(true);
        expect(existsSync(join(installDir, 'planderson'))).toBe(true);
        expect(existsSync(join(installDir, 'integrations'))).toBe(true);
        expect(existsSync(join(installDir, 'integrations', 'tmux'))).toBe(true);
        expect(existsSync(join(installDir, 'integrations', 'tmux', 'init.sh'))).toBe(true);
        expect(existsSync(join(installDir, 'integrations', 'tmux', 'run-and-restore.sh'))).toBe(true);
        expect(existsSync(join(installDir, 'logs'))).toBe(true);
        expect(existsSync(join(installDir, 'logs', 'activity.log'))).toBe(true);
        expect(existsSync(join(installDir, 'logs', 'error.log'))).toBe(true);
        expect(existsSync(join(installDir, 'sockets'))).toBe(true);
        expect(existsSync(join(installDir, 'registry'))).toBe(true);

        const symlinkPath = join(TEST_HOME, '.local', 'bin', 'planderson');
        expect(existsSync(symlinkPath)).toBe(true);
    });

    test('run install script -> overwrites existing installation', () => {
        const installDir = join(TEST_HOME, '.planderson');
        mkdirSync(installDir, { recursive: true });
        writeFileSync(join(installDir, 'test-file.txt'), 'existing file');

        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        expect(existsSync(join(installDir, 'planderson'))).toBe(true);
        expect(existsSync(join(installDir, 'integrations', 'tmux', 'init.sh'))).toBe(true);
    });

    test('run install script -> cleans stale sockets and registry', () => {
        const installDir = join(TEST_HOME, '.planderson');
        mkdirSync(join(installDir, 'sockets'), { recursive: true });
        mkdirSync(join(installDir, 'registry'), { recursive: true });
        writeFileSync(join(installDir, 'sockets', 'stale-socket.sock'), 'stale socket');
        writeFileSync(join(installDir, 'registry', 'stale-registry.json'), 'stale registry');

        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        expect(existsSync(join(installDir, 'sockets'))).toBe(true);
        expect(existsSync(join(installDir, 'registry'))).toBe(true);
        expect(existsSync(join(installDir, 'sockets', 'stale-socket.sock'))).toBe(false);
        expect(existsSync(join(installDir, 'registry', 'stale-registry.json'))).toBe(false);
    });

    test('installed binary -> executes hook and returns allow for non-ExitPlanMode', () => {
        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        const plandersonBinary = join(TEST_HOME, '.planderson', 'planderson');
        const input = JSON.stringify({
            tool_name: 'SomeOtherTool',
            tool_input: {},
            hook_event_name: 'PermissionRequest',
        });

        // Execute from /tmp to verify binary works regardless of working directory
        const output = execSync(`echo '${input}' | ${plandersonBinary} hook`, {
            encoding: 'utf-8',
            cwd: '/tmp',
            env: getSafeTestEnv({ HOME: TEST_HOME }),
            stdio: 'pipe',
        });

        const result = JSON.parse(output.trim());
        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
        expect(result.hookSpecificOutput.decision.behavior).toBe('allow');
    });

    test('installed binary -> returns version via --version flag', () => {
        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        const plandersonBinary = join(TEST_HOME, '.planderson', 'planderson');
        const output = execSync(`${plandersonBinary} --version`, {
            encoding: 'utf-8',
            env: getSafeTestEnv({ HOME: TEST_HOME }),
            stdio: 'pipe',
        });

        expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('log files are created and writable', () => {
        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        const activityLog = join(TEST_HOME, '.planderson', 'logs', 'activity.log');
        const errorLog = join(TEST_HOME, '.planderson', 'logs', 'error.log');

        expect(existsSync(activityLog)).toBe(true);
        expect(existsSync(errorLog)).toBe(true);

        writeFileSync(activityLog, 'test log entry\n', { flag: 'a' });
        writeFileSync(errorLog, 'test error entry\n', { flag: 'a' });
    });

    describe('Pre-flight Checks', () => {
        test('bun not in PATH -> fails with clear error', () => {
            try {
                execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                    cwd: PROJECT_ROOT,
                    env: {
                        ...process.env,
                        PATH: '/usr/bin:/bin', // Minimal PATH without bun
                    },
                    stdio: 'pipe',
                    encoding: 'utf-8',
                });
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.status).toBeGreaterThan(0);
                const output = error.stdout + error.stderr;
                expect(output).toContain('bun');
            }
        });

        test('binaries not built -> fails with clear error', () => {
            const buildDir = join(PROJECT_ROOT, 'build');
            const buildBackup = join(PROJECT_ROOT, 'build-backup');

            if (existsSync(buildDir)) {
                execSync(`mv ${buildDir} ${buildBackup}`, { cwd: PROJECT_ROOT });
            }

            try {
                execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                    cwd: PROJECT_ROOT,
                    env: getSafeTestEnv({ HOME: TEST_HOME }),
                    stdio: 'pipe',
                    encoding: 'utf-8',
                });
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.status).toBeGreaterThan(0);
                const output = error.stdout + error.stderr;
                expect(output).toContain('Binary not found');
            } finally {
                if (existsSync(buildBackup)) {
                    execSync(`mv ${buildBackup} ${buildDir}`, { cwd: PROJECT_ROOT });
                }
            }
        });
    });
});
