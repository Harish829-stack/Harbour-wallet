// Jupiter public swap API (https://dev.jup.ag) — same-chain Solana swaps. Response shapes follow the
// public docs and are UNVERIFIED live from this build environment (egress blocked).
import type { SwapRoute, SwapRouteRequest, SwapStep, SwapFee } from './types';
import { domainById } from './domains';
import { classifyAggregatorError, swapError } from './errors';
import { QUOTE_REFRESH_SECONDS } from './rules';

import { GATEWAY_URL } from '../../kit/endpoints';
export const JUP_BASE = GATEWAY_URL ? `${GATEWAY_URL}/jup/swap/v1` : 'https://lite-api.jup.ag/swap/v1';
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
type F = typeof fetch;
export const jupMint = (a: { address: string }) => (a.address === 'native' ? WSOL_MINT : a.address);

// TW "Solana turbo swaps" toggle (SolanaSwapFeeSettings Fast/Turbo/Ultra). Harbour maps Fast/Turbo.
export const SOLANA_PRIORITY = {
  fast:  { priorityLevel: 'medium', maxLamports: 200_000 },
  turbo: { priorityLevel: 'high',   maxLamports: 1_000_000 },
} as const;
const BASE_FEE_LAMPORTS = 5000;

async function call(f: F, url: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try { res = await f(url, { ...init, headers: { accept: 'application/json', 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000) }); }
  catch (e: any) { throw e?.name === 'TimeoutError' ? swapError('timeout') : swapError('network'); }
  let body: any = null; try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw classifyAggregatorError(res.status, body);
  if (body?.error) throw classifyAggregatorError(400, body);
  return body;
}

export function mapJupiterRoute(q: any, req: SwapRouteRequest, now = Date.now()): SwapRoute {
  const d = domainById('solana')!;
  const labels = ((q?.routePlan ?? []) as any[]).map((p) => p?.swapInfo?.label).filter(Boolean);
  const impactPct = Math.abs(Number(q?.priceImpactPct) || 0) * 100; // fraction -> percent [likely]
  const max = req.solanaTurbo ? SOLANA_PRIORITY.turbo.maxLamports : SOLANA_PRIORITY.fast.maxLamports;
  const networkFee: SwapFee = { symbol: d.nativeSymbol, decimals: d.nativeDecimals, amount: String(BASE_FEE_LAMPORTS + max), name: 'Network fee', isNative: true, upperBound: true };
  const out = String(q?.outAmount ?? '0');
  const step: SwapStep = {
    id: `jupiter-${now}`, type: 'swap',
    provider: { id: 'jupiter', name: 'Jupiter', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png' },
    fromDomainId: 'solana', toDomainId: 'solana',
    from: { asset: req.from, amount: String(q?.inAmount ?? req.amount) },
    to: { asset: req.to, amount: out, minAmount: String(q?.otherAmountThreshold ?? out) },
    slippage: { userSelected: Number(req.slippage) },
    priceImpact: impactPct ? -impactPct : 0,
    providerFees: [], networkFee,
    executionSeconds: 5,
    raw: { quote: q, priority: req.solanaTurbo ? 'turbo' : 'fast', via: labels },
  };
  return { id: step.id, source: 'jupiter', expiresAt: now + QUOTE_REFRESH_SECONDS * 1000, steps: [step], tags: ['RECOMMENDED'], warnings: [], priceImpact: step.priceImpact, totalSeconds: 5 };
}

export async function jupiterRoutes(req: SwapRouteRequest, f: F = fetch): Promise<SwapRoute[]> {
  const q = new URLSearchParams({ inputMint: jupMint(req.from), outputMint: jupMint(req.to), amount: req.amount, slippageBps: String(Math.round(Number(req.slippage) * 100)), restrictIntermediateTokens: 'true' });
  const quote = await call(f, `${JUP_BASE}/quote?${q}`);
  if (!quote?.outAmount || quote.outAmount === '0') throw swapError('no_liquidity');
  return [mapJupiterRoute(quote, req)];
}

// Build the (unsigned) base64 versioned transaction for a quote.
export async function jupiterSwapTransaction(raw: { quote: any; priority: 'fast' | 'turbo' }, userPublicKey: string, f: F = fetch): Promise<string> {
  const p = SOLANA_PRIORITY[raw.priority] ?? SOLANA_PRIORITY.fast;
  const out = await call(f, `${JUP_BASE}/swap`, { method: 'POST', body: JSON.stringify({
    quoteResponse: raw.quote, userPublicKey, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: { priorityLevelWithMaxLamports: { priorityLevel: p.priorityLevel, maxLamports: p.maxLamports } },
  }) });
  if (typeof out?.swapTransaction !== 'string') throw swapError('network');
  return out.swapTransaction;
}
