// QA (resilience): third-party API failure modes (500, 429, 403, malformed 200, HTML body, empty object, thrown network error) across
// the DeFi handlers that talk to outside services: ramps quotes / market reference, staking list / details / prepare per chain.
// Every answer must be a plain object; a failure carries a user-safe sentence (no status codes, URLs, stack or "undefined");
// nothing is ever broadcast and nothing is signed from partial data (prepare + submit with a dead review id).
// TEST_PLAN: T-DEFI-017 (ramps + staking/earn; swap quote failures are T-DEFI-005 in swap-flow.test.js).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`import './background/index'; // defi-failure-matrix`);
const { F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const seen = [];
const MODES = {
  http500: () => new Response('boom', { status: 500 }),
  http429: () => new Response('slow down', { status: 429, headers: { 'retry-after': '1' } }),
  http403: () => new Response('forbidden', { status: 403 }),
  html200: () => new Response('<html><body>Maintenance</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
  empty200: () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
  garbage200: () => new Response('{"a":', { status: 200, headers: { 'content-type': 'application/json' } }),
  netThrow: () => { throw new TypeError('Failed to fetch'); },
  timeout: () => { throw Object.assign(new Error('The operation timed out after 8000 ms'), { name: 'TimeoutError' }); },
};
const LEAK = /\bHTTP\s*\d{3}\b|https?:\/\/|\bTypeError\b|\bSyntaxError\b|\bat \S+:\d+:\d+|\bundefined\b|\[object|Unexpected (token|end)|\bJSON\b|Failed to fetch/i;
const BROADCAST = /eth_sendRawTransaction|\/broadcast|sendTransaction|submit/i;

// Ramps go through the Harbour backend (Onramper): the device registers and the backend serves the catalog; the failure modes
// below then hit the quote and market-reference calls.
const ok = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
const backend = (u) => {
  const p = new URL(String(u)).pathname;
  if (p === '/v1/devices/challenge') return ok({ challenge: 'qa', difficulty: 0 });
  if (p === '/v1/devices') return ok({ device_id: 'qa-device' });
  if (p === '/v1/ramps/config') return ok({ country: 'us', cryptos: [{ id: 'eth', code: 'ETH', network: 'ethereum', chainId: 1 }], fiats: [{ id: 'usd', code: 'USD' }, { id: 'eur', code: 'EUR' }] });
  return null;
};
before(async () => {
  H.reset();
  F.fetchImpl = (u) => { seen.push(String(u)); return Promise.resolve(backend(u) ?? new Response('{}', { status: 200 })); };
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
});

const cfg = async () => { const c = await send({ type: 'rampsConfig' }); assert.equal(c.ok, true); return c; };

for (const [mode, make] of Object.entries(MODES)) {
  test(`T-DEFI-017: ramps — ${mode}: friendly failure or empty quotes, never a leak`, async () => {
    const c = await cfg(); const asset = c.assets.find((a) => /eth/i.test(a.id)) ?? c.assets[0];
    assert.ok(asset, `the backend catalog yields a rampable asset: ${JSON.stringify(c).slice(0, 200)}`);
    F.fetchImpl = (u, i) => { seen.push(String(u)); return Promise.resolve().then(() => make(u, i)); };
    for (const m of [{ type: 'rampsQuotes', mode: 'buy', assetId: asset.id, fiat: 'USD', amount: '100' }, { type: 'rampsQuotes', mode: 'sell', assetId: asset.id, fiat: 'EUR', amount: '0.5' }, { type: 'rampsMarketRef', assetId: asset.id, fiat: 'USD' }]) {
      const r = await Promise.race([send(m), new Promise((res) => setTimeout(() => res({ timeout: true }), 30_000))]);
      assert.ok(r && typeof r === 'object' && !r.timeout, `${m.type} answered`);
      if (r.ok === false) assert.doesNotMatch(String(r.error ?? ''), LEAK, `${m.type}: ${r.error}`);
      if (r.ok === true && Array.isArray(r.quotes)) for (const q of r.quotes) assert.ok(!q.error || !LEAK.test(String(q.error)), `${m.type} per-provider error: ${q.error}`);
    }
    assert.equal(seen.filter((u) => BROADCAST.test(u)).length, 0, 'no broadcast/submit call');
  });
}

for (const [mode, make] of Object.entries(MODES)) {
  test(`T-DEFI-017: staking — ${mode}: list/details/prepare fail friendly on every chain; submit with no review signs nothing`, async () => {
    F.fetchImpl = (u, i) => { seen.push(String(u)); return Promise.resolve().then(() => make(u, i)); };
    seen.length = 0;
    const answers = [await send({ type: 'earnList', refresh: true })];
    for (const chainId of ['ethereum', 'smartchain', 'solana', 'polkadot', 'tron', 'tezos', 'cardano']) {
      answers.push(await send({ type: 'earnDetails', chainId }));
      answers.push(await send({ type: 'earnPrepare', chainId, action: 'stake', amount: '1' }));
    }
    for (const r of answers) {
      assert.ok(r && typeof r === 'object');
      if (r.ok === false) assert.doesNotMatch(String(r.error ?? ''), LEAK, JSON.stringify(r).slice(0, 200));
      if (r.ok === true && r.reviewId) assert.fail(`a review was prepared from failing data: ${JSON.stringify(r).slice(0, 200)}`);
    }
    assert.ok(answers.filter((r) => r.ok === false).length >= 8, `the failures were actually hit (${answers.filter((r) => r.ok === false).length} of ${answers.length} refused)`);
    const sub = await send({ type: 'earnSubmit', reviewId: 'does-not-exist' });
    assert.equal(sub.ok, false); assert.doesNotMatch(String(sub.error ?? ''), LEAK);
    assert.equal(seen.filter((u) => BROADCAST.test(u)).length, 0, 'nothing broadcast');
  });
}
