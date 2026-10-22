// Public entry point of the activity engine: one fetch per network that merges my own broadcasts, the on-chain log scan and the
// public explorer into a single typed feed. Non-EVM networks keep using their explorer adapters unchanged.
import type { ChainInfo } from '../chains/types';
import { chainById, chainByEvmId } from '../chains/index';
import { customNetwork, customExplorer } from '../networkRegistry';
import { rpcUrlList } from '../rpc';
import { fetchHistory, historySupportedFor, explorerTxFor, type HistoryItem } from '../txHistory';
import { createActivityEngine, type Store, type ActivityEngine } from './engine';
import { makeRpc } from './evm';
import { mergeSources } from './merge';

const CUSTOM = /^custom-(\d+)$/;
/** The EVM chain behind a network id (registry chain or user-added custom network), or null for non-EVM networks. */
export function evmOf(assetId: string): { chainId: number; symbol: string } | null {
  const c = chainById(assetId); if (c) return c.kind === 'evm' && c.evmChainId != null ? { chainId: c.evmChainId, symbol: c.symbol } : null;
  const m = CUSTOM.exec(assetId); const n = m ? customNetwork(Number(m[1])) : undefined;
  return n ? { chainId: n.chainId, symbol: n.symbol } : null;
}
/** Activity is available on every EVM network (log scan needs only the RPC) and on every network with an explorer adapter. */
export const activitySupported = (assetId: string): boolean => !!evmOf(assetId) || historySupportedFor(chainById(assetId));
export const activityUnsupportedReason = 'No public history source for this network yet.';

const idOfChain = (chainId: number): string | undefined => chainByEvmId(chainId)?.id ?? (customNetwork(chainId) ? `custom-${chainId}` : undefined);
const explorerUrl = (assetId: string, hash: string): string | undefined => {
  const m = CUSTOM.exec(assetId); if (m) { const base = customExplorer(Number(m[1])); return base ? `${base.replace(/\/+$/, '')}/tx/${hash}` : undefined; }
  return explorerTxFor(assetId, hash);
};

let engine: ActivityEngine | null = null;
/** Runtime wiring (real storage, RPC list, clock); called once by the service worker. Importing this module has no side effects. */
export function startActivityEngine(store: Store, onPending?: (has: boolean) => void): ActivityEngine {
  engine ??= createActivityEngine({
    store, now: () => Date.now(), onPending,
    rpcFor: (chainId) => makeRpc(rpcUrlList(chainId)),
    chainIdOf: (id) => evmOf(id)?.chainId, assetIdOf: idOfChain,
    nativeSymbol: (id) => evmOf(id)?.symbol ?? '', explorerTx: explorerUrl,
  });
  return engine;
}
export const currentActivityEngine = (): ActivityEngine | null => engine;

type F = typeof fetch;
export async function fetchActivity(chainOrId: ChainInfo | string, address: string, opts?: { solanaRpc?: string } | null, f: F = fetch, eng: ActivityEngine | null = engine): Promise<{ ok: true; items: HistoryItem[] } | { ok: false; error: string; unsupported?: boolean }> {
  const id = typeof chainOrId === 'string' ? chainOrId : chainOrId.id;
  if (!address) return { ok: false, error: 'No address for this network.' };
  if (!evmOf(id)) return fetchHistory(chainOrId, address, opts, f);   // non-EVM: explorer adapter exactly as before
  const chain = typeof chainOrId === 'string' ? chainById(chainOrId) : chainOrId;
  const [ex, own] = await Promise.allSettled([chain && historySupportedFor(chain) ? fetchHistory(chain, address, opts, f) : Promise.resolve(null), eng ? eng.read(id, address) : Promise.reject(new Error('activity engine not started'))]);
  const explorerRows = ex.status === 'fulfilled' && ex.value?.ok ? ex.value.items : []; const explorerOk = ex.status === 'fulfilled' && ex.value?.ok === true;
  const mine = own.status === 'fulfilled' ? own.value : null;
  const have = (mine?.local.length ?? 0) + (mine?.logs.length ?? 0) > 0;
  // Fail only when nothing at all could be produced: no explorer rows, no stored/scanned rows, and no source reported success.
  if (!explorerOk && !have && (!mine || mine.error)) return { ok: false, error: 'Could not load history right now.' };
  const items = mergeSources(mine?.local ?? [], mine?.logs ?? [], explorerRows).sort((a, b) => (b.status === 'pending' && !b.timestamp ? Number.MAX_SAFE_INTEGER : b.timestamp) - (a.status === 'pending' && !a.timestamp ? Number.MAX_SAFE_INTEGER : a.timestamp));
  return { ok: true, items: items.slice(0, 100) };
}
