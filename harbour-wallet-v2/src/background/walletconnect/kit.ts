// WalletKit (Reown) construction for the extension service worker. Persistence goes to chrome.storage.local (no localStorage/IndexedDB assumptions in a worker).
import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { local } from '../../core/storage';
import type { KitLike } from './bridge';

const PREFIX = 'harbour:wc:kv:';
// IKeyValueStorage over chrome.storage.local; values are JSON-serialised like the SDK's own browser storage.
const storage = {
  async getKeys(): Promise<string[]> { const all = (await chrome.storage.local.get(null)) as Record<string, unknown>; return Object.keys(all).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length)); },
  async getEntries<T = any>(): Promise<[string, T][]> { const all = (await chrome.storage.local.get(null)) as Record<string, string>; return Object.entries(all).filter(([k]) => k.startsWith(PREFIX)).map(([k, v]) => [k.slice(PREFIX.length), JSON.parse(v) as T]); },
  async getItem<T = any>(key: string): Promise<T | undefined> { const v = (await chrome.storage.local.get(PREFIX + key))[PREFIX + key]; return typeof v === 'string' ? (JSON.parse(v) as T) : undefined; },
  async setItem<T = any>(key: string, value: T): Promise<void> { await chrome.storage.local.set({ [PREFIX + key]: JSON.stringify(value) }); },
  async removeItem(key: string): Promise<void> { await chrome.storage.local.remove(PREFIX + key); },
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
