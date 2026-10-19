// LI.FI public REST adapter (https://docs.li.fi) — Harbour's stand-in for TW's private Amber
// router (POST /v1/route -> /v1/route/step -> /v1/transaction/submit). Same shape: a route is a
// list of steps; each step's transaction is built only when it is about to be executed.
// Response shapes below follow LI.FI's public docs and are UNVERIFIED against the live API from
// this build environment (egress blocked) — see evidence/25-swap/SWAP-SPEC.md "Verification".
import type { SwapAsset, SwapRoute, SwapStep, SwapRouteRequest, SwapFee, SwapStepType } from './types';
import { domainById, domainByLifiId } from './domains';
import { assetId, logoFor } from './tokens';
import { classifyAggregatorError, swapError } from './errors';
import { QUOTE_REFRESH_SECONDS } from './rules';

export const LIFI_BASE = 'https://li.quest/v1';
export const EVM_NATIVE = '0x0000000000000000000000000000000000000000';
export const SOL_NATIVE = '11111111111111111111111111111111';
type F = typeof fetch;

const headers = (): Record<string, string> => {
  const h: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  const key = (import.meta as any)?.env?.VITE_LIFI_API_KEY;
  if (typeof key === 'string' && key) h['x-lifi-api-key'] = key;
  return h;
};

export const lifiAddress = (a: SwapAsset): string =>
  a.address !== 'native' ? a.address : (domainById(a.domainId)!.kind === 'solana' ? SOL_NATIVE : EVM_NATIVE);

const ORDER: Record<string, string> = { quantity: 'CHEAPEST', security: 'SAFEST', latency: 'FASTEST', outcome: 'RECOMMENDED' };

export function toAsset(t: any): SwapAsset | null {
  const d = domainByLifiId(Number(t?.chainId));
  if (!d || !t?.address || !t?.symbol || typeof t?.decimals !== 'number') return null;
  const native = t.address === EVM_NATIVE || t.address === SOL_NATIVE;
  const address = native ? 'native' : String(t.address);
  const price = Number(t.priceUSD);
  return { assetId: assetId(d.id, address), domainId: d.id, address, symbol: String(t.symbol), name: String(t.name ?? t.symbol), decimals: t.decimals, logoUrl: logoFor(d.id, address), priceUsd: Number.isFinite(price) && price > 0 ? price : undefined };
}

function feeOf(token: any, amount: any, usd: any, name?: string, description?: string): SwapFee | null {
  if (!token || amount == null) return null;
  const u = Number(usd);
  return { symbol: String(token.symbol ?? ''), decimals: Number(token.decimals ?? 18), amount: String(amount), usd: Number.isFinite(u) ? u : undefined, name, description, isNative: token.address === EVM_NATIVE || token.address === SOL_NATIVE };
}
function stepType(s: any): SwapStepType {
  if (s?.type === 'swap') return 'swap';
  if (s?.type === 'cross') return 'bridge';
  const inc: string[] = (s?.includedSteps ?? []).map((x: any) => x?.type);
  const swapAt = inc.indexOf('swap'); const crossAt = inc.indexOf('cross');
  if (swapAt >= 0 && crossAt >= 0) return swapAt < crossAt ? 'swapAndBridge' : 'bridgeAndSwap';
  return crossAt >= 0 ? 'bridge' : 'aggregate';
}
const bigintStr = (v: any, fb = '0') => { try { return BigInt(v ?? fb).toString(); } catch { return fb; } };

export function mapLifiStep(s: any, slippagePct: number): SwapStep | null {
  const from = toAsset(s?.action?.fromToken); const to = toAsset(s?.action?.toToken);
  if (!from || !to || !s?.id) return null;
  const est = s.estimate ?? {};
  const gas = (est.gasCosts ?? []) as any[];
  const g0 = gas[0];
  const networkFee: SwapFee | undefined = g0?.token
    ? (feeOf(g0.token, gas.reduce((a, g) => a + BigInt(bigintStr(g?.amount)), 0n).toString(), gas.reduce((a, g) => a + (Number(g?.amountUSD) || 0), 0), 'Network fee') ?? undefined)
    : undefined;
  const providerFees = ((est.feeCosts ?? []) as any[]).map((f) => feeOf(f?.token, f?.amount, f?.amountUSD, f?.name, f?.description)).filter(Boolean) as SwapFee[];
  const spender: string | undefined = est.approvalAddress;
  return {
    id: String(s.id), type: stepType(s),
    provider: { id: String(s.tool ?? s.toolDetails?.key ?? 'lifi'), name: String(s.toolDetails?.name ?? s.tool ?? 'LI.FI'), logoUrl: s.toolDetails?.logoURI },
    fromDomainId: from.domainId, toDomainId: to.domainId,
    from: { asset: from, amount: bigintStr(s.action?.fromAmount ?? est.fromAmount) },
    to: { asset: to, amount: bigintStr(est.toAmount), minAmount: bigintStr(est.toAmountMin) },
    slippage: { userSelected: slippagePct },
    providerFees, networkFee,
    approval: from.address !== 'native' && spender ? { tokenAddress: from.address, spender, minAmount: bigintStr(s.action?.fromAmount ?? est.fromAmount) } : undefined,
    executionSeconds: Number(est.executionDuration) || undefined,
    raw: s,
  };
}

export function mapLifiRoute(r: any, req: SwapRouteRequest, now = Date.now()): SwapRoute | null {
  const slip = Number(req.slippage);
  const steps = ((r?.steps ?? []) as any[]).map((s) => mapLifiStep(s, slip));
  if (!steps.length || steps.some((s) => !s)) return null; // route crosses a chain Harbour cannot sign/read
  const fromUsd = Number(r.fromAmountUSD); const toUsd = Number(r.toAmountUSD);
  const impact = fromUsd > 0 && Number.isFinite(toUsd) ? ((toUsd - fromUsd) / fromUsd) * 100 : undefined;
  const total = (steps as SwapStep[]).reduce((a, s) => a + (s.executionSeconds ?? 0), 0);
  return {
    id: String(r.id), source: 'lifi', expiresAt: now + QUOTE_REFRESH_SECONDS * 1000, steps: steps as SwapStep[],
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [], warnings: [],
    fromAmountUsd: Number.isFinite(fromUsd) ? fromUsd : undefined, toAmountUsd: Number.isFinite(toUsd) ? toUsd : undefined,
    priceImpact: impact != null && Number.isFinite(impact) ? Number(impact.toFixed(4)) : undefined,
    totalSeconds: total || undefined,
  };
}

async function call(f: F, url: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try { res = await f(url, { ...init, headers: { ...headers(), ...(init?.headers as any) }, signal: AbortSignal.timeout(15000) }); }
  catch (e: any) { throw e?.name === 'TimeoutError' ? swapError('timeout') : swapError('network'); }
  let body: any = null; try { body = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) throw classifyAggregatorError(res.status, body);
  return body;
}

export async function lifiRoutes(req: SwapRouteRequest, f: F = fetch): Promise<SwapRoute[]> {
  const fromD = domainById(req.from.domainId)!; const toD = domainById(req.to.domainId)!;
  const body = {
    fromChainId: fromD.lifiChainId, toChainId: toD.lifiChainId,
    fromTokenAddress: lifiAddress(req.from), toTokenAddress: lifiAddress(req.to),
    fromAmount: req.amount, fromAddress: req.fromAddress, toAddress: req.toAddress,
    options: { slippage: Number(req.slippage) / 100, order: ORDER[req.sortBy] ?? 'RECOMMENDED', integrator: 'harbour-wallet', allowSwitchChain: false },
  };
  const out = await call(f, `${LIFI_BASE}/advanced/routes`, { method: 'POST', body: JSON.stringify(body) });
  const now = Date.now();
  // Multi-leg runs (TW startSwapRun `continuesToSwap`) are out of scope: keep single-transaction routes only.
  const routes = ((out?.routes ?? []) as any[]).filter((r) => (r?.steps?.length ?? 0) === 1).map((r) => mapLifiRoute(r, req, now)).filter(Boolean) as SwapRoute[];
  if (!routes.length) throw swapError('no_liquidity');
  return routes;
}

// Build the transaction for ONE step (TW: POST /v1/route/step). Returns LI.FI's refreshed step.
export async function lifiStepTransaction(rawStep: unknown, f: F = fetch): Promise<any> {
  return call(f, `${LIFI_BASE}/advanced/stepTransaction`, { method: 'POST', body: JSON.stringify(rawStep) });
}

export type BridgeStatus = { status: 'NOT_FOUND' | 'INVALID' | 'PENDING' | 'DONE' | 'FAILED'; substatus?: string; receivingTxHash?: string };
export async function lifiStatus(p: { txHash: string; fromChain: number; toChain: number; bridge?: string }, f: F = fetch): Promise<BridgeStatus> {
  const q = new URLSearchParams({ txHash: p.txHash, fromChain: String(p.fromChain), toChain: String(p.toChain) });
  if (p.bridge) q.set('bridge', p.bridge);
  const out = await call(f, `${LIFI_BASE}/status?${q}`);
  return { status: out?.status ?? 'PENDING', substatus: out?.substatus, receivingTxHash: out?.receiving?.txHash };
}

// Token lookup by address or symbol on one domain (replaces TW's /v1/search/assets).
export async function lifiToken(domainId: string, query: string, f: F = fetch): Promise<SwapAsset | null> {
  const d = domainById(domainId); if (!d) return null;
  try {
    const out = await call(f, `${LIFI_BASE}/token?${new URLSearchParams({ chain: String(d.lifiChainId), token: query })}`);
    return toAsset(out);
  } catch { return null; }
}
