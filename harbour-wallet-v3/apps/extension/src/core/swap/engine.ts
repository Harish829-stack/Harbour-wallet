import type { SwapQuoteResult, SwapRoute, SwapRouteRequest, SwapSource } from './types';
import { domainById } from './domains';
import { swapError } from './errors';
import { backendQuotes } from './backend';

// Route discovery = TW AmberRpcClient.getRoutes (POST /v1/route). Harbour's backend swap service asks the providers
// (LI.FI, Relay, Jupiter, THORChain) through their official APIs; this file validates the request and orders the answers.
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
  return out; // 'security' / 'outcome' keep the providers' SAFEST / RECOMMENDED ordering
}

/** Quotes for a request (optionally from some providers only, e.g. re-quoting the confirmed provider). */
export async function getSwapRoutes(req: SwapRouteRequest, providers?: SwapSource[]): Promise<SwapQuoteResult> {
  validateRouteRequest(req);
  const result = await backendQuotes(req, providers);
  const sorted = sortRoutes(result.routes, req.sortBy);
  // TW's provider list marks the best-output quote; provider tags (RECOMMENDED, CHEAPEST...) are kept.
  const outAmt = (r: SwapRoute) => BigInt(r.steps[r.steps.length - 1].to.amount);
  const best = sorted.reduce((a, b) => (outAmt(b) > outAmt(a) ? b : a));
  if (!best.tags.includes('BEST_RETURN')) best.tags = [...best.tags, 'BEST_RETURN'];
  return { ...result, routes: sorted };
}
