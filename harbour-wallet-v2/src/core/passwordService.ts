// PBKDF2-HMAC-SHA512 via wallet-core. RE §4.1.
export const DEFAULT_ITERATIONS = 20000;
export const UNLOCK_ITERATIONS = 210000;
export const KEY_LEN_BYTES = 64; // 512-bit
export class PasswordService {
  constructor(private core: any) {}
  hash(password: string, salt: Uint8Array, iterations = DEFAULT_ITERATIONS): Uint8Array {
    return this.core.PBKDF2.hmacSha512(new TextEncoder().encode(password), salt, iterations, KEY_LEN_BYTES);
  }
  generateSalt(len = 32): Uint8Array {
    const a = new Uint8Array(len); crypto.getRandomValues(a); return a;
  }
  deriveKeyHex(password: string, salt: Uint8Array, iterations: number): string {
    return this.core.HexCoding.encode(this.hash(password, salt, iterations));
  }
}
