import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';

import { useTempDir, useTempPlanFile } from './temp-dirs';

describe('fixtures temp-dirs', () => {
    describe('useTempDir', () => {
        test('creates unique temp directory', () => {
            const dir = useTempDir();

            expect(fs.existsSync(dir)).toBe(true);
            expect(dir).toContain('planderson-test-');
        });

        test('creates directories with custom prefix', () => {
            const dir = useTempDir('custom-');

            expect(dir).toContain('custom-');
        });

        test('creates unique directories per call', () => {
            const dir1 = useTempDir();
            const dir2 = useTempDir();

            expect(dir1).not.toBe(dir2);
        });
    });

    describe('useTempPlanFile', () => {
        test('creates temp plan file with content', () => {
            const file = useTempPlanFile('# Test Plan\nContent');

            expect(fs.existsSync(file)).toBe(true);
            expect(file).toEndWith('.md');

            const content = fs.readFileSync(file, 'utf-8');
            expect(content).toBe('# Test Plan\nContent');
        });

        test('creates file with custom filename', () => {
            const file = useTempPlanFile('content', 'custom.md');

            expect(file).toEndWith('custom.md');
        });
    });
});
