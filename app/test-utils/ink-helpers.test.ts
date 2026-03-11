import { describe, expect, test } from 'bun:test';

import { waitFor } from './ink-helpers';

describe('test-utils ink-helpers', () => {
    test('yields to macrotask queue after assertion passes', async () => {
        let sideEffectRan = false;
        setTimeout(() => {
            sideEffectRan = true;
        }, 0);

        // assertion passes immediately
        await waitFor(() => expect(true).toBe(true));

        // setTimeout(0) must have run by now
        expect(sideEffectRan).toBe(true);
    });

    test('polls until assertion passes', async () => {
        let ready = false;
        setTimeout(() => {
            ready = true;
        }, 20);

        await waitFor(() => expect(ready).toBe(true));
        expect(ready).toBe(true);
    });

    test('throws after timeout', async () => {
        await expect(waitFor(() => expect(false).toBe(true), 50)).rejects.toThrow();
    });
});
