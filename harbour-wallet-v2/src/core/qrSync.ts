// "Sync with Mobile": import wallets from the Trust Wallet mobile app's animated QR.
// Format recovered from the extension bundle (chunks/import-qr-nu_XkZeU.js, `createQrSyncReader`) [certain]:
//   frames are Blockchain-Commons UR parts (`ur:bytes/<seq>-<total>/...`, fountain coded) -> CBOR byte string -> gzip ->
//   UTF-8 JSON array of *minified* wallet-core StoredKeys, encrypted under a 6-character one-time code shown on the phone.
//   minified keys: c = crypto {c cipher, p {i iv}, t ciphertext, k kdf, kp {d dklen, n, p, r, s salt}, m mac}, t = type, a = active account, b = balance, n = name.
// Limits mirror TW's (400 KiB compressed, 1 MB inflated, sequence numbers 1..2048) so a hostile QR cannot exhaust memory.
// Harbour never sees the mobile password; the code only decrypts the exported keys on this device.
import { URDecoder } from '@ngraveio/bc-ur';
import { scryptAsync } from '@noble/hashes/scrypt';
import { keccak_256 } from '@noble/hashes/sha3';

export const MAX_COMPRESSED = 409_600, MAX_INFLATED = 1_000_000;
const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= 2048;

export interface MinKey { c: { c: string; p: { i: string }; t: string; k: string; kp: { d: number; n: number; p: number; r: number; s: string }; m: string }; t: unknown; a?: number | null; b?: unknown; n?: string }
export const unminify = (list: MinKey[]) => list.map((t) => ({
  // wallet-core's JSON parser ABORTS the wasm runtime on unexpected shapes, so only well-typed optional fields are passed on
  // (TW: `activeAccounts: a != null ? [a] : []`; `a` is an account object, `b` a numeric balance) [certain: unminify code].
  id: 'temporary-id', type: t.t, name: typeof t.n === 'string' ? t.n : '', version: 1, activeAccounts: t.a != null && typeof t.a === 'object' ? [t.a] : [],
  crypto: { cipher: t.c.c, cipherparams: { iv: t.c.p.i }, ciphertext: t.c.t, kdf: t.c.k, kdfparams: { dklen: t.c.kp.d, n: t.c.kp.n, p: t.c.kp.p, r: t.c.kp.r, salt: t.c.kp.s }, mac: t.c.m }, ...(typeof t.b === 'number' ? { balance: t.b } : {}),
}));

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  if (data.length > MAX_COMPRESSED) throw new Error('QR payload exceeds the maximum compressed size');
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.length; if (total > MAX_INFLATED) { await reader.cancel(); throw new Error('QR payload exceeds the maximum decompressed size'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

export function createQrSyncReader() {
  let dec = new URDecoder(); let rejected = false; let progress = 0;
  return {
    get progress() { return progress; },
    // Feed one scanned frame. Returns null until the transfer is complete, then the (unminified) stored keys.
    async receive(frame: string): Promise<ReturnType<typeof unminify> | null> {
      if (rejected) throw new Error('QR payload was already rejected');
      const text = String(frame).trim();
      if (!/^ur:/i.test(text)) throw new Error('Not a wallet sync QR code');
      const [, parts] = URDecoder.parse(text);
      if (parts.length >= 2) { const [seq, total] = URDecoder.parseSequenceComponent(parts[0]); if (!inRange(seq) || !inRange(total)) throw new Error('QR frame declares an out-of-range sequence'); }
      dec.receivePart(text);
      progress = dec.estimatedPercentComplete?.() ?? 0;
      if (!dec.isComplete()) return null;
      try {
        if (!dec.isSuccess()) throw new Error('QR transfer failed');
        const bytes = dec.resultUR().decodeCBOR() as Uint8Array;
        const json = new TextDecoder().decode(await gunzip(bytes));
        const arr = JSON.parse(json);
        if (!Array.isArray(arr) || !arr.length || arr.length > 100) throw new Error('Unexpected QR contents');
        return unminify(arr);
      } catch (e) { rejected = true; throw e; }
    },
    reset() { dec = new URDecoder(); rejected = false; progress = 0; },
  };
}

export const ONE_TIME_CODE = /^[A-Za-z0-9]{6}$/;

// wallet-core ABORTS the wasm runtime on a wrong password (it cannot be caught), so the one-time code is checked first with the
// standard keystore MAC: keccak256(derivedKey[16..32] || ciphertext) == mac, derivedKey = scrypt(code, salt, N, r, p, dklen).
const hex = (h: string): Uint8Array => { if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error('bad hex'); return Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16)); };
export async function codeMatchesKey(key: ReturnType<typeof unminify>[number], code: string): Promise<boolean> {
  const c = key?.crypto; const kp = c?.kdfparams;
  if (!c || !kp || c.kdf !== 'scrypt') return false;
  const { n, r, p, dklen } = kp; const bounded = (v: number, max: number) => Number.isInteger(v) && v >= 1 && v <= max;
  if (!bounded(n, 1 << 20) || (n & (n - 1)) !== 0 || !bounded(r, 16) || !bounded(p, 8) || !bounded(dklen, 64) || dklen < 32) return false;
  try {
    const dk = await scryptAsync(new TextEncoder().encode(code), hex(kp.salt), { N: n, r, p, dkLen: dklen });
    const ct = hex(c.ciphertext); const buf = new Uint8Array(16 + ct.length); buf.set(dk.subarray(16, 32)); buf.set(ct, 16);
    const mac = keccak_256(buf); const want = hex(c.mac);
    if (mac.length !== want.length) return false;
    let diff = 0; for (let i = 0; i < mac.length; i++) diff |= mac[i] ^ want[i];
    return diff === 0;
  } catch { return false; }
}

const isHex = (v: unknown, max = 8192): v is string => typeof v === 'string' && v.length <= max && /^([0-9a-f]{2})*$/i.test(v);
// Strict shape check before anything reaches wallet-core (its JSON parser aborts the whole wasm runtime on surprises).
export function isWellFormedKey(k: any): boolean {
  const c = k?.crypto; const kp = c?.kdfparams;
  return !!c && !!kp && typeof k.type === 'string' && /^(aes-128-ctr|aes-192-ctr|aes-256-ctr)$/.test(c.cipher) && c.kdf === 'scrypt'
    && isHex(c.cipherparams?.iv, 64) && isHex(c.ciphertext) && isHex(c.mac, 128) && isHex(kp.salt, 256)
    && [kp.n, kp.r, kp.p, kp.dklen].every((x: unknown) => Number.isInteger(x));
}
