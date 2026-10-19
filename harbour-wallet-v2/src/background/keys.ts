// Active-account key access for signing flows. Keys live only for the duration of one operation.
import { session, local, KEYS } from '../core/storage';
import type { VaultService } from '../core/vaultService';
import type { WalletService } from '../core/walletService';

export interface ActiveKeys {
  walletId: string;
  derivationIndex: number;
  addresses: Record<string, string>;
  evmPrivateKey(): `0x${string}`;
  solanaKey(): { key: any; address: string };
  /** Raw private key bytes (a copy; the caller must zero it) of the active account for a registry chain, verified against `address`. */
  privateKeyFor(chain: { ct: string; kind: string }, address: string): Uint8Array;
  dispose(): void;
}

export async function openActiveKeys(core: any, vault: VaultService, wallet: WalletService): Promise<ActiveKeys> {
  const passwordKey = await session.get<string>(KEYS.PASSWORD);
  if (!passwordKey) throw new Error('Wallet is locked');
  const st: any = await vault.getState();
  const entries = Object.entries(st.wallets ?? {}) as [string, any][];
  if (!entries.length) throw new Error('No wallet found');
  const walletId: string = st.activeWalletId && st.wallets[st.activeWalletId] ? st.activeWalletId : entries[0][0];
  const w = st.wallets[walletId];
  const accounts: any[] = Array.isArray(w.accounts) && w.accounts.length ? w.accounts : [{ derivationIndex: 0, addresses: w.addresses ?? {} }];
  const active = accounts[typeof w.activeAccount === 'number' && accounts[w.activeAccount] ? w.activeAccount : 0];
  const derivationIndex: number = active?.derivationIndex ?? 0;
  const addresses: Record<string, string> = active?.addresses ?? {};
  const ks = await local.get<any>(walletId);
  if (!ks) throw new Error('No wallet found');
  const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(ks)));
  // Imported private-key wallets (type 'privateKey') hold one key and no HD wallet: wallet-core returns that key for every coin.
  const isPrivateKeyWallet = (w.type ?? 'mnemonic') === 'privateKey';
  const pwBytes = new TextEncoder().encode(passwordKey);
  const hd = isPrivateKeyWallet ? null : sk.wallet(pwBytes);
  const owned: any[] = [];
  const keyFor = (coin: any) => isPrivateKeyWallet ? sk.privateKey(coin, pwBytes) : derivationIndex === 0 ? hd.getKeyForCoin(coin) : hd.getKey(coin, wallet.accountPath(coin, derivationIndex));
  return {
    walletId, derivationIndex, addresses,
    evmPrivateKey() {
      if (isPrivateKeyWallet && !addresses.ethereum) throw new Error('This wallet has no EVM account');
      const pk = keyFor(core.CoinType.ethereum); owned.push(pk);
      return core.HexCoding.encode(pk.data()) as `0x${string}`;
    },
    solanaKey() {
      const coin = core.CoinType.solana;
      const want: string = addresses.solana;
      // New wallets use the `solana` derivation, imported ones the legacy default: pick the key whose
      // address matches the stored account address.
      const candidates: any[] = [keyFor(coin)];
      if (derivationIndex === 0 && hd) { try { candidates.push(hd.getKeyDerivation(coin, core.Derivation.solanaSolana)); } catch { /* optional */ } }
      owned.push(...candidates);
      for (const k of candidates) {
        if (core.CoinTypeExt.deriveAddress(coin, k) === want) return { key: k, address: want };
      }
      throw new Error('Solana key does not match the account address');
    },
    privateKeyFor(chain, address) {
      const names = [chain.ct, ...(chain.kind === 'evm' && chain.ct !== 'ethereum' ? ['ethereum'] : [])];
      for (const name of names) {
        const coin = (core.CoinType as any)[name]; if (coin === undefined) continue;
        const cands: any[] = [keyFor(coin)];
        if (name === 'solana' && derivationIndex === 0) { try { cands.push(hd.getKeyDerivation(coin, core.Derivation.solanaSolana)); } catch { /* optional */ } }
        owned.push(...cands);
        for (const k of cands) {
          let derived = ''; try { derived = core.CoinTypeExt.deriveAddress(coin, k); } catch { /* next */ }
          if (derived && derived.toLowerCase() === address.toLowerCase()) return new Uint8Array(k.data());
        }
      }
      throw new Error('The signing key does not match the account address');
    },
    dispose() { for (const k of owned) { try { k.delete(); } catch { /* already freed */ } } try { hd?.delete(); } catch { /* */ } try { sk.delete(); } catch { /* */ } },
  };
}
