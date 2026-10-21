// Staking service: dispatches by protocol family, builds list/detail views. Pure (all I/O through `StakeEnv`).
import type { ChainInfo } from '../chains/types';
import { chainById } from '../chains/index';
import type { Fetcher } from '../chains/adapters/types';
import { stakingAsset, STAKING_ASSETS } from './registry';
import type { StakeAssetDef, StakeListItem, StakeOverview, Validator } from './types';
import { stakeError } from './types';
import { loadValidatorList } from './validators';
import { fetchCosmosOverview } from './cosmos';
import { fetchSolanaOverview } from './solana';
import { fetchLidoOverview, fetchBscOverview } from './evm';
import { fetchTronOverview } from './tron';
import { fetchTezosOverview } from './tezos';
import { fetchCardanoOverview } from './cardano';
import { fetchPolkadotOverview, poolsApi } from './polkadot';

export interface StakeEnv {
  f: Fetcher;
  /** EVM JSON-RPC urls for a chain (user override first). */
  rpcUrls: (chain: ChainInfo) => string[];
  solUrls: () => string[];
  /** Polkadot staking api (tests inject a fake). */
  dotApi?: () => Promise<any>;
}
export interface StakeDetails { overview: StakeOverview; validators: Validator[]; validatorsSource: 'network' | 'snapshot' | 'protocol'; bondDenom?: string; minJoin?: string }

export async function loadDetails(env: StakeEnv, chainId: string, address: string): Promise<StakeDetails> {
  const def = stakingAsset(chainId); const chain = chainById(chainId);
  if (!def || !chain) throw stakeError('unsupported', 'Staking is not available for this network');
  if (!address) throw stakeError('no_address', 'No address for this network');
  const meta = def.validatorsList ? await loadValidatorList(def.validatorsList, env.f) : { list: [], source: 'network' as const };
  switch (def.family) {
    case 'cosmos': { const r = await fetchCosmosOverview(chain, address, env.f, meta.list); return { ...r, validatorsSource: meta.source }; }
    case 'solana': { const r = await fetchSolanaOverview(env.solUrls(), address, env.f, meta.list); return { ...r, validatorsSource: meta.source }; }
    case 'lido': { const r = await fetchLidoOverview(env.f, env.rpcUrls(chain), address); return { ...r, validatorsSource: 'protocol' }; }
    case 'bsc': { const r = await fetchBscOverview(env.f, env.rpcUrls(chain), address, meta.list); return { ...r, validatorsSource: meta.source }; }
    case 'tron': { const r = await fetchTronOverview(chain, address, env.f, meta.list); return { ...r, validatorsSource: meta.list.length ? meta.source : 'network' }; }
    case 'tezos': { const r = await fetchTezosOverview(chain, address, env.f, meta.list); return { ...r, validatorsSource: meta.list.length ? meta.source : 'network' }; }
    case 'cardano': { const r = await fetchCardanoOverview(chain, address, env.f); return { ...r, validatorsSource: 'network' }; }
    case 'polkadot': { const r = await fetchPolkadotOverview(await (env.dotApi ?? poolsApi)(), address); return { overview: r.overview, validators: r.validators, validatorsSource: 'network', minJoin: r.minJoin.toString() }; }
  }
}

const itemName = (def: StakeAssetDef) => chainById(def.chainId)?.name ?? def.chainId;
export function toListItem(def: StakeAssetDef, o: StakeOverview): StakeListItem {
  return { chainId: def.chainId, symbol: def.symbol, name: itemName(def), apr: o.apr, staked: o.staked, rewards: o.rewards, decimals: def.decimals, protocol: def.protocol };
}
/** One row per supported asset. A failed asset keeps its row with `error` (never a fake zero). Bounded concurrency. */
export async function loadList(env: StakeEnv, addressOf: (chain: ChainInfo) => string, only?: string[], limit = 4): Promise<StakeListItem[]> {
  const defs = STAKING_ASSETS.filter((d) => !only || only.includes(d.chainId));
  const out: StakeListItem[] = new Array(defs.length); let i = 0;
  const worker = async () => {
    while (i < defs.length) {
      const idx = i++; const def = defs[idx]; const chain = chainById(def.chainId)!;
      try { out[idx] = toListItem(def, (await loadDetails(env, def.chainId, addressOf(chain))).overview); }
      catch (e: any) { out[idx] = { chainId: def.chainId, symbol: def.symbol, name: itemName(def), apr: null, staked: '0', rewards: '0', decimals: def.decimals, protocol: def.protocol, error: String(e?.message ?? 'failed').slice(0, 160) }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, defs.length) }, worker));
  return out;
}

// ---------- amounts ----------
/** "1.25" -> raw bigint at `decimals`; null when malformed / too precise / non-positive. */
export function toRaw(input: string, decimals: number): bigint | null {
  const s = String(input ?? '').trim().replace(',', '.');
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const [w, fr = ''] = s.split('.');
  if (fr.length > decimals) return null;
  const v = BigInt((w || '0') + fr.padEnd(decimals, '0'));
  return v > 0n ? v : null;
}
export { formatUnits } from '../chains/adapters/types';
