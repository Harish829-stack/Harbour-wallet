// HD wallet + keystore. RE §4.7/§4.8 — aes-128-ctr, accounts per coin, derived-key password.
import { session, KEYS } from './storage';
import defaultCoins from './defaultCoins.json';
import { ALL_CHAINS } from './chains/index';
export class WalletService {
  constructor(private core: any) {}
  async generateMnemonic(): Promise<string> {
    const passwordKey = await session.get<string>(KEYS.PASSWORD);
    if (!passwordKey) throw new Error('LOCKED');
    const w = this.core.HDWallet.create(128, passwordKey);
    try { return w.mnemonic(); } finally { w.delete(); }
  }
  isValidMnemonic(m: string): boolean { return this.core.Mnemonic.isValid(m); }
  // Proven default list, not the old seven-chain launch subset. Config-driven
  // extra coins and the full blockchain registry remain separately tracked gaps.
  supportedCoins(): Array<{ name: string; coin: any }> {
    const coins = new Map<number, { name: string; coin: any }>();
    // Trust Wallet's default coin list plus every chain it enables from config (HyperEVM, Robinhood Chain, Arc, …).
    for (const name of [...defaultCoins, ...ALL_CHAINS.map((c) => c.ct)]) {
      const coin = this.core.CoinType[name];
      if (!coin) throw new Error('Unsupported pinned CoinType: ' + name);
      if (!coins.has(coin.value)) coins.set(coin.value, { name, coin });
    }
    return [...coins.values()];
  }
  // Account-index derivation path, faithful to Trust Wallet (RE §4.8, evidences/re-evidence/08-derivation):
  // take the coin's default path and replace its LAST "0" with the account index.
  // e.g. ethereum "m/44'/60'/0'/0/0" + index 1 -> "m/44'/60'/0'/0/1".
  accountPath(coin: any, index: number): string {
    const base: string = this.core.CoinTypeExt.derivationPath(coin);
    const at = base.lastIndexOf('0');
    return at >= 0 ? `${base.slice(0, at)}${index}${base.slice(at + 1)}` : base;
  }

  // Derive the address map for every supported coin at the given account index,
  // reusing an already-open HDWallet (from a mnemonic or a decrypted StoredKey).
  deriveAddressesWithWallet(w: any, index = 0, newlyGenerated = false): Record<string, string> {
    const out: Record<string, string> = {};
    for (const { name, coin } of this.supportedCoins()) {
      if (index === 0) {
        out[name] = newlyGenerated && name === 'solana'
          ? w.getAddressDerivation(coin, this.core.Derivation.solanaSolana)
          : w.getAddressForCoin(coin);
        continue;
      }
      const key = w.getKey(coin, this.accountPath(coin, index));
      try { out[name] = this.core.CoinTypeExt.deriveAddress(coin, key); }
      finally { key.delete(); }
    }
    return out;
  }

  deriveAddresses(mnemonic: string, newlyGenerated = false): Record<string, string> {
    const w = this.core.HDWallet.createWithMnemonic(mnemonic, '');
    try { return this.deriveAddressesWithWallet(w, 0, newlyGenerated); }
    finally { w.delete(); }
  }
  // build the encrypted StoredKey (keystore v3) using the derived password key (RE §4.7)
  async buildStoredKey(mnemonic: string, name: string, newlyGenerated = false): Promise<any> {
    const passwordKey = await session.get<string>(KEYS.PASSWORD);
    if (!passwordKey) throw new Error('LOCKED');
    const coins = this.supportedCoins();
    const sk = this.core.StoredKey.importHDWalletWithEncryption(
      mnemonic, name, new TextEncoder().encode(passwordKey), coins[0].coin, this.core.StoredKeyEncryption.aes128Ctr);
    const w = this.core.HDWallet.createWithMnemonic(mnemonic, '');
    try {
      for (const { coin } of coins) sk.accountForCoin(coin, w).delete();
      if (newlyGenerated) {
        sk.removeAccountForCoin(this.core.CoinType.solana);
        sk.accountForCoinDerivation(this.core.CoinType.solana, this.core.Derivation.solanaSolana, w).delete();
      }
      return sk;
    } catch (error) { sk.delete(); throw error; }
    finally { w.delete(); }
  }
}
