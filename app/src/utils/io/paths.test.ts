import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { useTempDir } from '~/test-utils/fixtures';

import { getPlandersonBaseDir, getPlandersonInitScriptPath } from './paths';

describe('io paths', () => {
    let tempHomeDir: string;
    let plandersonDir: string;

    beforeEach(() => {
        tempHomeDir = useTempDir();
        spyOn(os, 'homedir').mockReturnValue(tempHomeDir);
        plandersonDir = path.join(tempHomeDir, '.planderson');
        fs.mkdirSync(plandersonDir, { recursive: true });
    });

    afterEach(() => {
        mock.restore();
    });

    describe('getPlandersonBaseDir', () => {
        test('returns ~/.planderson when no dev.json exists', () => {
            const result = getPlandersonBaseDir();

            expect(result).toBe(path.join(tempHomeDir, '.planderson'));
        });

        test('returns baseDir from dev.json when file exists', () => {
            const customBase = path.join(tempHomeDir, 'my-worktree');
            fs.writeFileSync(path.join(plandersonDir, 'dev.json'), JSON.stringify({ baseDir: customBase }));

            const result = getPlandersonBaseDir();

            expect(result).toBe(customBase);
        });

        test('falls back to default when dev.json contains malformed JSON', () => {
            fs.writeFileSync(path.join(plandersonDir, 'dev.json'), 'not valid json{{');

            const result = getPlandersonBaseDir();

            expect(result).toBe(path.join(tempHomeDir, '.planderson'));
        });

        test('falls back to default when dev.json is missing baseDir field', () => {
            fs.writeFileSync(path.join(plandersonDir, 'dev.json'), JSON.stringify({ someOtherField: 'value' }));

            const result = getPlandersonBaseDir();

            expect(result).toBe(path.join(tempHomeDir, '.planderson'));
        });
    });

    describe('getPlandersonInitScriptPath', () => {
        test('returns path to init.sh under the base dir', () => {
            const result = getPlandersonInitScriptPath();

            expect(result).toBe(path.join(tempHomeDir, '.planderson', 'integrations', 'tmux', 'init.sh'));
        });

        test('uses baseDir from dev.json when available', () => {
            const customBase = path.join(tempHomeDir, 'my-worktree');
            fs.writeFileSync(path.join(plandersonDir, 'dev.json'), JSON.stringify({ baseDir: customBase }));

            const result = getPlandersonInitScriptPath();

            expect(result).toBe(path.join(customBase, 'integrations', 'tmux', 'init.sh'));
        });
    });
});
