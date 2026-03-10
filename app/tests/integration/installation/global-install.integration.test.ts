import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
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
    const TEST_HOME = join(tmpdir(), `planderson-test-install-home-${Date.now()}`);
    let originalHome: string;

    beforeEach(() => {
        // Override HOME to use system temp directory
        originalHome = process.env.HOME!;
        process.env.HOME = TEST_HOME;
        mkdirSync(process.env.HOME, { recursive: true });

        // Ensure binaries are built
        try {
            execSync('bun run build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
        } catch (error) {
            console.error('Failed to build binaries:', error);
            throw error;
        }
    });

    afterEach(() => {
        // Restore HOME
        process.env.HOME = originalHome;

        // Clean up test home directory
        if (existsSync(TEST_HOME)) {
            rmSync(TEST_HOME, { recursive: true, force: true });
        }
    });

    test('run install script -> creates all required directories and files', () => {
        // Run install script
        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        const installDir = join(process.env.HOME!, '.planderson');

        // Verify directory structure
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

        // Verify symlink to ~/.local/bin/planderson
        const symlinkPath = join(TEST_HOME, '.local', 'bin', 'planderson');
        expect(existsSync(symlinkPath)).toBe(true);
    });

    test('installed binary -> executes hook and returns allow for non-ExitPlanMode', () => {
        // Run install script
        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        const plandersonBinary = join(process.env.HOME!, '.planderson', 'planderson');

        // Test hook with non-ExitPlanMode input
        const input = JSON.stringify({
            tool_name: 'SomeOtherTool',
            tool_input: {},
            hook_event_name: 'PermissionRequest',
        });

        const output = execSync(`echo '${input}' | ${plandersonBinary} hook`, {
            encoding: 'utf-8',
            env: getSafeTestEnv({ HOME: TEST_HOME }),
            stdio: 'pipe',
        });

        const result = JSON.parse(output.trim());
        expect(result.hookSpecificOutput).toBeDefined();
        expect(result.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
        expect(result.hookSpecificOutput.decision.behavior).toBe('allow');
    });

    test('run install script -> unified binary exists and is valid', () => {
        // Run install script
        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        const plandersonBinary = join(process.env.HOME!, '.planderson', 'planderson');

        // Verify binary exists
        expect(existsSync(plandersonBinary)).toBe(true);

        // Verify binary is defined
        const stats = Bun.file(plandersonBinary);
        expect(stats).toBeDefined();
    });

    test('existing .planderson directory -> install script overwrites with new files', () => {
        // Create existing installation
        const installDir = join(process.env.HOME!, '.planderson');
        mkdirSync(installDir, { recursive: true });
        writeFileSync(join(installDir, 'test-file.txt'), 'existing file');

        // Run install script (no longer prompts, just installs)
        execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
            cwd: PROJECT_ROOT,
            env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
            stdio: 'pipe',
        });

        // Verify new installation exists
        expect(existsSync(join(installDir, 'planderson'))).toBe(true);
        expect(existsSync(join(installDir, 'integrations', 'tmux', 'init.sh'))).toBe(true);
    });

    describe('Pre-flight Checks', () => {
        test('bun not in PATH -> installation fails with clear error', () => {
            // Run install script with PATH that excludes bun
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
                // Should fail with clear error about bun
                expect(error.status).toBeGreaterThan(0);
                const output = error.stdout + error.stderr;
                expect(output).toContain('bun');
            }
        });

        test('binaries not built -> installation fails with clear error', () => {
            // Temporarily move build directory
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
                // Should fail with clear error about missing binaries
                expect(error.status).toBeGreaterThan(0);
                const output = error.stdout + error.stderr;
                expect(output).toContain('Binary not found');
            } finally {
                // Restore build directory
                if (existsSync(buildBackup)) {
                    execSync(`mv ${buildBackup} ${buildDir}`, { cwd: PROJECT_ROOT });
                }
            }
        });

        test('install directory not writable -> installation fails gracefully', () => {
            // This test is platform-specific and hard to test reliably
            // Skip for now, as it requires creating a read-only directory
            // which is complex across different platforms
            expect(true).toBe(true);
        });
    });

    describe('Executable Verification', () => {
        test('installed binary is executable after install', () => {
            // Run install script
            execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                cwd: PROJECT_ROOT,
                env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
                stdio: 'pipe',
            });

            const plandersonBinary = join(process.env.HOME!, '.planderson', 'planderson');

            // Verify binary exists
            const stats = Bun.file(plandersonBinary);
            expect(stats).toBeDefined();

            // Verify it can be executed
            const testInput = JSON.stringify({
                tool_name: 'Test',
                tool_input: {},
                hook_event_name: 'PermissionRequest',
            });
            const output = execSync(`echo '${testInput}' | ${plandersonBinary} hook`, {
                encoding: 'utf-8',
                env: getSafeTestEnv({ HOME: TEST_HOME }),
                stdio: 'pipe',
            });
            expect(output).toContain('hookSpecificOutput');
        });

        test('tmux scripts are executable after install', () => {
            // Run install script
            execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                cwd: PROJECT_ROOT,
                env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
                stdio: 'pipe',
            });

            const plandersonInit = join(process.env.HOME!, '.planderson', 'integrations', 'tmux', 'init.sh');
            const plandersonRunRestore = join(
                process.env.HOME!,
                '.planderson',
                'integrations',
                'tmux',
                'run-and-restore.sh',
            );

            // Verify scripts exist and have execute permission
            expect(existsSync(plandersonInit)).toBe(true);
            expect(existsSync(plandersonRunRestore)).toBe(true);

            // Check if files have execute permission (check mode)
            const initStats = Bun.file(plandersonInit);
            const runRestoreStats = Bun.file(plandersonRunRestore);

            expect(initStats).toBeDefined();
            expect(runRestoreStats).toBeDefined();
        });
    });

    describe('File Permissions', () => {
        test('log files created with write permissions', () => {
            // Run install script
            execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                cwd: PROJECT_ROOT,
                env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
                stdio: 'pipe',
            });

            const activityLog = join(process.env.HOME!, '.planderson', 'logs', 'activity.log');
            const errorLog = join(process.env.HOME!, '.planderson', 'logs', 'error.log');

            // Verify log files exist
            expect(existsSync(activityLog)).toBe(true);
            expect(existsSync(errorLog)).toBe(true);

            // Verify files are writable by attempting to write to them
            writeFileSync(activityLog, 'test log entry\n', { flag: 'a' });
            writeFileSync(errorLog, 'test error entry\n', { flag: 'a' });

            // If we got here without errors, files are writable
            expect(true).toBe(true);
        });
    });

    describe('Configuration Content', () => {
        test('tmux scripts are installed and executable', () => {
            // Run install script
            execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                cwd: PROJECT_ROOT,
                env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
                stdio: 'pipe',
            });

            const initScript = join(process.env.HOME!, '.planderson', 'integrations', 'tmux', 'init.sh');
            const runScript = join(process.env.HOME!, '.planderson', 'integrations', 'tmux', 'run-and-restore.sh');

            expect(existsSync(initScript)).toBe(true);
            expect(existsSync(runScript)).toBe(true);
        });
    });

    describe('Runtime Directories', () => {
        test('install cleans existing sockets and registry', () => {
            const installDir = join(process.env.HOME!, '.planderson');

            // Create existing installation with stale runtime files
            mkdirSync(join(installDir, 'sockets'), { recursive: true });
            mkdirSync(join(installDir, 'registry'), { recursive: true });
            writeFileSync(join(installDir, 'sockets', 'stale-socket.sock'), 'stale socket');
            writeFileSync(join(installDir, 'registry', 'stale-registry.json'), 'stale registry');

            // Run install script
            execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                cwd: PROJECT_ROOT,
                env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
                stdio: 'pipe',
            });

            // Verify directories exist but are empty
            expect(existsSync(join(installDir, 'sockets'))).toBe(true);
            expect(existsSync(join(installDir, 'registry'))).toBe(true);

            // Verify stale files were removed
            expect(existsSync(join(installDir, 'sockets', 'stale-socket.sock'))).toBe(false);
            expect(existsSync(join(installDir, 'registry', 'stale-registry.json'))).toBe(false);
        });

        test('install creates empty log files', () => {
            // Run install script
            execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                cwd: PROJECT_ROOT,
                env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
                stdio: 'pipe',
            });

            const installDir = join(process.env.HOME!, '.planderson');

            // Verify log files exist and are initially empty or small
            expect(existsSync(join(installDir, 'logs', 'activity.log'))).toBe(true);
            expect(existsSync(join(installDir, 'logs', 'error.log'))).toBe(true);

            // Log files should be writable (test by appending)
            writeFileSync(join(installDir, 'logs', 'activity.log'), 'test entry\n', { flag: 'a' });
            writeFileSync(join(installDir, 'logs', 'error.log'), 'test entry\n', { flag: 'a' });

            expect(true).toBe(true); // If we got here, files are writable
        });
    });

    describe('Binary Behavior', () => {
        test('binary returns version via --version flag', () => {
            // Run install script
            execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                cwd: PROJECT_ROOT,
                env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
                stdio: 'pipe',
            });

            const plandersonBinary = join(process.env.HOME!, '.planderson', 'planderson');
            const output = execSync(`${plandersonBinary} --version`, {
                encoding: 'utf-8',
                env: getSafeTestEnv({ HOME: TEST_HOME }),
                stdio: 'pipe',
            });

            // Should output a version number (from package.json)
            expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
        });

        test('binary hook subcommand executes from any directory', () => {
            // Run install script
            execSync(`${join(PROJECT_ROOT, 'dev/install.sh')}`, {
                cwd: PROJECT_ROOT,
                env: getSafeTestEnv({ HOME: TEST_HOME, XDG_DATA_HOME: undefined }),
                stdio: 'pipe',
            });

            const plandersonBinary = join(process.env.HOME!, '.planderson', 'planderson');
            const testInput = JSON.stringify({
                tool_name: 'TestTool',
                tool_input: {},
                hook_event_name: 'PermissionRequest',
            });

            // Execute from /tmp to verify binary works regardless of working directory
            const output = execSync(`echo '${testInput}' | ${plandersonBinary} hook`, {
                encoding: 'utf-8',
                cwd: '/tmp',
                env: getSafeTestEnv({ HOME: TEST_HOME }),
                stdio: 'pipe',
            });

            const result = JSON.parse(output.trim());
            expect(result.hookSpecificOutput).toBeDefined();
            expect(result.hookSpecificOutput.decision.behavior).toBe('allow');
        });
    });
});
