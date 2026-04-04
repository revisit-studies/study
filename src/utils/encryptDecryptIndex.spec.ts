import { describe, expect, test } from 'vitest';
import { decryptIndex, encryptIndex } from './encryptDecryptIndex';

describe('encryptIndex / decryptIndex', () => {
  test.each([0, 1, 5, 42, 99, 999])('round-trips index %i', (n) => {
    expect(decryptIndex(encryptIndex(n))).toBe(n);
  });

  test('encryptIndex produces a valid base64 string', () => {
    const encoded = encryptIndex(7);
    expect(() => atob(encoded)).not.toThrow();
    expect(typeof encoded).toBe('string');
  });

  test('different indices produce different encrypted values', () => {
    const enc1 = encryptIndex(1);
    const enc2 = encryptIndex(2);
    expect(enc1).not.toBe(enc2);
  });
});
