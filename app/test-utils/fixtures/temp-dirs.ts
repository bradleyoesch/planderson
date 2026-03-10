import { afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Create a unique temporary directory with automatic cleanup.
 * Cleanup is registered immediately via afterEach hook.
 *
 * @param prefix - Directory name prefix (default: 'planderson-test-')
 * @returns Absolute path to created directory
 */
export const useTempDir = (prefix = 'planderson-test-'): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

    afterEach(() => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    return dir;
};

/**
 * Create a temporary plan file with automatic cleanup.
 * File is created in a unique temp directory.
 *
 * @param content - File content
 * @param filename - File name (default: 'test-plan.md')
 * @returns Absolute path to created file
 */
export const useTempPlanFile = (content: string, filename = 'test-plan.md'): string => {
    const dir = useTempDir();
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
};
