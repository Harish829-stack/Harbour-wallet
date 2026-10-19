// Password → key derivation. RE source: trust-wallet-RE.md §4.1 (PasswordService).
// PBKDF2-HMAC-SHA512 via wallet-core; 512-bit output; 32-byte random salt.
// DEFAULT_ITERATIONS=20000 (password key), UNLOCK_ITERATIONS=210000 (unlock key).
export const DEFAULT_ITERATIONS = 20000;
export const UNLOCK_ITERATIONS = 210000;
export const DEFAULT_BIT_KEY_LEN = 512;

export class PasswordService {
  constructor(core) { this.core = core; }

  // mirrors TW: hmacSha512(passwordBytes, salt, iterations, 512)
  hash(password, salt, iterations = DEFAULT_ITERATIONS) {
    const pwBytes = Buffer.from(password, 'utf8');
    return this.core.PBKDF2.hmacSha512(pwBytes, salt, iterations, DEFAULT_BIT_KEY_LEN / 8 * 8 === DEFAULT_BIT_KEY_LEN ? DEFAULT_BIT_KEY_LEN : DEFAULT_BIT_KEY_LEN);
  }

  generateSalt(len = 32) {
    const a = new Uint8Array(len);
    (globalThis.crypto || require('node:crypto').webcrypto).getRandomValues(a);
    return a;
  }

  // TW stores the derived key as hex (decodeUIntToHex). Returns hex string.
  deriveKeyHex(password, salt, iterations) {
    const out = this.hash(password, salt, iterations);
    return this.core.HexCoding.encode(out); // 0x-prefixed hex, matches decodeUIntToHex usage
  }
}
