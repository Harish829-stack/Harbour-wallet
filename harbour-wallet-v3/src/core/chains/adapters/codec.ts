// Small pure encoders/decoders shared by the non-EVM adapters (no DOM, no chrome APIs).
import { sha256 } from '@noble/hashes/sha256';

export const bytesToHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export function hexToBytes(h: string): Uint8Array {
  const s = h.replace(/^0x/i, '');
  if (s.length % 2 || /[^0-9a-fA-F]/.test(s)) throw new Error('bad hex');
  return Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16));
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) { const i = B58.indexOf(ch); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i); }
  const hex = n === 0n ? '' : n.toString(16);
  const body = hexToBytes(hex.length % 2 ? '0' + hex : hex);
  let zeros = 0; while (zeros < s.length && s[zeros] === '1') zeros++;
  const out = new Uint8Array(zeros + body.length); out.set(body, zeros); return out;
}
export function base58Encode(b: Uint8Array): string {
  let n = 0n; for (const x of b) n = (n << 8n) | BigInt(x);
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  let zeros = 0; while (zeros < b.length && b[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + s;
}
const checksum = (p: Uint8Array) => sha256(sha256(p)).slice(0, 4);
/** Base58Check (Tron / Bitcoin style). Returns the payload without the 4-byte checksum; throws on a bad checksum. */
export function base58CheckDecode(s: string): Uint8Array {
  const raw = base58Decode(s); if (raw.length < 5) throw new Error('too short');
  const p = raw.slice(0, -4); const c = raw.slice(-4); const e = checksum(p);
  if (c.some((x, i) => x !== e[i])) throw new Error('bad checksum');
  return p;
}
export function base58CheckEncode(p: Uint8Array): string { const o = new Uint8Array(p.length + 4); o.set(p); o.set(checksum(p), p.length); return base58Encode(o); }

const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values: number[]): number {
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; let chk = 1;
  for (const v of values) { const top = chk >>> 25; chk = ((chk & 0x1ffffff) << 5) ^ v; for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= G[i]; }
  return chk >>> 0;
}
/** Classic bech32 (checksum constant 1; Zilliqa, Harmony, IoTeX). Returns the hrp and the payload converted to bytes. */
export function bech32Decode(addr: string): { hrp: string; bytes: Uint8Array } {
  const s = addr.toLowerCase(); if (s !== addr && s !== addr.toUpperCase()) throw new Error('mixed case');
  const pos = s.lastIndexOf('1'); if (pos < 1 || pos + 7 > s.length) throw new Error('bad bech32');
  const hrp = s.slice(0, pos); const data: number[] = [];
  for (const ch of s.slice(pos + 1)) { const i = BECH.indexOf(ch); if (i < 0) throw new Error('bad bech32 char'); data.push(i); }
  const exp = [...Array.from(hrp, (c) => c.charCodeAt(0) >> 5), 0, ...Array.from(hrp, (c) => c.charCodeAt(0) & 31)];
  if (polymod([...exp, ...data]) !== 1) throw new Error('bad bech32 checksum');
  let acc = 0, bits = 0; const out: number[] = [];
  for (const v of data.slice(0, -6)) { acc = (acc << 5) | v; bits += 5; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); } }
  return { hrp, bytes: Uint8Array.from(out) };
}
/** `zil1…` / `one1…` / `io1…` -> 20-byte hex (no 0x). 0x/plain-hex input is normalised and passed through. */
export function bech32ToHex20(addr: string, hrp: string): string {
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(addr)) return addr.replace(/^0x/, '').toLowerCase();
  const d = bech32Decode(addr); if (d.hrp !== hrp || d.bytes.length !== 20) throw new Error('bad address');
  return bytesToHex(d.bytes);
}

/** Exact decimal string -> integer base units (no float math). Rejects negatives / junk. */
export function parseDecimal(v: unknown, decimals: number): bigint {
  const s = String(v ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('bad amount');
  const [w, f = ''] = s.split('.');
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
}
/** Strict integer parse for amounts (decimal string / safe integer number / 0x hex). Throws instead of guessing. */
export function toBig(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') { if (!Number.isSafeInteger(v) || v < 0) throw new Error('bad amount'); return BigInt(v); }
  const s = String(v ?? '').trim();
  if (/^0x[0-9a-fA-F]+$/.test(s) || /^\d+$/.test(s)) return BigInt(s);
  throw new Error('bad amount');
}
/** Pull an unsigned integer field out of raw JSON text, so values above 2^53 are not rounded by JSON.parse. */
export function intField(text: string, key: string): bigint | undefined {
  const m = new RegExp(`"${key.replace(/[^\w-]/g, '')}"\\s*:\\s*(\\d+)`).exec(text); return m ? BigInt(m[1]) : undefined;
}
