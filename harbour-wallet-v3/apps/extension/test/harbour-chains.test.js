// The generated Harbour chain list (src/core/harbour/chainList.gen.ts, from backend/config/chains.yaml) must agree with the extension's chain registry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const load = async (rel) => {
  const out = await build({ entryPoints: [fileURLToPath(new URL(rel, import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const { HARBOUR_CHAINS, INDEXED_CHAINS, isIndexedChain, isHarbourChain, isClientChain, CLIENT_CHAIN_IDS, harbourRpcUrl } = await load('../src/core/harbour/config.ts');
const { chainById, DEFAULT_HOME_CHAINS, ENABLED_CHAINS, ALL_CHAINS } = await load('../src/core/chains/index.ts');

test('every Harbour chain is a registry EVM chain with the same id and EVM chain id', () => {
  for (const c of HARBOUR_CHAINS) {
    const r = chainById(c.id);
    assert.ok(r, `${c.id} missing from the registry`);
    assert.equal(r.kind, 'evm', c.id); assert.equal(r.evmChainId, c.evmChainId, c.id); assert.equal(c.backend, c.id);
  }
  assert.equal(new Set(HARBOUR_CHAINS.map((c) => c.evmChainId)).size, HARBOUR_CHAINS.length, 'duplicate EVM chain id');
});
test('all 54 EVM mainnets in the registry are served, plus the testnets', () => {
  const evmMainnets = ALL_CHAINS.filter((c) => c.kind === 'evm');
  for (const c of evmMainnets) assert.ok(isHarbourChain(c.id), `${c.id} not served`);
  assert.ok(isHarbourChain('sepolia') && isHarbourChain('base-sepolia'));
  assert.ok(ENABLED_CHAINS.length >= evmMainnets.length);
});
test('indexed chains get history/NFTs from the backend; the rest are RPC-only; every chain has an RPC proxy URL', () => {
  assert.ok(INDEXED_CHAINS.length >= 10 && isIndexedChain('ethereum') && isIndexedChain('polygon') && !isIndexedChain('classic'));
  for (const c of HARBOUR_CHAINS) assert.match(harbourRpcUrl(c.evmChainId), new RegExp(`/v1/rpc/${c.backend}$`));
});
test('the default home is a small set of popular, served mainnets', () => {
  assert.ok(DEFAULT_HOME_CHAINS.length >= 5 && DEFAULT_HOME_CHAINS.length <= 10);
  for (const id of DEFAULT_HOME_CHAINS) assert.ok((isHarbourChain(id) || isClientChain(id)) && !chainById(id).testnet, id);
});
test('every non-EVM registry chain is offered (reached directly, not through the backend)', () => {
  const nonEvm = ALL_CHAINS.filter((c) => c.kind !== 'evm');
  assert.equal(CLIENT_CHAIN_IDS.length, nonEvm.length);
  for (const c of nonEvm) assert.ok(isClientChain(c.id) && !isHarbourChain(c.id), c.id);
  assert.ok(ENABLED_CHAINS.length >= ALL_CHAINS.length);
});
