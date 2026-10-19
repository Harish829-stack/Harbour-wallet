// Outer vault layer: PBKDF2-SHA256 10k -> AES-GCM-256, random 16-byte IV. RE §4.3.
const PBKDF2_ITERATIONS = 10000;
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function keyFromPassword(password: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(password: string, obj: unknown): Promise<string> {
  const salt = b64(crypto.getRandomValues(new Uint8Array(32)));
  const key = await keyFromPassword(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  return JSON.stringify({ data: b64(ct), iv: b64(iv), salt });
}
export async function decrypt<T = unknown>(password: string, payload: string): Promise<T> {
  const { data, iv, salt } = JSON.parse(payload);
  const key = await keyFromPassword(password, salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(data));
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch { throw new Error('Incorrect password'); }
}
