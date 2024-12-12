// Using CryptoJS to encrypt and decrypt index since it's synchronous, unlike the Web Crypto API.
import * as CryptoJS from 'crypto-js';

export function encryptIndex(index: number): string {
  const encrypted = CryptoJS.AES.encrypt(index.toString(), 'notSecret').toString();
  return btoa(encrypted);
}

export function decryptIndex(index: string): number {
  const decrypted = CryptoJS.AES.decrypt(atob(index), 'notSecret').toString(CryptoJS.enc.Utf8);
  return parseInt(decrypted, 10);
}
