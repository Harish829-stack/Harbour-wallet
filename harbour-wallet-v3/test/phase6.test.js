import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, createVerify } from 'node:crypto';

// Phase 6: market fallbacks (gateway -> CoinGecko -> DefiLlama, GeckoTerminal for tokens), hot tokens, notification rules,
// and the gateway push service (registration, address watcher, FCM auth) against fakes.
const bundle = async (contents, resolveDir) => {
  const out = await build({ stdin: { contents, resolveDir: fileURLToPath(new URL(resolveDir, import.meta.url)), sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const M = await bundle(`export * from './marketData'; export { mapCgTrending, fetchHot } from './priceService'; export * from './notifyRules';`, '../src/core/');
const P = await bundle(`export * from './push';`, '../gateway/');
const res = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

test('market: coin ids from the registry, token refs, DefiLlama chart + price fallbacks', async () => {
  assert.equal(M.coinIdFor('bitcoin'), 'bitcoin'); assert.equal(M.coinIdFor('tron'), 'tron'); assert.equal(M.coinIdFor('sepolia'), undefined);
  assert.deepEqual(M.tokenRef('token:ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'), { network: 'eth', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' });
  assert.equal(M.tokenRef('token:nowhere:0xabc'), null);
  const calls = [];
  const f = async (url) => { calls.push(url); if (url.includes('api.coingecko.com')) return res({}, 500); return res({ coins: { 'coingecko:tron': { prices: [{ timestamp: 1, price: 0.1 }, { timestamp: 2, price: 0.12 }] } } }); };
  const r = await M.fetchChart('tron', '1W', f, 10_000);
  assert.equal(r.ok, true); assert.equal(r.data.points.length, 2); assert.ok(calls.at(-1).includes('coins.llama.fi/chart/coingecko:tron'));
  const info = await M.fetchInfo('tron', async (url) => (url.includes('llama') ? res({ coins: { 'coingecko:tron': { price: 0.11 } } }) : res({}, 503)), 10_000);
  assert.equal(info.ok, true); assert.equal(info.data.price, 0.11);
});

test('market: token chart and info from GeckoTerminal (top pool OHLCV)', async () => {
  const addr = '0x6982508145454Ce325dDbE47a25d4ec3d2311933';
  const f = async (url) => {
    if (url.includes('/ohlcv/')) return res({ data: { attributes: { ohlcv_list: [[200, 1, 1, 1, 2, 9], [100, 1, 1, 1, 1, 9]] } } });
    return res({ data: { attributes: { price_usd: '0.00001', fdv_usd: '5000000', volume_usd: { h24: '123' } }, relationships: { top_pools: { data: [{ id: 'eth_0xpool' }] } } } });
  };
  const c = await M.fetchChart(`token:ethereum:${addr}`, '1D', f, 300_000);
  assert.equal(c.ok, true); assert.deepEqual(c.data.points.map((p) => p.p), [1, 2]); assert.equal(c.data.changePct, 100);
  const i = await M.fetchInfo(`token:ethereum:${addr}`, f, 1);
  assert.equal(i.data.price, 0.00001); assert.equal(i.data.marketCap, 5000000);
});

test('hot tokens: CoinGecko trending mapping + GeckoTerminal DEX pools on supported chains', async () => {
  const cg = { coins: [{ item: { id: 'pepe', symbol: 'pepe', name: 'Pepe', large: 'https://x/p.png', market_cap_rank: 30, data: { price: 0.00001, price_change_percentage_24h: { usd: 12.5 } } } }] };
  assert.deepEqual(M.mapCgTrending(cg)[0], { id: 'pepe', symbol: 'PEPE', name: 'Pepe', image: 'https://x/p.png', price: 0.00001, change24h: 12.5, rank: 30, source: 'coingecko' });
  const gt = { data: [
    { attributes: { name: 'WIF / SOL', base_token_price_usd: '2.1', price_change_percentage: { h24: '-3' }, volume_usd: { h24: '1000' }, address: 'pool1' }, relationships: { network: { data: { id: 'solana' } }, base_token: { data: { id: 'solana_EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' } } } },
    { attributes: { name: 'X / Y' }, relationships: { network: { data: { id: 'unknownnet' } }, base_token: { data: { id: 'unknownnet_abc' } } } },
  ] };
  const h = await M.fetchHot(async (url) => (url.includes('trending_pools') ? res(gt) : res(cg)));
  assert.equal(h.tokens.length, 1); assert.equal(h.dex.length, 1);
  assert.equal(h.dex[0].id, 'token:solana:EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'); assert.equal(h.dex[0].symbol, 'WIF'); assert.equal(h.dex[0].change24h, -3);
});

test('notification rule: first look seeds silently, later only new confirmed receives', () => {
  const it = (id, kind = 'receive', status = 'confirmed') => ({ id, kind, status, assetId: 'ethereum', timestamp: 0, amount: '1', symbol: 'ETH' });
  const a = M.newIncoming([it('1'), it('2')], undefined); assert.deepEqual(a.fresh, []); assert.deepEqual(a.seen, ['1', '2']);
  const b = M.newIncoming([it('3'), it('4', 'send'), it('5', 'receive', 'pending'), it('1')], a.seen);
  assert.deepEqual(b.fresh.map((x) => x.id), ['3']); assert.ok(b.seen.includes('4') && b.seen.includes('2'));
});

const fakeKv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) }; };
const ME = '0x1111111111111111111111111111111111111111';

test('gateway push: registration validation, EVM watcher cursor + notices, unregister', async () => {
  const kv = fakeKv(); const env = { CACHE: kv, ETHERSCAN_API_KEY: 'k' };
  assert.equal((await P.register(env, { token: 'short' })).status, 400);
  const r = await P.register(env, { token: 'tok_'.padEnd(40, 'x'), addresses: [{ chainId: 'ethereum', address: ME }, { chainId: 'ethereum', address: 'nope' }, { chainId: 'bitcoin', address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu' }] });
  assert.equal(r.status, 200); assert.equal(r.body.watching, 2);
  const tx = (h, to, block, value = '1000000000000000000') => ({ hash: h, to, from: '0x2222222222222222222222222222222222222222', blockNumber: String(block), value, isError: '0' });
  const first = await P.checkAddress(env, { chainId: 'ethereum', address: ME }, undefined, async () => res({ result: [tx('0xa', ME, 10)] }));
  assert.deepEqual(first.notices, []); assert.equal(first.cursor, '10');
  const urls = [];
  const next = await P.checkAddress(env, { chainId: 'ethereum', address: ME }, '10', async (u) => { urls.push(u); return res({ result: u.includes('tokentx') ? [] : [tx('0xb', ME, 12), tx('0xc', '0x3333333333333333333333333333333333333333', 13)] }); });
  assert.ok(urls[0].includes('startblock=11')); assert.equal(next.cursor, '13');
  assert.equal(next.notices.length, 1); assert.equal(next.notices[0].title, 'Received 1 ETH'); assert.equal(next.notices[0].url, 'https://etherscan.io/tx/0xb');
  assert.equal((await P.unregister(env, { token: 'tok_'.padEnd(40, 'x') })).status, 200); assert.equal(kv.m.size, 0);
});

test('gateway push: FCM service-account JWT is RS256-signed; watcher sends and drops dead tokens', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'svc@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'proj' };
  let assertion = '';
  const tokenFetch = async (url, init) => { assertion = new URLSearchParams(init.body).get('assertion'); return res({ access_token: 'ya29.x' }); };
  assert.equal(await P.fcmAccessToken(sa, tokenFetch, 1000), 'ya29.x');
  const [h, p, sig] = assertion.split('.');
  const v = createVerify('RSA-SHA256'); v.update(`${h}.${p}`);
  assert.ok(v.verify(publicKey, Buffer.from(sig, 'base64url')));
  assert.equal(JSON.parse(Buffer.from(p, 'base64url')).scope, 'https://www.googleapis.com/auth/firebase.messaging');
  const kv = fakeKv(); const env = { CACHE: kv, ETHERSCAN_API_KEY: 'k', FCM_SERVICE_ACCOUNT: JSON.stringify(sa) };
  await P.register(env, { token: 'devtoken'.padEnd(30, 'z'), addresses: [{ chainId: 'base', address: ME }] });
  const key = [...kv.m.keys()][0]; const reg = JSON.parse(kv.m.get(key)); reg.cursors[`base:${ME}`] = '5'; kv.m.set(key, JSON.stringify(reg));
  const sent = [];
  const f = async (url, init) => {
    if (url.includes('oauth2')) return res({ access_token: 'ya29.y' });
    if (url.includes('fcm.googleapis.com')) { sent.push(JSON.parse(init.body).message); return res({ name: 'm1' }); }
    return res({ result: url.includes('tokentx') ? [] : [{ hash: '0xd', to: ME, from: ME, blockNumber: '9', value: '5', isError: '0' }] });
  };
  const run = await P.runWatcher(env, f);
  assert.deepEqual(run, { checked: 1, sent: 1 }); assert.equal(sent[0].token, 'devtoken'.padEnd(30, 'z')); assert.match(sent[0].data.title, /^Received /);
  assert.equal(JSON.parse(kv.m.get(key)).cursors[`base:${ME}`], '9');
  const gone = async (url) => (url.includes('fcm.googleapis.com') ? { ok: false, status: 404, json: async () => ({}), text: async () => 'UNREGISTERED' } : f(url));
  const reg2 = JSON.parse(kv.m.get(key)); reg2.cursors[`base:${ME}`] = '5'; kv.m.set(key, JSON.stringify(reg2));
  await P.runWatcher(env, gone);
  assert.equal(kv.m.has(key), false);
});
