// Solana native staking: stake accounts via `getProgramAccounts` (Stake program, memcmp on the staker authority),
// validators via `getVoteAccounts`, yield via `getInflationRate`/`getSupply`. Signing uses wallet-core's Solana
// DelegateStake / DeactivateStake / WithdrawStake via AnySigner. Live behaviour UNVERIFIED (sandbox egress blocked).
import type { Fetcher } from '../chains/adapters/types';
import { TW } from '@trustwallet/wallet-core';
import { firstOf, jsonPost } from '../chains/adapters/types';
import type { Position, StakeAction, StakeOverview, Validator, ValidatorMeta } from './types';
import { stakeError } from './types';

export const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';
const U64_MAX = '18446744073709551615';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isSolAddress = (s: unknown): s is string => typeof s === 'string' && B58.test(s);

export async function solRpc(f: Fetcher, urls: string[], method: string, params: unknown[]): Promise<any> {
  return firstOf(urls, async (u) => {
    const j = await jsonPost(f, u, { jsonrpc: '2.0', id: 1, method, params }, 15000);
    if (j?.error) throw new Error(j.error.message ?? `${method} failed`);
    return j?.result;
  });
}

export interface VoteAccount { votePubkey: string; nodePubkey: string; activatedStake: number; commission: number; delinquent: boolean }
export function mapVoteAccounts(r: any): VoteAccount[] {
  const mk = (a: any, delinquent: boolean): VoteAccount | null => (isSolAddress(a?.votePubkey) && isSolAddress(a?.nodePubkey)
    ? { votePubkey: a.votePubkey, nodePubkey: a.nodePubkey, activatedStake: Number(a.activatedStake) || 0, commission: Number(a.commission) || 0, delinquent } : null);
  return [...(Array.isArray(r?.current) ? r.current : []).map((a: any) => mk(a, false)), ...(Array.isArray(r?.delinquent) ? r.delinquent : []).map((a: any) => mk(a, true))].filter((v): v is VoteAccount => !!v);
}
/** Network staking APR (percent) = validator inflation / staked ratio. null when inputs are unusable. */
export function solanaBaseApr(validatorInflation: number, totalSupplyLamports: number, activeStakeLamports: number): number | null {
  if (!(validatorInflation > 0) || !(totalSupplyLamports > 0) || !(activeStakeLamports > 0)) return null;
  const ratio = activeStakeLamports / totalSupplyLamports; if (ratio <= 0 || ratio > 1) return null;
  return Math.round((validatorInflation / ratio) * 10000) / 100;
}
export function solanaValidators(meta: ValidatorMeta[], votes: VoteAccount[], base: number | null, limit = 60): Validator[] {
  const byVote = new Map(votes.map((v) => [v.votePubkey, v])); const byNode = new Map(votes.map((v) => [v.nodePubkey, v]));
  const out: Validator[] = []; const seen = new Set<string>();
  const row = (id: string, m: Partial<ValidatorMeta>, v?: VoteAccount): Validator => ({
    id, name: m.name ?? id.slice(0, 8), description: m.description, website: m.website, commission: v ? v.commission : null,
    active: !!v && !v.delinquent, tokens: v ? String(v.activatedStake) : undefined, apr: v && base != null ? Math.round(base * (1 - v.commission / 100) * 100) / 100 : null,
  });
  for (const m of meta) {
    if (!isSolAddress(m.id)) continue;
    const v = byVote.get(m.id) ?? byNode.get(m.id);
    const id = v?.votePubkey ?? m.id; // delegations target the vote account
    if (seen.has(id)) continue; seen.add(id);
    out.push(row(id, m, v));
  }
  for (const v of [...votes].filter((x) => !x.delinquent && !seen.has(x.votePubkey)).sort((a, b) => b.activatedStake - a.activatedStake)) {
    if (out.length >= limit) break; seen.add(v.votePubkey); out.push(row(v.votePubkey, { name: `${v.votePubkey.slice(0, 4)}…${v.votePubkey.slice(-4)}` }, v));
  }
  return out;
}

export interface StakeAcct { pubkey: string; lamports: number; rent: number; staker: string; withdrawer: string; voter?: string; stake?: string; activationEpoch?: string; deactivationEpoch?: string; type: string; lockupUntil?: number }
export function mapStakeAccounts(r: any): StakeAcct[] {
  const out: StakeAcct[] = [];
  for (const a of Array.isArray(r) ? r : []) {
    const info = a?.account?.data?.parsed?.info; const type = a?.account?.data?.parsed?.type;
    if (!info?.meta?.authorized || typeof a?.pubkey !== 'string') continue;
    const d = info.stake?.delegation;
    out.push({
      pubkey: a.pubkey, lamports: Number(a.account.lamports) || 0, rent: Number(info.meta.rentExemptReserve) || 0, staker: String(info.meta.authorized.staker), withdrawer: String(info.meta.authorized.withdrawer),
      type: String(type), voter: d?.voter, stake: d ? String(d.stake) : undefined, activationEpoch: d ? String(d.activationEpoch) : undefined, deactivationEpoch: d ? String(d.deactivationEpoch) : undefined,
      lockupUntil: Number(info.meta.lockup?.unixTimestamp) > 0 ? Number(info.meta.lockup.unixTimestamp) * 1000 : undefined,
    });
  }
  return out;
}
export interface EpochInfo { epoch: number; slotIndex: number; slotsInEpoch: number }
/** Maps a stake account to a Position given the current epoch (simplified activation model; exact warmup/cooldown is per-epoch). */
export function stakePosition(a: StakeAcct, e: EpochInfo, names: Map<string, string>, aprOf: (v: string) => number | null, now = Date.now()): Position | null {
  const msPerEpoch = e.slotsInEpoch * 400; // ~0.4 s slots
  const toNext = Math.max(0, (e.slotsInEpoch - e.slotIndex) * 400);
  const base = { id: a.pubkey, validatorId: a.voter ?? '', validatorName: a.voter ? names.get(a.voter) : undefined, apr: a.voter ? aprOf(a.voter) : null };
  const extra = Math.max(0, a.lamports - a.rent - Number(a.stake ?? 0));
  if (a.type !== 'delegated' || !a.stake) return { ...base, amount: String(Math.max(0, a.lamports)), status: 'inactive' }; // initialized: fully withdrawable
  const act = Number(a.activationEpoch); const deact = a.deactivationEpoch === U64_MAX ? null : Number(a.deactivationEpoch);
  if (deact == null) {
    const status = act < e.epoch ? 'active' : 'activating';
    return { ...base, amount: a.stake, rewards: String(extra), status, availableAt: status === 'activating' ? now + toNext : undefined };
  }
  if (e.epoch > deact) return { ...base, amount: String(a.lamports), status: 'inactive' };
  return { ...base, amount: a.stake, status: 'deactivating', availableAt: now + toNext + (deact - e.epoch) * msPerEpoch };
}
export function summarizeSolana(positions: Position[], base: number | null, decimals = 9): StakeOverview {
  let staked = 0n, unbonding = 0n, claimable = 0n, rewards = 0n;
  for (const p of positions) {
    const v = BigInt(p.amount);
    if (p.status === 'active' || p.status === 'activating') { staked += v; rewards += BigInt(p.rewards ?? '0'); }
    else if (p.status === 'deactivating') unbonding += v; else claimable += v;
  }
  return { chainId: 'solana', symbol: 'SOL', decimals, staked: staked.toString(), rewards: rewards.toString(), unbonding: unbonding.toString(), claimable: claimable.toString(), apr: base, positions, lockDays: 2 };
}

export async function fetchSolanaOverview(urls: string[], address: string, f: Fetcher, meta: ValidatorMeta[]): Promise<{ overview: StakeOverview; validators: Validator[] }> {
  if (!isSolAddress(address)) throw stakeError('bad_address', 'Invalid Solana address');
  const [accts, votes, epoch, infl, supply] = await Promise.all([
    solRpc(f, urls, 'getProgramAccounts', [STAKE_PROGRAM, { encoding: 'jsonParsed', commitment: 'confirmed', filters: [{ memcmp: { offset: 12, bytes: address } }] }]),
    solRpc(f, urls, 'getVoteAccounts', [{ commitment: 'confirmed' }]).then(mapVoteAccounts),
    solRpc(f, urls, 'getEpochInfo', [{ commitment: 'confirmed' }]),
    solRpc(f, urls, 'getInflationRate', []).catch(() => null),
    solRpc(f, urls, 'getSupply', [{ commitment: 'confirmed', excludeNonCirculatingAccountsList: true }]).catch(() => null),
  ]);
  const active = votes.filter((v) => !v.delinquent).reduce((n, v) => n + v.activatedStake, 0);
  const base = solanaBaseApr(Number(infl?.validator), Number(supply?.value?.total), active);
  const validators = solanaValidators(meta, votes, base);
  const names = new Map(validators.map((v) => [v.id, v.name])); const aprs = new Map(validators.map((v) => [v.id, v.apr]));
  const e: EpochInfo = { epoch: Number(epoch?.epoch), slotIndex: Number(epoch?.slotIndex), slotsInEpoch: Number(epoch?.slotsInEpoch) || 432000 };
  if (!Number.isFinite(e.epoch)) throw stakeError('bad_response', 'Epoch info unavailable');
  const positions = mapStakeAccounts(accts).map((a) => stakePosition(a, e, names, (v) => aprs.get(v) ?? null)).filter((p): p is Position => !!p);
  const best = validators.reduce<number | null>((m, v) => (v.apr != null && v.active && (m == null || v.apr > m) ? v.apr : m), null);
  return { overview: summarizeSolana(positions, best ?? base), validators };
}

// ---------- signing ----------
export interface SolStakeArgs { action: StakeAction; sender: string; privateKey: Uint8Array; blockhash: string; validator?: string; amount?: string; stakeAccount?: string }
export function buildSolanaStakeInput(core: any, a: SolStakeArgs) {
  const P = TW.Solana.Proto;
  const long = (s: string) => { if (!/^[1-9]\d*$/.test(s)) throw stakeError('bad_amount', 'Amount must be a positive integer'); return Number(s) <= Number.MAX_SAFE_INTEGER ? Number(s) : s; };
  const base: any = { privateKey: a.privateKey, recentBlockhash: a.blockhash, sender: a.sender, txEncoding: P.Encoding.Base58 };
  switch (a.action) {
    case 'stake':
      if (!isSolAddress(a.validator)) throw stakeError('bad_request', 'Invalid validator vote account');
      return P.SigningInput.create({ ...base, delegateStakeTransaction: { validatorPubkey: a.validator, value: long(a.amount ?? '') } });
    case 'unstake':
      if (!isSolAddress(a.stakeAccount)) throw stakeError('bad_request', 'Missing stake account');
      return P.SigningInput.create({ ...base, deactivateStakeTransaction: { stakeAccount: a.stakeAccount } });
    case 'withdraw':
      if (!isSolAddress(a.stakeAccount)) throw stakeError('bad_request', 'Missing stake account');
      return P.SigningInput.create({ ...base, withdrawTransaction: { stakeAccount: a.stakeAccount, value: long(a.amount ?? '') } });
    default: throw stakeError('unsupported', `Solana has no "${a.action}" action`);
  }
}
export function signSolanaStake(core: any, a: SolStakeArgs): { encoded: string } {
  const P = TW.Solana.Proto;
  const out = P.SigningOutput.decode(core.AnySigner.sign(P.SigningInput.encode(buildSolanaStakeInput(core, a)).finish(), core.CoinType.solana));
  if (out.error || out.errorMessage) throw stakeError('sign_failed', out.errorMessage || `wallet-core signing error ${out.error}`);
  if (!out.encoded) throw stakeError('sign_failed', 'Signer returned no transaction');
  return { encoded: out.encoded };
}
export async function sendSolana(f: Fetcher, urls: string[], encoded: string): Promise<string> {
  const sig = await solRpc(f, urls, 'sendTransaction', [encoded, { encoding: 'base58', preflightCommitment: 'confirmed', maxRetries: 3 }]);
  if (typeof sig !== 'string') throw stakeError('broadcast_failed', 'No signature returned');
  return sig;
}
export async function solanaBlockhash(f: Fetcher, urls: string[]): Promise<string> {
  const r = await solRpc(f, urls, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const h = r?.value?.blockhash; if (typeof h !== 'string') throw stakeError('bad_response', 'No blockhash'); return h;
}
