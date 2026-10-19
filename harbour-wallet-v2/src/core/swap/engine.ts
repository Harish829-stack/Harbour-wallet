import type { SwapQuoteResult, SwapRoute, SwapRouteRequest } from './types';
import { domainById } from './domains';
import { lifiRoutes } from './lifi';
import { jupiterRoutes } from './jupiter';
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

export async function getSwapRoutes(req: SwapRouteRequest, f: typeof fetch = fetch): Promise<SwapQuoteResult> {
  validateRouteRequest(req);
  const bothSol = domainById(req.from.domainId)!.kind === 'solana' && domainById(req.to.domainId)!.kind === 'solana';
  const routes = bothSol ? await jupiterRoutes(req, f) : await lifiRoutes(req, f);
  return { routes: sortRoutes(routes, req.sortBy), refreshInterval: QUOTE_REFRESH_SECONDS, priceImpactMediumLevel: 0, priceImpactHighLevel: 0 };
}
