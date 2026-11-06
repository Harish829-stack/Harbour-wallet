import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import pkg from '@trustwallet/wallet-core';

// Phase 5 earn families: TRON Stake 2.0, Tezos delegation, Cardano pool delegation, Polkadot pools, Rocket Pool. Pure logic + wallet-core signing.
const out = await build({
  stdin: { contents: `export * from './staking/tron'; export * from './staking/tezos'; export * from './staking/cardano'; export { polkadotCall, ed25519Signer } from './staking/polkadot'; export * from './staking/evm'; export * from './chains/cardano'; export { STAKING_ASSETS } from './staking/registry';`,
    resolveDir: fileURLToPath(new URL('../src/core/', import.meta.url)), sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` },
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const core = await pkg.initWasm();
const hd = core.HDWallet.createWithMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', '');
const keyOf = (ct) => { const k = hd.getKeyForCoin(core.CoinType[ct]); const b = new Uint8Array(k.data()); k.delete(); return b; };
const addrOf = (ct) => hd.getAddressForCoin(core.CoinType[ct]);

test('TRON: account parsing, stake = freeze + full vote list, redelegate moves votes, signing with wallet-core', () => {
  const st = M.parseTronAccount({ balance: 50_000_000, frozenV2: [{ amount: 10_000_000 }, { type: 'ENERGY', amount: 0 }, { type: 'TRON_POWER', amount: 99 }], votes: [{ vote_address: 'TA', vote_count: 4 }], unfrozenV2: [{ unfreeze_amount: 3_000_000, unfreeze_expire_time: 1 }] }, { reward: 77 });
  assert.equal(st.frozen, 10_000_000n); assert.equal(st.reward, 77n); assert.equal(st.unfreezing.length, 1);
  const [freeze, vote] = M.tronContracts('stake', { owner: 'TOWN', state: st, amount: 5_000_000n, validator: 'TB' });
  assert.equal(freeze.freezeBalanceV2.frozenBalance, '5000000');
  assert.deepEqual(vote.voteWitness.votes, [{ voteAddress: 'TA', voteCount: '4' }, { voteAddress: 'TB', voteCount: '11' }]); // 15 TP total, 4 already voted
  const [re] = M.tronContracts('redelegate', { owner: 'TOWN', state: st, validator: 'TA', toValidator: 'TB' });
  assert.deepEqual(re.voteWitness.votes, [{ voteAddress: 'TB', voteCount: '4' }]);
  assert.throws(() => M.tronContracts('unstake', { owner: 'TOWN', state: st, amount: 11_000_000n }), /exceeds/);
  assert.ok(M.tronContracts('claim', { owner: 'TOWN', state: st })[0].withdrawBalance);
  const owner = addrOf('tron');
  const block = { block_header: { raw_data: { timestamp: 1700000000000, txTrieRoot: '00'.repeat(32), parentHash: '00'.repeat(32), number: 1, witness_address: '41' + '00'.repeat(20), version: 30 } } };
  const signed = M.signTronContract(core, M.tronContracts('stake', { owner, state: st, amount: 1_000_000n, validator: owner })[0], block, keyOf('tron'), 1700000000000);
  const j = JSON.parse(signed.json); assert.equal(j.raw_data.contract[0].type, 'FreezeBalanceV2Contract'); assert.equal(signed.id.length, 64);
});

test('Tezos: delegation targets and forged DELEGATION / undelegation operations', () => {
  const baker = 'tz1aWXP237BLwNHJcCD4b3DutCevhqq2T1Z9';
  assert.equal(M.tezosTarget('stake', { validator: baker, current: '' }), baker);
  assert.equal(M.tezosTarget('unstake', { current: baker }), '');
  assert.throws(() => M.tezosTarget('redelegate', { toValidator: baker, current: baker }), /different/);
  const ctx = { branch: 'BL8euoCWqNCny9AR3AKjnpi38haYMxjei1ZqNHuXMn19JSQnoWp', counter: 10n, revealed: true, balance: 5_000_000n, delegate: '' };
  const src = addrOf('tezos');
  const on = M.signTezosDelegation(core, { source: src, ctx, delegate: baker, key: keyOf('tezos') });
  const off = M.signTezosDelegation(core, { source: src, ctx, delegate: '', key: keyOf('tezos') });
  // kind 0x6e (110) = delegation; the delegate flag is 0xff with a key hash, 0x00 for "no delegate"
  assert.ok(on.slice(64).startsWith('6e')); assert.ok(off.slice(64).startsWith('6e'));
  assert.ok(off.length < on.length); assert.equal(off.slice(-128 - 2, -128), '00');
});

test('Cardano: pool id bech32, stake = register + delegate, claim adds abstain vote, wallet-core plans and signs', () => {
  const pool = 'pool1pu5jlj4q9w9jlxeu370a3c9myx47md5j5m2str0naunn2q3lkdy';
  assert.equal(Buffer.from(M.poolIdBytes(pool)).toString('hex'), '0f292fcaa02b8b2f9b3c8f9fd8e0bb21abedb692a6d5058df3ef2735');
  const address = addrOf('cardano');
  const stakeAddress = core.Cardano.getStakingAddress(address);
  const utxos = [{ txHash: 'f074134aabbfb13b8aec7cf5465b1e5a862bde5cb88532cc7e64619179b3e767', index: 1, lovelace: 20_000_000n, assets: [] }];
  const st = { address, stakeAddress, registered: false, pool: null, drep: null, rewards: 0n, total: 20_000_000n, balance: 20_000_000n, utxos };
  const input = M.cardanoStakeInput('stake', st, 100_000_000, pool);
  assert.equal(input.registerStakingKey.depositAmount, '2000000'); assert.equal(input.delegate.depositAmount, '0');
  const plan = M.cardanoPlan(core, input);
  assert.equal(Number(plan.error ?? 0), 0); assert.ok(Number(plan.fee) > 150_000 && Number(plan.fee) < 400_000); assert.equal(Number(plan.deposit), 2_000_000);
  const signed = M.cardanoSign(core, { ...input, privateKey: [keyOf('cardano')] });
  assert.ok(signed.cbor.length > 200); assert.equal(signed.txId.length, 64);
  const claim = M.cardanoStakeInput('claim', { ...st, registered: true, pool, rewards: 3_000_000n }, 1, undefined);
  assert.equal(claim.withdraw.withdrawAmount, '3000000'); assert.equal(claim.voteDelegation.drepType, 2);
  const un = M.cardanoStakeInput('unstake', { ...st, registered: true, pool, rewards: 0n, drep: 'drep_always_abstain' }, 1);
  assert.ok(un.deregisterStakingKey && !un.withdraw && !un.voteDelegation);
});

test('Polkadot pools: call selection from membership, and the ed25519 MultiSignature signer', async () => {
  const calls = [];
  const np = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return { name }; } });
  const api = { tx: { nominationPools: np }, call: { nominationPoolsApi: { balanceToPoints: async () => 5n } }, registry: { createType: (_t, p) => ({ toU8a: () => new Uint8Array(p.len) }) } };
  await M.polkadotCall(api, 'stake', { address: 'A', member: null, amount: 20_000_000_000n, pool: '12', minJoin: 10_000_000_000n });
  await M.polkadotCall(api, 'stake', { address: 'A', member: { poolId: 12, points: 1n, unbonding: [] }, amount: 1n, minJoin: 0n });
  await M.polkadotCall(api, 'unstake', { address: 'A', member: { poolId: 12, points: 9n, unbonding: [] }, amount: 3n, minJoin: 0n });
  await M.polkadotCall(api, 'compound', { address: 'A', member: { poolId: 12, points: 9n, unbonding: [] }, minJoin: 0n });
  assert.deepEqual(calls.map((c) => c[0]), ['join', 'bondExtra', 'unbond', 'bondExtra']);
  assert.deepEqual(calls[0].slice(1), [20_000_000_000n, 12]); assert.deepEqual(calls[2].slice(1), ['A', 5n]); assert.equal(calls[3][1], 'Rewards');
  await assert.rejects(M.polkadotCall(api, 'stake', { address: 'A', member: null, amount: 1n, pool: '12', minJoin: 10n }), /minimum/);
  await assert.rejects(M.polkadotCall(api, 'stake', { address: 'A', member: { poolId: 3, points: 1n, unbonding: [] }, amount: 1n, pool: '12', minJoin: 0n }), /another pool/);
  let signed;
  const signer = M.ed25519Signer(api, (m) => { signed = m; return new Uint8Array(64).fill(7); });
  const small = await signer.signPayload({ len: 100, version: 4 }); assert.equal(signed.length, 100);
  assert.equal(small.signature.slice(0, 4), '0x00'); assert.equal(small.signature.length, 2 + 130);
  await signer.signPayload({ len: 300, version: 4 }); assert.equal(signed.length, 32); // long payloads are blake2b-256 hashed
});

test('Rocket Pool storage key, registry filters assets to enabled chains', () => {
  assert.equal(M.rocketKey('rocketDepositPool').length, 66);
  assert.ok(M.STAKING_ASSETS.some((a) => a.chainId === 'tron') && M.STAKING_ASSETS.some((a) => a.chainId === 'polkadot'));
  assert.equal(M.STAKING_ASSETS.some((a) => a.chainId === 'cardano'), false); // Cardano is an extra chain, off until enabled
});
