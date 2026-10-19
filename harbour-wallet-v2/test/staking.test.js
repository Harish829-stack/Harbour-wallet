import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import pkg from '@trustwallet/wallet-core';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './staking/cosmos'; export * from './staking/solana'; export * from './staking/evm'; export * from './staking/service'; export * from './staking/validators'; export * from './staking/registry'; export { chainById } from './chains/index'; export { encodeFunctionResult, decodeFunctionData, toFunctionSelector } from 'viem';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` },
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const core = await pkg.initWasm();
const sha = (b) => createHash('sha256').update(b).digest('hex');
const KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1);          // test-only key, never a real wallet
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const route = (table) => async (url, init) => { for (const [k, v] of Object.entries(table)) if (String(url).includes(k)) return typeof v === 'function' ? v(url, init) : json(v); return json({ message: 'nf' }, 404); };

// ---------------------------------------------------------------- registry / validators
test('registry: every staking asset resolves to a registry chain; cosmos assets have an LCD endpoint + hrp', () => {
  for (const a of M.STAKING_ASSETS) {
    const c = M.chainById(a.chainId); assert.ok(c, a.chainId);
    assert.equal(c.decimals, a.decimals, `${a.chainId} decimals`);
    if (a.family === 'cosmos') { assert.ok(c.endpoints?.length, a.chainId); assert.ok(c.hrp, a.chainId); }
  }
});
test('validators: sanitises rows, drops junk, https-only websites, bundled snapshot fallback', async () => {
  const s = M.sanitizeValidators([{ id: 'a1', name: ' <b>X</b>\n', website: 'javascript:alert(1)' }, { id: 'a1', name: 'dup' }, { id: 'has space' }, null, { id: 'b2', website: 'https://ok.example/x' }]);
  assert.deepEqual(s.map((v) => v.id), ['a1', 'b2']); assert.equal(s[0].website, undefined); assert.ok(!/[<>]/.test(s[0].name)); assert.equal(s[1].website, 'https://ok.example/x');
  M.clearValidatorCache();
  const r = await M.loadValidatorList('cosmos', async () => { throw new Error('offline'); });
  assert.equal(r.source, 'snapshot'); assert.ok(r.list.length > 30); assert.ok(r.list.every((v) => v.id.startsWith('cosmosvaloper1')));
  M.clearValidatorCache();
  const live = await M.loadValidatorList('solana', async (u) => { assert.match(u, /raw\.githubusercontent\.com\/trustwallet\/assets\/master\/blockchains\/solana\/validators\/list\.json$/); return json([{ id: 'FiijvR2ibXEHaFqB127CxrL3vSj19K2Kx1jf2RbK4BWS', name: 'N' }]); });
  assert.equal(live.source, 'network'); assert.equal(live.list.length, 1);
});
test('amount parsing', () => {
  assert.equal(M.toRaw('1.5', 6), 1500000n); assert.equal(M.toRaw('0', 6), null); assert.equal(M.toRaw('1.1234567', 6), null); assert.equal(M.toRaw('abc', 6), null); assert.equal(M.toRaw('.5', 2), 50n);
});

// ---------------------------------------------------------------- cosmos reads
test('cosmos APR math', () => {
  // 7% inflation, 50% bonded, 2% community tax => 7/0.5*0.98 = 13.72%
  assert.equal(M.computeBaseApr({ inflation: '0.07', bondedTokens: '500', supply: '1000', communityTax: '0.02' }), 13.72);
  assert.equal(M.computeBaseApr({ inflation: '0.07', bondedTokens: '0', supply: '1000' }), null);
  assert.equal(M.computeBaseApr({ inflation: 'x', bondedTokens: '5', supply: '10' }), null);
  assert.equal(M.delegatorApr(10, 5), 9.5); assert.equal(M.delegatorApr(null, 5), null);
});
const ME = core.CoinTypeExt.deriveAddress(core.CoinType.cosmos, core.PrivateKey.createWithData(KEY)); // delegator = address of the test key
const V1 = 'cosmosvaloper1k6e7l0lz497l8njqjxpd3g4wlkdfwe93uqf03k';
const V2 = 'cosmosvaloper1gpx52r9h3zeul45amvcy2pysgvcwddxrgx6cnv';
test('cosmos overview from LCD fixtures: positions, rewards (floor), unbonding, APR, validator merge', async () => {
  const f = route({
    '/cosmos/staking/v1beta1/params': { params: { bond_denom: 'uatom', unbonding_time: '1814400s' } },
    '/cosmos/staking/v1beta1/delegations/': { delegation_responses: [{ delegation: { validator_address: V1, shares: '5' }, balance: { denom: 'uatom', amount: '5000000' } }, { delegation: { validator_address: V2 }, balance: { denom: 'uatom', amount: '0' } }] },
    '/unbonding_delegations': { unbonding_responses: [{ validator_address: V2, entries: [{ completion_time: '2030-01-01T00:00:00Z', balance: '2000000' }] }] },
    '/rewards': { rewards: [{ validator_address: V1, reward: [{ denom: 'uatom', amount: '123456.789000000000000000' }, { denom: 'ibc/XYZ', amount: '9' }] }] },
    '/cosmos/staking/v1beta1/validators?status': { validators: [{ operator_address: V1, status: 'BOND_STATUS_BONDED', jailed: false, tokens: '900', description: { moniker: 'Trust Nodes' }, commission: { commission_rates: { rate: '0.050000000000000000' } } }, { operator_address: V2, status: 'BOND_STATUS_BONDED', jailed: false, tokens: '100', description: { moniker: 'StakeLab' }, commission: { commission_rates: { rate: '0.1' } } }] },
    '/cosmos/mint/v1beta1/inflation': { inflation: '0.07' },
    '/cosmos/staking/v1beta1/pool': { pool: { bonded_tokens: '500' } },
    '/cosmos/bank/v1beta1/supply/by_denom': { amount: { denom: 'uatom', amount: '1000' } },
    '/cosmos/distribution/v1beta1/params': { params: { community_tax: '0.02' } },
  });
  const atom = M.chainById('cosmos');
  const r = await M.fetchCosmosOverview(atom, ME, f, [{ id: V1, name: 'Trust Nodes' }, { id: V2, name: 'StakeLab' }, { id: 'evil', name: 'bad address' }]);
  assert.equal(r.bondDenom, 'uatom');
  const o = r.overview;
  assert.equal(o.staked, '5000000'); assert.equal(o.rewards, '123456'); assert.equal(o.unbonding, '2000000'); assert.equal(o.lockDays, 21);
  assert.equal(o.positions.length, 2); assert.equal(o.positions[0].validatorName, 'Trust Nodes'); assert.equal(o.positions[1].status, 'unbonding'); assert.equal(o.positions[1].availableAt, Date.parse('2030-01-01T00:00:00Z'));
  // base 13.72; V1 5% commission => 13.03 ; V2 10% => 12.35 ; best = V1
  assert.equal(r.validators.find((v) => v.id === V1).apr, 13.03); assert.equal(r.validators.find((v) => v.id === V2).apr, 12.35); assert.equal(o.apr, 13.03);
  assert.ok(!r.validators.some((v) => v.id === 'evil'), 'malformed list ids are dropped');
});
test('cosmos: account parsing (base, vesting, ethermint) and broadcast error surfacing', async () => {
  assert.deepEqual(M.parseCosmosAccount({ account: { account_number: '12', sequence: '3' } }), { accountNumber: '12', sequence: '3' });
  assert.deepEqual(M.parseCosmosAccount({ account: { base_vesting_account: { base_account: { account_number: '7', sequence: '0' } } } }), { accountNumber: '7', sequence: '0' });
  assert.deepEqual(M.parseCosmosAccount({ account: { base_account: { account_number: '9', sequence: '1' } } }), { accountNumber: '9', sequence: '1' });
  assert.throws(() => M.parseCosmosAccount({}), /Account not found/);
  const atom = M.chainById('cosmos');
  await assert.rejects(M.broadcastCosmos(atom, async () => json({ tx_response: { code: 5, raw_log: 'insufficient funds' } }), { tx_bytes: 'AA==', mode: 'BROADCAST_MODE_SYNC' }), /insufficient funds/);
  assert.equal(await M.broadcastCosmos(atom, async () => json({ tx_response: { code: 0, txhash: 'ABC123' } }), { tx_bytes: 'AA==', mode: 'BROADCAST_MODE_SYNC' }), 'ABC123');
});

// ---------------------------------------------------------------- cosmos signing vectors (wallet-core AnySigner, no broadcast)
const sign = (op, extra = {}) => M.signCosmos(core, M.chainById('cosmos'), { op: { delegator: ME, denom: 'uatom', ...op }, accountNumber: '77', sequence: '4', chainId: 'cosmoshub-4', fee: M.cosmosFee('cosmos', 'uatom', op.action, op.rewards?.length ?? 1), privateKey: KEY, ...extra });
const txText = (r) => Buffer.from(r.body.tx_bytes, 'base64').toString('latin1');
test('cosmos signing: MsgDelegate / MsgUndelegate / MsgBeginRedelegate / MsgWithdrawDelegatorReward / compound contain the right messages', () => {
  const d = sign({ action: 'stake', validator: V1, amount: '1500000' });
  assert.match(txText(d), /\/cosmos\.staking\.v1beta1\.MsgDelegate/); assert.ok(txText(d).includes(V1)); assert.ok(txText(d).includes('1500000')); assert.ok(txText(d).includes(ME));
  assert.equal(d.body.mode, 'BROADCAST_MODE_SYNC');
  const u = sign({ action: 'unstake', validator: V1, amount: '42' });
  assert.match(txText(u), /MsgUndelegate/);
  const r = sign({ action: 'redelegate', validator: V1, toValidator: V2, amount: '99' });
  assert.match(txText(r), /MsgBeginRedelegate/); assert.ok(txText(r).includes(V1) && txText(r).includes(V2));
  const c = sign({ action: 'claim', rewards: [{ validator: V1, amount: '1' }, { validator: V2, amount: '2' }] });
  assert.equal((txText(c).match(/MsgWithdrawDelegatorReward/g) ?? []).length, 2);
  const k = sign({ action: 'compound', rewards: [{ validator: V1, amount: '555' }] });
  assert.match(txText(k), /MsgWithdrawDelegatorReward/); assert.match(txText(k), /MsgDelegate/); assert.ok(txText(k).includes('555'));
});
test('cosmos signing is deterministic and regression-pinned (self-generated vector, NOT a TW/wallet-core published vector)', () => {
  const a = sign({ action: 'stake', validator: V1, amount: '1000000' }); const b = sign({ action: 'stake', validator: V1, amount: '1000000' });
  assert.equal(a.body.tx_bytes, b.body.tx_bytes);
  const other = sign({ action: 'stake', validator: V1, amount: '1000001' });
  assert.notEqual(a.body.tx_bytes, other.body.tx_bytes);
  const seq = sign({ action: 'stake', validator: V1, amount: '1000000' }, { sequence: '5' });
  assert.notEqual(a.body.tx_bytes, seq.body.tx_bytes);
  assert.equal(sha(Buffer.from(a.body.tx_bytes, 'base64')), process.env.UPDATE_VECTORS ? 'x' : PINNED.cosmosDelegate);
});
test('cosmos message builder validation', () => {
  assert.throws(() => M.buildCosmosMessages({ action: 'stake', delegator: ME, denom: 'uatom', validator: V1, amount: '0' }), /positive integer/);
  assert.throws(() => M.buildCosmosMessages({ action: 'stake', delegator: ME, denom: 'uatom', amount: '1' }), /validator/);
  assert.throws(() => M.buildCosmosMessages({ action: 'claim', delegator: ME, denom: 'uatom', rewards: [] }), /No rewards/);
  assert.throws(() => M.buildCosmosMessages({ action: 'compound', delegator: ME, denom: 'uatom', rewards: [{ validator: V1, amount: '0' }] }), /No rewards/);
  assert.throws(() => M.buildCosmosMessages({ action: 'withdraw', delegator: ME, denom: 'uatom' }), /no "withdraw"/);
  assert.equal(M.cosmosFee('cosmos', 'uatom', 'stake').amount, '1250');           // 250000 gas * 0.005
  assert.equal(M.cosmosFee('terra', 'uluna', 'stake').amount, '7081250');          // 250000 * 28.325
  assert.equal(M.cosmosGas('claim', 3), 200_000 + 2 * 90_000);
});

// ---------------------------------------------------------------- solana
const SOL_ME = '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T';
const VOTE = 'FiijvR2ibXEHaFqB127CxrL3vSj19K2Kx1jf2RbK4BWS';
const NODE = 'DTwEEF6VSrmTBYkDcj3BKAc52qhvP8CEQUEAMMT1cG3';
const stakeAcct = (pubkey, type, lamports, stake, act, deact) => ({ pubkey, account: { lamports, data: { parsed: { type, info: { meta: { rentExemptReserve: '2282880', authorized: { staker: SOL_ME, withdrawer: SOL_ME }, lockup: { unixTimestamp: 0 } }, ...(stake ? { stake: { delegation: { voter: VOTE, stake, activationEpoch: act, deactivationEpoch: deact } } } : {}) } } } } });
const U64 = '18446744073709551615';
test('solana overview: stake account states, rewards, APR, validators merged by vote account', async () => {
  const rpc = (res) => async (url, init) => { const b = JSON.parse(init.body); const r = res[b.method]; return json(r === undefined ? { error: { message: 'nf' } } : { result: r }); };
  const f = rpc({
    getProgramAccounts: [stakeAcct('A1', 'delegated', 5_002_282_880 + 1000, '5000000000', '100', U64), stakeAcct('A2', 'delegated', 3_000_000_000, '2000000000', '100', '119'), stakeAcct('A3', 'delegated', 1_000_000_000, '1000000000', '120', U64), stakeAcct('A4', 'initialized', 1_002_282_880, null)],
    getVoteAccounts: { current: [{ votePubkey: VOTE, nodePubkey: NODE, activatedStake: 1000, commission: 10 }], delinquent: [] },
    getEpochInfo: { epoch: 120, slotIndex: 216000, slotsInEpoch: 432000 },
    getInflationRate: { validator: 0.05 },
    getSupply: { value: { total: 1000 } },
  });
  const r = await M.fetchSolanaOverview(['https://rpc.example'], SOL_ME, f, [{ id: NODE, name: 'Trust Nodes' }, { id: 'not-an-address', name: 'x' }]);
  const byId = Object.fromEntries(r.overview.positions.map((p) => [p.id, p]));
  assert.equal(byId.A1.status, 'active'); assert.equal(byId.A1.rewards, '1000'); assert.equal(byId.A2.status, 'inactive'); assert.equal(byId.A3.status, 'activating'); assert.equal(byId.A4.status, 'inactive');
  assert.equal(byId.A1.validatorName, 'Trust Nodes'); assert.equal(byId.A2.amount, String(3_000_000_000));
  assert.equal(r.overview.staked, String(5_000_000_000 + 1_000_000_000)); assert.equal(r.overview.claimable, String(3_000_000_000 + 1_002_282_880));
  // base = 0.05 / (1000/1000) *100 = 5% ; with 10% commission => 4.5
  assert.equal(r.validators[0].id, VOTE); assert.equal(r.validators[0].apr, 4.5); assert.equal(r.overview.apr, 4.5);
  assert.ok(!r.validators.some((v) => v.id === 'not-an-address'));
});
test('solana: deactivating accounts report an availability time; base APR guards', () => {
  const e = { epoch: 120, slotIndex: 0, slotsInEpoch: 432000 };
  const p = M.stakePosition({ pubkey: 'S', lamports: 10, rent: 1, staker: 'a', withdrawer: 'a', type: 'delegated', voter: VOTE, stake: '9', activationEpoch: '100', deactivationEpoch: '120' }, e, new Map(), () => null, 1000);
  assert.equal(p.status, 'deactivating'); assert.ok(p.availableAt > 1000);
  assert.equal(M.solanaBaseApr(0, 1, 1), null); assert.equal(M.solanaBaseApr(0.05, 100, 50), 10);
});
test('solana signing: DelegateStake / DeactivateStake / WithdrawStake produce transactions that reference the Stake program', () => {
  const stakeProg = core.Base58.decodeNoCheck(M.STAKE_PROGRAM);
  const has = (enc) => { const raw = Buffer.from(core.Base58.decodeNoCheck(enc)); return raw.includes(Buffer.from(stakeProg)); };
  const common = { sender: SOL_ME, privateKey: KEY, blockhash: '11111111111111111111111111111111' };
  // wallet-core validates that the private key matches `sender`: use the key's own address
  const pk = core.PrivateKey.createWithData(KEY); const me = core.CoinTypeExt.deriveAddress(core.CoinType.solana, pk);
  const c2 = { ...common, sender: me };
  const del = M.signSolanaStake(core, { ...c2, action: 'stake', validator: VOTE, amount: '2000000000' });
  assert.ok(del.encoded.length > 100 && has(del.encoded));
  const deact = M.signSolanaStake(core, { ...c2, action: 'unstake', stakeAccount: NODE });
  assert.ok(has(deact.encoded));
  const wd = M.signSolanaStake(core, { ...c2, action: 'withdraw', stakeAccount: NODE, amount: '1000' });
  assert.ok(has(wd.encoded));
  assert.equal(sha(Buffer.from(core.Base58.decodeNoCheck(del.encoded))), PINNED.solDelegate);
  assert.throws(() => M.buildSolanaStakeInput(core, { ...c2, action: 'stake', validator: 'bad', amount: '1' }), /Invalid validator/);
  assert.throws(() => M.buildSolanaStakeInput(core, { ...c2, action: 'claim' }), /no "claim"/);
  assert.throws(() => M.buildSolanaStakeInput(core, { ...c2, action: 'unstake', stakeAccount: 'x' }), /Missing stake account/);
});

// ---------------------------------------------------------------- EVM
test('lido plans: selectors and argument encoding', () => {
  const s = M.lidoStakePlan(10n ** 18n)[0];
  assert.equal(s.to, M.LIDO.stETH); assert.equal(s.value, 10n ** 18n); assert.equal(s.data.slice(0, 10), '0xa1903eab'); // submit(address)
  const owner = '0x1111111111111111111111111111111111111111';
  const plan = M.lidoUnstakePlan(5n * 10n ** 18n, owner, 0n);
  assert.equal(plan.length, 2); assert.equal(plan[0].data.slice(0, 10), '0x095ea7b3'); assert.equal(plan[1].to, M.LIDO.queue); assert.equal(plan[1].data.slice(0, 10), '0xd6681042');
  assert.equal(M.lidoUnstakePlan(5n * 10n ** 18n, owner, 10n ** 30n).length, 1, 'no approve when allowance suffices');
  const big = M.lidoUnstakePlan(2500n * 10n ** 18n, owner, 10n ** 40n)[0]; const dec = M.decodeFunctionData({ abi: M.queueAbi, data: big.data });
  assert.deepEqual(dec.args[0].map(String), [String(1000n * 10n ** 18n), String(1000n * 10n ** 18n), String(500n * 10n ** 18n)]);
  assert.throws(() => M.lidoUnstakePlan(5n, owner, 0n), /below the Lido minimum/);
  assert.equal(M.lidoClaimPlan(77n)[0].data.slice(0, 10), '0xf8444436');
});
test('lido overview from mocked eth_call + APR endpoint', async () => {
  const owner = '0x1111111111111111111111111111111111111111';
  const call = (data) => ({ ok: true, status: 200, json: async () => ({ result: data }) });
  const f = async (url, init) => {
    if (String(url).includes('eth-api.lido.fi')) return json({ data: { smaApr: 2.71 } });
    const b = JSON.parse(init.body); const d = b.params[0].data; const to = b.params[0].to.toLowerCase();
    if (to === M.LIDO.stETH.toLowerCase() && d.startsWith('0x70a08231')) return call(M.encodeFunctionResult({ abi: M.stethAbi, functionName: 'balanceOf', result: 3n * 10n ** 18n }));
    if (d.startsWith(M.toFunctionSelector('getWithdrawalRequests(address)'))) return call(M.encodeFunctionResult({ abi: M.queueAbi, functionName: 'getWithdrawalRequests', result: [[11n, 12n, 13n]] }));
    if (d.startsWith(M.toFunctionSelector('getWithdrawalStatus(uint256[])'))) return call(M.encodeFunctionResult({ abi: M.queueAbi, functionName: 'getWithdrawalStatus', result: [[
      { amountOfStETH: 10n ** 18n, amountOfShares: 1n, owner, timestamp: 1n, isFinalized: true, isClaimed: false },
      { amountOfStETH: 2n * 10n ** 18n, amountOfShares: 1n, owner, timestamp: 1n, isFinalized: false, isClaimed: false },
      { amountOfStETH: 5n, amountOfShares: 1n, owner, timestamp: 1n, isFinalized: true, isClaimed: true }]] }));
    throw new Error('unexpected call ' + d.slice(0, 10));
  };
  const r = await M.fetchLidoOverview(f, ['https://rpc.example'], owner);
  assert.equal(r.overview.staked, String(3n * 10n ** 18n)); assert.equal(r.overview.apr, 2.71); assert.equal(r.overview.claimable, String(10n ** 18n)); assert.equal(r.overview.unbonding, String(2n * 10n ** 18n));
  assert.deepEqual(r.overview.positions.map((p) => p.status), ['active', 'claimable', 'unbonding']);
});
test('bsc stakehub plans', () => {
  const op = '0x773760b0708a5Cc369c346993a0c225D8e4043B1'; const dst = '0x343dA7Ff0446247ca47AA41e2A25c5Bbb230ED0A';
  const d = M.bscPlan('stake', { validator: op, amount: 10n ** 18n })[0];
  assert.equal(d.to, M.STAKE_HUB); assert.equal(d.value, 10n ** 18n);
  const dec = M.decodeFunctionData({ abi: M.stakeHubAbi, data: d.data }); assert.equal(dec.functionName, 'delegate'); assert.equal(dec.args[0], op); assert.equal(dec.args[1], false);
  const u = M.decodeFunctionData({ abi: M.stakeHubAbi, data: M.bscPlan('unstake', { validator: op, shares: 7n })[0].data }); assert.equal(u.functionName, 'undelegate'); assert.equal(u.args[1], 7n);
  const r = M.decodeFunctionData({ abi: M.stakeHubAbi, data: M.bscPlan('redelegate', { validator: op, toValidator: dst, shares: 3n })[0].data }); assert.equal(r.functionName, 'redelegate'); assert.equal(r.args[1], dst);
  const c = M.decodeFunctionData({ abi: M.stakeHubAbi, data: M.bscPlan('claim', { validator: op })[0].data }); assert.equal(c.functionName, 'claim'); assert.equal(c.args[1], 0n);
  assert.throws(() => M.bscPlan('stake', { validator: 'nope', amount: 1n }), /Invalid validator/);
  assert.throws(() => M.bscPlan('compound', { validator: op }), /no "compound"/);
});

// regression-pinned hashes of the self-generated vectors above (filled by `node test/staking.test.js` run; see evidence/34-staking/SPEC.md)
const PINNED = { cosmosDelegate: 'c03435d9a369568cab223f0e11feafd03444090c6c976d12178aaf796544385b', solDelegate: 'd328bc173785807daf425b669b4f9252948a9068bf3e22e189cd772e112e9e92' };
