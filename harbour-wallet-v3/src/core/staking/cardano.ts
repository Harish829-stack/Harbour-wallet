// Cardano delegation: register the stake key (2 ADA refundable deposit) and delegate to a pool in one transaction;
// redelegate; claim rewards (a reward withdrawal; since the Plomin hard fork it requires a DRep vote delegation, so
// Harbour adds "always abstain" when the account has none); unstake = withdraw rewards + deregister (deposit returned).
// ADA never leaves the account and is never locked. Data from Koios; transactions built and signed by wallet-core.
import { TW } from '../chains/send/proto';
import type { ChainInfo } from '../chains/types';
import type { Fetcher } from '../chains/adapters/types';
import { KOIOS, cardanoAddressInfo, cardanoTipSlot, toTxInputs, type CardanoUtxo } from '../chains/cardano';
import type { Position, StakeAction, StakeOverview, Validator } from './types';
import { stakeError } from './types';

export const STAKE_KEY_DEPOSIT = 2_000_000n;
const SELF_OUTPUT = 1_500_000n;
const TTL_SLOTS = 7200;
const base = (c?: ChainInfo) => ((c?.endpoints?.[0]) ?? KOIOS).replace(/\/$/, '');

// ---- bech32 (pool ids) ----
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
export function bech32Data(s: string, hrp: string): Uint8Array {
  const str = s.toLowerCase(); const sep = str.lastIndexOf('1');
  if (sep < 1 || str.slice(0, sep) !== hrp) throw stakeError('bad_request', 'Invalid pool id');
  const words: number[] = [];
  for (const ch of str.slice(sep + 1, -6)) { const v = CHARSET.indexOf(ch); if (v < 0) throw stakeError('bad_request', 'Invalid pool id'); words.push(v); }
  let acc = 0, bits = 0; const out: number[] = [];
  for (const w of words) { acc = (acc << 5) | w; bits += 5; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); } }
  return Uint8Array.from(out);
}
export const isPoolId = (s: unknown): s is string => typeof s === 'string' && /^pool1[02-9ac-hj-np-z]{50,60}$/.test(s);
export const poolIdBytes = (bech: string): Uint8Array => { const b = bech32Data(bech, 'pool'); if (b.length !== 28) throw stakeError('bad_request', 'Invalid pool id'); return b; };

async function kpost(f: Fetcher, url: string, body: unknown) { const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
async function kget(f: Fetcher, url: string) { const r = await f(url, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

export interface CardanoStakeState { address: string; stakeAddress: string; registered: boolean; pool: string | null; drep: string | null; rewards: bigint; total: bigint; balance: bigint; utxos: CardanoUtxo[] }
export async function fetchCardanoState(chain: ChainInfo, address: string, f: Fetcher): Promise<CardanoStakeState> {
  const info = await cardanoAddressInfo(f, address, chain);
  if (!info.stakeAddress) return { address, stakeAddress: '', registered: false, pool: null, drep: null, rewards: 0n, total: info.balance, balance: info.balance, utxos: info.utxos };
  const rows = await kpost(f, `${base(chain)}/account_info`, { _stake_addresses: [info.stakeAddress] });
  const a = Array.isArray(rows) ? rows[0] : null;
  return {
    address, stakeAddress: info.stakeAddress, registered: a?.status === 'registered', pool: a?.delegated_pool ?? null, drep: a?.delegated_drep ?? null,
    rewards: BigInt(a?.rewards_available ?? 0), total: BigInt(a?.total_balance ?? info.balance), balance: info.balance, utxos: info.utxos,
  };
}

export async function fetchCardanoOverview(chain: ChainInfo, address: string, f: Fetcher): Promise<{ overview: StakeOverview; validators: Validator[] }> {
  const [st, pools] = await Promise.all([
    fetchCardanoState(chain, address, f),
    kget(f, `${base(chain)}/pool_list?pool_status=eq.registered&order=active_stake.desc.nullslast&limit=60&select=pool_id_bech32,ticker,margin,active_stake`).catch(() => []),
  ]);
  const validators: Validator[] = (Array.isArray(pools) ? pools : []).filter((p: any) => isPoolId(p?.pool_id_bech32)).map((p: any) => ({
    id: String(p.pool_id_bech32), name: String(p.ticker ?? '').replace(/[^\w .-]/g, '').slice(0, 20) || String(p.pool_id_bech32).slice(0, 12),
    apr: null, commission: Number.isFinite(Number(p.margin)) ? Math.round(Number(p.margin) * 10000) / 100 : null, active: true, tokens: p.active_stake != null ? String(p.active_stake) : undefined,
  }));
  const positions: Position[] = st.registered && st.pool ? [{ id: `pool:${st.pool}`, validatorId: st.pool, validatorName: validators.find((v) => v.id === st.pool)?.name, amount: st.total.toString(), rewards: st.rewards.toString(), status: 'active' }] : [];
  return {
    overview: { chainId: 'cardano', symbol: 'ADA', decimals: 6, staked: positions.length ? st.total.toString() : '0', rewards: st.rewards.toString(), unbonding: '0', claimable: '0', apr: null, positions, lockDays: null },
    validators,
  };
}

/** wallet-core SigningInput (without the key) for a staking action. */
export function cardanoStakeInput(action: StakeAction, st: CardanoStakeState, slot: number, pool?: string): any {
  if (!st.stakeAddress) throw stakeError('unsupported', 'This Cardano address has no staking part (enterprise address)');
  const stakingAddress = st.stakeAddress;
  const input: any = { utxos: toTxInputs(st.address, st.utxos), ttl: slot + TTL_SLOTS, transferMessage: { toAddress: st.address, changeAddress: st.address, amount: SELF_OUTPUT.toString(), useMaxAmount: false } };
  const vote = () => (st.drep ? {} : { voteDelegation: { stakingAddress, drepType: TW.Cardano.Proto.VoteDelegation.DRepType.DREP_ALWAYS_ABSTAIN } });
  switch (action) {
    case 'stake': case 'redelegate': {
      if (!isPoolId(pool)) throw stakeError('bad_request', 'Choose a stake pool');
      if (st.pool === pool) throw stakeError('bad_request', 'You already delegate to this pool');
      if (action === 'redelegate' && !st.registered) throw stakeError('bad_request', 'You are not delegating yet');
      return { ...input, ...(st.registered ? {} : { registerStakingKey: { stakingAddress, depositAmount: STAKE_KEY_DEPOSIT.toString() } }), delegate: { stakingAddress, poolId: poolIdBytes(pool), depositAmount: '0' } }; // the deposit is counted once, on the registration
    }
    case 'claim': case 'compound':
      if (st.rewards <= 0n) throw stakeError('nothing_to_claim', 'There are no rewards to claim');
      return { ...input, withdraw: { stakingAddress, withdrawAmount: st.rewards.toString() }, ...vote() };
    case 'unstake':
      if (!st.registered) throw stakeError('bad_request', 'You are not delegating');
      return { ...input, ...(st.rewards > 0n ? { withdraw: { stakingAddress, withdrawAmount: st.rewards.toString() }, ...vote() } : {}), deregisterStakingKey: { stakingAddress, undepositAmount: STAKE_KEY_DEPOSIT.toString() } };
  }
  throw stakeError('unsupported', 'This action is not available for ADA');
}
export { cardanoTipSlot };
