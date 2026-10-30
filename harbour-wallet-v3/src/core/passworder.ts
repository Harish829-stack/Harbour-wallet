// Outer vault layer: AES-256-GCM under a key derived from a machine-generated secret. RE §4.3 describes Trust Wallet's
// PBKDF2-SHA256 10k envelope; Harbour keeps reading it (v1) but writes v2.
//
// v2: HKDF-SHA256(secret, random 32-byte salt) -> AES-GCM-256, random 12-byte IV. Every secret passed in here is already a
// high-entropy key (the vault unlock key and keystore passphrase from keySchedule.ts, or the 32-byte passkey secret), never a
// human password, so password stretching belongs to keySchedule.ts and a second slow KDF here would only add latency to every
// vault write. encrypt() refuses short inputs so a human password can never be passed in by mistake.
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const LEGACY_PBKDF2_ITERATIONS = 10000;
const MIN_SECRET_CHARS = 32;
const INFO = new TextEncoder().encode('harbour/passworder/v2');

async function keyV2(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: INFO }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function keyV1(password: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: LEGACY_PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(secret: string, obj: unknown): Promise<string> {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_CHARS) throw new Error('passworder needs a derived high-entropy key, not a password');
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const key = await keyV2(secret, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  return JSON.stringify({ v: 2, data: b64(ct), iv: b64(iv), salt: b64(salt) });
}
export async function decrypt<T = unknown>(secret: string, payload: string): Promise<T> {
  const { v, data, iv, salt } = JSON.parse(payload);
  try {
    const key = v === 2 ? await keyV2(secret, unb64(salt)) : await keyV1(secret, salt);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(data));
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch { throw new Error('Incorrect password'); }
}
