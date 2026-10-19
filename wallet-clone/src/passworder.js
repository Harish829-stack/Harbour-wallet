// Outer vault encryption. RE source: §4.3 Layer B / §4.6 (passworder-style).
// PBKDF2-SHA256 10000 iters over the unlock key -> AES-GCM-256, random 16-byte IV.
const webcrypto = globalThis.crypto || (await import('node:crypto')).webcrypto;
const PBKDF2_ITERATIONS = 10000; // RE'd value (§4.3)

async function keyFromPassword(password, saltB64) {
  const pw = new TextEncoder().encode(password);
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const base = await webcrypto.subtle.importKey('raw', pw, { name: 'PBKDF2' }, false, ['deriveKey']);
  return webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
function genSaltB64(len = 32) {
  const a = new Uint8Array(len); webcrypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a));
}
export async function encrypt(password, obj) {
  const salt = genSaltB64();
  const key = await keyFromPassword(password, salt);
  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  return JSON.stringify({ data: btoa(String.fromCharCode(...ct)), iv: btoa(String.fromCharCode(...iv)), salt });
}
export async function decrypt(password, payloadStr) {
  const { data, iv, salt } = JSON.parse(payloadStr);
  const key = await keyFromPassword(password, salt);
  const ct = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const ivb = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  try {
    const pt = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: ivb }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt));
  } catch { throw new Error('Incorrect password'); }
}
