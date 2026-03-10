import { describe, expect, test } from 'bun:test';

import { stripVersionPrefix } from './update';

describe('commands update', () => {
    describe('stripVersionPrefix', () => {
        test('strips v prefix', () => expect(stripVersionPrefix('v0.3.0')).toBe('0.3.0'));
        test('no-ops without v prefix', () => expect(stripVersionPrefix('0.3.0')).toBe('0.3.0'));
    });
});
