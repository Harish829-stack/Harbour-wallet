// Access to the wallet vault for the provider: account listing for the connect screen and key access for signing.
// Keys exist only inside one operation; the connected account (not necessarily the wallet's active one) is the one that signs.
import { session, local, KEYS } from '../../core/storage';
import type { VaultService } from '../../core/vaultService';
import type { WalletService } from '../../core/walletService';
import { ensureAccounts, activeEntry } from '../walletState';
import { ERR, ProviderError } from '../../core/provider/errors';
import { MULTI_CHAINS } from '../../core/provider/multiChains';
import { chainById } from '../../core/chains/index';

export interface AccountEntry { index: number; derivationIndex: number; name: string; evm?: string; solana?: string; multi?: Record<string, string> }
const multiOf = (a: Record<string, string> | undefined): Record<string, string> => Object.fromEntries(Object.keys(MULTI_CHAINS).filter((k) => a?.[k]).map((k) => [k, a![k]]));
export interface WalletAccounts { walletId: string; walletName: string; activeAccount: number; accounts: AccountEntry[] }
const evmOf = (a: Record<string, string> | undefined) => a?.ethereum ?? Object.values(a ?? {}).find((v) => /^0x[0-9a-fA-F]{40}$/.test(v));

/** Accounts of the ACTIVE wallet (requires an unlocked vault). */
export async function readWalletAccounts(vault: VaultService): Promise<WalletAccounts | null> {
  const st: any = await vault.getState(); const e = activeEntry(st); if (!e) return null;
  const [walletId, w] = e; const accts = ensureAccounts(w);
  return { walletId, walletName: String(w.label ?? w.name ?? 'Wallet'), activeAccount: w.activeAccount ?? 0, accounts: accts.map((a, i) => ({ index: i, derivationIndex: a.derivationIndex, name: a.name || `Account ${i + 1}`, evm: evmOf(a.addresses), solana: a.addresses?.solana, multi: multiOf(a.addresses) })) };
}
export async function readAccountOf(vault: VaultService, walletId: string, index: number): Promise<AccountEntry | null> {
  const st: any = await vault.getState(); const w = st.wallets?.[walletId]; if (!w) return null; const a = ensureAccounts(w)[index]; if (!a) return null;
  return { index, derivationIndex: a.derivationIndex, name: a.name || `Account ${index + 1}`, evm: evmOf(a.addresses), solana: a.addresses?.solana, multi: multiOf(a.addresses) };
}

export interface ConnKeys { evmPrivateKey(): Uint8Array; solanaKey(): { key: any; address: string }; chainKey(chain: string): { key: any; address: string }; dispose(): void }
export interface ConnRef { walletId: string; accountIndex: number; evmAddress?: string; solanaAddress?: string; others?: Record<string, { address: string; publicKey: string }> }
export async function openConnectionKeys(core: any, vault: VaultService, wallet: WalletService, conn: ConnRef): Promise<ConnKeys> {
  const passwordKey = await session.get<string>(KEYS.PASSWORD);
  if (!passwordKey || !(await vault.isUnlocked())) throw new ProviderError(ERR.UNAUTHORIZED, 'Wallet is locked.');
  const st: any = await vault.getState(); const w = st.wallets?.[conn.walletId];
  if (!w) throw new ProviderError(ERR.UNAUTHORIZED, 'The connected wallet no longer exists.');
  const acct = ensureAccounts(w)[conn.accountIndex];
  if (!acct) throw new ProviderError(ERR.UNAUTHORIZED, 'The connected account no longer exists.');
  // Never sign with an account other than the one the site was connected with.
  if (conn.evmAddress && evmOf(acct.addresses)?.toLowerCase() !== conn.evmAddress.toLowerCase()) throw new ProviderError(ERR.UNAUTHORIZED, 'The connected account has changed. Reconnect the site.');
  for (const [chain, o] of Object.entries(conn.others ?? {})) if (acct.addresses?.[chain] !== o.address) throw new ProviderError(ERR.UNAUTHORIZED, 'The connected account has changed. Reconnect the site.');
  if (conn.solanaAddress && acct.addresses?.solana !== conn.solanaAddress) throw new ProviderError(ERR.UNAUTHORIZED, 'The connected account has changed. Reconnect the site.');
  const derivationIndex = acct.derivationIndex ?? 0;
  const ks = await local.get<any>(conn.walletId); if (!ks) throw new ProviderError(ERR.INTERNAL, 'Wallet keystore not found.');
  const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(ks)));
  const hd = sk.wallet(new TextEncoder().encode(passwordKey));
  const owned: any[] = []; const secrets: Uint8Array[] = [];
  const keyFor = (coin: any) => (derivationIndex === 0 ? hd.getKeyForCoin(coin) : hd.getKey(coin, wallet.accountPath(coin, derivationIndex)));
  return {
    evmPrivateKey() { const pk = keyFor(core.CoinType.ethereum); owned.push(pk); const b = new Uint8Array(pk.data()); secrets.push(b); return b; },
    solanaKey() {
      const coin = core.CoinType.solana; const want = conn.solanaAddress ?? acct.addresses?.solana;
      const candidates: any[] = [keyFor(coin)];
      if (derivationIndex === 0) { try { candidates.push(hd.getKeyDerivation(coin, core.Derivation.solanaSolana)); } catch { /* optional */ } }
      owned.push(...candidates);
      for (const k of candidates) if (core.CoinTypeExt.deriveAddress(coin, k) === want) return { key: k, address: want as string };
      throw new ProviderError(ERR.INTERNAL, 'Solana key does not match the account address.');
    },
    chainKey(chain) {
      const info = chainById(chain); if (!info || !MULTI_CHAINS[chain]) throw new ProviderError(ERR.INVALID_PARAMS, 'Unsupported chain.');
      const coin = core.CoinType[info.ct]; const key = keyFor(coin); owned.push(key);
      const address = core.CoinTypeExt.deriveAddress(coin, key) as string; const want = acct.addresses?.[chain];
      if (want && address !== want) throw new ProviderError(ERR.INTERNAL, 'The key does not match the account address.');
      return { key, address };
    },
    dispose() { for (const b of secrets) b.fill(0); for (const k of owned) { try { k.delete(); } catch { /* freed */ } } try { hd.delete(); } catch { /* */ } try { sk.delete(); } catch { /* */ } },
  };
}
