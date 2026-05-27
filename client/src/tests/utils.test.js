import { describe, test, expect } from 'vitest';
import { formatINR } from '../lib/utils.js';

describe('INR Formatter Utilities', () => {
  test('formats numbers using the Indian numbering system', () => {
    expect(formatINR(123456)).toContain('1,23,456');
    expect(formatINR(10000000)).toContain('1,00,00,000');
    expect(formatINR(0)).toContain('0.00');
  });
});
