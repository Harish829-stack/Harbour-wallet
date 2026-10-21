// TRON Stake 2.0: freeze TRX for bandwidth (FreezeBalanceV2), vote the resulting TRON Power for a Super Representative
// (VoteWitness), claim voting rewards (WithdrawBalance, once per 24 h), unfreeze (UnfreezeBalanceV2, 14-day wait) and
// withdraw expired unfreezes (WithdrawExpireUnfreeze). Reads/broadcasts go through TronGrid (or the gateway); signing is wallet-core.
import { TW } from '../chains/send/proto';
import type { ChainInfo } from '../chains/types';
import type { Fetcher } from '../chains/adapters/types';
import type { Position, StakeOverview, Validator, ValidatorMeta, StakeAction } from './types';
import { stakeError } from './types';

const SUN = 1_000_000n;
export const TRON_UNFREEZE_DAYS = 14;
const eps = (c: ChainInfo) => (c.endpoints ?? []).map((u) => u.replace(/\/$/, ''));
export async function tronPost(chain: ChainInfo, f: Fetcher, path: string, body: unknown): Promise<any> {
  let last: unknown;
  for (const u of eps(chain)) {
    try {
      const r = await f(u + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; }
  }
  throw last ?? stakeError('network', 'No TRON endpoint');
}

export interface TronAccountState { frozen: bigint; votes: Array<{ address: string; count: bigint }>; unfreezing: Array<{ amount: bigint; expireAt: number }>; reward: bigint; balance: bigint }
export function parseTronAccount(acct: any, reward: any): TronAccountState {
  const frozen = ((acct?.frozenV2 ?? []) as any[]).filter((x) => !x?.type || x.type === 'BANDWIDTH' || x.type === 'ENERGY').reduce((n, x) => n + BigInt(x?.amount ?? 0), 0n);
  const votes = ((acct?.votes ?? []) as any[]).map((v) => ({ address: String(v.vote_address), count: BigInt(v.vote_count ?? 0) })).filter((v) => v.count > 0n);
  const unfreezing = ((acct?.unfrozenV2 ?? []) as any[]).map((u) => ({ amount: BigInt(u?.unfreeze_amount ?? 0), expireAt: Number(u?.unfreeze_expire_time ?? 0) })).filter((u) => u.amount > 0n);
  return { frozen, votes, unfreezing, reward: BigInt(reward?.reward ?? 0), balance: BigInt(acct?.balance ?? 0) };
}

export async function fetchTronState(chain: ChainInfo, address: string, f: Fetcher): Promise<TronAccountState> {
  const [acct, reward] = await Promise.all([
    tronPost(chain, f, '/wallet/getaccount', { address, visible: true }),
    tronPost(chain, f, '/wallet/getReward', { address, visible: true }).catch(() => ({ reward: 0 })),
  ]);
  return parseTronAccount(acct, reward);
}

export async function fetchTronOverview(chain: ChainInfo, address: string, f: Fetcher, meta: ValidatorMeta[], now = Date.now()): Promise<{ overview: StakeOverview; validators: Validator[] }> {
  const [st, wl] = await Promise.all([fetchTronState(chain, address, f), tronPost(chain, f, '/wallet/listwitnesses', { visible: true }).catch(() => ({ witnesses: [] }))]);
  
  const witnesses: any[] = (wl?.witnesses ?? []).filter((w: any) => w?.isJobs !== false);
  // Validator list: the curated trustwallet/assets list (base58 ids) with live vote counts when the node returns them in base58.
  const live = new Map(witnesses.map((w: any) => [String(w.address), BigInt(w.voteCount ?? 0)]));
  const host = (u: unknown) => { try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return ''; } };
  // No curated list (or it failed and the snapshot has none): the top 27 elected SRs by votes, named by their website.
  const base: ValidatorMeta[] = meta.length ? meta : witnesses.sort((x, y) => Number(BigInt(y.voteCount ?? 0) - BigInt(x.voteCount ?? 0))).slice(0, 27)
    .map((w) => ({ id: String(w.address), name: host(w.url) || String(w.address).slice(0, 10), website: /^https:/.test(String(w.url)) ? String(w.url) : undefined }));
  const validators: Validator[] = base.map((m) => ({ ...m, apr: null, commission: null, active: true, tokens: live.get(m.id)?.toString() }));
  const positions: Position[] = st.votes.map((v) => ({ id: `vote:${v.address}`, validatorId: v.address, validatorName: validators.find((x) => x.id === v.address)?.name, amount: (v.count * SUN).toString(), status: 'active' as const }));
  const votedSun = st.votes.reduce((n, v) => n + v.count * SUN, 0n);
  if (st.frozen > votedSun) positions.push({ id: 'unvoted', validatorId: '', validatorName: 'Not voted', amount: (st.frozen - votedSun).toString(), status: 'active' });
  let unbonding = 0n, claimable = 0n;
  for (const u of st.unfreezing) {
    const ready = u.expireAt <= now;
    positions.push({ id: `unfreeze:${u.expireAt}`, validatorId: '', validatorName: 'Unfreezing', amount: u.amount.toString(), status: ready ? 'claimable' : 'unbonding', availableAt: u.expireAt });
    if (ready) claimable += u.amount; else unbonding += u.amount;
  }
  return {
    overview: { chainId: chain.id, symbol: 'TRX', decimals: 6, staked: st.frozen.toString(), rewards: st.reward.toString(), unbonding: unbonding.toString(), claimable: claimable.toString(), apr: null, positions, lockDays: TRON_UNFREEZE_DAYS },
    validators,
  };
}

/** Contracts for one staking action, in broadcast order. Votes REPLACE the account's vote list, so the full new list is sent. */
export function tronContracts(action: StakeAction, a: { owner: string; state: TronAccountState; amount?: bigint; validator?: string; toValidator?: string }): any[] {
  const { owner, state } = a;
  const tp = (sun: bigint) => sun / SUN;
  const voteList = (m: Map<string, bigint>) => [...m.entries()].filter(([, c]) => c > 0n).slice(0, 30).map(([voteAddress, c]) => ({ voteAddress, voteCount: c.toString() }));
  const current = new Map(state.votes.map((v) => [v.address, v.count]));
  switch (action) {
    case 'stake': {
      if (!a.amount || a.amount < SUN || !a.validator) throw stakeError('bad_request', 'Enter at least 1 TRX and choose a Super Representative');
      const next = new Map(current); const freeTp = tp(state.frozen + a.amount) - [...current.values()].reduce((n, c) => n + c, 0n);
      next.set(a.validator, (next.get(a.validator) ?? 0n) + (freeTp > 0n ? freeTp : 0n));
      return [
        { freezeBalanceV2: { ownerAddress: owner, frozenBalance: a.amount.toString(), resource: 'BANDWIDTH' } },
        { voteWitness: { ownerAddress: owner, votes: voteList(next), support: true } },
      ];
    }
    case 'redelegate': {
      if (!a.validator || !a.toValidator || a.validator === a.toValidator) throw stakeError('bad_request', 'Choose a different Super Representative');
      const moving = current.get(a.validator) ?? 0n; if (moving <= 0n) throw stakeError('bad_request', 'You have no votes for this Super Representative');
      const next = new Map(current); next.delete(a.validator); next.set(a.toValidator, (next.get(a.toValidator) ?? 0n) + moving);
      return [{ voteWitness: { ownerAddress: owner, votes: voteList(next), support: true } }];
    }
    case 'unstake':
      if (!a.amount || a.amount <= 0n || a.amount > state.frozen) throw stakeError('bad_amount', 'Amount exceeds your staked TRX');
      return [{ unfreezeBalanceV2: { ownerAddress: owner, unfreezeBalance: a.amount.toString(), resource: 'BANDWIDTH' } }];
    case 'claim':
    case 'compound':
      if (state.reward <= 0n) throw stakeError('nothing_to_claim', 'There are no rewards to claim');
      return [{ withdrawBalance: { ownerAddress: owner } }];
    case 'withdraw':
      return [{ withdrawExpireUnfreeze: { ownerAddress: owner } }];
  }
  throw stakeError('unsupported', 'This action is not available for TRX');
}

/** Sign one contract against a fresh block header; returns the JSON body TronGrid's broadcasttransaction expects. */
export function signTronContract(core: any, contract: any, block: any, key: Uint8Array, now = Date.now()): { json: string; id: string } {
  const raw = block.block_header.raw_data;
  const h = (s: string) => Uint8Array.from((s.match(/../g) ?? []).map((x) => parseInt(x, 16)));
  const blockHeader = { timestamp: raw.timestamp, txTrieRoot: h(raw.txTrieRoot), parentHash: h(raw.parentHash), number: raw.number, witnessAddress: h(raw.witness_address), version: raw.version ?? 0 };
  const input = TW.Tron.Proto.SigningInput.create({ transaction: { timestamp: now, expiration: now + 10 * 60 * 1000, blockHeader, ...contract } as any, privateKey: key });
  const out = TW.Tron.Proto.SigningOutput.decode(core.AnySigner.sign(TW.Tron.Proto.SigningInput.encode(input).finish(), core.CoinType.tron));
  if (out.error) throw stakeError('sign_failed', out.errorMessage || 'Could not build the transaction');
  return { json: out.json, id: Array.from(out.id as Uint8Array, (b) => b.toString(16).padStart(2, '0')).join('') };
}

export async function broadcastTron(chain: ChainInfo, f: Fetcher, json: string): Promise<string> {
  const r = await tronPost(chain, f, '/wallet/broadcasttransaction', JSON.parse(json));
  if (r?.result === true) return String(r.txid);
  let msg = String(r?.message ?? r?.code ?? 'Broadcast rejected');
  if (/^[0-9a-f]+$/i.test(msg) && msg.length % 2 === 0) { try { msg = new TextDecoder().decode(Uint8Array.from((msg.match(/../g) ?? []).map((x) => parseInt(x, 16)))); } catch { /* keep */ } }
  throw stakeError('broadcast_failed', msg);
}
