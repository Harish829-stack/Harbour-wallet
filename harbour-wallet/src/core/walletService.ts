// HD wallet + keystore. RE §4.7/§4.8 — aes-128-ctr, accounts per coin, derived-key password.
import { session, KEYS } from './storage';
import defaultCoins from './defaultCoins.json';
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
    for (const name of defaultCoins) {
      const coin = this.core.CoinType[name];
      if (!coin) throw new Error('Unsupported pinned CoinType: ' + name);
      if (!coins.has(coin.value)) coins.set(coin.value, { name, coin });
    }
    return [...coins.values()];
  }
  deriveAddresses(mnemonic: string, newlyGenerated = false): Record<string, string> {
    const w = this.core.HDWallet.createWithMnemonic(mnemonic, '');
    const out: Record<string, string> = {};
    try {
      for (const { name, coin } of this.supportedCoins()) {
        out[name] = newlyGenerated && name === 'solana'
          ? w.getAddressDerivation(coin, this.core.Derivation.solanaSolana)
          : w.getAddressForCoin(coin);
      }
      return out;
    } finally { w.delete(); }
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
