import { defaultWalletName } from '../core/importKey';
// Shared helpers over the decrypted vault state (wallets / accounts / active pointers). Used by the router and feature handlers.
export type Acct = { derivationIndex: number; name: string; addresses: Record<string, string> };
// Migrate legacy single-account wallets (top-level `addresses` only) to the multi-account
// shape in place and clamp the active index. Returns the accounts array.
export function ensureAccounts(w: any): Acct[] {
  if (!Array.isArray(w.accounts) || w.accounts.length === 0) {
    w.accounts = [{ derivationIndex: 0, name: 'Account 1', addresses: w.addresses ?? {} }];
    w.activeAccount = 0;
  }
  if (typeof w.activeAccount !== 'number' || w.activeAccount < 0 || w.activeAccount >= w.accounts.length) w.activeAccount = 0;
  return w.accounts as Acct[];
}

// Resolve the active wallet entry [walletId, w], defaulting to the first and repairing the pointer.
export function activeEntry(state: any): [string, any] | undefined {
  const entries = Object.entries(state.wallets ?? {}) as [string, any][];
  if (!entries.length) return undefined;
  let id = state.activeWalletId;
  if (!id || !state.wallets[id]) { id = entries[0][0]; state.activeWalletId = id; }
  return [id, state.wallets[id]];
}
// Default name of the next wallet, TW style: "Main wallet", "Main wallet 2", ... (chunks/useWalletName).
export function nextSeedLabel(state: any): string {
  const names = Object.values(state.wallets ?? {}).map((w: any) => String(w?.label ?? w?.name ?? ''));
  return defaultWalletName(names);
}
