import { describe, expect, test } from 'bun:test';

import { parseArguments } from './args';

describe('cli args', () => {
    describe('registry ID parsing', () => {
        test('parses --pane argument (backward compatibility)', () => {
            const result = parseArguments(['--pane', '%42', 'other', 'args']);
            expect(result.registryId).toBe('%42');
            expect(result.sessionId).toBeNull();
            expect(result.filepath).toBeNull();
            expect(result.remainingArgs).toEqual(['other', 'args']);
        });

        test('parses --registry argument', () => {
            const result = parseArguments(['--registry', 'tmux-pane-%42', 'other', 'args']);
            expect(result.registryId).toBe('tmux-pane-%42');
            expect(result.sessionId).toBeNull();
            expect(result.filepath).toBeNull();
            expect(result.remainingArgs).toEqual(['other', 'args']);
        });

        test('prefers --registry over --pane when both provided', () => {
            const result = parseArguments(['--registry', 'reg123', '--pane', '%42']);
            expect(result.registryId).toBe('reg123');
            // --pane remains in args since --registry was used
            expect(result.remainingArgs).toEqual(['--pane', '%42']);
        });

        test('returns null when no registry ID provided', () => {
            const result = parseArguments(['other', 'args']);
            expect(result.registryId).toBeNull();
            expect(result.remainingArgs).toEqual(['other', 'args']);
        });

        test('returns null when --pane has no value', () => {
            const result = parseArguments(['--pane']);
            expect(result.registryId).toBeNull();
            expect(result.remainingArgs).toEqual(['--pane']);
        });

        test('handles --pane at different positions', () => {
            const result = parseArguments(['other', '--pane', '%99', 'args']);
            expect(result.registryId).toBe('%99');
            expect(result.remainingArgs).toEqual(['other', 'args']);
        });

        test('handles --pane at end of args', () => {
            const result = parseArguments(['other', 'args', '--pane', '%0']);
            expect(result.registryId).toBe('%0');
            expect(result.remainingArgs).toEqual(['other', 'args']);
        });
    });

    describe('session ID parsing', () => {
        test('parses --session argument', () => {
            const result = parseArguments(['--session', 'abc123']);
            expect(result.sessionId).toBe('abc123');
            expect(result.registryId).toBeNull();
            expect(result.filepath).toBeNull();
            expect(result.remainingArgs).toEqual([]);
        });

        test('parses --session with other flags', () => {
            const result = parseArguments(['--pane', '%42', '--session', 'xyz789', 'other', 'args']);
            expect(result.registryId).toBe('%42');
            expect(result.sessionId).toBe('xyz789');
            expect(result.remainingArgs).toEqual(['other', 'args']);
        });

        test('returns null when --session has no value', () => {
            const result = parseArguments(['--session']);
            expect(result.sessionId).toBeNull();
            expect(result.remainingArgs).toEqual(['--session']);
        });
    });

    describe('file path parsing', () => {
        test('parses --file argument', () => {
            const result = parseArguments(['--file', 'plan.md']);
            expect(result.filepath).toBe('plan.md');
            expect(result.registryId).toBeNull();
            expect(result.sessionId).toBeNull();
            expect(result.remainingArgs).toEqual([]);
        });

        test('parses positional file argument when it is the only argument', () => {
            const result = parseArguments(['test-plan.md']);
            expect(result.filepath).toBe('test-plan.md');
            expect(result.remainingArgs).toEqual([]);
        });

        test('does not treat positional argument as file when multiple arguments present', () => {
            const result = parseArguments(['test-plan.md', 'other']);
            expect(result.filepath).toBeNull();
            expect(result.remainingArgs).toEqual(['test-plan.md', 'other']);
        });

        test('prefers --file over positional argument', () => {
            const result = parseArguments(['--file', 'explicit.md', 'positional.md']);
            expect(result.filepath).toBe('explicit.md');
            expect(result.remainingArgs).toEqual(['positional.md']);
        });

        test('does not treat flags as positional file', () => {
            const result = parseArguments(['--other-flag', 'value']);
            expect(result.filepath).toBeNull();
            expect(result.remainingArgs).toEqual(['--other-flag', 'value']);
        });

        test('returns null when --file has no value', () => {
            const result = parseArguments(['--file']);
            expect(result.filepath).toBeNull();
            expect(result.remainingArgs).toEqual(['--file']);
        });
    });

    describe('combined parsing', () => {
        test('parses all flags together', () => {
            const result = parseArguments(['--pane', '%1', '--session', 'sess123', '--file', 'plan.md', 'extra']);
            expect(result.registryId).toBe('%1');
            expect(result.sessionId).toBe('sess123');
            expect(result.filepath).toBe('plan.md');
            expect(result.remainingArgs).toEqual(['extra']);
        });

        test('preserves unknown flags', () => {
            const result = parseArguments(['--unknown', 'value', '--pane', '%42', '--other']);
            expect(result.registryId).toBe('%42');
            expect(result.remainingArgs).toEqual(['--unknown', 'value', '--other']);
        });

        test('does not modify original args array', () => {
            const originalArgs = ['--pane', '%42', 'other', 'args'];
            const result = parseArguments(originalArgs);
            expect(originalArgs).toEqual(['--pane', '%42', 'other', 'args']);
            expect(result.registryId).toBe('%42');
            expect(result.remainingArgs).toEqual(['other', 'args']);
        });
    });
});
