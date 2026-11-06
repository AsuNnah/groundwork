import { expect, test } from 'vitest';
import { sum } from './sum.js';
test('adds', () => expect(sum(1, 2)).toBe(3));
