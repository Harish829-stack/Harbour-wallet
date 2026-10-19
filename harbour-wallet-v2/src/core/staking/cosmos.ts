// Cosmos-SDK staking: public LCD (REST) reads + wallet-core `AnySigner` message builders (MsgDelegate / MsgUndelegate /
// MsgBeginRedelegate / MsgWithdrawDelegatorReward). Read paths are the standard Cosmos SDK gRPC-gateway routes; every
// request is pure `fetch` (injectable). Live behaviour is UNVERIFIED in the build sandbox (egress blocked) — see evidence/34-staking.
import type { ChainInfo } from '../chains/types';
import { TW } from '@trustwallet/wallet-core';
import { firstOf, jsonGet } from '../chains/adapters/types';
import type { Fetcher } from '../chains/adapters/types';
import type { Position, StakeAction, StakeOverview, Validator, ValidatorMeta } from './types';
import { stakeError } from './types';

const trim = (u: string) => u.replace(/\/+$/, '');
export async function lcd<T = any>(chain: ChainInfo, f: Fetcher, path: string): Promise<T> {
  const urls = (chain.endpoints ?? []).map(trim);
  if (!urls.length) throw stakeError('no_endpoint', `No public REST endpoint configured for ${chain.name}`);
  return firstOf(urls, (u) => jsonGet(f, u + path, 10000)) as Promise<T>;
}

// ---------- decimals ----------
/** "123.456" -> 123n (integer part, floor). Cosmos reward amounts are `sdk.Dec` strings with 18 fractional digits. */
export function decFloor(s: unknown): bigint {
  if (typeof s !== 'string' || !/^\d+(\.\d+)?$/.test(s)) return 0n;
  return BigInt(s.split('.')[0]);
}
/** Parses a decimal string to [numerator, denominator]. */
function ratio(s: string): [bigint, bigint] {
  if (!/^\d+(\.\d+)?$/.test(s)) throw stakeError('bad_decimal', `Not a decimal: ${s}`);
  const [w, fr = ''] = s.split('.');
  return [BigInt(w + fr), 10n ** BigInt(fr.length)];
}
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

// ---------- APR ----------
export interface AprInput { inflation: string | number; bondedTokens: string; supply: string; communityTax?: string | number }
/** Base staking APR (percent) = inflation / bonded ratio * (1 - community tax). Returns null when inputs are unusable. */
export function computeBaseApr(i: AprInput): number | null {
  const infl = Number(i.inflation); const tax = Number(i.communityTax ?? 0);
  let bonded: bigint, supply: bigint;
  try { bonded = BigInt(i.bondedTokens); supply = BigInt(i.supply); } catch { return null; }
  if (!Number.isFinite(infl) || infl < 0 || bonded <= 0n || supply <= 0n || bonded > supply * 2n) return null;
  const ratioBonded = Number(bonded) / Number(supply);
  if (!(ratioBonded > 0)) return null;
  const apr = (infl / ratioBonded) * (1 - (Number.isFinite(tax) ? tax : 0)) * 100;
  return Number.isFinite(apr) && apr >= 0 && apr < 1000 ? Math.round(apr * 100) / 100 : null;
}
export const delegatorApr = (base: number | null, commission: number | null): number | null =>
  base == null ? null : Math.round(base * (1 - (commission ?? 0) / 100) * 100) / 100;

export interface CosmosParams { bondDenom: string; unbondingDays: number | null }
export async function fetchCosmosParams(chain: ChainInfo, f: Fetcher): Promise<CosmosParams> {
  const j = await lcd(chain, f, '/cosmos/staking/v1beta1/params');
  const bondDenom = j?.params?.bond_denom;
  if (typeof bondDenom !== 'string' || !bondDenom) throw stakeError('bad_response', 'Staking params missing bond denom');
  const t = String(j?.params?.unbonding_time ?? ''); // e.g. "1814400s"
  const secs = /^(\d+)(?:\.\d+)?s$/.exec(t);
  return { bondDenom, unbondingDays: secs ? Math.round(Number(secs[1]) / 86400) : null };
}
/** Base APR from mint inflation + bonded ratio; null when the chain's mint module differs (e.g. Osmosis epoch provisions). */
export async function fetchCosmosBaseApr(chain: ChainInfo, f: Fetcher, bondDenom: string): Promise<number | null> {
  try {
    const [infl, pool, supply, dist] = await Promise.all([
      lcd(chain, f, '/cosmos/mint/v1beta1/inflation'),
      lcd(chain, f, '/cosmos/staking/v1beta1/pool'),
      lcd(chain, f, `/cosmos/bank/v1beta1/supply/by_denom?denom=${encodeURIComponent(bondDenom)}`),
      lcd(chain, f, '/cosmos/distribution/v1beta1/params').catch(() => null),
    ]);
    return computeBaseApr({ inflation: infl?.inflation, bondedTokens: pool?.pool?.bonded_tokens, supply: supply?.amount?.amount, communityTax: dist?.params?.community_tax ?? 0 });
  } catch { return null; }
}

// ---------- validators ----------
export interface ChainValidator { operator: string; moniker: string; commission: number | null; jailed: boolean; bonded: boolean; tokens: string }
export function mapChainValidator(v: any): ChainValidator | null {
  const operator = v?.operator_address;
  if (typeof operator !== 'string' || !operator) return null;
  const rate = Number(v?.commission?.commission_rates?.rate);
  return {
    operator, moniker: String(v?.description?.moniker ?? '').slice(0, 80), commission: Number.isFinite(rate) ? Math.round(rate * 10000) / 100 : null,
    jailed: !!v?.jailed, bonded: v?.status === 'BOND_STATUS_BONDED', tokens: /^\d+$/.test(String(v?.tokens)) ? String(v.tokens) : '0',
  };
}
export async function fetchBondedValidators(chain: ChainInfo, f: Fetcher): Promise<ChainValidator[]> {
  const j = await lcd(chain, f, '/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=1000');
  return (Array.isArray(j?.validators) ? j.validators : []).map(mapChainValidator).filter((v: ChainValidator | null): v is ChainValidator => !!v);
}
export function validAddress(chain: ChainInfo, valoper: string): boolean {
  return !!chain.hrp && new RegExp(`^${chain.hrp}valoper1[02-9ac-hj-np-z]{38}$`).test(valoper);
}
/** Curated list first (those the chain reports), then the remaining bonded validators by stake, so the picker is never empty. */
export function mergeValidators(chain: ChainInfo, meta: ValidatorMeta[], chainVals: ChainValidator[], base: number | null, limit = 60): Validator[] {
  const byOp = new Map(chainVals.map((v) => [v.operator, v]));
  const out: Validator[] = []; const seen = new Set<string>();
  for (const m of meta) {
    if (!validAddress(chain, m.id)) continue;
    const c = byOp.get(m.id);
    seen.add(m.id);
    out.push({ ...m, commission: c?.commission ?? null, active: !!c && c.bonded && !c.jailed, jailed: c?.jailed, tokens: c?.tokens, apr: c ? delegatorApr(base, c.commission) : null });
  }
  const rest = chainVals.filter((v) => !seen.has(v.operator) && !v.jailed).sort((a, b) => (BigInt(b.tokens) > BigInt(a.tokens) ? 1 : BigInt(b.tokens) < BigInt(a.tokens) ? -1 : 0));
  for (const c of rest) { if (out.length >= limit) break; out.push({ id: c.operator, name: c.moniker || c.operator.slice(0, 14), commission: c.commission, active: true, tokens: c.tokens, apr: delegatorApr(base, c.commission) }); }
  return out;
}

// ---------- positions ----------
export interface CosmosRaw { delegations: any; unbonding: any; rewards: any }
/** Pure mapper over the three LCD answers (unit-tested with fixtures). */
export function mapCosmosPositions(raw: CosmosRaw, bondDenom: string, names: Map<string, string>, aprOf: (v: string) => number | null): Position[] {
  const out: Position[] = [];
  const rewardBy = new Map<string, bigint>();
  for (const r of Array.isArray(raw.rewards?.rewards) ? raw.rewards.rewards : []) {
    const coin = (Array.isArray(r?.reward) ? r.reward : []).find((c: any) => c?.denom === bondDenom);
    if (coin && typeof r.validator_address === 'string') rewardBy.set(r.validator_address, decFloor(coin.amount));
  }
  for (const d of Array.isArray(raw.delegations?.delegation_responses) ? raw.delegations.delegation_responses : []) {
    const v = d?.delegation?.validator_address; const bal = d?.balance;
    if (typeof v !== 'string' || bal?.denom !== bondDenom || !/^\d+$/.test(String(bal?.amount)) || BigInt(bal.amount) === 0n) continue;
    out.push({ id: v, validatorId: v, validatorName: names.get(v), amount: String(bal.amount), rewards: (rewardBy.get(v) ?? 0n).toString(), status: 'active', apr: aprOf(v) });
  }
  for (const u of Array.isArray(raw.unbonding?.unbonding_responses) ? raw.unbonding.unbonding_responses : []) {
    const v = u?.validator_address; if (typeof v !== 'string') continue;
    for (const [i, e] of (Array.isArray(u.entries) ? u.entries : []).entries()) {
      if (!/^\d+$/.test(String(e?.balance)) || BigInt(e.balance) === 0n) continue;
      const t = Date.parse(e.completion_time);
      out.push({ id: `${v}:${i}:${e.completion_time}`, validatorId: v, validatorName: names.get(v), amount: String(e.balance), status: 'unbonding', availableAt: Number.isFinite(t) ? t : undefined });
    }
  }
  return out;
}
export function summarize(chain: ChainInfo, symbol: string, positions: Position[], base: number | null, lockDays: number | null): StakeOverview {
  let staked = 0n, rewards = 0n, unbonding = 0n;
  for (const p of positions) {
    if (p.status === 'unbonding') unbonding += BigInt(p.amount);
    else { staked += BigInt(p.amount); rewards += BigInt(p.rewards ?? '0'); }
  }
  return { chainId: chain.id, symbol, decimals: chain.decimals, staked: staked.toString(), rewards: rewards.toString(), unbonding: unbonding.toString(), claimable: '0', apr: base, positions, lockDays };
}

export async function fetchCosmosOverview(chain: ChainInfo, address: string, f: Fetcher, meta: ValidatorMeta[]): Promise<{ overview: StakeOverview; validators: Validator[]; bondDenom: string }> {
  const enc = encodeURIComponent(address);
  const [params, delegations, unbonding, rewards, bonded] = await Promise.all([
    fetchCosmosParams(chain, f),
    lcd(chain, f, `/cosmos/staking/v1beta1/delegations/${enc}`),
    lcd(chain, f, `/cosmos/staking/v1beta1/delegators/${enc}/unbonding_delegations`),
    lcd(chain, f, `/cosmos/distribution/v1beta1/delegators/${enc}/rewards`).catch(() => ({ rewards: [] })),
    fetchBondedValidators(chain, f).catch(() => [] as ChainValidator[]),
  ]);
  const base = await fetchCosmosBaseApr(chain, f, params.bondDenom);
  const validators = mergeValidators(chain, meta, bonded, base);
  // Delegations to validators outside the list/bonded set: resolve their names individually so rows are never blank.
  const known = new Map(validators.map((v) => [v.id, v]));
  const extra = new Set<string>();
  for (const d of Array.isArray(delegations?.delegation_responses) ? delegations.delegation_responses : []) { const v = d?.delegation?.validator_address; if (typeof v === 'string' && !known.has(v)) extra.add(v); }
  for (const u of Array.isArray(unbonding?.unbonding_responses) ? unbonding.unbonding_responses : []) { const v = u?.validator_address; if (typeof v === 'string' && !known.has(v)) extra.add(v); }
  for (const v of [...extra].slice(0, 20)) {
    try {
      const j = await lcd(chain, f, `/cosmos/staking/v1beta1/validators/${encodeURIComponent(v)}`);
      const c = mapChainValidator(j?.validator);
      if (c) validators.push({ id: c.operator, name: c.moniker || c.operator.slice(0, 14), commission: c.commission, active: c.bonded && !c.jailed, jailed: c.jailed, tokens: c.tokens, apr: delegatorApr(base, c.commission) });
    } catch { /* leave unnamed */ }
  }
  const names = new Map(validators.map((v) => [v.id, v.name])); const apr = new Map(validators.map((v) => [v.id, v.apr]));
  const positions = mapCosmosPositions({ delegations, unbonding, rewards }, params.bondDenom, names, (v) => apr.get(v) ?? null);
  const best = validators.reduce<number | null>((m, v) => (v.apr != null && v.active && (m == null || v.apr > m) ? v.apr : m), null);
  return { overview: { ...summarize(chain, chain.symbol, positions, best ?? base, params.unbondingDays), }, validators, bondDenom: params.bondDenom };
}

/** Spendable balance of the bond denom (smallest unit). */
export async function fetchCosmosBalance(chain: ChainInfo, address: string, denom: string, f: Fetcher): Promise<bigint> {
  const j = await lcd(chain, f, `/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}/by_denom?denom=${encodeURIComponent(denom)}`);
  const a = j?.balance?.amount; return /^\d+$/.test(String(a)) ? BigInt(a) : 0n;
}

// ---------- fees & signing ----------
/** Minimum gas prices (smallest unit per gas) of the public networks. [likely] — nodes may require more; the broadcast error is surfaced. */
const GAS_PRICE: Record<string, string> = {
  cosmos: '0.005', osmosis: '0.0025', kava: '0.025', akash: '0.025', sei: '0.1', juno: '0.075', stride: '0.005', axelar: '0.007',
  agoric: '0.01', nativeinjective: '160000000', zetachain: '10000000000', terra: '28.325',
};
const GAS: Record<StakeAction, number> = { stake: 250_000, unstake: 300_000, redelegate: 400_000, compound: 450_000, claim: 200_000, withdraw: 200_000 };
export function cosmosGas(action: StakeAction, validators: number): number {
  const n = Math.max(1, validators);
  return action === 'claim' ? GAS.claim + (n - 1) * 90_000 : action === 'compound' ? GAS.compound + (n - 1) * 150_000 : GAS[action];
}
export function cosmosFee(chainId: string, denom: string, action: StakeAction, validators = 1): { denom: string; amount: string; gas: number } {
  const gas = cosmosGas(action, validators);
  const [n, d] = ratio(GAS_PRICE[chainId] ?? '0.025');
  return { denom, amount: ceilDiv(BigInt(gas) * n, d).toString(), gas };
}

export interface CosmosOp {
  action: StakeAction;
  delegator: string;
  denom: string;
  amount?: string;                 // raw
  validator?: string;
  toValidator?: string;            // redelegate destination
  /** claim / compound: validators with rewards, and for compound the integer reward amount per validator. */
  rewards?: Array<{ validator: string; amount: string }>;
}
/** wallet-core `Cosmos.Message` objects for an operation. Pure. */
export function buildCosmosMessages(op: CosmosOp): any[] {
  const coin = (amount: string) => ({ denom: op.denom, amount });
  const need = (v: unknown, what: string) => { if (!v) throw stakeError('bad_request', `Missing ${what}`); return v as string; };
  const amt = () => { const a = need(op.amount, 'amount'); if (!/^[1-9]\d*$/.test(a)) throw stakeError('bad_amount', 'Amount must be a positive integer'); return a; };
  switch (op.action) {
    case 'stake': return [{ stakeMessage: { delegatorAddress: op.delegator, validatorAddress: need(op.validator, 'validator'), amount: coin(amt()) } }];
    case 'unstake': return [{ unstakeMessage: { delegatorAddress: op.delegator, validatorAddress: need(op.validator, 'validator'), amount: coin(amt()) } }];
    case 'redelegate': return [{ restakeMessage: { delegatorAddress: op.delegator, validatorSrcAddress: need(op.validator, 'source validator'), validatorDstAddress: need(op.toValidator, 'destination validator'), amount: coin(amt()) } }];
    case 'claim': {
      const list = op.rewards ?? []; if (!list.length) throw stakeError('nothing_to_claim', 'No rewards to claim');
      return list.map((r) => ({ withdrawStakeRewardMessage: { delegatorAddress: op.delegator, validatorAddress: r.validator } }));
    }
    case 'compound': {
      const list = (op.rewards ?? []).filter((r) => /^[1-9]\d*$/.test(r.amount)); if (!list.length) throw stakeError('nothing_to_claim', 'No rewards to compound');
      const out: any[] = [];
      for (const r of list) { out.push({ withdrawStakeRewardMessage: { delegatorAddress: op.delegator, validatorAddress: r.validator } }); out.push({ stakeMessage: { delegatorAddress: op.delegator, validatorAddress: r.validator, amount: coin(r.amount) } }); }
      return out;
    }
    default: throw stakeError('unsupported', `Cosmos has no "${op.action}" action`);
  }
}

export interface CosmosSigningArgs { op: CosmosOp; accountNumber: string; sequence: string; chainId: string; fee: { denom: string; amount: string; gas: number }; privateKey: Uint8Array; memo?: string }
export function buildCosmosSigningInput(core: any, a: CosmosSigningArgs) {
  const P = TW.Cosmos.Proto;
  return P.SigningInput.create({
    signingMode: P.SigningMode.Protobuf, accountNumber: Number(a.accountNumber), chainId: a.chainId, sequence: Number(a.sequence), memo: a.memo ?? '',
    fee: { amounts: [{ denom: a.fee.denom, amount: a.fee.amount }], gas: a.fee.gas },
    privateKey: a.privateKey, messages: buildCosmosMessages(a.op), mode: P.BroadcastMode.SYNC,
  });
}
/** Signs with wallet-core's AnySigner. Returns the LCD broadcast body. Never logs key material. */
export function signCosmos(core: any, chain: ChainInfo, a: CosmosSigningArgs): { body: { tx_bytes: string; mode: string }; json: string } {
  const P = TW.Cosmos.Proto;
  const input = buildCosmosSigningInput(core, a);
  const out = P.SigningOutput.decode(core.AnySigner.sign(P.SigningInput.encode(input).finish(), core.CoinType[chain.ct]));
  if (out.error || out.errorMessage) throw stakeError('sign_failed', out.errorMessage || `wallet-core signing error ${out.error}`);
  let body: any; try { body = JSON.parse(out.serialized); } catch { throw stakeError('sign_failed', 'Unexpected signer output'); }
  if (typeof body?.tx_bytes !== 'string') throw stakeError('sign_failed', 'Signer returned no tx bytes');
  return { body: { tx_bytes: body.tx_bytes, mode: body.mode ?? 'BROADCAST_MODE_SYNC' }, json: out.json };
}

export function parseCosmosAccount(j: any): { accountNumber: string; sequence: string } {
  const a = j?.account; const base = a?.base_account ?? a?.base_vesting_account?.base_account ?? a;
  const accountNumber = String(base?.account_number ?? ''); const sequence = String(base?.sequence ?? '0');
  if (!/^\d+$/.test(accountNumber) || !/^\d+$/.test(sequence)) throw stakeError('no_account', 'Account not found on chain (fund it first)');
  return { accountNumber, sequence };
}
export async function fetchCosmosSigningContext(chain: ChainInfo, address: string, f: Fetcher): Promise<{ accountNumber: string; sequence: string; chainId: string }> {
  const [acct, node] = await Promise.all([
    lcd(chain, f, `/cosmos/auth/v1beta1/accounts/${encodeURIComponent(address)}`),
    lcd(chain, f, '/cosmos/base/tendermint/v1beta1/node_info'),
  ]);
  const chainId = node?.default_node_info?.network;
  if (typeof chainId !== 'string' || !chainId) throw stakeError('bad_response', 'Node did not report a chain id');
  return { ...parseCosmosAccount(acct), chainId };
}
export async function broadcastCosmos(chain: ChainInfo, f: Fetcher, body: { tx_bytes: string; mode: string }): Promise<string> {
  const urls = (chain.endpoints ?? []).map(trim);
  const j: any = await firstOf(urls, async (u) => {
    const res = await f(`${u}/cosmos/tx/v1beta1/txs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const t = await res.json().catch(() => null);
    if (!res.ok && !t?.tx_response) throw new Error(t?.message ?? `HTTP ${res.status}`);
    return t;
  });
  const r = j?.tx_response;
  if (!r || (typeof r.code === 'number' && r.code !== 0)) throw stakeError('broadcast_failed', String(r?.raw_log ?? 'Broadcast rejected').slice(0, 300));
  if (typeof r.txhash !== 'string') throw stakeError('broadcast_failed', 'No transaction hash returned');
  return r.txhash;
}
