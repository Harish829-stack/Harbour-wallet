// "Deposit from exchange" (TW /fund/cex/*). TW asks its gateway for a Coinbase-Pay / Binance-Pay deep link per (provider, asset, wallet address)
// (`FETCH_CEX_FUNDING_LINK`; asset lists from GET /v1/cex-transfer/providers/{coinbase-pay|binance-pay}/assets). Both are TW-private, so Harbour
// builds the equivalent from public data: the exchange's public currency/network list + the user's own deposit address (QR + copy +
// network warnings) + a link to the exchange's withdrawal page. No partner key is needed.
import type { Fetcher } from './types';
import { ALL_CHAINS, chainById } from '../chains/index';
import { safeHttpsLink } from './guard';

export type CexProviderId = 'binance-pay' | 'coinbase-pay';
export const CEX_PROVIDERS: Array<{ id: CexProviderId; name: string; needsPlatform: boolean }> = [
  { id: 'binance-pay', name: 'Binance', needsPlatform: true }, // TW fundingProviders chunk: only binance-pay goes through /platform
  { id: 'coinbase-pay', name: 'Coinbase', needsPlatform: false },
];
export const cexProvider = (id: unknown) => CEX_PROVIDERS.find((p) => p.id === id);

export interface CexAsset { key: string; symbol: string; name: string; chainId: string; chainName: string; networkLabel: string; isNative: boolean; contract?: string; minWithdrawal?: string; requiresMemoOnExchange?: boolean }
export interface CexAssets { assets: CexAsset[]; source: 'coinbase-exchange-api' | 'binance-public-bapi' | 'registry'; note?: string }

const CB_NET: Record<string, string> = { ethereum: 'ethereum', base: 'base', polygon: 'polygon', arbitrum: 'arbitrum', optimism: 'optimism', avacchain: 'avalanchec', 'avalanche-c-chain': 'avalanchec', solana: 'solana', bitcoin: 'bitcoin', tron: 'tron', bsc: 'smartchain' };
const BN_NET: Record<string, string> = { ETH: 'ethereum', BSC: 'smartchain', MATIC: 'polygon', POLYGON: 'polygon', ARBITRUM: 'arbitrum', OPTIMISM: 'optimism', BASE: 'base', AVAXC: 'avalanchec', SOL: 'solana', BTC: 'bitcoin', TRX: 'tron', TON: 'ton' };
const sym = (s: unknown) => (typeof s === 'string' && /^[A-Za-z0-9]{1,12}$/.test(s) ? s.toUpperCase() : '');
const text = (s: unknown, n = 60) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '');

function mk(symbol: string, name: string, chainId: string, label: string, extra: Partial<CexAsset> = {}): CexAsset | null {
  const c = chainById(chainId); if (!c || c.testnet || !symbol) return null;
  const isNative = symbol === c.symbol || (c.id === 'polygon' && symbol === 'MATIC');
  return { key: `${chainId}:${symbol}`, symbol, name: name || symbol, chainId, chainName: c.name, networkLabel: label || c.name, isNative, ...extra };
}
const dedupe = (a: CexAsset[]) => { const m = new Map<string, CexAsset>(); for (const x of a) if (!m.has(x.key)) m.set(x.key, x); return [...m.values()]; };

/** Coinbase Exchange public `GET https://api.exchange.coinbase.com/currencies` (official docs: `supported_networks[]`). */
export function parseCoinbaseCurrencies(body: unknown): CexAsset[] {
  const out: CexAsset[] = [];
  if (!Array.isArray(body)) return out;
  for (const c of body as any[]) {
    const symbol = sym(c?.id); if (!symbol || c?.details?.type === 'fiat' || (c?.status && c.status !== 'online')) continue;
    for (const n of Array.isArray(c?.supported_networks) ? c.supported_networks : []) {
      if (n?.status && n.status !== 'online') continue;
      const chainId = CB_NET[String(n?.id ?? '').toLowerCase()]; if (!chainId) continue;
      const a = mk(symbol, text(c?.name), chainId, text(n?.name), { contract: /^0x[0-9a-fA-F]{40}$/.test(n?.contract_address ?? '') ? n.contract_address : undefined, minWithdrawal: text(String(n?.min_withdrawal_amount ?? ''), 20) || undefined });
      if (a) out.push(a);
    }
  }
  return dedupe(out);
}
/** Binance public (unofficial, [guessing]) `capital/getNetworkCoinAll` list: {data:[{coin,name,networkList:[{network,name,withdrawEnable,withdrawMin,memoRegex}]}]}. */
export function parseBinanceNetworks(body: any): CexAsset[] {
  const out: CexAsset[] = []; const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  for (const c of list) {
    const symbol = sym(c?.coin); if (!symbol) continue;
    for (const n of Array.isArray(c?.networkList) ? c.networkList : []) {
      if (n?.withdrawEnable === false) continue;
      const chainId = BN_NET[String(n?.network ?? '').toUpperCase()]; if (!chainId) continue;
      const a = mk(symbol, text(c?.name), chainId, text(n?.name), { minWithdrawal: text(String(n?.withdrawMin ?? ''), 20) || undefined });
      if (a) out.push(a);
    }
  }
  return dedupe(out);
}
/** Registry-derived fallback: native coins of Harbour chains + USDT/USDC on EVM/Solana/Tron. Explicitly limited (not exchange-confirmed). */
export function registryCexAssets(): CexAsset[] {
  const out: CexAsset[] = [];
  for (const c of ALL_CHAINS) { const a = mk(c.symbol, c.name, c.id, c.name); if (a) out.push(a); }
  for (const s of ['USDT', 'USDC']) for (const id of ['ethereum', 'smartchain', 'polygon', 'arbitrum', 'optimism', 'base', 'avalanchec', 'solana', 'tron']) { const a = mk(s, s === 'USDT' ? 'Tether' : 'USD Coin', id, chainById(id)?.name ?? ''); if (a) out.push(a); }
  return dedupe(out);
}
const sortAssets = (a: CexAsset[]) => a.sort((x, y) => Number(y.isNative) - Number(x.isNative) || x.symbol.localeCompare(y.symbol) || x.chainName.localeCompare(y.chainName));

export async function fetchCexAssets(id: CexProviderId, f: Fetcher): Promise<CexAssets> {
  const url = id === 'coinbase-pay' ? 'https://api.exchange.coinbase.com/currencies' : 'https://www.binance.com/bapi/capital/v1/public/capital/getNetworkCoinAll';
  try {
    const res = await f(url, { signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const assets = sortAssets(id === 'coinbase-pay' ? parseCoinbaseCurrencies(body) : parseBinanceNetworks(body));
    if (assets.length) return { assets, source: id === 'coinbase-pay' ? 'coinbase-exchange-api' : 'binance-public-bapi' };
    throw new Error('empty list');
  } catch (e: any) {
    return { assets: sortAssets(registryCexAssets()), source: 'registry', note: `Could not load ${id === 'coinbase-pay' ? 'Coinbase' : 'Binance'}'s asset list (${String(e?.message ?? 'offline').slice(0, 80)}). Showing Harbour's own list: the exchange may not support every asset or network shown. Check the network on the exchange's withdrawal form.` };
  }
}

const NO_TAG_KINDS = new Set(['ripple', 'stellar', 'ton', 'cosmos', 'algorand', 'near', 'icp', 'fio', 'tezos', 'hedera']);
const ACTIVATION_KINDS = new Set(['ripple', 'stellar', 'algorand', 'tezos', 'solana', 'ton']);
export interface CexDeposit { warnings: string[]; exchangeUrl: string; qrData: string }
export function cexDepositInfo(provider: CexProviderId, asset: CexAsset, address: string): CexDeposit {
  const c = chainById(asset.chainId);
  const w = [`Send only ${asset.symbol} on ${asset.chainName} to this address. Anything else, or the wrong network, can be lost permanently.`,
    `On ${provider === 'binance-pay' ? 'Binance' : 'Coinbase'}, choose the network "${asset.networkLabel}" in the withdrawal form. Selecting a different network sends funds to a place you may not be able to recover them from.`];
  if (c && NO_TAG_KINDS.has(c.kind)) w.push('If the exchange asks for a memo, tag or comment, leave it empty: a Harbour address does not use one.');
  if (c && ACTIVATION_KINDS.has(c.kind)) w.push(`${c.name} accounts may need a minimum first deposit to be activated; a very small first transfer can fail.`);
  if (asset.minWithdrawal) w.push(`The exchange's minimum withdrawal for this network is ${asset.minWithdrawal} ${asset.symbol}.`);
  if (!asset.isNative) w.push('Token transfers require some of the network’s native coin in this wallet before you can move or swap the tokens.');
  const exchangeUrl = provider === 'binance-pay' ? safeHttpsLink(`https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/${asset.symbol}`) : safeHttpsLink('https://www.coinbase.com/');
  return { warnings: w, exchangeUrl, qrData: address };
}
