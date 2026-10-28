import type { SwapQuoteResult, SwapRoute, SwapRouteRequest } from './types';
import { domainById } from './domains';
import { lifiRoutes } from './lifi';
import { jupiterRoutes } from './jupiter';
import { relayRoutes, relaySupports } from './relay';
import { thorchainRoutes, thorSupports } from './thorchain';
import type { SwapError, SwapSource } from './types';
import { swapError } from './errors';
import { QUOTE_REFRESH_SECONDS } from './rules';

// Route discovery = TW AmberRpcClient.getRoutes (POST /v1/route) backed by public aggregators.
// Solana->Solana goes to Jupiter; everything else (EVM same-chain, bridges, EVM<->Solana) to LI.FI.
export function validateRouteRequest(r: SwapRouteRequest) {
  const fd = domainById(r.from.domainId); const td = domainById(r.to.domainId);
  if (!fd || !td) throw swapError('unsupported_domain');
  if (r.from.assetId === r.to.assetId) throw swapError('unsupported_pair');
  let amt = 0n; try { amt = BigInt(r.amount); } catch { /* invalid */ }
  if (amt <= 0n) throw swapError('invalid_amount');
  const s = Number(r.slippage);
  if (!(s > 0 && s <= 30)) throw swapError('invalid_slippage');
  if (!r.fromAddress || !r.toAddress) throw swapError('invalid_asset');
}

export function sortRoutes(routes: SwapRoute[], sortBy: SwapRouteRequest['sortBy']): SwapRoute[] {
  const out = [...routes];
  const outAmt = (r: SwapRoute) => BigInt(r.steps[r.steps.length - 1].to.amount);
  if (sortBy === 'quantity') out.sort((a, b) => (outAmt(b) > outAmt(a) ? 1 : outAmt(b) < outAmt(a) ? -1 : 0));
  if (sortBy === 'latency') out.sort((a, b) => (a.totalSeconds ?? 1e9) - (b.totalSeconds ?? 1e9));
  return out; // 'security' / 'outcome' keep the aggregator's SAFEST / RECOMMENDED ordering
}

/** Providers that can quote this pair (TW races its aggregator's providers; Harbour races public ones). */
export function eligibleProviders(req: Pick<SwapRouteRequest, 'from' | 'to'>): SwapSource[] {
  const fk = domainById(req.from.domainId)!.kind; const tk = domainById(req.to.domainId)!.kind;
  const out: SwapSource[] = [];
  if (fk === 'solana' && tk === 'solana') out.push('jupiter');
  else if (fk !== 'utxo' && tk !== 'utxo') out.push('lifi');
  if (relaySupports(req)) out.push('relay');
  if (thorSupports(req)) out.push('thorchain');
  return out;
}
const PROVIDER_TIMEOUT_MS = 12_000;
const RUNNERS: Record<SwapSource, (req: SwapRouteRequest, f: typeof fetch) => Promise<SwapRoute[]>> = {
  lifi: lifiRoutes, jupiter: jupiterRoutes, relay: relayRoutes, thorchain: thorchainRoutes,
};
// Error precedence when every provider fails: a user-fixable error (amount/pair) beats an infrastructure one.
const ERROR_RANK = ['amount_too_low', 'amount_too_high', 'invalid_amount', 'unsupported_pair', 'no_liquidity', 'server', 'timeout', 'network'];
const rank = (e: SwapError) => { const i = ERROR_RANK.indexOf(e.code); return i < 0 ? ERROR_RANK.length : i; };

/** Quote racing: every eligible provider in parallel, each capped at 12 s; failures are dropped while any provider answers. */
export async function getSwapRoutes(req: SwapRouteRequest, f: typeof fetch = fetch): Promise<SwapQuoteResult> {
  validateRouteRequest(req);
  const providers = eligibleProviders(req);
  if (!providers.length) throw swapError('unsupported_pair');
  const capped = <T,>(p: Promise<T>) => new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(swapError('timeout')), PROVIDER_TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
  const settled = await Promise.allSettled(providers.map((p) => capped(RUNNERS[p](req, f))));
  const routes = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (!routes.length) {
    const errs = settled.map((r) => (r.status === 'rejected' ? r.reason : null)).filter((e): e is SwapError => !!e?.code);
    throw errs.sort((a, b) => rank(a) - rank(b))[0] ?? swapError('no_liquidity');
  }
  const sorted = sortRoutes(routes, req.sortBy);
  // TW's provider list marks the best-output quote; aggregator tags (RECOMMENDED, CHEAPEST...) are kept.
  const outAmt = (r: SwapRoute) => BigInt(r.steps[r.steps.length - 1].to.amount);
  const best = routes.reduce((a, b) => (outAmt(b) > outAmt(a) ? b : a));
  if (!best.tags.includes('BEST_RETURN')) best.tags = [...best.tags, 'BEST_RETURN'];
  return { routes: sorted, refreshInterval: QUOTE_REFRESH_SECONDS, priceImpactMediumLevel: 0, priceImpactHighLevel: 0 };
}
