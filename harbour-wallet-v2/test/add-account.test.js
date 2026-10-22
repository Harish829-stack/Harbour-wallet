// Verifies Harbour's multi-account derivation matches Trust Wallet's algorithm
// (evidences/re-evidence/08-derivation: take the coin's default path, replace its LAST "0" with
// the account index) AND cross-checks it against wallet-core's own structured
// getDerivedKey(coin, account, change, address) so correctness needs no hard-coded vectors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pkg from '@trustwallet/wallet-core';
const { initWasm } = pkg;

// Replicates WalletService.accountPath exactly.
const accountPath = (core, coin, index) => {
  const base = core.CoinTypeExt.derivationPath(coin);
  const at = base.lastIndexOf('0');
  return at >= 0 ? `${base.slice(0, at)}${index}${base.slice(at + 1)}` : base;
};
const addrAt = (core, w, coin, index) => {
  const key = w.getKey(coin, accountPath(core, coin, index));
  try { return core.CoinTypeExt.deriveAddress(coin, key); } finally { key.delete(); }
};

const M = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';

test('ethereum: path string = m/44\'/60\'/0\'/0/<index>', async () => {
  const core = await initWasm();
  assert.equal(accountPath(core, core.CoinType.ethereum, 0), "m/44'/60'/0'/0/0");
  assert.equal(accountPath(core, core.CoinType.ethereum, 1), "m/44'/60'/0'/0/1");
  assert.equal(accountPath(core, core.CoinType.ethereum, 5), "m/44'/60'/0'/0/5");
});

test('index 0 equals getAddressForCoin; indices are distinct & valid', async () => {
  const core = await initWasm();
  const w = core.HDWallet.createWithMnemonic(M, '');
  try {
    const a0 = addrAt(core, w, core.CoinType.ethereum, 0);
    assert.equal(a0, w.getAddressForCoin(core.CoinType.ethereum), 'index 0 must equal canonical address');
    const addrs = [0, 1, 2, 3].map((i) => addrAt(core, w, core.CoinType.ethereum, i));
    for (const a of addrs) assert.match(a, /^0x[0-9a-fA-F]{40}$/);
    assert.equal(new Set(addrs).size, 4, 'each account index must yield a distinct address');
  } finally { w.delete(); }
});

test('cross-check vs wallet-core getDerivedKey(eth, 0, 0, index)', async () => {
  const core = await initWasm();
  const w = core.HDWallet.createWithMnemonic(M, '');
  try {
    for (const i of [0, 1, 2, 7]) {
      const viaPath = addrAt(core, w, core.CoinType.ethereum, i);
      const k = w.getDerivedKey(core.CoinType.ethereum, 0, 0, i); // account=0, change=0, address=i
      let viaStruct;
      try { viaStruct = core.CoinTypeExt.deriveAddress(core.CoinType.ethereum, k); } finally { k.delete(); }
      assert.equal(viaPath, viaStruct, `index ${i}: path-string vs getDerivedKey mismatch`);
    }
  } finally { w.delete(); }
});
