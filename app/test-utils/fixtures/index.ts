/**
 * Auto-scoped test fixtures with automatic cleanup.
 *
 * Each fixture function registers cleanup via afterEach hook.
 * Tests get isolated resources with guaranteed cleanup even on failure.
 *
 * @example
 * ```typescript
 * import { useTempPlanFile, useTestSocket } from '~/test-utils/fixtures';
 *
 * test('my test', () => {
 *     const file = useTempPlanFile('# Plan content');
 *     const { path } = useTestSocket('my-test');
 *     // Cleanup automatic!
 * });
 * ```
 */

export { useTestSocket } from './sockets';
export { useTempDir, useTempPlanFile } from './temp-dirs';
