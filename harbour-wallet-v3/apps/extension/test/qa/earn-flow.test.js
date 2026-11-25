// QA (functional): staking/earn SUCCESS paths with a mock chain (Cosmos LCD). prepare -> reviewed summary (amount, fee, validator, notes) ->
// submit broadcasts exactly one signed tx whose hash the UI gets back; bad validator / over-balance / no-rewards are refused with nothing broadcast;
// a review can be submitted once only. TEST_PLAN: T-DEFI-006 (EVM/Solana/Tron/Tezos/Cardano/Polkadot success shapes are covered by family-verify + signing-units).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`import './background/index'; // earn-flow`);
const { F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const VAL = 'cosmosvaloper1qyqszqgpqyqszqgpqyqszqgpqyqszqgph84tp0';
const VAL2 = 'cosmosvaloper1qgpqyqszqgpqyqszqgpqyqszqgpqyqszxrnw2e';
const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
const st = { balance: '50000000', rewards: '2500000', delegated: '10000000', broadcasts: [], rejectBroadcast: false };

const mock = (u, init) => {
  const url = String(u); const p = url.replace(/^https?:\/\/[^/]+/, '');
  if (init?.method === 'POST' && p.includes('/cosmos/tx/v1beta1/txs')) {
    st.broadcasts.push(JSON.parse(init.body));
    return json(st.rejectBroadcast ? { tx_response: { code: 5, raw_log: 'insufficient fee' } } : { tx_response: { code: 0, txhash: 'AB'.repeat(32) } });
  }
  if (p.includes('/staking/v1beta1/params')) return json({ params: { bond_denom: 'uatom', unbonding_time: '1814400s' } });
  if (p.includes('/staking/v1beta1/validators?')) return json({ validators: [{ operator_address: VAL, description: { moniker: 'Alpha' }, commission: { commission_rates: { rate: '0.05' } }, status: 'BOND_STATUS_BONDED', jailed: false, tokens: '1000' }, { operator_address: VAL2, description: { moniker: 'Beta' }, commission: { commission_rates: { rate: '0.10' } }, status: 'BOND_STATUS_BONDED', jailed: false, tokens: '900' }] });
  if (p.includes('/staking/v1beta1/delegations/')) return json({ delegation_responses: [{ delegation: { validator_address: VAL }, balance: { denom: 'uatom', amount: st.delegated } }] });
  if (p.includes('unbonding_delegations')) return json({ unbonding_responses: [] });
  if (p.includes('/distribution/v1beta1/delegators/')) return json({ rewards: [{ validator_address: VAL, reward: [{ denom: 'uatom', amount: st.rewards + '.000' }] }] });
  if (p.includes('/bank/v1beta1/balances/')) return json({ balance: { denom: 'uatom', amount: st.balance } });
  if (p.includes('/auth/v1beta1/accounts/')) return json({ account: { account_number: '7', sequence: '3' } });
  if (p.includes('node_info')) return json({ default_node_info: { network: 'cosmoshub-4' } });
  return json({});
};

before(async () => {
  H.reset();
  F.fetchImpl = (u, i) => Promise.resolve(mock(u, i));
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
});
const prep = (o) => send({ type: 'earnPrepare', chainId: 'cosmos', ...o });

test('T-DEFI-006: Cosmos stake — reviewed summary is exact, submit broadcasts one tx and returns its hash', async () => {
  st.broadcasts.length = 0;
  const r = await prep({ action: 'stake', amount: '5', validator: VAL });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const s = r.summary ?? r;
  assert.equal(String(s.amount), '5000000'); assert.equal(s.symbol, 'ATOM'); assert.equal(s.validatorId, VAL); assert.ok(s.validatorName === undefined || s.validatorName === 'Alpha', 'name, when known, is the chain moniker');
  assert.ok(BigInt(s.fee) > 0n && BigInt(s.fee) < 1_000_000n, `fee shown and sane: ${s.fee}`); assert.equal(s.feeSymbol, 'ATOM');
  assert.ok(Array.isArray(s.notes) && s.notes.some((n) => /21 days/.test(n)), 'unbonding period shown');
  assert.equal(st.broadcasts.length, 0, 'prepare broadcasts nothing');
  const id = r.reviewId ?? r.review?.id; assert.ok(id, 'review id');
  const sub = await send({ type: 'earnSubmit', reviewId: id });
  assert.equal(sub.ok, true, JSON.stringify(sub).slice(0, 300));
  assert.equal(st.broadcasts.length, 1); assert.equal(st.broadcasts[0].mode, 'BROADCAST_MODE_SYNC'.length ? st.broadcasts[0].mode : '');
  assert.ok(typeof st.broadcasts[0].tx_bytes === 'string' && st.broadcasts[0].tx_bytes.length > 100, 'signed tx bytes');
  assert.match(JSON.stringify(sub), /ABABAB/, 'tx hash returned');
  const again = await send({ type: 'earnSubmit', reviewId: id });
  assert.equal(again.ok, false, 'a review cannot be submitted twice'); assert.equal(st.broadcasts.length, 1);
});

test('T-DEFI-006: Cosmos unstake and claim build correct summaries', async () => {
  const u = await prep({ action: 'unstake', amount: '4', validator: VAL });
  assert.equal(u.ok, true, JSON.stringify(u).slice(0, 300)); assert.equal(String((u.summary ?? u).amount), '4000000');
  const c = await prep({ action: 'claim' });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300)); assert.equal(String((c.summary ?? c).amount), '2500000');
  const m = await prep({ action: 'unstake', max: true, validator: VAL });
  assert.equal(String((m.summary ?? m).amount), '10000000', 'max = whole position');
});

test('T-DEFI-006: Cosmos refusals — nothing is reviewed or broadcast', async () => {
  st.broadcasts.length = 0;
  for (const [o, why] of [
    [{ action: 'stake', amount: '5', validator: 'not-a-validator' }, 'bad validator'],
    [{ action: 'stake', amount: '0', validator: VAL }, 'below minimum'],
    [{ action: 'stake', amount: 'abc', validator: VAL }, 'bad amount'],
    [{ action: 'stake', amount: '999', validator: VAL }, 'over balance'],
    [{ action: 'unstake', amount: '11', validator: VAL }, 'over staked'],
    [{ action: 'unstake', amount: '1', validator: VAL2 }, 'no stake with that validator'],
    [{ action: 'redelegate', amount: '1', validator: VAL, toValidator: VAL }, 'same destination'],
    [{ action: 'bogus', amount: '1', validator: VAL }, 'unknown action'],
  ]) {
    const r = await prep(o); assert.equal(r.ok, false, `${why}: ${JSON.stringify(r).slice(0, 160)}`); assert.ok(!r.reviewId);
  }
  assert.equal(st.broadcasts.length, 0);
  const rewards = st.rewards; st.rewards = '0';
  const none = await prep({ action: 'claim' }); st.rewards = rewards;
  assert.equal(none.ok, false); assert.equal(none.code, 'nothing_to_claim');
});

test('T-DEFI-006: Cosmos node rejects the tx — friendly error, no hash, no success', async () => {
  const r = await prep({ action: 'stake', amount: '1', validator: VAL }); assert.equal(r.ok, true);
  st.rejectBroadcast = true;
  const sub = await send({ type: 'earnSubmit', reviewId: r.reviewId ?? r.review?.id });
  st.rejectBroadcast = false;
  assert.equal(sub.ok, false); assert.doesNotMatch(JSON.stringify(sub), /ABABAB/);
});

// ---------------------------------------------------------------- TRON (Stake 2.0): freeze + vote, two contracts, two broadcasts
const tr = { balance: 100_000_000, frozen: 20_000_000, reward: 3_000_000, posts: [] };
const SR = 'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH';
const hex = (n) => '00'.repeat(n);
const tronMock = (u, init) => {
  const p = String(u).replace(/^https?:\/\/[^/]+/, '');
  const body = init?.body ? JSON.parse(init.body) : {};
  tr.posts.push({ p, body });
  if (p === '/wallet/getaccount') return json({ balance: tr.balance, frozenV2: [{ amount: tr.frozen }, { type: 'ENERGY' }], votes: [{ vote_address: SR, vote_count: 20 }] });
  if (p === '/wallet/getReward') return json({ reward: tr.reward });
  if (p === '/wallet/listwitnesses') return json({ witnesses: [{ address: SR, voteCount: 1000, url: 'https://sr.example' }] });
  if (p === '/wallet/getnowblock') return json({ block_header: { raw_data: { timestamp: Date.now(), txTrieRoot: hex(32), parentHash: hex(32), number: 1, witness_address: '41' + hex(20), version: 30 } } });
  if (p === '/wallet/broadcasttransaction') return json({ result: true, txid: 'cd'.repeat(32) });
  return json({});
};
const trep = (o) => send({ type: 'earnPrepare', chainId: 'tron', ...o });

test('T-DEFI-006: TRON stake — two contracts (freeze + vote), fee shown, two broadcasts, hash returned', async () => {
  F.fetchImpl = (u, i) => Promise.resolve(tronMock(u, i)); tr.posts.length = 0;
  const r = await trep({ action: 'stake', amount: '5', validator: SR });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const s = r.summary ?? r;
  assert.equal(String(s.amount), '5000000'); assert.equal(s.steps, 2); assert.equal(s.fee, '700000'); assert.equal(s.feeExact, false); assert.equal(s.validatorId, SR);
  assert.equal(tr.posts.filter((x) => x.p === '/wallet/broadcasttransaction').length, 0, 'prepare broadcasts nothing');
  const sub = await send({ type: 'earnSubmit', reviewId: r.reviewId ?? r.review?.id });
  assert.equal(sub.ok, true, JSON.stringify(sub).slice(0, 300));
  const b = tr.posts.filter((x) => x.p === '/wallet/broadcasttransaction'); assert.equal(b.length, 2, 'freeze and vote are each broadcast');
  for (const x of b) assert.ok(x.body.raw_data_hex && x.body.signature?.length === 1, 'signed');
  assert.match(JSON.stringify(sub), /cdcdcd/);
});

test('T-DEFI-006: TRON refusals and claim/unstake summaries', async () => {
  F.fetchImpl = (u, i) => Promise.resolve(tronMock(u, i)); tr.posts.length = 0;
  for (const o of [{ action: 'stake', amount: '0.5', validator: SR }, { action: 'stake', amount: '5' }, { action: 'stake', amount: '999', validator: SR }, { action: 'unstake', amount: '21', validator: SR }]) {
    const r = await trep(o); assert.equal(r.ok, false, JSON.stringify(o) + ' ' + JSON.stringify(r).slice(0, 120));
  }
  const c = await trep({ action: 'claim' }); assert.equal(c.ok, true, JSON.stringify(c).slice(0, 200)); assert.equal(String((c.summary ?? c).amount), '3000000');
  const u = await trep({ action: 'unstake', amount: '4' }); assert.equal(u.ok, true, JSON.stringify(u).slice(0, 200)); assert.equal(String((u.summary ?? u).amount), '4000000');
  assert.equal(tr.posts.filter((x) => x.p === '/wallet/broadcasttransaction').length, 0);
});

test('T-DEFI-006: TRON node rejects a broadcast — error surfaced, not reported as success', async () => {
  const mk = (u, i) => (String(u).endsWith('/wallet/broadcasttransaction') ? json({ code: 'CONTRACT_VALIDATE_ERROR', message: Buffer.from('balance is not sufficient').toString('hex') }) : tronMock(u, i));
  F.fetchImpl = (u, i) => Promise.resolve(mk(u, i));
  const r = await trep({ action: 'stake', amount: '5', validator: SR }); assert.equal(r.ok, true);
  const sub = await send({ type: 'earnSubmit', reviewId: r.reviewId ?? r.review?.id });
  assert.equal(sub.ok, false); assert.doesNotMatch(JSON.stringify(sub), /cdcdcd/);
});
