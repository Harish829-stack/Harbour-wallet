// chrome.storage wrappers. Keys mirror TW schema (RE §6.2) with "wallet:" prefix.
import browser from 'webextension-polyfill';
import { secureStore, secureStoreAvailable } from './secureStore';

// PT-11: key material (vault, KDF record, keystores, biometric seal, perps/prediction credentials) lives in extension-origin IndexedDB,
// which content scripts cannot reach; everything else stays in chrome.storage.local. Callers keep using `local` unchanged.
// Wallet keystores are stored under their wallet-core identifier (a UUID).
const SECRET_KEYS = new Set(['wallet:vault', 'wallet:pbkdf2', 'wallet:passkey:vault', 'perps:agents:v1', 'predictions:creds:v1']);
const KEYSTORE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isSecretKey = (k: string): boolean => SECRET_KEYS.has(k) || KEYSTORE_ID.test(k);
/** Non-secret change marker in chrome.storage.local, so storage.onChanged listeners still see vault creation / removal. */
export const VAULT_REV = 'wallet:vaultRev';
const secure = (k: string) => isSecretKey(k) && secureStoreAvailable();
const legacyGet = async (k: string) => (await browser.storage.local.get(k))[k];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
async function touch(keys: string[]) { if (keys.includes('wallet:vault')) await browser.storage.local.set({ [VAULT_REV]: Date.now() }); }

/** Moves one legacy value into the secure store: written, read back and compared before the old copy is deleted. */
async function moveOne(k: string, v: unknown): Promise<void> {
  await secureStore.set(k, v);
  if (!same(await secureStore.get(k), v)) throw new Error('SECURE_STORE_VERIFY_FAILED');
  await browser.storage.local.remove(k);
}
/** Boot-time migration of every secret still in chrome.storage.local. Idempotent; a failure leaves the old copy (read lazily later). */
export async function migrateSecretsToSecureStore(): Promise<number> {
  if (!secureStoreAvailable()) return 0;
  const all = (await browser.storage.local.get(null)) as Record<string, unknown>; let n = 0;
  for (const [k, v] of Object.entries(all)) {
    if (!isSecretKey(k)) continue;
    if ((await secureStore.get(k)) === undefined) await moveOne(k, v); else await browser.storage.local.remove(k); // newer copy already moved
    n++;
  }
  return n;
}

export const local = {
  async get<T=any>(k: string): Promise<T | undefined> {
    if (!secure(k)) return (await browser.storage.local.get(k))[k] as T;
    const v = await secureStore.get<T>(k); if (v !== undefined) return v;
    const old = await legacyGet(k); if (old !== undefined) { try { await moveOne(k, old); } catch { /* keep using the old copy */ } }
    return old as T | undefined;
  },
  async set(k: string, v: unknown) {
    if (!secure(k)) { await browser.storage.local.set({ [k]: v }); return; }
    await secureStore.set(k, v); await browser.storage.local.remove(k); await touch([k]);
  },
  /** Several keys in one write, applied all-or-nothing within each store (secrets go in ONE IndexedDB transaction: key-schedule migration). */
  async setMany(o: Record<string, unknown>) {
    const sec: Record<string, unknown> = {}; const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) (secure(k) ? sec : rest)[k] = v;
    if (Object.keys(sec).length) { await secureStore.setMany(sec); await browser.storage.local.remove(Object.keys(sec)); await touch(Object.keys(sec)); }
    if (Object.keys(rest).length) await browser.storage.local.set(rest);
  },
  async remove(k: string) {
    if (secure(k)) { await secureStore.remove(k); await touch([k]); }
    await browser.storage.local.remove(k); // also any legacy copy, so it can never be resurrected by the lazy migration
  },
};
export const session = {
  async get<T=any>(k: string): Promise<T | undefined> { return (await browser.storage.session.get(k))[k] as T; },
  async set(k: string, v: unknown) { await browser.storage.session.set({ [k]: v }); },
  async remove(k: string) { await browser.storage.session.remove(k); },
};
export const KEYS = {
  STORE: 'wallet:store', PBKDF2: 'wallet:pbkdf2', VAULT: 'wallet:vault',
  VAULT_ID: 'wallet:vaultId', THROTTLE: 'wallet:throttle',
  PASSWORD: 'wallet:password', UNLOCK: 'wallet:unlock', UI: 'wallet:ui',
  SETTINGS: 'wallet:settings', PASSKEY: 'wallet:passkey', REVEAL: 'wallet:revealGrant', ADD_WALLET: 'wallet:addWalletGrant', MANAGE: 'wallet:manageGrant', NETWORKS: 'wallet:networks', PASSKEY_VAULT: 'wallet:passkey:vault', FIAT_RATES: 'wallet:fiatRates',
  // Blobs encrypted under the keystore passphrase (they must be re-encrypted together with the keystores on a key-schedule migration).
  PERPS_AGENTS: 'perps:agents:v1', PREDICTIONS_CREDS: 'predictions:creds:v1',
  wallets: (vaultId: string) => `wallet:wallets:${vaultId}`,
};
