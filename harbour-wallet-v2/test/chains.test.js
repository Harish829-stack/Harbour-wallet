// Chain registry: Trust Wallet's 86 enabled chains (HAR /v1/balances/chains) joined with wallet-core 4.8.2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const reg = JSON.parse(fs.readFileSync(new URL('../src/core/chains/registry.json', import.meta.url), 'utf8'));
const har = JSON.parse(fs.readFileSync(new URL('../evidence/30-chain-registry/har-balances-chains.json', import.meta.url), 'utf8'));

test('registry contains exactly the chains Trust Wallet enables', () => {
  const enabled = har.chains.filter((c) => c.enabled).map((c) => c.chain_id).sort((a, b) => a - b);
  assert.equal(har.stats.enabled, 86);
  assert.deepEqual(reg.map((c) => c.twId), enabled);
  assert.equal(new Set(reg.map((c) => c.id)).size, reg.length, 'unique ids');
});
test('every chain maps to a wallet-core CoinType and has a usable endpoint family', async () => {
  const { initWasm } = require('@trustwallet/wallet-core');
  const core = await initWasm();
  for (const c of reg) {
    assert.ok(core.CoinType[c.ct], `CoinType ${c.ct} for ${c.id}`);
    assert.equal(core.CoinType[c.ct].value, c.twId, `${c.id} twId == CoinType value`);
    assert.ok(c.symbol && c.decimals >= 0, c.id);
    assert.ok(c.cg, `${c.id} has a CoinGecko id`);
    if (c.kind === 'evm') { assert.ok(Number.isSafeInteger(c.evmChainId), c.id); assert.ok(c.rpcs.every((u) => /^https?:\/\//.test(u))); }
  }
});
test('EVM chain ids are unique and match wallet-core', async () => {
  const ids = reg.filter((c) => c.kind === 'evm').map((c) => c.evmChainId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(1) && ids.includes(56) && ids.includes(137) && ids.includes(42161) && ids.includes(8453) && ids.includes(10));
});
test('chains with no public endpoint are explicitly listed, not silently faked', () => {
  const none = reg.filter((c) => (c.kind === 'evm' ? !c.rpcs?.length : !c.endpoints?.length)).map((c) => c.id).sort();
  assert.deepEqual(none, ['aion', 'nimiq']);
});
