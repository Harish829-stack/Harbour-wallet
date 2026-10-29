// Per-install device identity for the Harbour API (twin of backend/clients/ts/hbclient.ts and backend/internal/devicesig).
// The key proves "same install" and nothing else: it never signs transactions and never touches wallet secrets.
// Preferred: a WebCrypto Ed25519 key created non-extractable and kept in IndexedDB. Browsers without WebCrypto Ed25519
// fall back to a random seed kept in the same IndexedDB store (still not a wallet credential).
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { HB_API_URL } from './config';

export interface Identity { deviceId: string; publicKeyB64: string; sign: (msg: Uint8Array) => Promise<Uint8Array> }
interface StoredKey { kind: 'webcrypto'; priv: CryptoKey; pub: string; deviceId?: string }
interface StoredSeed { kind: 'seed'; seed: string; pub: string; deviceId?: string }
type Stored = StoredKey | StoredSeed;

const enc = new TextEncoder();
export const b64url = (bytes: Uint8Array): string => {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

// ---- persistence (IndexedDB holds CryptoKey objects by structured clone) ----
const DB = 'harbour-device', OS = 'keys', KEY = 'device';
function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(OS);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(OS, mode); const req = fn(tx.objectStore(OS));
      req.onsuccess = () => resolve(req.result as T); req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}
let storage = {
  load: () => idb<Stored | undefined>('readonly', (s) => s.get(KEY)).catch(() => undefined),
  save: (v: Stored) => idb<unknown>('readwrite', (s) => s.put(v, KEY)),
  forget: () => idb<unknown>('readwrite', (s) => s.delete(KEY)).catch(() => undefined),
};
/** Tests and tools without IndexedDB swap the key store. */
export const setDeviceStorage = (s: typeof storage): void => { storage = s; pending = null; };
const load = () => storage.load();
const save = (v: Stored) => storage.save(v);
export const forgetDevice = () => storage.forget();

async function newKey(): Promise<Stored> {
  try {
    const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' } as any, false, ['sign', 'verify'])) as CryptoKeyPair;
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    return { kind: 'webcrypto', priv: kp.privateKey, pub: b64url(pub) };
  } catch {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    return { kind: 'seed', seed: b64url(seed), pub: b64url(ed25519.getPublicKey(seed)) };
  }
}
const signer = (k: Stored) => async (msg: Uint8Array): Promise<Uint8Array> =>
  k.kind === 'webcrypto' ? new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' } as any, k.priv, msg)) : ed25519.sign(msg, unb64url(k.seed));

// ---- proof-of-work registration ----
const leadingZeroBits = (h: Uint8Array): number => {
  let n = 0;
  for (const b of h) { if (b === 0) { n += 8; continue; } return n + Math.clz32(b) - 24; }
  return n;
};
/** Finds a counter so sha256(challenge:pub:counter) has `difficulty` leading zero bits; yields to the event loop between batches. */
export async function solvePow(challenge: string, pub: string, difficulty: number): Promise<string> {
  for (let i = 0; ; i++) {
    if (leadingZeroBits(sha256(enc.encode(`${challenge}:${pub}:${i}`))) >= difficulty) return String(i);
    if (i % 50_000 === 49_999) await new Promise((r) => setTimeout(r, 0));
  }
}

export class HarbourApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable: boolean) { super(message); }
}
export async function parseResponse(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new HarbourApiError(res.status, e.code ?? 'unknown', e.message ?? 'Something went wrong. Please try again.', !!e.retryable);
  }
  return body;
}

/** Highest proof-of-work difficulty the client accepts (the server uses 20-24 bits). */
export const MAX_POW_BITS = 26;
let pending: Promise<Identity> | null = null;
/** The registered device, registering (proof-of-work) on first use. Concurrent callers share one registration. */
export function deviceIdentity(base = HB_API_URL, f: typeof fetch = fetch): Promise<Identity> {
  pending ??= (async () => {
    let k = await load();
    if (!k) { k = await newKey(); await save(k); }
    const sign = signer(k);
    if (!k.deviceId) {
      const ch = await parseResponse(await f(`${base}/v1/devices/challenge`, { method: 'POST' }));
      // The server picks the difficulty; cap it so a hostile or broken server cannot stall the wallet forever.
      if (!Number.isInteger(ch.difficulty) || ch.difficulty < 0 || ch.difficulty > MAX_POW_BITS) throw new HarbourApiError(0, 'bad_challenge', 'Harbour could not set up this device. Please try again later.', true);
      const counter = await solvePow(ch.challenge, k.pub, ch.difficulty);
      const sig = b64url(await sign(enc.encode(`HB1-register\n${ch.challenge}`)));
      const reg = await parseResponse(await f(`${base}/v1/devices`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: k.pub, challenge: ch.challenge, pow_counter: counter, signature: sig }) }));
      k = { ...k, deviceId: String(reg.device_id) }; await save(k);
    }
    return { deviceId: k.deviceId!, publicKeyB64: k.pub, sign };
  })();
  pending.catch(() => { pending = null; }); // retry on the next call after a failure
  return pending;
}
/** Drops the cached identity (after the server forgot the device); the next call registers again with a fresh key. */
export async function resetDevice(): Promise<void> { pending = null; await forgetDevice(); }
