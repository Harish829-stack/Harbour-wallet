// QA: perps (Hyperliquid) and predictions (Polymarket) through the REAL worker, against in-process fakes of both venues, of the
// Harbour API device/rpc endpoints and of the chains' JSON-RPC. The agent key and the Polymarket API credentials are secrets the UI
// must never receive: every response of every handler is scanned for them. Venue failure modes must give a plain error and sign nothing.
// TEST_PLAN: T-KEY-146, T-KEY-145, T-KEY-106, T-DEFI-017 (perps + predictions part).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAddress } from 'viem/accounts';
import { harness, PASSWORD, PHRASE_ABOUT, allStrings } from './harness.mjs';

const H = await harness(`
  import './background/index';
  export { store, actions } from './background/store/index';
  export { KEYS, local, session } from './core/storage';
  export * as passworder from './core/passworder';
  export { findSecretField } from './core/uiSafe';
`);
const { M, F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const ADDR0 = '0x9858effd232b4033e47d90003d41ec34ecaeda94';
const PM_SECRET = 'cWEtZmFrZS1wb2x5bWFya2V0LXNlY3JldA=='; const PM_PASSPHRASE = 'qa-fake-passphrase-5d1c'; const PM_KEY = '11111111-2222-3333-4444-555555555555';

// ---------------------------------------------------------------- fakes
const venue = { hl: [], pm: [], rpc: [], mode: 'ok' };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
const WORD = (n) => '0x' + BigInt(n).toString(16).padStart(64, '0');
function rpc(body) {
  const one = (r) => { venue.rpc.push(r?.method);
    const sel = String(r?.params?.[0]?.data ?? r?.params?.[0]?.input ?? '').slice(0, 10);
    const call = { '0x70a08231': WORD(10n ** 12n), '0xdd62ed3e': WORD(10n ** 30n), '0xe985e9c5': WORD(1) }[sel] ?? '0x';
    const res = { eth_chainId: '0x89', eth_blockNumber: '0x10', eth_getTransactionCount: '0x0', eth_estimateGas: '0x5208', eth_gasPrice: '0x3b9aca00', eth_maxPriorityFeePerGas: '0x3b9aca00', eth_getBalance: '0xde0b6b3a7640000', eth_call: call,
      eth_getBlockByNumber: { number: '0x10', baseFeePerGas: '0x3b9aca00', timestamp: '0x1', hash: '0x' + '11'.repeat(32), transactions: [] }, eth_feeHistory: { baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'], gasUsedRatio: [0.5], oldestBlock: '0x1', reward: [['0x3b9aca00']] } }[r?.method];
    return { jsonrpc: '2.0', id: r?.id ?? 1, ...(res !== undefined ? { result: res } : { error: { code: -32601, message: 'not found' } }) }; };
  return json(Array.isArray(body) ? body.map(one) : one(body));
}
function hyperliquid(path, body) {
  venue.hl.push({ path, type: body?.type ?? body?.action?.type });
  if (venue.mode === '500') return json({ error: 'boom' }, 500);
  if (venue.mode === 'malformed') return new Response('<html>not json', { status: 200 });
  if (venue.mode === '429') return json('rate limited', 429);
  if (path === '/info') {
    if (body.type === 'metaAndAssetCtxs') return json([{ universe: [{ name: 'ETH', szDecimals: 4, maxLeverage: 25 }] }, [{ midPx: '3000', markPx: '3000', prevDayPx: '2900' }]]);
    if (body.type === 'clearinghouseState') return json({ marginSummary: { accountValue: '100', totalMarginUsed: '0' }, withdrawable: '100', assetPositions: [] });
    return json([]);
  }
  if (path === '/exchange') {
    if (venue.mode === 'reject') return json({ status: 'err', response: 'User or API Wallet does not exist.' });
    const t = body?.action?.type;
    return json(t === 'order' ? { status: 'ok', response: { type: 'order', data: { statuses: [{ resting: { oid: 42 } }] } } } : t === 'cancel' ? { status: 'ok', response: { type: 'cancel', data: { statuses: ['success'] } } } : { status: 'ok', response: { type: 'default' } });
  }
  return json({}, 404);
}
function polymarket(u, init) {
  venue.pm.push({ path: u.pathname, method: init?.method ?? 'GET', headers: init?.headers ?? {} });
  if (venue.mode === '500') return json({ error: 'boom' }, 500);
  if (venue.mode === '429') return json({ error: 'Too Many Requests' }, 429);
  if (venue.mode === 'malformed') return new Response('<html>', { status: 200 });
  if (u.hostname === 'polymarket.com' && u.pathname === '/api/geoblock') return json({ blocked: venue.mode === 'geoblocked', country: 'QA' });
  if (u.pathname === '/book') return json({ asks: [{ price: '0.55', size: '500' }], bids: [{ price: '0.45', size: '500' }], tick_size: '0.01', min_order_size: '5', neg_risk: false });
  if (u.pathname === '/auth/derive-api-key') return json({ apiKey: PM_KEY, secret: PM_SECRET, passphrase: PM_PASSPHRASE });
  if (u.pathname === '/order') return json({ success: true, orderID: '0xorder', status: 'matched' });
  if (u.hostname === 'gamma-api.polymarket.com') return json([]);
  return json([]);
}
async function net(url, init) {
  const u = new URL(url);
  let body = null; try { const b = init?.body; body = b == null ? null : JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch { /* not json */ }
  if (u.hostname === 'api.hyperliquid.xyz') return hyperliquid(u.pathname, body);
  if (/polymarket\.com$/.test(u.hostname)) return polymarket(u, init);
  if (u.pathname === '/v1/devices/challenge') return json({ challenge: 'qa-challenge', difficulty: 0 });
  if (u.pathname === '/v1/devices') return json({ device_id: 'qa-device' });
  if (body && (body.jsonrpc || Array.isArray(body))) return rpc(body);
  if (process.env.HB_QA_DEBUG) console.log('UNHANDLED', init?.method ?? 'GET', url, init?.body ? String(init.body).slice(0, 200) : '');
  return json({ error: { code: 'not_found', message: 'not found' } }, 404);
}

// ---------------------------------------------------------------- helpers
let agentPk = null;
const responses = [];
async function call(msg) { const r = await send(msg); responses.push({ type: msg.type, r }); return r; }
function assertNoVenueSecret(r, label) {
  assert.equal(M.findSecretField(r), null, `${label}: secret-named field`);
  const strs = allStrings(r).map((s) => s.toLowerCase());
  const needles = [PM_SECRET, PM_PASSPHRASE, PM_KEY, ...(agentPk ? [agentPk, agentPk.slice(2)] : [])].map((x) => x.toLowerCase());
  for (const n of needles) assert.ok(!strs.some((s) => s.includes(n)), `${label} leaks a venue secret`);
}
const flags = (f) => M.store.dispatch(M.actions.sdkFeatureSlice.patch({ flags: f }));

before(async () => {
  H.reset(); F.fetchImpl = net;
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
});

test('T-KEY-145: perps/predictions refuse when the feature is off, when locked, and before perpsEnable — with no venue write', async () => {
  flags({ perps: false, predictions: false });
  for (const type of ['perpsMarkets', 'perpsEnable', 'perpsOrder', 'predictionMarkets', 'predictionOrder']) assert.equal((await call({ type, coin: 'ETH', side: 'buy', size: 1, tokenId: '1' })).code, 'FEATURE_DISABLED', type);
  flags({ perps: true, predictions: true });
  const hl0 = venue.hl.length, pm0 = venue.pm.filter((x) => x.method === 'POST').length;
  const noAgent = await call({ type: 'perpsOrder', coin: 'ETH', side: 'buy', size: 0.01, orderType: 'market' });
  assert.equal(noAgent.ok, false); assert.equal(noAgent.code, 'no_agent');
  assert.ok(!venue.hl.slice(hl0).some((x) => x.path === '/exchange'), 'nothing sent to the exchange without an agent');
  await send({ type: 'lock' });
  for (const m of [{ type: 'perpsEnable' }, { type: 'perpsOrder', coin: 'ETH', side: 'buy', size: 0.01 }, { type: 'predictionOrder', tokenId: '123', side: 'BUY', size: 10 }]) {
    const r = await call(m); assert.equal(r.ok, false, `${m.type} while locked: ${JSON.stringify(r)}`);
  }
  assert.ok(!venue.hl.slice(hl0).some((x) => x.path === '/exchange'), 'no exchange call while locked');
  assert.equal(venue.pm.filter((x) => x.method === 'POST').length, pm0, 'no Polymarket POST while locked');
  assert.equal((await send({ type: 'unlock', password: PASSWORD })).ok, true);
});

test('T-KEY-146 / T-KEY-106: perpsEnable stores the agent key encrypted under the session password key; it survives lock/unlock and no response ever contains it', async () => {
  flags({ perps: true });
  const en = await call({ type: 'perpsEnable' });
  assert.equal(en.ok, true, JSON.stringify(en));
  const recs = await M.local.get(M.KEYS.PERPS_AGENTS); const [scope, rec] = Object.entries(recs)[0];
  assert.match(scope, /:0$/); assert.equal(rec.address, en.agent);
  assert.doesNotMatch(JSON.stringify(rec), /0x[0-9a-f]{64}/i, 'no raw 32-byte hex in the stored record');
  ({ pk: agentPk } = await M.passworder.decrypt(F.session.data[M.KEYS.PASSWORD], rec.enc));
  assert.equal(privateKeyToAddress(agentPk), en.agent, 'stored blob decrypts to the approved agent');
  assert.ok(venue.hl.some((x) => x.path === '/exchange' && x.type === 'approveAgent'), 'agent approved by the main wallet');
  // lock / unlock: the agent is still usable (same address), and orders are signed by it
  await send({ type: 'lock' }); assert.equal((await send({ type: 'unlock', password: PASSWORD })).ok, true);
  const again = await M.passworder.decrypt(F.session.data[M.KEYS.PASSWORD], (await M.local.get(M.KEYS.PERPS_AGENTS))[scope].enc);
  assert.equal(again.pk, agentPk);
  const order = await call({ type: 'perpsOrder', coin: 'ETH', side: 'buy', size: 0.01, orderType: 'market' });
  assert.equal(order.ok, true, JSON.stringify(order));
  const cancel = await call({ type: 'perpsCancel', coin: 'ETH', oid: 42 }); assert.equal(cancel.ok, true, JSON.stringify(cancel));
  for (const type of ['perpsMarkets', 'perpsAccount']) await call({ type });
  await call({ type: 'perpsWithdraw', amount: 5 });
  await call({ type: 'perpsDeposit', amount: '10000000', dryRun: true });
  for (const { type, r } of responses) assertNoVenueSecret(r, type);
});

test('T-KEY-146: Polymarket API credentials are derived with a wallet signature, stored encrypted, used for L2 headers, and never returned', async () => {
  flags({ predictions: true }); venue.mode = 'ok';
  await call({ type: 'predictionMarkets' }); await call({ type: 'predictionPortfolio' });
  const r = await call({ type: 'predictionOrder', tokenId: '123456', side: 'BUY', size: 10, orderType: 'FOK' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const derive = venue.pm.find((x) => x.path === '/auth/derive-api-key'); assert.ok(derive, 'credentials derived');
  assert.match(String(derive.headers.POLY_SIGNATURE), /^0x[0-9a-f]{130}$/, 'L1 auth signed by the wallet');
  const post = venue.pm.find((x) => x.path === '/order' && x.method === 'POST'); assert.ok(post);
  assert.equal(post.headers.POLY_API_KEY, PM_KEY); assert.equal(post.headers.POLY_PASSPHRASE, PM_PASSPHRASE); assert.ok(post.headers.POLY_SIGNATURE, 'HMAC header present');
  assert.ok(!Object.values(post.headers).includes(PM_SECRET), 'the secret itself is never sent');
  const stored = JSON.stringify(await M.local.get(M.KEYS.PREDICTIONS_CREDS));
  for (const s of [PM_SECRET, PM_PASSPHRASE, PM_KEY]) assert.ok(!stored.includes(s), 'credentials encrypted at rest');
  // second order reuses the stored creds (no second derivation)
  const n = venue.pm.filter((x) => x.path === '/auth/derive-api-key').length;
  assert.equal((await call({ type: 'predictionOrder', tokenId: '123456', side: 'BUY', size: 10, orderType: 'FOK' })).ok, true);
  assert.equal(venue.pm.filter((x) => x.path === '/auth/derive-api-key').length, n);
  for (const { type, r: x } of responses) assertNoVenueSecret(x, type);
});

test('T-DEFI-017 (perps, predictions): venue 500 / 429 / malformed / rejection → plain error, nothing signed for the chain, no secret in the error', async () => {
  for (const mode of ['500', '429', 'malformed', 'reject']) {
    venue.mode = mode; const rpc0 = venue.rpc.filter((m) => m === 'eth_sendRawTransaction').length;
    for (const m of [{ type: 'perpsOrder', coin: 'ETH', side: 'buy', size: 0.01, orderType: 'market' }, { type: 'perpsMarkets' }, { type: 'perpsAccount' }]) {
      const r = await call(m);
      if (mode !== 'reject' || m.type === 'perpsOrder') assert.equal(r.ok, false, `${mode} ${m.type}: ${JSON.stringify(r)}`);
      if (r.ok === false) { assert.equal(typeof r.error, 'string'); assert.doesNotMatch(r.error, /TypeError|at \S+:\d+|Unexpected token/, `${mode} ${m.type} error text: ${r.error}`); }
    }
    if (mode !== 'reject') {
      const p = await call({ type: 'predictionOrder', tokenId: '123456', side: 'BUY', size: 10, orderType: 'FOK' });
      assert.equal(p.ok, false, `${mode} predictionOrder`);
    }
    assert.equal(venue.rpc.filter((m) => m === 'eth_sendRawTransaction').length, rpc0, `${mode}: nothing broadcast`);
  }
  venue.mode = 'ok';
  for (const { type, r } of responses) assertNoVenueSecret(r, type);
});
