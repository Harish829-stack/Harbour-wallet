// chrome.storage wrappers. Keys mirror TW schema (RE §6.2) with "wallet:" prefix.
import browser from 'webextension-polyfill';
export const local = {
  async get<T=any>(k: string): Promise<T | undefined> { return (await browser.storage.local.get(k))[k] as T; },
  async set(k: string, v: unknown) { await browser.storage.local.set({ [k]: v }); },
  async remove(k: string) { await browser.storage.local.remove(k); },
};
export const session = {
  async get<T=any>(k: string): Promise<T | undefined> { return (await browser.storage.session.get(k))[k] as T; },
  async set(k: string, v: unknown) { await browser.storage.session.set({ [k]: v }); },
  async remove(k: string) { await browser.storage.session.remove(k); },
};
export const KEYS = {
  STORE: 'wallet:store', PBKDF2: 'wallet:pbkdf2', VAULT: 'wallet:vault',
  VAULT_ID: 'wallet:vaultId', THROTTLE: 'wallet:throttle',
  PASSWORD: 'wallet:password', UNLOCK: 'wallet:unlock',
  wallets: (vaultId: string) => `wallet:wallets:${vaultId}`,
};
