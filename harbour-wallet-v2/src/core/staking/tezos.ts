// Tezos delegation ("baking" delegation, TW's Tezos earn): delegate the whole liquid balance to a baker with a DELEGATION
// operation; undelegate by sending one with no delegate. Funds never leave the account and are never locked. Account and baker
// data from TzKT (public, no key); counter / branch / reveal state from the node RPC; signing and forging by wallet-core.
import { TW } from '../chains/send/proto';
import type { ChainInfo } from '../chains/types';
import type { Fetcher } from '../chains/adapters/types';
import type { Position, StakeOverview, Validator, ValidatorMeta, StakeAction } from './types';
import { stakeError } from './types';

export const TZKT = 'https://api.tzkt.io/v1';
const DELEGATION_FEE = 1300n, REVEAL_FEE = 1000n, DELEGATION_GAS = 1100, REVEAL_GAS = 1000;
const getJson = async (f: Fetcher, url: string) => { const r = await f(url, { signal: AbortSignal.timeout(12000) }); if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status }); return r.json(); };
const nodes = (c: ChainInfo) => [...(c.endpoints ?? []), 'https://rpc.tzkt.io/mainnet'].map((u) => u.replace(/\/$/, '')).filter((u, i, a) => a.indexOf(u) === i);
async function node(chain: ChainInfo, f: Fetcher, path: string, allowMissing = false): Promise<any> {
  let last: unknown;
  for (const u of nodes(chain)) {
    try { return await getJson(f, u + path); } catch (e: any) { if (allowMissing && (e?.status === 404 || e?.status === 500)) return null; last = e; }
  }
  throw last ?? stakeError('network', 'No Tezos endpoint');
}
export const isTezosBaker = (s: unknown): s is string => typeof s === 'string' && /^tz[1-4][1-9A-HJ-NP-Za-km-z]{33}$/.test(s);

export async function fetchTezosOverview(_chain: ChainInfo, address: string, f: Fetcher, meta: ValidatorMeta[]): Promise<{ overview: StakeOverview; validators: Validator[] }> {
  const [acct, bakers] = await Promise.all([
    getJson(f, `${TZKT}/accounts/${encodeURIComponent(address)}`).catch((e) => { if (e?.status === 404) return {}; throw e; }),
    getJson(f, `${TZKT}/delegates?active=true&sort.desc=stakingBalance&limit=50&select=address,alias,stakingBalance,delegatedBalance`).catch(() => []),
  ]);
  const live = new Map<string, any>((Array.isArray(bakers) ? bakers : []).map((b: any) => [String(b.address), b]));
  const base: ValidatorMeta[] = meta.length ? meta : [...live.values()].map((b) => ({ id: String(b.address), name: String(b.alias ?? '').slice(0, 80) || String(b.address).slice(0, 10) }));
  const validators: Validator[] = base.map((m) => ({ ...m, apr: null, commission: null, active: meta.length ? true : live.has(m.id), tokens: live.get(m.id)?.stakingBalance != null ? String(live.get(m.id).stakingBalance) : undefined }));
  const balance = BigInt(acct?.balance ?? 0);
  const delegate = acct?.delegate?.address ? String(acct.delegate.address) : '';
  const positions: Position[] = delegate ? [{ id: `delegation:${delegate}`, validatorId: delegate, validatorName: acct.delegate.alias ?? validators.find((v) => v.id === delegate)?.name, amount: balance.toString(), status: 'active' }] : [];
  return {
    overview: { chainId: 'tezos', symbol: 'XTZ', decimals: 6, staked: delegate ? balance.toString() : '0', rewards: '0', unbonding: '0', claimable: '0', apr: null, positions, lockDays: null },
    validators,
  };
}

export interface TezosCtx { branch: string; counter: bigint; revealed: boolean; balance: bigint; delegate: string }
export async function fetchTezosContext(chain: ChainInfo, address: string, f: Fetcher): Promise<TezosCtx> {
  const p = `/chains/main/blocks/head/context/contracts/${address}`;
  const [branch, counter, mk, bal, dlg] = await Promise.all([node(chain, f, '/chains/main/blocks/head/hash'), node(chain, f, `${p}/counter`), node(chain, f, `${p}/manager_key`, true), node(chain, f, `${p}/balance`), node(chain, f, `${p}/delegate`, true)]);
  return { branch: String(branch), counter: BigInt(counter), revealed: !!mk, balance: BigInt(bal), delegate: dlg ? String(dlg) : '' };
}
export const tezosFee = (revealed: boolean) => DELEGATION_FEE + (revealed ? 0n : REVEAL_FEE);

/** The baker to delegate to for an action ('' = undelegate). */
export function tezosTarget(action: StakeAction, a: { validator?: string; toValidator?: string; current: string }): string {
  if (action === 'stake') { if (!isTezosBaker(a.validator)) throw stakeError('bad_request', 'Choose a baker'); if (a.validator === a.current) throw stakeError('bad_request', 'You already delegate to this baker'); return a.validator; }
  if (action === 'redelegate') { if (!isTezosBaker(a.toValidator) || a.toValidator === a.current) throw stakeError('bad_request', 'Choose a different baker'); return a.toValidator; }
  if (action === 'unstake') { if (!a.current) throw stakeError('bad_request', 'You are not delegating'); return ''; }
  throw stakeError('unsupported', 'This action is not available for XTZ');
}

export function signTezosDelegation(core: any, a: { source: string; ctx: TezosCtx; delegate: string; key: Uint8Array }): string {
  const K = TW.Tezos.Proto.Operation.OperationKind; const ops: any[] = []; let counter = a.ctx.counter;
  if (!a.ctx.revealed) {
    const pk = core.PrivateKey.createWithData(a.key); const pub = pk.getPublicKeyEd25519(); const pubBytes: Uint8Array = pub.data(); pk.delete(); pub.delete();
    counter += 1n; ops.push({ source: a.source, fee: REVEAL_FEE.toString(), counter: counter.toString(), gasLimit: REVEAL_GAS, storageLimit: 0, kind: K.REVEAL, revealOperationData: { publicKey: pubBytes } });
  }
  counter += 1n;
  ops.push({ source: a.source, fee: DELEGATION_FEE.toString(), counter: counter.toString(), gasLimit: DELEGATION_GAS, storageLimit: 0, kind: K.DELEGATION, delegationOperationData: { delegate: a.delegate } });
  const input = TW.Tezos.Proto.SigningInput.create({ operationList: { branch: a.ctx.branch, operations: ops }, privateKey: a.key } as any);
  const out = TW.Tezos.Proto.SigningOutput.decode(core.AnySigner.sign(TW.Tezos.Proto.SigningInput.encode(input).finish(), core.CoinType.tezos));
  if (out.error) throw stakeError('sign_failed', out.errorMessage || 'Could not build the operation');
  return Array.from(out.encoded as Uint8Array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function injectTezos(chain: ChainInfo, f: Fetcher, hex: string): Promise<string> {
  let last: unknown;
  for (const u of nodes(chain)) {
    try {
      const r = await f(`${u}/injection/operation`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(hex), signal: AbortSignal.timeout(15000) });
      const t = await r.text(); if (!r.ok) throw new Error(t.slice(0, 300) || `HTTP ${r.status}`);
      return JSON.parse(t);
    } catch (e) { last = e; }
  }
  throw last ?? stakeError('network', 'No Tezos endpoint');
}
