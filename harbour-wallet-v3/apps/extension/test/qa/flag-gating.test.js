// QA (unit): remote flags gate features in the handler itself, not only in registration/UI. With flags {} (default) or the
// provider killed, perps / predictions / smart-account messages are refused with FEATURE_DISABLED (or a plain refusal) and no
// network call is made; turning the flag on enables them and a kill list switches them off again.
// TEST_PLAN: T-X-008 (remote-flag half; build flags are covered by T-X-009 / T-MSG-005).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`
  import './background/index';
  export { store, actions } from './background/store';
  export { setKilledProviders } from './kit/failover';
`);
const { M, F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const calls = [];
const setFlags = (flags, killed = []) => { M.store.dispatch(M.actions.sdkFeatureSlice.patch({ flags, killedProviders: killed })); M.setKilledProviders(killed); };

before(async () => {
  H.reset(); F.fetchImpl = (url) => { calls.push(String(url)); return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })); };
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
});

const PERPS = [{ type: 'perpsMarkets' }, { type: 'perpsAccount' }, { type: 'perpsEnable' }, { type: 'perpsDeposit', amount: '10000000' }, { type: 'perpsOrder', coin: 'ETH' }, { type: 'perpsCancel' }, { type: 'perpsClose', coin: 'ETH' }];

test('T-X-008: perps handlers refuse with FEATURE_DISABLED when the flag is absent, false, or the venue is killed; no network', async () => {
  for (const [flags, killed] of [[{}, []], [{ perps: false }, []], [{ perps: 'true' }, []], [{ perps: true }, ['hyperliquid']]]) {
    setFlags(flags, killed); calls.length = 0;
    for (const m of PERPS) { const r = await send(m); assert.equal(r.ok, false, `${m.type} ${JSON.stringify(flags)} ${killed}`); assert.equal(r.code ?? r.error, 'FEATURE_DISABLED', m.type); }
    assert.deepEqual(calls.filter((u) => /hyperliquid/i.test(u)), [], 'no venue call while disabled');
  }
  setFlags({ perps: true }, []); // control: the same message is not refused as disabled once the flag is on (proves the gate, not a dead handler)
  for (const m of PERPS.slice(0, 2)) assert.notEqual((await send(m)).code, 'FEATURE_DISABLED', m.type);
});

test('T-X-008: predictions handlers refuse when flag absent or polymarket killed; flag on lets the gate open', async () => {
  const P = [{ type: 'predictionMarkets' }, { type: 'predictionMarket', id: 'x' }, { type: 'predictionPortfolio' }, { type: 'predictionWrap', amount: '1' }, { type: 'predictionOrder' }];
  for (const [flags, killed] of [[{}, []], [{ predictions: true }, ['polymarket']]]) {
    setFlags(flags, killed); calls.length = 0;
    for (const m of P) { const r = await send(m); const disabled = r?.ok === false && (r.code === 'FEATURE_DISABLED' || /not enabled/i.test(r.error ?? '')); assert.ok(disabled || r?.blocked === true || r?.tradingBlocked === true, `${m.type}: ${JSON.stringify(r).slice(0, 160)}`); }
    assert.deepEqual(calls.filter((u) => /polymarket|gamma|clob/i.test(u)), [], 'no venue call while disabled');
  }
  setFlags({ predictions: true }, []);
  const r = await send({ type: 'predictionMarkets' });
  assert.notEqual(r.code, 'FEATURE_DISABLED', 'enabled flag opens the gate (the fake network may still fail the fetch)');
});

test('T-X-008: smart-account actions are refused without the smartAccounts flag, in the handler (not just hidden in the UI)', async () => {
  setFlags({}, []); calls.length = 0;
  for (const m of [{ type: 'smartAccountPrepare', chainId: 11155111 }, { type: 'smartAccountApprove', chainId: 11155111 }]) {
    const r = await send(m); assert.equal(r.ok, false, m.type);
  }
  const st = await send({ type: 'smartAccountState', chainId: 11155111 });
  if (st?.ok) assert.equal(st.flagOn, false);
  assert.deepEqual(calls.filter((u) => /bundler|pimlico/i.test(u)), []);
});
