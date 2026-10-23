// THORChain native swaps (BTC <-> EVM natives/tokens), quoted by a public THORNode (no key). The quote names the vault
// (`inbound_address`), the memo and, for EVM sources, the router. Execution:
//   - BTC source: a normal BTC send to the vault with the memo in an OP_RETURN output (wallet-core Bitcoin signer);
//   - EVM source: router.depositWithExpiry(vault, asset, amount, memo, expiry) (ERC-20 sells approve the router first).
// Response fields follow dev.thorchain.org's swap guide; the build sandbox cannot reach THORNode, so shapes are unverified live.
import { encodeFunctionData, getAddress } from 'viem';
import type { SwapAsset, SwapRoute, SwapRouteRequest, SwapStep, SwapFee } from './types';
import { domainById } from './domains';
import { classifyAggregatorError, swapError } from './errors';
import { QUOTE_REFRESH_SECONDS } from './rules';
import { GATEWAY_URL } from '../../kit/endpoints';

type F = typeof fetch;
export const THORNODE_URLS = [
  ...(GATEWAY_URL ? [`${GATEWAY_URL}/thornode`] : []),
  'https://gateway.liquify.com/chain/thorchain_api',
  'https://thornode.ninerealms.com',
];
const THOR_CHAIN: Record<string, { chain: string; native: string }> = {
  bitcoin: { chain: 'BTC', native: 'BTC.BTC' },
  ethereum: { chain: 'ETH', native: 'ETH.ETH' },
  smartchain: { chain: 'BSC', native: 'BSC.BNB' },
  base: { chain: 'BASE', native: 'BASE.ETH' },
};
const THOR_DECIMALS = 8;
export const THOR_ROUTER_ABI = [{
  type: 'function', name: 'depositWithExpiry', stateMutability: 'payable', outputs: [],
  inputs: [{ name: 'vault', type: 'address' }, { name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'memo', type: 'string' }, { name: 'expiration', type: 'uint256' }],
}] as const;
const EVM_ZERO = '0x0000000000000000000000000000000000000000';

/** THORChain asset notation (CHAIN.SYMBOL or CHAIN.SYMBOL-0XCONTRACT); null when the domain is not a THORChain chain. */
export function thorAsset(a: SwapAsset): string | null {
  const c = THOR_CHAIN[a.domainId]; if (!c) return null;
  if (a.address === 'native') return c.native;
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.address) || !/^[A-Za-z0-9]{1,16}$/.test(a.symbol)) return null;
  return `${c.chain}.${a.symbol.toUpperCase()}-${a.address.toUpperCase()}`;
}
/** Atomic units <-> THORChain's fixed 1e8 units. */
export function toThorUnits(amount: string, decimals: number): bigint {
  const v = BigInt(amount);
  return decimals >= THOR_DECIMALS ? v / 10n ** BigInt(decimals - THOR_DECIMALS) : v * 10n ** BigInt(THOR_DECIMALS - decimals);
}
export function fromThorUnits(amount: string | bigint, decimals: number): bigint {
  const v = BigInt(amount);
  return decimals >= THOR_DECIMALS ? v * 10n ** BigInt(decimals - THOR_DECIMALS) : v / 10n ** BigInt(THOR_DECIMALS - decimals);
}
export const thorSupports = (req: Pick<SwapRouteRequest, 'from' | 'to'>): boolean =>
  req.from.domainId !== req.to.domainId && !!thorAsset(req.from) && !!thorAsset(req.to);

async function thorGet(f: F, path: string): Promise<any> {
  let last: unknown = swapError('network');
  for (const base of THORNODE_URLS) {
    let res: Response;
    try { res = await f(`${base}${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) }); }
    catch (e: any) { last = e?.name === 'TimeoutError' ? swapError('timeout') : swapError('network'); continue; }
    let body: any = null; try { body = await res.json(); } catch { /* not JSON */ }
    if (res.ok && body && !body.error) return body;
    if (res.status >= 500 || res.status === 429) { last = swapError('server'); continue; }
    throw classifyAggregatorError(res.status, { message: body?.message ?? body?.error });
  }
  throw last;
}

export async function thorQuote(req: SwapRouteRequest, f: F = fetch): Promise<any> {
  const from = thorAsset(req.from); const to = thorAsset(req.to);
  if (!from || !to) throw swapError('unsupported_pair');
  const amount = toThorUnits(req.amount, req.from.decimals);
  if (amount <= 0n) throw swapError('amount_too_low');
  const q = new URLSearchParams({
    from_asset: from, to_asset: to, amount: amount.toString(), destination: req.toAddress, refund_address: req.fromAddress,
    streaming_interval: '1', streaming_quantity: '0', liquidity_tolerance_bps: String(Math.round(Number(req.slippage) * 100)),
  });
  const quote = await thorGet(f, `/thorchain/quote/swap?${q}`);
  if (!quote?.inbound_address || !quote?.memo || !quote?.expected_amount_out) throw swapError('no_liquidity');
  if (quote.recommended_min_amount_in && amount < BigInt(quote.recommended_min_amount_in)) throw swapError('amount_too_low', { minAmount: fromThorUnits(quote.recommended_min_amount_in, req.from.decimals).toString() });
  return quote;
}

export function mapThorRoute(q: any, req: SwapRouteRequest, now = Date.now()): SwapRoute {
  const out = fromThorUnits(String(q.expected_amount_out), req.to.decimals);
  const bps = BigInt(Math.round(Number(req.slippage) * 100));
  const min = (out * (10_000n - bps)) / 10_000n;
  const fees: SwapFee[] = [];
  if (q?.fees?.total != null) fees.push({ symbol: req.to.symbol, decimals: req.to.decimals, amount: fromThorUnits(String(q.fees.total), req.to.decimals).toString(), name: 'THORChain fees', description: 'Liquidity, outbound and network fees' });
  const isEvmToken = domainById(req.from.domainId)!.kind === 'evm' && req.from.address !== 'native';
  const seconds = Number(q?.total_swap_seconds ?? (Number(q?.outbound_delay_seconds ?? 0) + Number(q?.inbound_confirmation_seconds ?? 0) + Number(q?.streaming_swap_seconds ?? 0))) || 600;
  const impact = Number(q?.fees?.slippage_bps); // fee-side price impact in bps
  const step: SwapStep = {
    id: `thorchain-${now}`, type: 'swapAndBridge',
    provider: { id: 'thorchain', name: 'THORChain', logoUrl: '/chains/thorchain.png' },
    fromDomainId: req.from.domainId, toDomainId: req.to.domainId,
    from: { asset: req.from, amount: req.amount },
    to: { asset: req.to, amount: out.toString(), minAmount: min.toString() },
    slippage: { userSelected: Number(req.slippage) },
    priceImpact: Number.isFinite(impact) ? -(impact / 100) : undefined,
    providerFees: fees,
    approval: isEvmToken && q.router ? { tokenAddress: req.from.address, spender: q.router, minAmount: req.amount } : undefined,
    executionSeconds: seconds,
    raw: { quote: q, request: { ...req } },
  };
  return { id: step.id, source: 'thorchain', expiresAt: Math.min(now + QUOTE_REFRESH_SECONDS * 1000, Number(q.expiry ?? 0) * 1000 || Infinity), steps: [step], tags: [], warnings: q?.warning ? [{ code: 'thorchain', message: String(q.warning) }] : [], priceImpact: step.priceImpact, totalSeconds: seconds };
}

export async function thorchainRoutes(req: SwapRouteRequest, f: F = fetch): Promise<SwapRoute[]> {
  if (!thorSupports(req)) return [];
  return [mapThorRoute(await thorQuote(req, f), req)];
}

/**
 * Pre-sign check for a FRESH quote fetched at submit time (THORChain asks that vault addresses are never cached).
 * The memo must pay out to our own destination address, and the expected output may not have drifted past the
 * user's slippage since the confirmed quote.
 */
export function checkThorQuote(fresh: any, step: SwapStep, toAddress: string, slippagePct: number): void {
  if (!fresh?.inbound_address || typeof fresh.memo !== 'string' || fresh.memo.length > 80) throw swapError('unsafe_transaction');
  const parts = fresh.memo.split(':');
  if (!['=', 's', 'swap', 'SWAP'].includes(parts[0]) || parts[2]?.toLowerCase() !== toAddress.toLowerCase()) throw swapError('unsafe_transaction');
  // full memo: =:ASSET:DEST:LIMIT[/INTERVAL/QUANTITY] and nothing else (no affiliate / fee fields); the asset may not be swapped for a different one
  if (parts.length > 4 || (parts[3] != null && !/^\d*(\/\d+\/\d+)?$/.test(parts[3]))) throw swapError('unsafe_transaction');
  const want = thorAsset(step.to.asset); const got = String(parts[1] ?? '');
  if (want && got.includes('.') && got.toUpperCase().split('-')[0] !== want.toUpperCase().split('-')[0]) throw swapError('unsafe_transaction');
  const outNow = fromThorUnits(String(fresh.expected_amount_out ?? '0'), step.to.asset.decimals);
  const quoted = BigInt(step.to.amount);
  const bps = BigInt(Math.round(slippagePct * 100));
  if (outNow * 10_000n < quoted * (10_000n - bps)) throw swapError('price_moved');
  if (fresh.expiry && Number(fresh.expiry) * 1000 < Date.now()) throw swapError('price_moved');
}

/**
 * Cross-check the vault (and router) against THORNode's /inbound_addresses on independent nodes. A quote served by one
 * compromised endpoint cannot name an attacker vault: at least two different nodes must list the same address, and none may list another.
 */
export async function verifyThorInbound(fresh: any, step: SwapStep, f: F = fetch): Promise<void> {
  const chain = THOR_CHAIN[step.from.asset.domainId]?.chain; if (!chain) throw swapError('unsafe_transaction');
  const vault = String(fresh?.inbound_address ?? '').toLowerCase(); const router = fresh?.router ? String(fresh.router).toLowerCase() : '';
  let agree = 0;
  const sources = [...new Set(THORNODE_URLS)];
  const answers = await Promise.all(sources.map(async (base) => {
    try { const r = await f(`${base}/thorchain/inbound_addresses`, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) }); return r.ok ? await r.json() : null; } catch { return null; }
  }));
  for (const list of answers) {
    const e = Array.isArray(list) ? list.find((x: any) => x?.chain === chain) : null; if (!e) continue;
    if (e.halted || e.global_trading_paused || e.chain_trading_paused) throw swapError('unsafe_transaction');
    const sameVault = String(e.address ?? '').toLowerCase() === vault; const sameRouter = !router || String(e.router ?? '').toLowerCase() === router;
    if (!sameVault || !sameRouter) throw swapError('unsafe_transaction');
    agree++;
  }
  if (agree < 2) throw swapError('unsafe_transaction');
}

/** Router call for an EVM-source swap. `value` is the native amount for native sells, 0 for tokens. */
export function thorRouterCall(fresh: any, step: SwapStep): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(fresh?.router ?? '')) || !/^0x[0-9a-fA-F]{40}$/.test(String(fresh.inbound_address))) throw swapError('unsafe_transaction');
  const native = step.from.asset.address === 'native';
  const amount = BigInt(step.from.amount);
  const expiry = BigInt(Number(fresh.expiry) || Math.floor(Date.now() / 1000) + 900);
  const asset = native ? EVM_ZERO : getAddress(step.from.asset.address);
  const data = encodeFunctionData({ abi: THOR_ROUTER_ABI, functionName: 'depositWithExpiry', args: [getAddress(fresh.inbound_address), asset as `0x${string}`, amount, fresh.memo, expiry] });
  return { to: getAddress(fresh.router), data, value: native ? amount : 0n };
}

export type ThorStatus = 'pending' | 'done' | 'refunded' | 'failed';
/** THORNode tx tracking: done once the swap is finalised and the outbound is signed; a REFUND outbound means the swap failed. */
export function readThorStatus(s: any): ThorStatus {
  const outs: any[] = [...(s?.out_txs ?? []), ...(s?.planned_out_txs ?? [])];
  if (outs.some((o) => /^REFUND/i.test(String(o?.memo ?? '')) || o?.refund === true)) return 'refunded';
  const st = s?.stages ?? {};
  if (st.inbound_observed?.completed === false && st.inbound_observed?.final_count === 0) return 'pending';
  if (st.swap_finalised?.completed && (st.outbound_signed?.completed ?? (s?.out_txs?.length > 0))) return 'done';
  return 'pending';
}
export async function thorStatus(hash: string, f: F = fetch): Promise<ThorStatus> {
  return readThorStatus(await thorGet(f, `/thorchain/tx/status/${hash.replace(/^0x/, '').toUpperCase()}`));
}
