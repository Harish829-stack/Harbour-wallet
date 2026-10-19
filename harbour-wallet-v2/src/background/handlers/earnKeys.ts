// Key access for the earn feature: one wallet-core private key per operation, wiped afterwards. Mirrors background/keys.ts
// (openActiveKeys) for coins it does not expose (Cosmos family); never returns or logs key material to the UI.
import { session, local, KEYS } from '../../core/storage';
import type { HandlerCtx } from './types';
import { activeEntry, ensureAccounts } from '../walletState';

export interface ActiveInfo { walletId: string; walletType: string; derivationIndex: number; addresses: Record<string, string> }
export async function activeInfo(ctx: HandlerCtx): Promise<ActiveInfo | null> {
  const st: any = await ctx.vault.getState();
  const e = activeEntry(st); if (!e) return null;
  const [walletId, w] = e; const accounts = ensureAccounts(w); const acct = accounts[w.activeAccount] ?? accounts[0];
  return { walletId, walletType: String(w.type ?? 'mnemonic'), derivationIndex: acct?.derivationIndex ?? 0, addresses: acct?.addresses ?? w.addresses ?? {} };
}
/** Earn needs a locally-held seed. TW hides the earn branch for hardware accounts; Harbour also hides it for non-mnemonic wallets. */
export function earnAvailability(info: ActiveInfo | null): { available: boolean; reason?: 'hardware' | 'unsupported_wallet' | 'no_wallet' } {
  if (!info) return { available: false, reason: 'no_wallet' };
  if (/ledger|keystone|trezor|hardware|gridplus|qr/i.test(info.walletType)) return { available: false, reason: 'hardware' };
  if (info.walletType !== 'mnemonic') return { available: false, reason: 'unsupported_wallet' };
  return { available: true };
}

/** Runs `fn` with the wallet-core private key bytes for coin `ctName` of the active account, then zeroes and frees everything. */
export async function withCoinKey<T>(ctx: HandlerCtx, ctName: string, fn: (key: Uint8Array, address: string) => Promise<T> | T): Promise<T> {
  const { core, vault, wallet } = ctx;
  const passwordKey = await session.get<string>(KEYS.PASSWORD);
  if (!passwordKey) throw new Error('Wallet is locked');
  const info = await activeInfo(ctx); if (!info) throw new Error('No wallet found');
  const ks = await local.get<any>(info.walletId); if (!ks) throw new Error('No wallet found');
  const coin = core.CoinType[ctName]; if (!coin) throw new Error('Unsupported coin');
  const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(ks)));
  const hd = sk.wallet(new TextEncoder().encode(passwordKey));
  let pk: any;
  try {
    pk = info.derivationIndex === 0 ? hd.getKeyForCoin(coin) : hd.getKey(coin, wallet.accountPath(coin, info.derivationIndex));
    const address: string = core.CoinTypeExt.deriveAddress(coin, pk);
    const stored = info.addresses[ctName];
    if (stored && stored !== address) throw new Error('Derived key does not match the account address');
    const bytes: Uint8Array = pk.data();
    try { return await fn(bytes, address); } finally { bytes.fill(0); }
  } finally {
    try { pk?.delete(); } catch { /* freed */ }
    try { hd.delete(); } catch { /* freed */ }
    try { sk.delete(); } catch { /* freed */ }
  }
}
