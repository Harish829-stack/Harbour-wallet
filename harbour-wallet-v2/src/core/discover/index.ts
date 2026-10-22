// dApp directory. TW's Discover/DApps tab is `FetchDappDiscovery` -> sections[{id,name,items[{id,name,description,url,image}]}] from its gateway
// (GET /v1/discover/new, /v1/discover/group/<id>; auth-gated, not used). Harbour's public equivalent is DeFiLlama's open API
// (https://api.llama.fi/protocols and /v2/chains, no key): real protocols with real websites, logos, TVL and category.
// Section mapping (deviation, see evidences/re-evidence/37-discover/SPEC.md): Popular = top TVL; Latest = newest listings; Featured = large and growing.
import { safeHttpsLink } from '../ramps/guard';
import { cleanText } from '../sentiment/index';
import { ALL_CHAINS } from '../chains/index';

export const LLAMA_PROTOCOLS = 'https://api.llama.fi/protocols';
export const LLAMA_CHAINS = 'https://api.llama.fi/v2/chains';
export const DISCOVER_TTL_MS = 6 * 3600_000;
export const MAX_DAPPS = 1200;
type F = typeof fetch;

export interface Dapp { id: string; name: string; desc: string; url: string; logo: string; category: string; categoryId: string; chains: string[]; tvl: number; change1d: number | null; change7d: number | null; listedAt: number | null; twitter: string; symbol: string }
export interface DappSection { id: 'popular' | 'latest' | 'featured'; name: string; items: Dapp[] }
export interface DappChain { name: string; tvl: number; chainId?: string }

export const DAPP_CATEGORIES: Array<{ id: string; name: string }> = [
  { id: 'exchange', name: 'Exchange' }, { id: 'lending', name: 'Lending' }, { id: 'staking', name: 'Staking' }, { id: 'yield', name: 'Yield' }, { id: 'bridge', name: 'Bridge' },
  { id: 'derivatives', name: 'Derivatives' }, { id: 'nft', name: 'NFT' }, { id: 'games', name: 'Games' }, { id: 'stablecoins', name: 'Stablecoins' }, { id: 'social', name: 'Social' }, { id: 'other', name: 'Other' },
];
const CAT_MAP: Array<[RegExp, string]> = [
  [/^(dexs?|dex aggregator|dexes|exchange)/i, 'exchange'], [/(lending|borrow|cdp)/i, 'lending'], [/(staking|restaking)/i, 'staking'], [/(yield|farm|vault|auto-?compound)/i, 'yield'],
  [/bridge/i, 'bridge'], [/(derivative|option|perp|prediction|synthetic)/i, 'derivatives'], [/nft/i, 'nft'], [/gam(e|ing)/i, 'games'], [/(stable|algo-stable)/i, 'stablecoins'], [/social/i, 'social'],
];
const EXCLUDED = /^(cex|chain)$/i;
export function categoryId(llama: unknown): string { const s = String(llama ?? ''); for (const [re, id] of CAT_MAP) if (re.test(s)) return id; return 'other'; }

const clean = (s: unknown, n: number) => cleanText(s, n);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Map DeFiLlama `/protocols` to Dapp[]: https-only websites, text sanitised, CEX/Chain entries dropped, capped by TVL. */
export function mapProtocols(body: unknown, max = MAX_DAPPS): Dapp[] {
  if (!Array.isArray(body)) return [];
  const out: Dapp[] = [];
  for (const p of body as any[]) {
    if (!p || EXCLUDED.test(String(p.category ?? ''))) continue;
    const url = safeHttpsLink(p.url); const name = clean(p.name, 60);
    const slug = typeof p.slug === 'string' && /^[a-z0-9._-]{1,80}$/i.test(p.slug) ? p.slug : '';
    if (!url || !name || !slug) continue;
    const logo = safeHttpsLink(p.logo);
    out.push({ id: slug, name, desc: clean(p.description, 280), url, logo, category: clean(p.category, 40) || 'Other', categoryId: categoryId(p.category),
      chains: (Array.isArray(p.chains) ? p.chains : []).filter((c: unknown) => typeof c === 'string').map((c: string) => clean(c, 30)).filter(Boolean).slice(0, 40),
      tvl: typeof p.tvl === 'number' && Number.isFinite(p.tvl) && p.tvl > 0 ? p.tvl : 0, change1d: numOrNull(p.change_1d), change7d: numOrNull(p.change_7d),
      listedAt: typeof p.listedAt === 'number' && p.listedAt > 0 ? p.listedAt : null, twitter: typeof p.twitter === 'string' && /^[A-Za-z0-9_]{1,15}$/.test(p.twitter) ? p.twitter : '', symbol: clean(p.symbol, 12) });
  }
  out.sort((a, b) => b.tvl - a.tvl);
  const keep = out.slice(0, max);
  const kept = new Set(keep.map((d) => d.id));
  // recent listings are kept even when their TVL is still tiny, otherwise "Latest" would be empty
  const recent = out.filter((d) => !kept.has(d.id) && d.listedAt).sort((a, b) => (b.listedAt as number) - (a.listedAt as number)).slice(0, 100);
  return [...keep, ...recent];
}
export function mapChains(body: unknown, max = 80): DappChain[] {
  if (!Array.isArray(body)) return [];
  const rows = (body as any[]).filter((c) => c && typeof c.name === 'string' && typeof c.tvl === 'number').map((c) => ({ name: clean(c.name, 30), tvl: c.tvl as number }));
  rows.sort((a, b) => b.tvl - a.tvl);
  return rows.slice(0, max).map((c) => ({ ...c, chainId: harbourChainFor(c.name) }));
}

const LLAMA_ALIAS: Record<string, string> = { smartchain: 'Binance', avalanchec: 'Avalanche', polygon: 'Polygon', xdai: 'xDai', bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana', tron: 'Tron', arbitrum: 'Arbitrum', optimism: 'Optimism', base: 'Base', ton: 'TON', sui: 'Sui', aptos: 'Aptos', cronos: 'Cronos', fantom: 'Fantom', mantle: 'Mantle', linea: 'Linea', blast: 'Blast', scroll: 'Scroll', zksync: 'zkSync Era', celo: 'Celo', kcc: 'KCC', metis: 'Metis', moonbeam: 'Moonbeam', ronin: 'Ronin', sei: 'Sei', near: 'Near', tezos: 'Tezos', algorand: 'Algorand', ripple: 'XRPL', stellar: 'Stellar', cosmos: 'Cosmos', osmosis: 'Osmosis', hyperevm: 'Hyperliquid L1', sonic: 'Sonic', opbnb: 'OP_BNB', polkadot: 'Polkadot', kava: 'Kava', klaytn: 'Klaytn', aurora: 'Aurora' };
/** Name DeFiLlama uses for a Harbour chain (alias table, else the registry name). */
export const llamaChainName = (chainId: string): string | undefined => LLAMA_ALIAS[chainId] ?? ALL_CHAINS.find((c) => c.id === chainId)?.name;
export function harbourChainFor(llamaName: string): string | undefined {
  const l = llamaName.toLowerCase();
  for (const [id, n] of Object.entries(LLAMA_ALIAS)) if (n.toLowerCase() === l) return id;
  return ALL_CHAINS.find((c) => c.name.toLowerCase() === l)?.id;
}

export function buildSections(items: Dapp[], now = Date.now() / 1000): DappSection[] {
  const popular = items.filter((d) => d.tvl > 0).slice(0, 20);
  const pop = new Set(popular.slice(0, 10).map((d) => d.id));
  const latest = items.filter((d) => d.listedAt && d.listedAt <= now + 86400 && d.tvl >= 100_000).sort((a, b) => (b.listedAt as number) - (a.listedAt as number)).slice(0, 20);
  const featured = items.filter((d) => d.tvl >= 25_000_000 && (d.change7d ?? 0) > 0 && !pop.has(d.id)).slice(0, 10);
  return ([{ id: 'popular', name: 'Popular', items: popular }, { id: 'latest', name: 'Latest', items: latest }, { id: 'featured', name: 'Featured', items: featured }] as DappSection[]).filter((s) => s.items.length);
}
export interface DappFilter { query?: string; categoryId?: string; chain?: string }
export function filterDapps(items: Dapp[], f: DappFilter): Dapp[] {
  const q = (f.query ?? '').trim().toLowerCase(); const chain = f.chain?.toLowerCase();
  let r = items.filter((d) => (!f.categoryId || f.categoryId === 'all' || d.categoryId === f.categoryId) && (!chain || d.chains.some((c) => c.toLowerCase() === chain)));
  if (q) {
    const rank = (d: Dapp) => (d.name.toLowerCase() === q ? 0 : d.name.toLowerCase().startsWith(q) ? 1 : d.name.toLowerCase().includes(q) ? 2 : d.symbol.toLowerCase() === q ? 3 : d.category.toLowerCase().includes(q) ? 4 : d.desc.toLowerCase().includes(q) ? 5 : 9);
    r = r.filter((d) => rank(d) < 9).sort((a, b) => rank(a) - rank(b) || b.tvl - a.tvl);
  }
  return r;
}

export interface DappCache { at: number; items: Dapp[]; chains: DappChain[] }
export interface KV { get(): Promise<DappCache | undefined>; set(v: DappCache): Promise<void> }
export type DappLoad = { ok: true; items: Dapp[]; chains: DappChain[]; at: number; stale: boolean } | { ok: false; error: string };
const validCache = (c: any): c is DappCache => c && typeof c.at === 'number' && Array.isArray(c.items) && Array.isArray(c.chains);

/** Cache-first loader with TTL. On network failure a stale cache is still served (flagged `stale`), otherwise an error. */
export async function loadDapps(kv: KV, f: F, now = Date.now(), force = false): Promise<DappLoad> {
  const cached = await kv.get().catch(() => undefined);
  const fresh = validCache(cached) && now - cached.at < DISCOVER_TTL_MS;
  if (fresh && !force) return { ok: true, items: cached.items, chains: cached.chains, at: cached.at, stale: false };
  try {
    const get = async (u: string) => { const r = await f(u, { signal: AbortSignal.timeout(20_000), headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
    const [p, c] = await Promise.all([get(LLAMA_PROTOCOLS), get(LLAMA_CHAINS).catch(() => [])]);
    const items = mapProtocols(p);
    if (!items.length) throw new Error('empty directory');
    const v: DappCache = { at: now, items, chains: mapChains(c) };
    await kv.set(v).catch(() => {});
    return { ok: true, items: v.items, chains: v.chains, at: v.at, stale: false };
  } catch (e: any) {
    if (validCache(cached)) return { ok: true, items: cached.items, chains: cached.chains, at: cached.at, stale: true };
    return { ok: false, error: String(e?.message ?? 'DApps are unavailable right now').slice(0, 120) };
  }
}
