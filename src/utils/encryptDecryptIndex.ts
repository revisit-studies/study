// Using CryptoJS to encrypt and decrypt index since it's synchronous, unlike the Web Crypto API.
import { AES, enc, mode } from 'crypto-js';

const key = enc.Hex.parse('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');

export function encryptIndex(index: number): string {
  const encrypted = AES.encrypt(index.toString(), key, { mode: mode.ECB }).toString();
  return btoa(encrypted);
}

export function decryptIndex(index: string): number {
  const decrypted = AES.decrypt(atob(index), key, { mode: mode.ECB }).toString(enc.Utf8);
  return parseInt(decrypted, 10);
}
