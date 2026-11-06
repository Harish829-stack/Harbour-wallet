// Bitcoin-alphabet base58 (no checksum), as used for Solana keys and signatures. Pure; shared by the inpage provider and the background.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP: Record<string, number> = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));
export function b58encode(bytes: Uint8Array): string {
  let zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}
export function b58decode(str: string): Uint8Array {
  if (typeof str !== 'string') throw new Error('base58: not a string');
  let zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < str.length; i++) {
    const v = MAP[str[i]]; if (v === undefined) throw new Error('base58: invalid character');
    let carry = v;
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[zeros + i] = bytes[bytes.length - 1 - i];
  return out;
}
export const isSolanaAddress = (s: unknown): s is string => { if (typeof s !== 'string' || s.length < 32 || s.length > 44) return false; try { return b58decode(s).length === 32; } catch { return false; } };

// base64 helpers that work in pages, content scripts and service workers (no Buffer).
export const bytesToB64 = (b: Uint8Array): string => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
export const b64ToBytes = (s: string): Uint8Array => { if (typeof s !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('invalid base64'); return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
