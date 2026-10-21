// Hyperliquid perps (TW "Perps", plan Phase 7). Public info + exchange API (api.hyperliquid.xyz), no Trust relay:
//   - the main wallet signs user actions (EIP-712 "HyperliquidSignTransaction"): approve an agent, approve the builder fee, withdraw;
//   - a locally generated AGENT key (stored encrypted, cannot withdraw) signs trading actions (L1 "phantom agent" EIP-712 over
//     keccak(msgpack(action) || nonce || vault flag)); this is Hyperliquid's own session-key model.
// Wire formats follow the official Python SDK (hyperliquid-python-sdk signing.py / utils). Unverified live from the build sandbox.
import { encode as msgpack } from '@msgpack/msgpack';
import { concat, hashTypedData, keccak256, toBytes, toHex, type Hex } from 'viem';

export const HL_API = 'https://api.hyperliquid.xyz';
export const HL_BRIDGE = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7' as const; // Arbitrum Bridge2: USDC sent here is credited to the sender
export const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const;
export const MIN_DEPOSIT = 5_000_000n; // 5 USDC (6 decimals); smaller deposits are lost per Hyperliquid's docs
export const SIGNATURE_CHAIN_ID = '0xa4b1'; // Arbitrum One
const ZERO = '0x0000000000000000000000000000000000000000' as const;

type F = typeof fetch;
export async function hlInfo<T = any>(body: unknown, f: F = fetch): Promise<T> {
  const r = await f(`${HL_API}/info`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Hyperliquid info HTTP ${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- number formatting (SDK float_to_wire + tick rules)
/** SDK float_to_wire: 8 decimals, trailing zeros stripped, never "-0". */
export function floatToWire(x: number): string {
  const s = x.toFixed(8);
  if (Math.abs(Number(s) - x) >= 1e-12) throw new Error('float_to_wire causes rounding');
  let n = s.replace(/0+$/, '').replace(/\.$/, '');
  if (n === '-0' || n === '') n = '0';
  return n;
}
/** Perp prices: at most 5 significant figures and at most (6 - szDecimals) decimals; integers are always allowed. */
export function roundPrice(px: number, szDecimals: number): number {
  if (!(px > 0)) throw new Error('Invalid price');
  if (Number.isInteger(px)) return px;
  const sig = Number(px.toPrecision(5));
  const dec = Math.max(0, 6 - szDecimals);
  return Number(sig.toFixed(dec));
}
export const roundSize = (sz: number, szDecimals: number): number => Math.floor(sz * 10 ** szDecimals + 1e-9) / 10 ** szDecimals;

// ---------------------------------------------------------------- actions
export interface OrderWire { a: number; b: boolean; p: string; s: string; r: boolean; t: { limit: { tif: 'Gtc' | 'Ioc' | 'Alo' } } }
export interface Builder { b: string; f: number } // f in tenths of a basis point
export function orderAction(orders: OrderWire[], builder?: Builder | null) {
  return builder ? { type: 'order', orders, grouping: 'na', builder: { b: builder.b.toLowerCase(), f: builder.f } } : { type: 'order', orders, grouping: 'na' };
}
export function orderWire(p: { asset: number; isBuy: boolean; price: number; size: number; reduceOnly?: boolean; tif?: 'Gtc' | 'Ioc' | 'Alo'; szDecimals: number }): OrderWire {
  const size = roundSize(p.size, p.szDecimals);
  if (!(size > 0)) throw new Error('Order size is below the minimum lot');
  return { a: p.asset, b: p.isBuy, p: floatToWire(roundPrice(p.price, p.szDecimals)), s: floatToWire(size), r: !!p.reduceOnly, t: { limit: { tif: p.tif ?? 'Gtc' } } };
}
/** Market order = IOC limit at mid ± slippage (SDK default 5%). */
export const marketPrice = (mid: number, isBuy: boolean, slippage = 0.05) => (isBuy ? mid * (1 + slippage) : mid * (1 - slippage));
export const cancelAction = (cancels: Array<{ asset: number; oid: number }>) => ({ type: 'cancel', cancels: cancels.map((c) => ({ a: c.asset, o: c.oid })) });
export const leverageAction = (asset: number, leverage: number, isCross: boolean) => ({ type: 'updateLeverage', asset, isCross, leverage: Math.round(leverage) });

// ---------------------------------------------------------------- L1 (agent) signing
export function actionHash(action: unknown, nonce: number, vaultAddress?: string | null): Hex {
  const parts: Uint8Array[] = [msgpack(action)];
  const n = new Uint8Array(8); new DataView(n.buffer).setBigUint64(0, BigInt(nonce), false); parts.push(n);
  parts.push(vaultAddress ? concat([new Uint8Array([1]), toBytes(vaultAddress as Hex)]) : new Uint8Array([0]));
  return keccak256(concat(parts));
}
export function l1Digest(action: unknown, nonce: number, mainnet = true, vaultAddress?: string | null): Hex {
  return hashTypedData({
    domain: { name: 'Exchange', version: '1', chainId: 1337, verifyingContract: ZERO },
    types: { Agent: [{ name: 'source', type: 'string' }, { name: 'connectionId', type: 'bytes32' }] },
    primaryType: 'Agent', message: { source: mainnet ? 'a' : 'b', connectionId: actionHash(action, nonce, vaultAddress) },
  });
}

// ---------------------------------------------------------------- user-signed actions (main wallet)
const USER_TYPES = {
  approveAgent: { primary: 'HyperliquidTransaction:ApproveAgent', fields: [{ name: 'hyperliquidChain', type: 'string' }, { name: 'agentAddress', type: 'address' }, { name: 'agentName', type: 'string' }, { name: 'nonce', type: 'uint64' }] },
  approveBuilderFee: { primary: 'HyperliquidTransaction:ApproveBuilderFee', fields: [{ name: 'hyperliquidChain', type: 'string' }, { name: 'maxFeeRate', type: 'string' }, { name: 'builder', type: 'address' }, { name: 'nonce', type: 'uint64' }] },
  withdraw3: { primary: 'HyperliquidTransaction:Withdraw', fields: [{ name: 'hyperliquidChain', type: 'string' }, { name: 'destination', type: 'string' }, { name: 'amount', type: 'string' }, { name: 'time', type: 'uint64' }] },
} as const;
export type UserActionType = keyof typeof USER_TYPES;
export function userAction(type: UserActionType, fields: Record<string, string | number>, mainnet = true): Record<string, unknown> {
  return { type, signatureChainId: SIGNATURE_CHAIN_ID, hyperliquidChain: mainnet ? 'Mainnet' : 'Testnet', ...fields };
}
export function userDigest(action: Record<string, any>): Hex {
  const t = USER_TYPES[action.type as UserActionType]; if (!t) throw new Error('Unknown user action');
  const message: Record<string, unknown> = {};
  for (const fld of t.fields) message[fld.name] = fld.type === 'uint64' ? BigInt(action[fld.name]) : action[fld.name] ?? '';
  return hashTypedData({
    domain: { name: 'HyperliquidSignTransaction', version: '1', chainId: Number(action.signatureChainId), verifyingContract: ZERO },
    types: { [t.primary]: t.fields as any }, primaryType: t.primary as any, message: message as any,
  });
}

export interface Sig { r: Hex; s: Hex; v: number }
export async function hlExchange(body: { action: unknown; nonce: number; signature: Sig; vaultAddress?: string | null }, f: F = fetch): Promise<any> {
  const r = await f(`${HL_API}/exchange`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, vaultAddress: body.vaultAddress ?? null }), signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.status !== 'ok') throw new Error(typeof j?.response === 'string' ? j.response : `Hyperliquid rejected the request (${r.status})`);
  return j.response;
}
/** Per-order results of an order/cancel response: resting oid, fill, or the venue's error text. */
export function orderStatuses(resp: any): Array<{ ok: boolean; oid?: number; filled?: { totalSz: string; avgPx: string }; error?: string }> {
  return ((resp?.data?.statuses ?? []) as any[]).map((s) => (s?.error ? { ok: false, error: String(s.error) } : s?.filled ? { ok: true, oid: s.filled.oid, filled: { totalSz: s.filled.totalSz, avgPx: s.filled.avgPx } } : s?.resting ? { ok: true, oid: s.resting.oid } : { ok: s === 'success' }));
}

// ---------------------------------------------------------------- read models
export interface PerpMarket { coin: string; asset: number; szDecimals: number; maxLeverage: number; mid: number; prevDayPx?: number; funding?: number; openInterest?: number; volume24h?: number }
export async function perpMarkets(f: F = fetch): Promise<PerpMarket[]> {
  const [meta, ctxs] = await hlInfo<[any, any[]]>({ type: 'metaAndAssetCtxs' }, f);
  return ((meta?.universe ?? []) as any[]).map((u, i) => ({ u, c: ctxs?.[i] ?? {}, i })).filter((x) => !x.u.isDelisted).map(({ u, c, i }) => ({
    coin: String(u.name), asset: i, szDecimals: Number(u.szDecimals), maxLeverage: Number(u.maxLeverage), mid: Number(c.midPx ?? c.markPx ?? 0),
    prevDayPx: Number(c.prevDayPx) || undefined, funding: Number(c.funding) || undefined, openInterest: Number(c.openInterest) || undefined, volume24h: Number(c.dayNtlVlm) || undefined,
  }));
}
export interface PerpAccount {
  accountValue: number; withdrawable: number; marginUsed: number; unrealizedPnl: number;
  positions: Array<{ coin: string; size: number; entryPx: number; positionValue: number; unrealizedPnl: number; leverage: number; liquidationPx: number | null; marginUsed: number; returnOnEquity: number }>;
  orders: Array<{ coin: string; oid: number; side: 'buy' | 'sell'; px: number; sz: number; reduceOnly: boolean; timestamp: number }>;
  fills: Array<{ coin: string; side: 'buy' | 'sell'; px: number; sz: number; closedPnl: number; fee: number; time: number; hash: string }>;
  realizedPnl: number;
}
export function mapAccount(state: any, orders: any[], fills: any[]): PerpAccount {
  const ms = state?.marginSummary ?? {};
  const positions = ((state?.assetPositions ?? []) as any[]).map((p) => p?.position).filter((p) => p && Number(p.szi) !== 0).map((p) => ({
    coin: String(p.coin), size: Number(p.szi), entryPx: Number(p.entryPx), positionValue: Number(p.positionValue), unrealizedPnl: Number(p.unrealizedPnl),
    leverage: Number(p.leverage?.value ?? 1), liquidationPx: p.liquidationPx != null ? Number(p.liquidationPx) : null, marginUsed: Number(p.marginUsed), returnOnEquity: Number(p.returnOnEquity),
  }));
  const fl = (Array.isArray(fills) ? fills : []).slice(0, 100).map((x) => ({ coin: String(x.coin), side: x.side === 'B' ? 'buy' as const : 'sell' as const, px: Number(x.px), sz: Number(x.sz), closedPnl: Number(x.closedPnl ?? 0), fee: Number(x.fee ?? 0), time: Number(x.time), hash: String(x.hash ?? '') }));
  return {
    accountValue: Number(ms.accountValue ?? 0), withdrawable: Number(state?.withdrawable ?? 0), marginUsed: Number(ms.totalMarginUsed ?? 0),
    unrealizedPnl: positions.reduce((n, p) => n + p.unrealizedPnl, 0), positions,
    orders: (Array.isArray(orders) ? orders : []).map((o) => ({ coin: String(o.coin), oid: Number(o.oid), side: o.side === 'B' ? 'buy' as const : 'sell' as const, px: Number(o.limitPx), sz: Number(o.sz), reduceOnly: !!o.reduceOnly, timestamp: Number(o.timestamp) })),
    fills: fl, realizedPnl: fl.reduce((n, x) => n + x.closedPnl - x.fee, 0),
  };
}
export async function perpAccount(user: string, f: F = fetch): Promise<PerpAccount> {
  const [state, orders, fills] = await Promise.all([hlInfo({ type: 'clearinghouseState', user }, f), hlInfo({ type: 'frontendOpenOrders', user }, f), hlInfo({ type: 'userFills', user }, f).catch(() => [])]);
  return mapAccount(state, orders, fills);
}
export const toSig = (s: { r: Hex; s: Hex; v?: bigint; yParity?: number }): Sig => ({ r: s.r, s: s.s, v: s.v != null ? Number(s.v) : 27 + Number(s.yParity ?? 0) });
export { toHex };
