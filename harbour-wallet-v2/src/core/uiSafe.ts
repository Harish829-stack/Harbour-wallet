// Last line of defence for the "dumb UI" rule: every response the service worker sends to an extension page goes through
// `uiSafe`. A response carrying a field whose name marks key material (phrase, private key, password...) is replaced by an
// error, so a regression in any handler fails loudly in tests and in the UI instead of handing a secret to the popup.
// Field names only (values are not inspected); the list is exact so ordinary data (e.g. NFT attributes) is not affected.
const FORBIDDEN = new Set(['mnemonic', 'seedphrase', 'secretphrase', 'privatekey', 'secretkey', 'password', 'passwordkey', 'unlockkey', 'xprv', 'storedkeys', 'keystore']);
const norm = (k: string) => k.toLowerCase().replace(/[_-]/g, '');

export function findSecretField(v: unknown, depth = 0, seen: Set<object> = new Set()): string | null {
  if (!v || typeof v !== 'object' || depth > 5 || seen.has(v as object)) return null;
  seen.add(v as object);
  if (Array.isArray(v)) { for (const x of v.slice(0, 500)) { const r = findSecretField(x, depth + 1, seen); if (r) return r; } return null; }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (FORBIDDEN.has(norm(k)) && x !== undefined && x !== null && x !== false) return k;
    const r = findSecretField(x, depth + 1, seen); if (r) return r;
  }
  return null;
}

export function uiSafe<T>(result: T): T | { ok: false; error: 'SECRET_FIELD_BLOCKED'; field: string } {
  const field = findSecretField(result);
  return field ? { ok: false, error: 'SECRET_FIELD_BLOCKED', field } : result;
}
