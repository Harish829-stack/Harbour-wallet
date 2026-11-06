// HW-2026-017 / CCSS D-02: cross-wallet restore. A phrase made anywhere must restore to the same addresses other wallets
// show (MetaMask, Ledger Live, Electrum/BIP-84 reference vectors), using Harbour's own account-path rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pkg from '@trustwallet/wallet-core';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os'; import { writeFileSync } from 'node:fs'; import path from 'node:path';

const core = await pkg.initWasm();
const src = fileURLToPath(new URL('../src/', import.meta.url));
const fake = { name: 'fake', setup(b) { b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'f', namespace: 'f' })); b.onLoad({ filter: /.*/, namespace: 'f' }, () => ({ contents: 'export default { storage: { local: {}, session: {} } };', loader: 'js' })); } };
const out = await build({ stdin: { contents: `export { WalletService } from './core/walletService';`, resolveDir: src, sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', plugins: [fake], loader: { '.json': 'json' } });
const f = path.join(tmpdir(), `harbour-restore-${process.pid}.mjs`); writeFileSync(f, out.outputFiles[0].text);
const { WalletService } = await import(pathToFileURL(f).href);

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
test('BIP-39/44/84 reference vectors restore to the addresses other wallets derive', () => {
  const hd = core.HDWallet.createWithMnemonic(PHRASE, '');
  try {
    assert.equal(hd.getAddressForCoin(core.CoinType.ethereum), '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'); // m/44'/60'/0'/0/0
    assert.equal(hd.getAddressForCoin(core.CoinType.bitcoin), 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'); // BIP-84 vector m/84'/0'/0'/0/0
    const ws = new WalletService(core);
    const p1 = ws.accountPath(core.CoinType.ethereum, 1);
    assert.equal(p1, "m/44'/60'/0'/0/1"); // MetaMask "Account 2"
    const k = hd.getKey(core.CoinType.ethereum, p1);
    assert.equal(core.CoinTypeExt.deriveAddress(core.CoinType.ethereum, k), '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0');
    k.delete();
  } finally { hd.delete(); }
});
