// Signing policy (src/core/harbour/policy.ts): mainnet, testnet and user-added networks are separate, explicit switches; unknown chains are refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// One bundle for both modules: policy.ts reads the same networkRegistry instance the test mutates.
const out = await build({ stdin: { contents: `export * from './core/harbour/policy'; export { setNetworkState } from './core/networkRegistry';`, resolveDir: fileURLToPath(new URL('../src/', import.meta.url)), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
const P = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const R = P;

test('the three signing switches are explicit and on in this build', () => {
  assert.deepEqual({ ...P.SIGNING_POLICY }, { mainnet: true, testnet: true, custom: true });
  assert.ok(Object.isFrozen(P.SIGNING_POLICY));
});
test('Harbour mainnets and curated testnets are classified and signable; unknown chains are refused', () => {
  assert.equal(P.evmSigningBasis(1), 'harbour-mainnet'); assert.equal(P.evmSigningBasis('0x1'), 'harbour-mainnet');
  assert.equal(P.evmSigningBasis(11155111), 'harbour-testnet'); assert.equal(P.evmSigningBasis(6343), 'harbour-testnet');
  assert.equal(P.evmSigningBasis(59141), null, 'a testnet that is not in the curated list is only signable once the user adds it');
  assert.equal(P.isSigningEvmChain(59141), false); assert.equal(P.isSigningEvmChain(null), false); assert.equal(P.isSigningEvmChain('nope'), false);
  assert.throws(() => P.assertSigningEvmChain(59141), /not available/);
});
test('a user-added network becomes signable, and stops being signable when removed', () => {
  R.setNetworkState({ custom: [{ chainId: 59141, name: 'Linea Sepolia', rpcUrl: 'https://rpc.sepolia.linea.build', symbol: 'ETH', addedAt: 1 }], rpcOverrides: {} });
  assert.equal(P.evmSigningBasis(59141), 'custom-network'); assert.equal(P.isSigningEvmChain(59141), true);
  R.setNetworkState({ custom: [], rpcOverrides: {} });
  assert.equal(P.isSigningEvmChain(59141), false);
});

test('smart accounts need the remote flag, a software account and a pinned, signable chain', () => {
  const ok = { flag: true, chainId: 84532, walletType: 'mnemonic' };
  assert.equal(P.smartAccountsAvailable(ok), true);
  assert.equal(P.smartAccountsAvailable({ ...ok, chainId: '0x14a34' }), true);
  assert.equal(P.smartAccountsAvailable({ ...ok, chainId: 11155111, walletType: 'privateKey' }), true);
  assert.equal(P.smartAccountsAvailable({ ...ok, flag: false }), false, 'default off');
  assert.equal(P.smartAccountsAvailable({ ...ok, flag: undefined }), false);
  assert.equal(P.smartAccountsAvailable({ ...ok, walletType: 'ledger' }), false);
  assert.equal(P.smartAccountsAvailable({ ...ok, walletType: 'watch' }), false);
  assert.equal(P.smartAccountsAvailable({ ...ok, walletType: undefined }), false);
  for (const chainId of [1, 8453, 0, 59141, null, undefined, '', 'nope']) assert.equal(P.smartAccountsAvailable({ ...ok, chainId }), false, String(chainId));
});
