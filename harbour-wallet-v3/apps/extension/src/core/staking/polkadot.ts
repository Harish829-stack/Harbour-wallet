// Polkadot nomination pools (TW's DOT earn): join a pool with any amount above the pool minimum, bond more, claim or
// compound rewards, unbond (28 days) and withdraw. Staking lives on Polkadot Asset Hub since the 2025 Asset Hub migration;
// the endpoint list falls back to the relay chain if a node's runtime still carries the pallet there. Calls are built from
// the live runtime metadata by @polkadot/api, and signed with the account's ed25519 key (wallet-core) via a raw signer.
import { ApiPromise, WsProvider } from '@polkadot/api';
import { blake2b } from '@noble/hashes/blake2b';
import type { Position, StakeAction, StakeOverview, Validator } from './types';
import { stakeError } from './types';

export const POOL_ENDPOINTS = ['wss://polkadot-asset-hub-rpc.polkadot.io', 'wss://asset-hub-polkadot-rpc.n.dwellir.com', 'wss://statemint.api.onfinality.io/public-ws', 'wss://dot-rpc.stakeworld.io/assethub'];
export const DOT_UNBOND_DAYS = 28;
const DOT = { symbol: 'DOT', decimals: 10 };
let shared: Promise<any> | null = null;

/** One shared connection to the first endpoint whose runtime has the nominationPools pallet. Tests inject their own api. */
export async function poolsApi(endpoints = POOL_ENDPOINTS): Promise<any> {
  if (!shared) shared = (async () => {
    let last: unknown;
    for (const url of endpoints) {
      const provider = new WsProvider(url, false, {}, 60_000); // no auto-reconnect while probing; metadata is ~1 MB
      try {
        await Promise.race([provider.connect(), new Promise((_, rej) => setTimeout(() => rej(new Error('connect timeout')), 10_000))]);
        const api = await ApiPromise.create({ provider, noInitWarn: true, throwOnConnect: true } as any);
        if (api.tx?.nominationPools?.join) { provider.on('disconnected', () => { shared = null; }); return api; }
        await api.disconnect();
      } catch (e) { last = e; await provider.disconnect().catch(() => undefined); }
    }
    throw last ?? stakeError('network', 'No Polkadot staking endpoint reachable');
  })().catch((e) => { shared = null; throw e; });
  return shared;
}

const big = (v: any): bigint => { try { return BigInt(v?.toString?.() ?? v ?? 0); } catch { return 0n; } };
const text = (v: any): string => { try { const s = v?.toUtf8?.() ?? ''; return String(s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60); } catch { return ''; } };

export interface PoolMember { poolId: number; points: bigint; unbonding: Array<{ era: number; points: bigint }> }
export async function poolMember(api: any, address: string): Promise<PoolMember | null> {
  const m = await api.query.nominationPools.poolMembers(address);
  if (!m || m.isNone) return null;
  const v = m.unwrap();
  const unbonding: Array<{ era: number; points: bigint }> = [];
  for (const [era, pts] of v.unbondingEras.entries()) unbonding.push({ era: Number(era.toString()), points: big(pts) });
  return { poolId: Number(v.poolId.toString()), points: big(v.points), unbonding };
}

export async function fetchPolkadotOverview(api: any, address: string, now = Date.now()): Promise<{ overview: StakeOverview; validators: Validator[]; minJoin: bigint }> {
  const [member, entries, minJoin, activeEra] = await Promise.all([
    poolMember(api, address),
    api.query.nominationPools.bondedPools.entries(),
    api.query.nominationPools.minJoinBond(),
    api.query.staking.activeEra(),
  ]);
  const era = activeEra?.isSome ? Number(activeEra.unwrap().index.toString()) : 0;
  const open = (entries as any[]).map(([k, v]: any) => ({ id: Number(k.args[0].toString()), p: v.unwrap() }))
    .filter((x) => x.p.state.toString() === 'Open').sort((a, b) => Number(big(b.p.points) - big(a.p.points))).slice(0, 40);
  if (member && !open.some((x) => x.id === member.poolId)) {
    const own = await api.query.nominationPools.bondedPools(member.poolId); if (own?.isSome) open.push({ id: member.poolId, p: own.unwrap() });
  }
  const metas = await api.query.nominationPools.metadata.multi(open.map((x) => x.id));
  const validators: Validator[] = open.map((x, i) => {
    const c = x.p.commission?.current; const perbill = c?.isSome ? Number(c.unwrap()[0].toString()) : 0;
    return { id: String(x.id), name: text(metas[i]) || `Pool #${x.id}`, apr: null, commission: perbill / 1e7, active: x.p.state.toString() === 'Open', tokens: big(x.p.points).toString() };
  });
  const positions: Position[] = []; let staked = 0n, rewards = 0n, unbonding = 0n, claimable = 0n;
  if (member) {
    const [bal, pending] = await Promise.all([
      member.points > 0n ? api.call.nominationPoolsApi.pointsToBalance(member.poolId, member.points) : Promise.resolve(0),
      api.call.nominationPoolsApi.pendingRewards(address).catch(() => 0),
    ]);
    staked = big(bal); rewards = big(pending);
    const name = validators.find((v) => v.id === String(member.poolId))?.name;
    if (staked > 0n || rewards > 0n) positions.push({ id: `pool:${member.poolId}`, validatorId: String(member.poolId), validatorName: name, amount: staked.toString(), rewards: rewards.toString(), status: 'active' });
    for (const u of member.unbonding) {
      // unbonding points are 1:1 with balance unless the pool was slashed; eras last 24 h
      const ready = u.era <= era;
      positions.push({ id: `unbond:${u.era}`, validatorId: String(member.poolId), validatorName: name, amount: u.points.toString(), status: ready ? 'claimable' : 'unbonding', availableAt: ready ? undefined : now + (u.era - era) * 86_400_000 });
      if (ready) claimable += u.points; else unbonding += u.points;
    }
  }
  return { overview: { chainId: 'polkadot', ...DOT, staked: staked.toString(), rewards: rewards.toString(), unbonding: unbonding.toString(), claimable: claimable.toString(), apr: null, positions, lockDays: DOT_UNBOND_DAYS }, validators, minJoin: big(minJoin) };
}

/** The extrinsic for an action. `amount` in planck; unbond converts the amount to pool points. */
export async function polkadotCall(api: any, action: StakeAction, a: { address: string; member: PoolMember | null; amount?: bigint; pool?: string; max?: boolean; minJoin: bigint }): Promise<any> {
  const np = api.tx.nominationPools;
  switch (action) {
    case 'stake': {
      if (!a.amount || a.amount <= 0n) throw stakeError('bad_amount', 'Enter a valid amount');
      if (!a.member) {
        if (!a.pool || !/^\d{1,9}$/.test(a.pool)) throw stakeError('bad_request', 'Choose a pool');
        if (a.amount < a.minJoin) throw stakeError('bad_amount', 'Amount is below the pool minimum');
        return np.join(a.amount, Number(a.pool));
      }
      if (a.pool && Number(a.pool) !== a.member.poolId) throw stakeError('bad_request', 'You are already in another pool; unstake from it first');
      return np.bondExtra({ FreeBalance: a.amount });
    }
    case 'compound':
      if (!a.member) throw stakeError('bad_request', 'You are not in a pool');
      return np.bondExtra('Rewards');
    case 'claim':
      if (!a.member) throw stakeError('bad_request', 'You are not in a pool');
      return np.claimPayout();
    case 'unstake': {
      if (!a.member || a.member.points <= 0n) throw stakeError('bad_request', 'You have no active stake in a pool');
      const pts = a.max || !a.amount ? a.member.points : big(await api.call.nominationPoolsApi.balanceToPoints(a.member.poolId, a.amount));
      if (pts <= 0n || pts > a.member.points) throw stakeError('bad_amount', 'Amount exceeds your pool stake');
      return np.unbond(a.address, pts);
    }
    case 'withdraw':
      if (!a.member?.unbonding.length) throw stakeError('bad_request', 'Nothing is withdrawable yet');
      return np.withdrawUnbonded(a.address, 0);
  }
  throw stakeError('unsupported', 'This action is not available for DOT');
}

/** A @polkadot/api signer backed by a raw ed25519 signing function (the key never leaves the caller). */
export function ed25519Signer(api: any, sign: (msg: Uint8Array) => Uint8Array) {
  return {
    async signPayload(payload: any) {
      const raw: Uint8Array = api.registry.createType('ExtrinsicPayload', payload, { version: payload.version }).toU8a({ method: true });
      const msg = raw.length > 256 ? blake2b(raw, { dkLen: 32 }) : raw;
      const sig = sign(msg);
      const out = new Uint8Array(65); out[0] = 0x00; out.set(sig, 1); // MultiSignature::Ed25519
      return { id: 1, signature: '0x' + Array.from(out, (b) => b.toString(16).padStart(2, '0')).join('') };
    },
  };
}
export async function polkadotFee(api: any, call: any, address: string): Promise<bigint> {
  try { return big((await call.paymentInfo(address)).partialFee); } catch { return 200_000_000n; } // 0.02 DOT fallback
}
export async function polkadotSubmit(api: any, call: any, address: string, sign: (msg: Uint8Array) => Uint8Array): Promise<string> {
  await call.signAsync(address, { signer: ed25519Signer(api, sign), nonce: -1 });
  return (await api.rpc.author.submitExtrinsic(call)).toHex();
}
