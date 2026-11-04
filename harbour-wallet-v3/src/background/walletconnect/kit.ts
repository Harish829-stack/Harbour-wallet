// WalletKit (Reown) construction for the extension service worker. Persistence goes to the extension-origin secure store (IndexedDB).
import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { local } from '../../core/storage';
import { secureStore, secureStoreAvailable } from '../../core/secureStore';
import type { KitLike } from './bridge';

const PREFIX = 'harbour:wc:kv:';
// IKeyValueStorage for WalletKit; values are JSON-serialised like the SDK's own browser storage. PT-11: the relay keychain (session
// symmetric keys) lives in extension-origin IndexedDB, out of reach of content scripts; chrome.storage.local is the fallback only.
const chromeKv = {
  async keys(): Promise<string[]> { return Object.keys((await chrome.storage.local.get(null)) as Record<string, unknown>).filter((k) => k.startsWith(PREFIX)); },
  async get(k: string): Promise<unknown> { return (await chrome.storage.local.get(k))[k]; },
  async set(k: string, v: unknown): Promise<void> { await chrome.storage.local.set({ [k]: v }); },
  async remove(k: string): Promise<void> { await chrome.storage.local.remove(k); },
};
const idbKv = {
  async keys(): Promise<string[]> { return (await secureStore.keys()).filter((k) => k.startsWith(PREFIX)); },
  get: (k: string) => secureStore.get(k), set: (k: string, v: unknown) => secureStore.set(k, v), remove: (k: string) => secureStore.remove(k),
};
const kv = () => (secureStoreAvailable() ? idbKv : chromeKv);
let moved: Promise<void> | null = null;
/** One-time move of WalletKit data written by earlier builds from chrome.storage.local into the secure store. */
const migrate = () => (moved ??= (async () => { if (!secureStoreAvailable()) return; for (const k of await chromeKv.keys()) { const v = await chromeKv.get(k); if ((await secureStore.get(k)) === undefined) await secureStore.set(k, v); await chromeKv.remove(k); } })().catch(() => { moved = null; }));
const storage = {
  async getKeys(): Promise<string[]> { await migrate(); return (await kv().keys()).map((k) => k.slice(PREFIX.length)); },
  async getEntries<T = any>(): Promise<[string, T][]> { await migrate(); const out: [string, T][] = []; for (const k of await kv().keys()) { const v = await kv().get(k); if (typeof v === 'string') out.push([k.slice(PREFIX.length), JSON.parse(v) as T]); } return out; },
  async getItem<T = any>(key: string): Promise<T | undefined> { await migrate(); const v = await kv().get(PREFIX + key); return typeof v === 'string' ? (JSON.parse(v) as T) : undefined; },
  async setItem<T = any>(key: string, value: T): Promise<void> { await migrate(); await kv().set(PREFIX + key, JSON.stringify(value)); },
  async removeItem(key: string): Promise<void> { await migrate(); await kv().remove(PREFIX + key); },
};
/** Wallet metadata shown to dApps. UNKNOWN: Harbour has no public site yet; `.invalid` is a reserved never-resolving TLD (RFC 2606) used as a placeholder. */
export const WALLET_METADATA = { name: 'Harbour Wallet', description: 'Self-custody crypto wallet', url: 'https://harbour.invalid', icons: [] as string[] };

export async function createKit(projectId: string): Promise<KitLike> {
  const core = new Core({ projectId, storage: storage as any });
  const kit = await WalletKit.init({ core, metadata: WALLET_METADATA });
  return kit as unknown as KitLike;
}
export const readProjectId = async (): Promise<string | null> => {
  const stored = await local.get<string>('harbour:wc:projectId');
  const id = stored || (import.meta as any).env?.VITE_WC_PROJECT_ID || '';
  return /^[0-9a-f]{32}$/i.test(id) ? id : null;
};
