// Harbour-backed data for the Harbour networks, shaped like the wallet's existing types so screens don't change:
// native balances, ERC-20 holdings (shown like custom tokens), history rows (HistoryItem) and NFT collections.
// Everything is read from the backend's database (no RPC), and only public addresses are sent.
import { formatUnits } from 'viem';
import type { HistoryItem } from '../txHistory';
import type { NftCollection, NftItem } from '../nfts/types';
import type { CustomToken } from '../customTokens';
import { INDEXED_CHAINS, backendChainOf, chainIdOfBackend, evmIdOfBackend } from './config';
import { getPortfolio, getHistory, getNfts, putAddresses, listAddresses, mediaUrl, HarbourApiError, type AddressRef, type Portfolio, type HistoryRow, type NftView } from './client';

const lc = (s: string) => s.toLowerCase();
/** The Harbour refs for one EVM address: the same address on every network the backend indexes. */
export const refsFor = (evmAddress: string | undefined): AddressRef[] =>
  evmAddress && /^0x[0-9a-fA-F]{40}$/.test(evmAddress) ? INDEXED_CHAINS.map((c) => ({ chain: c.backend, address: lc(evmAddress) })) : [];

// ---------- tracking ----------
const tracked = new Set<string>();
const key = (r: AddressRef) => `${r.chain}:${r.address}`;
/** One PUT, and if the API refuses the batch because it does not serve one of the networks (a stale or smaller backend), retry network by
 *  network so the supported ones are still tracked. Returns the refs the API accepted. */
async function putResilient(add: AddressRef[], remove: AddressRef[]): Promise<AddressRef[]> {
  try { await putAddresses(add, remove); return add; } catch (e) {
    if (!(e instanceof HarbourApiError) || e.code !== 'bad_address' || add.length + remove.length < 2) throw e;
  }
  const ok: AddressRef[] = [];
  for (const r of add) { try { await putAddresses([r], []); ok.push(r); } catch (e) { if (!(e instanceof HarbourApiError) || e.code !== 'bad_address') throw e; } }
  for (const r of remove) { try { await putAddresses([], [r]); } catch (e) { if (!(e instanceof HarbourApiError) || e.code !== 'bad_address') throw e; } }
  return ok;
}
/** Makes sure the device tracks these refs (cheap no-op once known). */
export async function ensureTracked(refs: AddressRef[]): Promise<void> {
  const missing = refs.filter((r) => !tracked.has(key(r)));
  if (!missing.length) return;
  for (const r of await putResilient(missing, [])) tracked.add(key(r));
}
/** Replaces the device's tracked set with `want` (used by the background address sync). */
export async function syncTracked(want: AddressRef[]): Promise<{ added: number; removed: number }> {
  const have = (await listAddresses()).addresses.map((a) => ({ chain: a.chain, address: lc(a.address) }));
  const wantKeys = new Set(want.map(key)); const haveKeys = new Set(have.map(key));
  const add = want.filter((r) => !haveKeys.has(key(r))); const remove = have.filter((r) => !wantKeys.has(key(r)));
  const accepted = new Set<string>(have.filter((r) => wantKeys.has(key(r))).map(key));
  for (let i = 0; i < Math.max(add.length, remove.length); i += 100) for (const r of await putResilient(add.slice(i, i + 100), remove.slice(i, i + 100))) accepted.add(key(r));
  tracked.clear(); for (const r of want) if (accepted.has(key(r))) tracked.add(key(r));
  return { added: add.length, removed: remove.length };
}
/** Runs fn; if the API says an address isn't tracked yet, tracks it and retries once. */
async function withTracking<T>(refs: AddressRef[], fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (e instanceof HarbourApiError && e.code === 'not_tracked') { for (const r of refs) tracked.delete(key(r)); await ensureTracked(refs); return fn(); }
    throw e;
  }
}

// ---------- portfolio (cached briefly; realtime updates invalidate it) ----------
const PF_TTL = 5_000;
let pfCache: { k: string; at: number; p: Promise<Portfolio> } | null = null;
export const invalidatePortfolio = (): void => { pfCache = null; };
export function portfolio(evmAddress: string): Promise<Portfolio> {
  const refs = refsFor(evmAddress); const k = refs.map(key).join(',');
  if (pfCache && pfCache.k === k && Date.now() - pfCache.at < PF_TTL) return pfCache.p;
  const p = withTracking(refs, async () => { await ensureTracked(refs); return getPortfolio(refs); });
  pfCache = { k, at: Date.now(), p }; p.catch(() => { if (pfCache?.p === p) pfCache = null; });
  return p;
}

export interface NativeResult { ok: boolean; raw: string; formatted: string; synced: boolean; error?: string }
/** Native balance of a Harbour network from the portfolio. */
export async function nativeBalance(registryId: string, evmAddress: string): Promise<NativeResult> {
  const chain = backendChainOf(registryId);
  try {
    const pf = await portfolio(evmAddress);
    const a = pf.addresses.find((x) => x.chain === chain && x.address === lc(evmAddress));
    const n = a?.assets.find((h) => h.kind === 'native');
    const raw = n?.amount_raw ?? '0';
    return { ok: true, raw, formatted: formatUnits(BigInt(raw), n?.decimals ?? 18), synced: !!a?.synced };
  } catch (e) { return { ok: false, raw: '0', formatted: '0', synced: false, error: e instanceof Error ? e.message : 'Balance unavailable' }; }
}

/** Token holdings (non-spam ERC-20s found by the indexer) shaped like custom tokens. Ids start with `hb-`. */
export const hbTokenId = (evmChainId: number, address: string) => `hb-${evmChainId}-${lc(address)}`;
export interface HbTokenItem { token: CustomToken; ok: boolean; raw: string; formatted: string; price: number | null; change: number | null; usd: number | null }
export async function tokenItems(evmAddress: string): Promise<HbTokenItem[]> {
  const pf = await portfolio(evmAddress);
  const out: HbTokenItem[] = [];
  for (const a of pf.addresses) {
    const evm = evmIdOfBackend(a.chain); const reg = chainIdOfBackend(a.chain); if (!evm || !reg) continue;
    for (const h of a.assets) {
      if (h.kind !== 'token' || h.spam || h.decimals == null || h.amount_raw === '0') continue;
      const token: CustomToken = { id: hbTokenId(evm, h.asset_ref), chainId: evm, networkId: reg, address: h.asset_ref,
        name: h.name || h.symbol || 'Token', symbol: h.symbol || '???', decimals: h.decimals, manual: false, addedAt: 0 };
      out.push({ token, ok: true, raw: h.amount_raw, formatted: h.amount, price: h.price.usd, change: null, usd: h.value_usd });
    }
  }
  return out;
}
/** Finds an `hb-` token for sending (address + decimals come from the backend's asset row). */
export async function findHbToken(id: string, evmAddress: string): Promise<CustomToken | undefined> {
  if (!id.startsWith('hb-')) return undefined;
  return (await tokenItems(evmAddress).catch(() => [])).find((i) => i.token.id === id)?.token;
}

// ---------- history ----------
export function historyItems(rows: HistoryRow[], explorerTx: (registryId: string, hash: string) => string | undefined): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const r of rows) {
    const reg = chainIdOfBackend(r.chain); if (!reg) continue;
    const ts = Date.parse(r.block_time) || 0; const url = explorerTx(reg, r.tx_hash);
    // Spam airdrops never reach the feed; a zero-value native leg is only the call itself, not a transfer.
    const legs = r.transfers.filter((t) => !(t.spam && t.direction === 'in'));
    const real = legs.filter((t) => !(t.kind === 'native' && /^0*$/.test(t.amount_raw)));
    if (!real.length) {
      // Only a zero-value call (approvals, contract calls): one "Contract interaction" row, like the log scanner shows.
      if (legs.length) out.push({ id: `${r.tx_hash}:0`, hash: r.tx_hash, assetId: reg, kind: 'contract', status: 'confirmed', timestamp: ts, amount: '', symbol: 'ETH', counterparty: legs[0].counterparty, url, source: 'explorer' });
      continue;
    }
    real.forEach((t, i) => {
      const kind = t.direction === 'in' ? 'receive' : t.direction === 'self' ? 'self' : 'send';
      const isNative = t.kind === 'native'; const isNft = t.kind === 'nft' || t.kind === 'multi';
      const symbol = isNative ? 'ETH' : t.symbol || (isNft ? 'NFT' : 'Token');
      // A token whose decimals aren't known yet would show a raw integer: leave the amount blank instead.
      const amount = isNative || isNft || t.decimals != null ? t.amount : '';
      out.push({
        id: `${r.tx_hash}:${i}`, hash: r.tx_hash, assetId: reg, kind, status: 'confirmed', timestamp: ts,
        amount, symbol, counterparty: t.counterparty, url,
        ...(isNative ? {} : { token: { symbol, address: t.asset_ref, ...(t.decimals != null ? { decimals: t.decimals } : {}) } }),
        ...(t.token_id ? { tokenId: t.token_id } : {}), source: 'explorer',
      });
    });
  }
  return out;
}
export async function fetchHarbourHistory(registryId: string, evmAddress: string, explorerTx: (registryId: string, hash: string) => string | undefined, limit = 200): Promise<HistoryItem[]> {
  const chain = backendChainOf(registryId); if (!chain) return [];
  const refs = [{ chain, address: lc(evmAddress) }];
  const h = await withTracking(refs, async () => { await ensureTracked(refs); return getHistory(refs, undefined, limit); });
  return historyItems(h.items, explorerTx);
}

// ---------- NFTs ----------
export function nftCollections(list: NftView[]): NftCollection[] {
  const byId = new Map<string, NftCollection>();
  for (const n of list) {
    const reg = chainIdOfBackend(n.chain); if (!reg) continue;
    const id = `${reg}:${lc(n.contract)}`; const standard = n.standard === 'erc1155' ? 'ERC-1155' : 'ERC-721';
    let c = byId.get(id);
    if (!c) { c = { id, chainId: reg, contract: n.contract, name: n.collection || 'Collection', symbol: n.collection || '', image: '', owned: 0, standard, suspicious: n.spam, items: [] }; byId.set(id, c); }
    const image = mediaUrl(n.image_url);
    const item: NftItem = { id: n.token_id, collectionId: id, chainId: reg, contract: n.contract, name: n.name || `#${n.token_id}`, description: '',
      image, animationUrl: '', attributes: [], standard, balance: n.amount || '1', externalUrl: '', transferable: true };
    c.items.push(item); c.owned += 1; c.image ||= image;
  }
  return [...byId.values()];
}
export async function fetchHarbourNfts(evmAddress: string, registryIds: string[]): Promise<NftCollection[]> {
  const refs = refsFor(evmAddress).filter((r) => registryIds.includes(chainIdOfBackend(r.chain) ?? ''));
  if (!refs.length) return [];
  const r = await withTracking(refs, async () => { await ensureTracked(refs); return getNfts(refs); });
  return nftCollections(r.nfts);
}
