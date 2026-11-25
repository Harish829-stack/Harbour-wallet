// QA: custom tokens, custom networks and ramp keys through the REAL worker (tokenAdd/tokenList/tokenRemove, networkSave/networkList,
// rampsKeysSet/Get/Clear) and the registry loaders for data written by older builds. TEST_PLAN: T-CH-006, T-CH-016, T-DEFI-013.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT, allStrings } from './harness.mjs';

const H = await harness(`
  import './background/index';
  export { readTokens, sanitizeToken, tokenId, MAX_TOKENS } from './core/customTokens';
  export { setNetworkState, getNetworkState, customNetworks, rpcOverride } from './core/networkRegistry';
  export { RAMP_KEYS_STORAGE } from './core/ramps/keys';
`);
const { M, F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const contract = (i) => '0x' + (0x1000 + i).toString(16).padStart(40, '0');
before(async () => { H.reset(); assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true); });

test('T-CH-006: manual tokens persist in the vault (survive lock/unlock), upsert by id, 101st refused, remove works', async () => {
  for (let i = 0; i < 100; i++) {
    const r = await send({ type: 'tokenAdd', manual: true, chainId: 1, address: contract(i), name: `Token ${i}`, symbol: `T${i}`, decimals: 18 });
    assert.equal(r.ok, true, `${i}: ${JSON.stringify(r)}`);
  }
  const over = await send({ type: 'tokenAdd', manual: true, chainId: 1, address: contract(100), name: 'One too many', symbol: 'X', decimals: 6 });
  assert.equal(over.ok, false); assert.match(over.error, /up to 100/);
  // same contract in another letter case = the same token (upsert, no duplicate), and the cap does not block it
  const again = await send({ type: 'tokenAdd', manual: true, chainId: 1, address: contract(5).toUpperCase().replace('0X', '0x'), name: 'Renamed', symbol: 'T5', decimals: 18 });
  assert.equal(again.ok, true, JSON.stringify(again)); assert.equal(again.existed, true);
  await send({ type: 'lock' }); assert.equal((await send({ type: 'unlock', password: PASSWORD })).ok, true);
  const list = (await send({ type: 'tokenList' })).tokens;
  assert.equal(list.length, 100); assert.equal(new Set(list.map((t) => t.id)).size, 100);
  assert.equal(list.find((t) => t.id === M.tokenId(1, contract(5))).name, 'Renamed');
  assert.equal((await send({ type: 'tokenRemove', id: M.tokenId(1, contract(0)) })).ok, true);
  assert.equal((await send({ type: 'tokenList' })).tokens.length, 99);
  assert.equal((await send({ type: 'tokenAdd', manual: true, chainId: 1, address: contract(100), name: 'Now fits', symbol: 'Y', decimals: 6 })).ok, true);
  // the list lives in the encrypted vault, not in plain storage
  assert.ok(!JSON.stringify(F.local.data).includes(contract(7).slice(2)), 'token list not stored in clear in storage.local');
  // invalid input
  for (const bad of [{ chainId: 999999991 }, { address: '0x123' }, { decimals: 33 }, { decimals: -1 }, { name: '' }, { symbol: '' }, { address: '0x' + 'G'.repeat(40) }])
    assert.equal((await send({ type: 'tokenAdd', manual: true, chainId: 1, address: contract(200), name: 'N', symbol: 'S', decimals: 6, ...bad })).ok, false, JSON.stringify(bad));
});

test('T-CH-016: token and network records written by older builds load normalised with stable ids', () => {
  const good = M.sanitizeToken({ chainId: 1, address: contract(9), name: 'A', symbol: 'A', decimals: 6 }, 1).token;
  const legacy = { ...good }; delete legacy.addedAt; delete legacy.networkId; delete legacy.manual;
  const rows = M.readTokens([legacy, null, 7, { id: 'x' }, { ...good, chainId: '1' }, { ...good, chainId: 999999991, id: 'gone' }]);
  assert.deepEqual(rows.map((r) => r.id), [good.id], 'well-formed legacy row kept with its id; malformed and unknown-network rows dropped');
  assert.equal(M.tokenId(1, contract(9).toUpperCase().replace('0X', '0x')), good.id, 'id is case-insensitive');
  assert.deepEqual(M.readTokens('not a list'), []);
  // networks: an older build could save a built-in chain as a custom row → becomes an RPC override, one identity per chain
  M.setNetworkState({ custom: [{ chainId: 1, name: 'My Ethereum', rpcUrl: 'https://my-rpc.example', symbol: 'ETH' }, { chainId: 777777, name: 'Custom', rpcUrl: 'https://c.example', symbol: 'C' },
    { chainId: '5', rpcUrl: 'x' }, { chainId: 3.5, rpcUrl: 'x' }, null, { chainId: 888888 }], rpcOverrides: { 10: 'https://op.example' } });
  assert.deepEqual(M.customNetworks().map((n) => n.chainId), [777777]);
  assert.equal(M.rpcOverride(1), 'https://my-rpc.example'); assert.equal(M.rpcOverride(10), 'https://op.example');
  M.setNetworkState({ custom: [{ chainId: 1, rpcUrl: 'https://second.example' }], rpcOverrides: { 1: 'https://kept.example' } });
  assert.equal(M.rpcOverride(1), 'https://kept.example', 'an explicit override wins over a legacy duplicate row');
  M.setNetworkState(null); assert.deepEqual(M.getNetworkState(), { custom: [], rpcOverrides: {} });
});

test('T-DEFI-013: ramp keys — only publishable formats accepted, the UI only ever sees masked previews, clear removes them', async () => {
  const pk = 'pk_test_abcdefghijKLMNOP1234';
  const set = await send({ type: 'rampsKeysSet', providerId: 'moonpay', keys: { apiKey: pk } });
  assert.equal(set.ok, true, JSON.stringify(set));
  for (const r of [set, await send({ type: 'rampsKeysGet' })]) assert.ok(!allStrings(r).some((s) => s.includes(pk)), 'full key never returned to the UI');
  const mp = set.providers.find((p) => p.id === 'moonpay'); assert.equal(mp.fields[0].configured, true); assert.equal(mp.fields[0].preview, 'pk_••••234');
  // secret keys and junk are refused (the design stores publishable identifiers only; see core/ramps/keys.ts)
  for (const bad of ['sk_live_abcdefghijklmnop', 'pk_live_<script>', '', 'x'.repeat(500)]) {
    const r = await send({ type: 'rampsKeysSet', providerId: 'moonpay', keys: { apiKey: bad } });
    if (bad === '') continue; // blank keeps the stored value
    assert.equal(r.ok, false, bad);
  }
  assert.equal((await send({ type: 'rampsKeysSet', providerId: 'nope', keys: {} })).ok, false);
  const stored = F.local.data[M.RAMP_KEYS_STORAGE]; assert.equal(stored.moonpay.apiKey, pk);
  const cl = await send({ type: 'rampsKeysClear', providerId: 'moonpay' }); assert.equal(cl.ok, true);
  assert.equal(F.local.data[M.RAMP_KEYS_STORAGE].moonpay, undefined);
  // stored data is re-validated on read: a tampered secret key in storage is ignored
  F.local.data[M.RAMP_KEYS_STORAGE] = { moonpay: { apiKey: 'sk_live_tampered1234567' } };
  const g = await send({ type: 'rampsKeysGet' }); assert.equal(g.providers.find((p) => p.id === 'moonpay').fields[0].configured, false);
});
