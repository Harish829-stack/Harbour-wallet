// Validates the invariant behind addWallet's dedupe (TW MNEMONIC_ALREADY_EXISTS):
// the ethereum address of a mnemonic is deterministic and unique per seed, so keying
// dedupe on account-0 eth address is sound.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pkg from '@trustwallet/wallet-core';
const { initWasm } = pkg;

const ethAddr = (core, m) => {
  const w = core.HDWallet.createWithMnemonic(m, '');
  try { return w.getAddressForCoin(core.CoinType.ethereum); } finally { w.delete(); }
};

const A = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const B = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('distinct seeds -> distinct eth addresses (both wallets are kept)', async () => {
  const core = await initWasm();
  assert.notEqual(ethAddr(core, A), ethAddr(core, B));
});

test('same seed -> identical eth address (re-import is detected as duplicate)', async () => {
  const core = await initWasm();
  assert.equal(ethAddr(core, A), ethAddr(core, A));
  assert.match(ethAddr(core, A), /^0x[0-9a-fA-F]{40}$/);
});
