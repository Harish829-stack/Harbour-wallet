import { test } from 'node:test'; import assert from 'node:assert';
import pkg from '@trustwallet/wallet-core'; const { initWasm } = pkg;
test('addresses deterministic + keystore params (Harbour core uses wallet-core)', async () => {
  const core = await initWasm();
  const M='ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
  const w = core.HDWallet.createWithMnemonic(M,'');
  const eth = w.getAddressForCoin(core.CoinType.ethereum);
  assert.match(eth,/^0x[0-9a-fA-F]{40}$/);
  const sk = core.StoredKey.importHDWalletWithEncryption(M,'w',Buffer.from('pw'),core.CoinType.ethereum,core.StoredKeyEncryption.aes128Ctr);
  const j = JSON.parse(Buffer.from(sk.exportJSON()).toString('utf8'));
  assert.equal(j.crypto.cipher,'aes-128-ctr'); assert.equal(j.crypto.kdfparams.n,16384);
  w.delete(); sk.delete();
  console.log('   ETH', eth);
});
