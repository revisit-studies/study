import {
  describe, expect, it,
} from 'vitest';
import { normalizeConfidenceValue } from './CustomResponseCard';

describe('normalizeConfidenceValue', () => {
  it('accepts numeric strings while the user is typing', () => {
    expect(normalizeConfidenceValue('80')).toBe(80);
  });

  it('preserves numeric input values', () => {
    expect(normalizeConfidenceValue(80)).toBe(80);
  });

  it('treats blank or invalid input as empty', () => {
    expect(normalizeConfidenceValue('')).toBeNull();
    expect(normalizeConfidenceValue('abc')).toBeNull();
  });
});
