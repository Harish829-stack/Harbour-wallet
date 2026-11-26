// Client for the Harbour swap service (backend /v1/swap). The backend talks to the swap providers through their official
// APIs (LI.FI, Relay, Jupiter, THORChain) and holds their keys; this file only sends requests and screens the answers.
//
// Trust model: the backend is NOT trusted to vouch for a transaction. A route is kept only when it trades exactly the
// requested assets and amount with a minimum that honours the user's slippage, the assets shown are the user's own objects,
// and before signing every transaction is re-checked against the confirmed route (safety.ts, relay.ts, thorchain.ts) and
// simulated (simGuard.ts). The background registers the signed request function (core/harbour/client.ts) at start-up.
import type { SwapAsset, SwapError, SwapErrorCode, SwapQuoteResult, SwapRoute, SwapRouteRequest, SwapSource } from './types';
import { swapError, SWAP_MESSAGES } from './errors';
import { QUOTE_REFRESH_SECONDS } from './rules';
import { tokenLogoPath } from '../assetLogos';
import { assetId, logoFor } from './tokens';
import { domainById } from './domains';

export type SwapBackendSend = (method: 'GET' | 'POST', path: string, body?: unknown) => Promise<Response>;
let send: SwapBackendSend = async () => { throw swapError('network'); };
/** Called once by the service worker with the signed-request function (tests pass a fake). */
export const setSwapBackend = (f: SwapBackendSend): void => { send = f; };

const SOURCES: ReadonlySet<SwapSource> = new Set(['lifi', 'relay', 'jupiter', 'thorchain']);
const INT = /^\d{1,78}$/;

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try { res = await send(method, path, body); }
  catch (e: any) { throw e?.code && SWAP_MESSAGES[e.code as SwapErrorCode] ? e : e?.name === 'TimeoutError' ? swapError('timeout') : swapError('network'); }
  let j: any = null; try { j = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) {
    const code = String(j?.error?.code ?? '');
    const min = typeof j?.error?.minAmount === 'string' && INT.test(j.error.minAmount) ? { minAmount: j.error.minAmount } : undefined;
    if (code in SWAP_MESSAGES) throw swapError(code as SwapErrorCode, min);
    throw swapError(res.status === 504 ? 'timeout' : res.status >= 500 ? 'server' : 'network');
  }
  return j as T;
}

const sameAsset = (a: any, b: SwapAsset) => a?.domainId === b.domainId && (b.address === 'native' ? a?.address === 'native' : String(a?.address ?? '').toLowerCase() === b.address.toLowerCase());
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, max) : '');

/**
 * Accept one route from the backend, or null. It must sell exactly `req.amount` of `req.from` and buy `req.to`, in one
 * step, with integer amounts and a minimum that is not looser than the user's slippage (0.1% rounding tolerance).
 */
export function acceptRoute(r: any, req: SwapRouteRequest, now = Date.now()): SwapRoute | null {
  if (!r || typeof r !== 'object' || !SOURCES.has(r.source) || !Array.isArray(r.steps) || r.steps.length !== 1) return null;
  const st = r.steps[0];
  if (!st || st.fromDomainId !== req.from.domainId || st.toDomainId !== req.to.domainId) return null;
  if (!sameAsset(st.from?.asset, req.from) || !sameAsset(st.to?.asset, req.to) || st.from?.amount !== req.amount) return null;
  // LI.FI routes Harbour can verify end to end are EVM → EVM only (Solana-source and non-EVM-destination legs: audit H1/H2).
  if (r.source === 'lifi' && (domainById(req.from.domainId)?.kind !== 'evm' || domainById(req.to.domainId)?.kind !== 'evm')) return null;
  // Relay: EVM source only (the backend never offers others; cross-chain orders are verified before signing).
  if (r.source === 'relay' && domainById(req.from.domainId)?.kind !== 'evm') return null;
  if (!INT.test(st.to?.amount ?? '') || !INT.test(st.to?.minAmount ?? '')) return null;
  const out = BigInt(st.to.amount); const min = BigInt(st.to.minAmount);
  const bps = BigInt(Math.round(Number(req.slippage) * 100));
  // 0.1% rounding tolerance (out * 10 on the x10_000 scale): live LI.FI bridges (Layerswap) quote minimums a hair under 1%.
  if (out <= 0n || min <= 0n || min > out || min * 10_000n < out * (10_000n - bps) - out * 10n) return null;
  if (st.approval != null) {
    const a = st.approval;
    if (req.from.address === 'native' || typeof a.spender !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(a.spender) || String(a.tokenAddress).toLowerCase() !== req.from.address.toLowerCase() || a.minAmount !== req.amount) return null;
    st.approval = { tokenAddress: req.from.address, spender: a.spender, minAmount: req.amount };
  }
  // Show the user's own asset objects (names, logos), never the server's.
  st.from = { asset: req.from, amount: req.amount };
  st.to = { asset: req.to, amount: st.to.amount, minAmount: st.to.minAmount };
  st.slippage = { userSelected: Number(req.slippage) };   // the user's own setting; later checks rely on it
  const pid = text(st.provider?.id, 40) || r.source;
  // Bundled logos only: a provider-supplied URL would make the popup fetch from any host and leak the user's IP to it.
  const logo = r.source === 'thorchain' ? '/chains/thorchain.png' : r.source === 'jupiter' ? tokenLogoPath('solana', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN') : undefined;
  st.provider = { id: pid, name: text(st.provider?.name, 40) || pid, logoUrl: logo };
  st.providerFees = Array.isArray(st.providerFees) ? st.providerFees.filter((f: any) => INT.test(f?.amount ?? '')).slice(0, 6) : [];
  if (st.networkFee && !INT.test(st.networkFee.amount ?? '')) delete st.networkFee;
  return {
    ...r, steps: [st],
    // expiry on our own clock: the backend's clock may differ
    expiresAt: now + Math.min(QUOTE_REFRESH_SECONDS, r.source === 'relay' ? 30 : QUOTE_REFRESH_SECONDS) * 1000,
    quoteRef: typeof r.quoteRef === 'string' && /^[0-9a-f]{48}$/.test(r.quoteRef) ? r.quoteRef : undefined,
    tags: Array.isArray(r.tags) ? r.tags.filter((t: unknown) => typeof t === 'string').map((t: string) => text(t, 24)).slice(0, 6) : [],
    warnings: Array.isArray(r.warnings) ? r.warnings.slice(0, 4).map((w: any) => ({ code: text(w?.code, 24), message: text(w?.message, 200) })) : [],
  };
}

/** Quotes from every provider the backend has on. Throws a SwapError when none answered. */
export async function backendQuotes(req: SwapRouteRequest, providers?: SwapSource[]): Promise<SwapQuoteResult> {
  const body = { from: req.from, to: req.to, fromAddress: req.fromAddress, toAddress: req.toAddress, amount: req.amount, slippage: req.slippage, sortBy: req.sortBy, solanaTurbo: !!req.solanaTurbo, ...(providers ? { providers } : {}) };
  const res: any = await call('POST', '/v1/swap/quotes', stripAssets(body));
  const routes = (Array.isArray(res?.routes) ? res.routes : []).map((r: any) => acceptRoute(r, req)).filter(Boolean) as SwapRoute[];
  if (!routes.length) throw swapError('no_liquidity');
  return { routes, refreshInterval: QUOTE_REFRESH_SECONDS, priceImpactMediumLevel: 0, priceImpactHighLevel: 0 };
}

// The backend accepts only the asset fields it needs.
function stripAssets<T extends { from: SwapAsset; to: SwapAsset }>(b: T): T {
  const pick = (a: SwapAsset) => ({ assetId: a.assetId, domainId: a.domainId, address: a.address, symbol: a.symbol, name: (a.name ?? a.symbol).slice(0, 64), decimals: a.decimals });
  return { ...b, from: pick(b.from), to: pick(b.to) } as T;
}

export type TxSource = { source: 'lifi'; ref: string } | { source: 'relay' | 'thorchain'; request: SwapRouteRequest } | { source: 'jupiter'; ref: string; priority: 'fast' | 'turbo'; user: string };
/** The provider's own fresh answer for a confirmed route (checked by the caller before anything is signed). */
export async function backendTransaction(t: TxSource): Promise<any> {
  if ('ref' in t && !t.ref) throw swapError('quote_expired');   // routes without a server ref cannot be sent: quote again
  const body: any = { ...t };
  if ('request' in t) body.request = stripAssets({ ...t.request, sortBy: t.request.sortBy ?? 'quantity', solanaTurbo: !!t.request.solanaTurbo });
  return call('POST', '/v1/swap/transaction', body);
}

export type SettleStatus = { status: 'pending' | 'success' | 'failed' | 'refunded'; detail?: string; receivingTxHash?: string };
export async function backendStatus(q: { source: SwapSource; txHash: string; requestId?: string; fromDomainId: string; toDomainId: string; bridge?: string }): Promise<SettleStatus> {
  const r: any = await call('POST', '/v1/swap/status', q);
  const s = ['pending', 'success', 'failed', 'refunded'].includes(r?.status) ? r.status : 'pending';
  return { status: s, detail: text(r?.detail, 64) || undefined, receivingTxHash: typeof r?.receivingTxHash === 'string' ? r.receivingTxHash : undefined };
}

/** Token lookup by address or symbol on one network. Null when not found or invalid. */
export async function backendToken(domainId: string, query: string): Promise<SwapAsset | null> {
  const d = domainById(domainId); if (!d || d.kind === 'utxo') return null;
  try {
    const t: any = await call('GET', `/v1/swap/token?${new URLSearchParams({ domain: domainId, q: query })}`);
    const address = t?.address === 'native' ? 'native' : String(t?.address ?? '');
    if (t?.domainId !== domainId || !address || typeof t?.symbol !== 'string' || !Number.isInteger(t?.decimals)) return null;
    if (address !== 'native' && !(d.kind === 'evm' ? /^0x[0-9a-fA-F]{40}$/ : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/).test(address)) return null;
    const price = Number(t.priceUsd);
    return { assetId: assetId(domainId, address), domainId, address, symbol: text(t.symbol, 16), name: text(t.name, 64) || text(t.symbol, 16), decimals: t.decimals, logoUrl: logoFor(domainId, address), priceUsd: Number.isFinite(price) && price > 0 ? price : undefined };
  } catch { return null; }
}

export type { SwapError };
