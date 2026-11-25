// QA (contract): the extension's Harbour chain list (chainList.gen.ts) and the backend's config/chains.yaml describe the same
// networks — read independently here with js-yaml, not through the generator. TEST_PLAN: T-CH-001.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { harness } from './harness.mjs';

const { M } = await harness(`export { HARBOUR_CHAIN_LIST } from './core/harbour/chainList.gen'; export { chainById, ENABLED_CHAINS } from './core/chains/index'; export { HARBOUR_CHAINS } from './core/harbour/config';`);
const cfg = yaml.load(readFileSync(new URL('../../../backend/config/chains.yaml', import.meta.url), 'utf8')).chains;

test('T-CH-001: every backend EVM chain is in the extension list with the same id / chain id; indexed = has sources; testnet flags agree; testnets unpriced', () => {
  const evm = Object.entries(cfg).filter(([, c]) => c.family === 'evm');
  const list = new Map(M.HARBOUR_CHAIN_LIST.map((c) => [c.backend, c]));
  assert.equal(list.size, M.HARBOUR_CHAIN_LIST.length, 'no duplicate backend names');
  for (const [name, c] of evm) {
    const e = list.get(name); assert.ok(e, `${name} missing from chainList.gen.ts`);
    assert.equal(e.evmChainId, c.evm_chain_id, `${name} chain id`);
    assert.equal(e.indexed, !!(c.sources && Object.keys(c.sources).length), `${name} indexed flag`);
    assert.equal(e.testnet, c.testnet === true, `${name} testnet flag`);
    if (c.testnet) assert.equal(c.prices, undefined, `${name}: a testnet must not carry prices`);
  }
  for (const e of M.HARBOUR_CHAIN_LIST) assert.equal(cfg[e.backend]?.family, 'evm', `${e.backend} in the extension list but not an EVM chain in chains.yaml`);
  const ids = M.HARBOUR_CHAIN_LIST.map((c) => c.evmChainId); assert.equal(new Set(ids).size, ids.length, 'chain ids unique');
});

test('T-CH-001: each listed chain resolves in the extension registry with the same EVM chain id and testnet flag, and is served', () => {
  for (const e of M.HARBOUR_CHAIN_LIST) {
    const r = M.chainById(e.id); assert.ok(r, `${e.id} not in the registry`);
    assert.equal(r.evmChainId, e.evmChainId, `${e.id} registry chain id`);
    assert.equal(!!r.testnet, e.testnet, `${e.id} registry testnet flag`);
    assert.ok(M.ENABLED_CHAINS.some((c) => c.id === e.id), `${e.id} not enabled`);
    assert.ok(M.HARBOUR_CHAINS.some((c) => c.id === e.id), `${e.id} not served by HARBOUR_CHAINS`);
  }
});
