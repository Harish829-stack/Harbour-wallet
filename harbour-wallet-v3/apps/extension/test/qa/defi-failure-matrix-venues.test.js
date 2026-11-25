// QA (resilience): the same third-party failure modes as defi-failure-matrix.test.js, for the venues that were left out of it:
// perps (Hyperliquid), predictions (Polymarket) and NFT indexers. Every answer is a plain object, a failure carries a user-safe
// sentence (no status code, URL, stack or "undefined"), nothing is posted to a venue from partial data, and a 429 never turns into
// a retry storm (bounded calls per request, answered quickly).
// TEST_PLAN: T-DEFI-017 (perps, predictions, NFT providers, 429 back-off).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`
  import './background/index';
  export { store, actions } from './background/store';
`);
const { M, F } = H;
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
const POSTS = /hyperliquid[^ ]*\/exchange|clob[^ ]*\/order|broadcast|sendRawTransaction/i;
const MAX_CALLS_PER_REQUEST = 40; // generous: a handler may fan out (markets + books + balances), but never loops on a 429

before(async () => {
  H.reset();
  F.fetchImpl = (u) => { seen.push(String(u)); return Promise.resolve(new Response('{}', { status: 200 })); };
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
  M.store.dispatch(M.actions.sdkFeatureSlice.patch({ flags: { perps: true, predictions: true }, killedProviders: [] }));
});

const VENUE_MESSAGES = [
  { type: 'perpsMarkets' }, { type: 'perpsAccount' }, { type: 'perpsOrder', coin: 'ETH', side: 'buy', size: '0.01', orderType: 'market' },
  { type: 'perpsCancel', coin: 'ETH', oid: 1 }, { type: 'perpsClose', coin: 'ETH' },
  { type: 'predictionMarkets' }, { type: 'predictionMarkets', q: 'election' }, { type: 'predictionMarket', id: 'abc' }, { type: 'predictionPortfolio' },
  { type: 'nftList', refresh: true }, { type: 'nftCollection', id: 'ethereum:0x0000000000000000000000000000000000000001' },
  { type: 'nftItem', collectionId: 'ethereum:0x0000000000000000000000000000000000000001', itemId: '1' },
];

for (const [mode, make] of Object.entries(MODES)) {
  test(`T-DEFI-017: perps / predictions / NFTs — ${mode}: friendly failure, no venue post, bounded calls`, async () => {
    F.fetchImpl = (u, i) => { seen.push(String(u)); return Promise.resolve().then(() => make(u, i)); };
    seen.length = 0; let refused = 0;
    for (const m of VENUE_MESSAGES) {
      const before = seen.length; const t0 = Date.now();
      const r = await Promise.race([send(m), new Promise((res) => setTimeout(() => res({ hung: true }), 30_000))]);
      assert.ok(r && typeof r === 'object' && !r.hung, `${m.type} answered`);
      if (r.ok === false) { refused++; assert.doesNotMatch(String(r.error ?? ''), LEAK, `${m.type}: ${r.error}`); }
      if (r.ok === true && Array.isArray(r.errors)) for (const e of r.errors) assert.doesNotMatch(String(e?.error ?? e), LEAK, `${m.type} per-source error: ${JSON.stringify(e)}`);
      if (r.ok === true && r.itemsError) assert.doesNotMatch(String(r.itemsError), LEAK, `${m.type} itemsError`);
      assert.ok(seen.length - before <= MAX_CALLS_PER_REQUEST, `${m.type}: ${seen.length - before} calls for one request (retry storm?)`);
      if (mode === 'http429') assert.ok(Date.now() - t0 < 20_000, `${m.type} answered promptly under 429`);
    }
    assert.ok(refused >= 6, `the failures were actually hit (${refused} of ${VENUE_MESSAGES.length} refused)`);
    assert.ok(seen.some((u) => /hyperliquid|polymarket|gamma|clob/i.test(u)), 'a venue was actually called');
    assert.deepEqual(seen.filter((u) => POSTS.test(u)), [], 'nothing posted to a venue from failing data');
  });
}
