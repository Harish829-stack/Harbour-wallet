// Fixes for the 2026-11-19 "trending charts / stake errors" capture. Mocked fetch only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const load = async (contents, env = {}) => {
  const out = await build({ stdin: { contents, resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, define: { 'import.meta.env': JSON.stringify(env) } });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('Trending: a market coin charts its own CoinGecko id, never Ethereum', async () => {
  const M = await load(`export * from './core/marketData';`);
  assert.equal(M.coinIdFor('cg:solana'), 'solana');
  assert.equal(M.coinIdFor('cg:shiba-inu'), 'shiba-inu');
  for (const bad of ['cg:', 'cg:../x', 'cg:Solana', 'cg:a?b=1', `cg:${'a'.repeat(81)}`]) assert.equal(M.coinIdFor(bad), undefined, bad);
  const urls = [];
  const f = async (u) => { urls.push(String(u)); return json({ prices: [[1, 10], [2, 11]] }); };
  const r = await M.fetchChart('cg:solana', '1D', f, 3);
  assert.equal(r.ok, true);
  assert.ok(urls.every((u) => u.includes('solana')) && !urls.some((u) => u.includes('ethereum')), urls.join());
});

test('Trending row opens the market screen with the row coin (no ETH fallback)', async () => {
  const fs = await import('node:fs');
  const w = fs.readFileSync(new URL('../src/popup/wallet/Wallet.tsx', import.meta.url), 'utf8');
  assert.ok(w.includes("nav.push('marketToken', { coin: { id: String(t.id"));
  assert.ok(!/\?\? 'ethereum' \}\)/.test(w));
  const m = fs.readFileSync(new URL('../src/popup/wallet/features/market.tsx', import.meta.url), 'utf8');
  assert.ok(m.includes("SCREENS_market: Record<string, React.FC<Ctx>> = { marketToken: MarketTokenScreen }"));
  assert.ok(!/balance|nav\.push\('send'/i.test(m.replace(/\/\/.*$/gm, '')), 'market screen shows no wallet balance or send');
  const idx = fs.readFileSync(new URL('../src/popup/wallet/features/index.ts', import.meta.url), 'utf8'); assert.ok(idx.includes('...SCREENS_market'));
});

test('Cosmos REST: a host that answers for another chain is skipped for reads and broadcast', async () => {
  const C = await load(`export * from './core/staking/cosmos'; export { chainById } from './core/chains/index';`);
  C.resetEndpointIdentityForTests();
  const base = C.chainById('stride');
  const chain = { ...base, endpoints: ['https://wrong.test', 'https://down.test', 'https://right.test'] };
  const seen = [];
  const f = async (u, init) => {
    u = String(u); seen.push(u);
    if (u.endsWith('/cosmos/auth/v1beta1/bech32')) return u.startsWith('https://wrong.test') ? json({ bech32_prefix: 'agoric' }) : u.startsWith('https://down.test') ? json({}, 501) : json({ bech32_prefix: 'stride' });
    if (u.startsWith('https://wrong.test')) return json({ validators: [{ operator_address: 'agoricvaloper1qe8uuf5x69c526h4nzxwv4ltftr73v7qgmf2fd', status: 'BOND_STATUS_BONDED', tokens: '5' }] });
    if (u.startsWith('https://down.test')) return json({}, 503);
    if (u.endsWith('/cosmos/tx/v1beta1/txs')) return json({ tx_response: { code: 0, txhash: 'AB' } });
    return json({ validators: [
      { operator_address: 'stridevaloper1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', status: 'BOND_STATUS_BONDED', tokens: '7' },
      { operator_address: 'agoricvaloper1qe8uuf5x69c526h4nzxwv4ltftr73v7qgmf2fd', status: 'BOND_STATUS_BONDED', tokens: '9' }] });
  };
  const vals = await C.fetchBondedValidators(chain, f);
  assert.deepEqual(vals.map((v) => v.operator), ['stridevaloper1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'], 'only this chain\'s operators');
  assert.ok(!seen.some((u) => u.startsWith('https://wrong.test/cosmos/staking')), 'the wrong-chain host is never read');
  assert.equal(await C.broadcastCosmos(chain, f, { tx_bytes: 'x', mode: 'BROADCAST_MODE_SYNC' }), 'AB');
  assert.ok(!seen.some((u) => u === 'https://wrong.test/cosmos/tx/v1beta1/txs'));
  // identity is checked once per host per session
  assert.equal(seen.filter((u) => u === 'https://wrong.test/cosmos/auth/v1beta1/bech32').length, 1);
});

test('Gas station: offered for every built-in EVM network (testnets too) and lists the build networks only', async () => {
  const fs = await import('node:fs');
  const s = fs.readFileSync(new URL('../src/popup/wallet/screens.tsx', import.meta.url), 'utf8');
  assert.ok(s.includes("{a.evm && a.native && !!chainById(a.id) && <Row onClick={() => c.nav.push('gasStation'"));
  const g = fs.readFileSync(new URL('../src/popup/wallet/features/gas.tsx', import.meta.url), 'utf8');
  assert.ok(g.includes('allAssets().filter((a) => a.native && a.evm)'));
});
