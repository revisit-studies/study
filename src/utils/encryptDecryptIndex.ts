// Using CryptoJS to encrypt and decrypt index since it's synchronous, unlike the Web Crypto API.
import { AES, enc } from 'crypto-js';

export function encryptIndex(index: number): string {
  const encrypted = AES.encrypt(index.toString(), 'notSecret').toString();
  return btoa(encrypted);
}

export function decryptIndex(index: string): number {
  const decrypted = AES.decrypt(atob(index), 'notSecret').toString(enc.Utf8);
  return parseInt(decrypted, 10);
}
