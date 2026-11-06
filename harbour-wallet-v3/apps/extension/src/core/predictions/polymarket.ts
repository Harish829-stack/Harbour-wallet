// Polymarket (TW "Predictions" /v1/odd/*): Gamma (markets), CLOB (books, orders), Data API (positions, activity). Flag- and geo-gated.
// Trading follows the CLOB V2 docs (docs.polymarket.com, 2026): L1 ClobAuth EIP-712 -> API creds; L2 HMAC headers; orders are the V2
// EIP-712 struct (salt, maker, signer, tokenId, makerAmount, takerAmount, side, signatureType, timestamp, metadata, builder) signed
// by the EOA (signatureType 0), collateral pUSD (wrap USDC.e via the CollateralOnramp). Builder attribution = public bytes32 code.
// Books that report `version: "v2"` trade by positionId on the V2 exchange; Harbour trades CTF books only and links out for V2 ones.
// Unverified live from the build sandbox.
import { hashTypedData, type Hex } from 'viem';

export const GAMMA = 'https://gamma-api.polymarket.com';
export const CLOB = 'https://clob.polymarket.com';
export const DATA = 'https://data-api.polymarket.com';
export const POLYGON = 137;
export const PUSD = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB' as const;
export const USDCE = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;
export const ONRAMP = '0x93070a847efEf7F70739046A929D47a521F5B8ee' as const;
export const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const;
export const EXCHANGES = { ctf: '0xE111180000d2663C0091e4f400237545B87B996B', negRisk: '0xe2222d279d744050d28e00520010520000310F59' } as const;
const ZERO32 = `0x${'0'.repeat(64)}` as Hex;
type F = typeof fetch;
const j = async (f: F, url: string, init?: RequestInit) => { const r = await f(url, { ...init, signal: AbortSignal.timeout(12000) }); const b = await r.json().catch(() => null); if (!r.ok) throw Object.assign(new Error(b?.error ?? b?.message ?? `HTTP ${r.status}`), { status: r.status }); return b; };
const arr = (v: unknown): any[] => { try { return typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : []; } catch { return []; } };

export interface PmMarket { id: string; conditionId: string; question: string; slug: string; image: string; outcomes: string[]; prices: number[]; tokenIds: string[]; volume: number; endDate?: string; negRisk: boolean; tickSize: number; minSize: number; active: boolean }
export function mapMarket(m: any): PmMarket {
  return {
    id: String(m.id), conditionId: String(m.conditionId ?? ''), question: String(m.question ?? '').slice(0, 200), slug: String(m.slug ?? ''), image: /^https:\/\//.test(m.image ?? '') ? m.image : '',
    outcomes: arr(m.outcomes).map(String), prices: arr(m.outcomePrices).map(Number), tokenIds: arr(m.clobTokenIds).map(String), volume: Number(m.volumeNum ?? m.volume ?? 0), endDate: m.endDate,
    negRisk: m.negRisk === true, tickSize: Number(m.orderPriceMinTickSize ?? 0.01) || 0.01, minSize: Number(m.orderMinSize ?? 5) || 5, active: m.active !== false && m.closed !== true && m.acceptingOrders !== false,
  };
}
export async function markets(f: F = fetch, limit = 30, q?: string): Promise<PmMarket[]> {
  const qs = new URLSearchParams({ active: 'true', closed: 'false', limit: String(limit), order: 'volumeNum', ascending: 'false' });
  const rows = await j(f, `${GAMMA}/markets?${qs}`);
  const list = (Array.isArray(rows) ? rows : []).map(mapMarket);
  return q ? list.filter((m) => m.question.toLowerCase().includes(q.toLowerCase())) : list;
}
export async function market(id: string, f: F = fetch): Promise<PmMarket> { return mapMarket(await j(f, `${GAMMA}/markets/${encodeURIComponent(id)}`)); }

export interface Book { version?: string; negRisk: boolean; tickSize: number; minSize: number; bestBid?: number; bestAsk?: number; asks: Array<{ price: number; size: number }>; bids: Array<{ price: number; size: number }> }
export async function book(tokenId: string, f: F = fetch): Promise<Book> {
  const b = await j(f, `${CLOB}/book?token_id=${encodeURIComponent(tokenId)}`);
  const side = (x: any[]) => (Array.isArray(x) ? x : []).map((l) => ({ price: Number(l.price), size: Number(l.size) })).filter((l) => l.price > 0 && l.size > 0);
  const asks = side(b?.asks).sort((a, c) => a.price - c.price); const bids = side(b?.bids).sort((a, c) => c.price - a.price);
  return { version: b?.version, negRisk: b?.neg_risk === true, tickSize: Number(b?.tick_size ?? 0.01), minSize: Number(b?.min_order_size ?? 5), bestAsk: asks[0]?.price, bestBid: bids[0]?.price, asks: asks.slice(0, 10), bids: bids.slice(0, 10) };
}
/** Polymarket's own region check (it blocks some countries entirely). */
export async function geoblock(f: F = fetch): Promise<{ blocked: boolean; country?: string; region?: string }> {
  const g = await j(f, 'https://polymarket.com/api/geoblock');
  return { blocked: g?.blocked === true, country: g?.country, region: g?.region };
}
export interface PmPosition { title: string; outcome: string; size: number; avgPrice: number; curPrice: number; value: number; pnl: number; pnlPct: number; asset: string; slug: string; redeemable: boolean }
export async function positions(user: string, f: F = fetch): Promise<PmPosition[]> {
  const rows = await j(f, `${DATA}/positions?user=${user}&sizeThreshold=0.01&limit=100`);
  return (Array.isArray(rows) ? rows : []).map((p) => ({ title: String(p.title ?? ''), outcome: String(p.outcome ?? ''), size: Number(p.size), avgPrice: Number(p.avgPrice), curPrice: Number(p.curPrice), value: Number(p.currentValue), pnl: Number(p.cashPnl), pnlPct: Number(p.percentPnl), asset: String(p.asset ?? ''), slug: String(p.slug ?? ''), redeemable: p.redeemable === true }));
}
export async function activity(user: string, f: F = fetch): Promise<Array<{ type: string; title: string; outcome: string; side: string; size: number; price: number; usd: number; time: number; tx: string }>> {
  const rows = await j(f, `${DATA}/activity?user=${user}&limit=50`);
  return (Array.isArray(rows) ? rows : []).map((a) => ({ type: String(a.type ?? ''), title: String(a.title ?? ''), outcome: String(a.outcome ?? ''), side: String(a.side ?? ''), size: Number(a.size ?? 0), price: Number(a.price ?? 0), usd: Number(a.usdcSize ?? 0), time: Number(a.timestamp ?? 0) * 1000, tx: String(a.transactionHash ?? '') }));
}

// ---------------------------------------------------------------- auth
export const CLOB_AUTH_MESSAGE = 'This message attests that I control the given wallet';
export function clobAuthDigest(address: string, timestamp: number, nonce = 0): Hex {
  return hashTypedData({
    domain: { name: 'ClobAuthDomain', version: '1', chainId: POLYGON },
    types: { ClobAuth: [{ name: 'address', type: 'address' }, { name: 'timestamp', type: 'string' }, { name: 'nonce', type: 'uint256' }, { name: 'message', type: 'string' }] },
    primaryType: 'ClobAuth', message: { address: address as Hex, timestamp: String(timestamp), nonce: BigInt(nonce), message: CLOB_AUTH_MESSAGE },
  });
}
export interface Creds { apiKey: string; secret: string; passphrase: string }
const b64ToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const bytesToB64Url = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_'); }; // url-safe, padding kept
export async function l2Signature(secret: string, timestamp: number, method: string, path: string, body = ''): Promise<string> {
  const key = await crypto.subtle.importKey('raw', b64ToBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToB64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}${method.toUpperCase()}${path}${body}`))));
}
export async function l2Headers(c: Creds, address: string, method: string, path: string, body = '', now = Math.floor(Date.now() / 1000)): Promise<Record<string, string>> {
  return { POLY_ADDRESS: address, POLY_SIGNATURE: await l2Signature(c.secret, now, method, path, body), POLY_TIMESTAMP: String(now), POLY_API_KEY: c.apiKey, POLY_PASSPHRASE: c.passphrase };
}
/** Derive existing API creds, or create them the first time. `sign` signs the ClobAuth digest with the wallet key. */
export async function apiCreds(address: string, sign: (d: Hex) => Promise<Hex>, f: F = fetch): Promise<Creds> {
  const ts = Math.floor(Date.now() / 1000); const sig = await sign(clobAuthDigest(address, ts, 0));
  const headers = { POLY_ADDRESS: address, POLY_SIGNATURE: sig, POLY_TIMESTAMP: String(ts), POLY_NONCE: '0' };
  const map = (b: any): Creds => ({ apiKey: String(b.apiKey ?? b.key), secret: String(b.secret), passphrase: String(b.passphrase) });
  try { const b = await j(f, `${CLOB}/auth/derive-api-key`, { headers }); if (b?.apiKey || b?.key) return map(b); } catch { /* none yet */ }
  return map(await j(f, `${CLOB}/auth/api-key`, { method: 'POST', headers }));
}

// ---------------------------------------------------------------- orders (V2 struct, CTF books)
const DEC: Record<string, { price: number; size: number; amount: number }> = {
  '0.1': { price: 1, size: 2, amount: 3 }, '0.01': { price: 2, size: 2, amount: 4 }, '0.005': { price: 3, size: 2, amount: 5 }, '0.0025': { price: 4, size: 2, amount: 6 }, '0.001': { price: 3, size: 2, amount: 5 }, '0.0001': { price: 4, size: 2, amount: 6 },
};
const floorTo = (x: number, d: number) => Math.floor(x * 10 ** d + 1e-9) / 10 ** d;
const roundTo = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
const ceilTo = (x: number, d: number) => Math.ceil(x * 10 ** d - 1e-9) / 10 ** d;
const decimalsOf = (x: number) => { const s = x.toString(); return s.includes('e-') ? Number(s.split('e-')[1]) : (s.split('.')[1] ?? '').length; };
const to6 = (x: number) => BigInt(Math.round(x * 1e6)).toString();
/** makerAmount / takerAmount per the docs' rounding procedure. */
export function orderAmounts(side: 'BUY' | 'SELL', price: number, size: number, tickSize: number): { makerAmount: string; takerAmount: string; price: number; size: number } {
  const d = DEC[String(tickSize)] ?? DEC['0.01'];
  const p = roundTo(price, d.price); const sz = floorTo(size, d.size);
  if (!(p > 0 && p < 1)) throw new Error('Price must be between 0 and 1');
  if (!(sz > 0)) throw new Error('Size is too small');
  let amt = p * sz; if (decimalsOf(amt) > d.amount) { amt = ceilTo(amt, d.amount + 4); if (decimalsOf(amt) > d.amount) amt = floorTo(amt, d.amount); }
  return side === 'BUY' ? { makerAmount: to6(amt), takerAmount: to6(sz), price: p, size: sz } : { makerAmount: to6(sz), takerAmount: to6(amt), price: p, size: sz };
}
export interface V2Order { salt: number; maker: string; signer: string; tokenId: string; makerAmount: string; takerAmount: string; side: 0 | 1; signatureType: 0; timestamp: string; metadata: Hex; builder: Hex }
export function buildOrder(p: { maker: string; tokenId: string; side: 'BUY' | 'SELL'; price: number; size: number; tickSize: number; builder?: string; now?: number; salt?: number }): V2Order {
  const a = orderAmounts(p.side, p.price, p.size, p.tickSize);
  const builder = /^0x[0-9a-fA-F]{64}$/.test(p.builder ?? '') ? (p.builder as Hex) : ZERO32;
  return { salt: p.salt ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), maker: p.maker, signer: p.maker, tokenId: p.tokenId, makerAmount: a.makerAmount, takerAmount: a.takerAmount, side: p.side === 'BUY' ? 0 : 1, signatureType: 0, timestamp: String(p.now ?? Date.now()), metadata: ZERO32, builder };
}
export function orderDigest(o: V2Order, negRisk: boolean): Hex {
  return hashTypedData({
    domain: { name: 'Polymarket CTF Exchange', version: '2', chainId: POLYGON, verifyingContract: negRisk ? EXCHANGES.negRisk : EXCHANGES.ctf },
    types: { Order: [
      { name: 'salt', type: 'uint256' }, { name: 'maker', type: 'address' }, { name: 'signer', type: 'address' }, { name: 'tokenId', type: 'uint256' },
      { name: 'makerAmount', type: 'uint256' }, { name: 'takerAmount', type: 'uint256' }, { name: 'side', type: 'uint8' }, { name: 'signatureType', type: 'uint8' },
      { name: 'timestamp', type: 'uint256' }, { name: 'metadata', type: 'bytes32' }, { name: 'builder', type: 'bytes32' },
    ] },
    primaryType: 'Order',
    message: { salt: BigInt(o.salt), maker: o.maker as Hex, signer: o.signer as Hex, tokenId: BigInt(o.tokenId), makerAmount: BigInt(o.makerAmount), takerAmount: BigInt(o.takerAmount), side: o.side, signatureType: o.signatureType, timestamp: BigInt(o.timestamp), metadata: o.metadata, builder: o.builder },
  });
}
export function orderBody(o: V2Order, signature: Hex, owner: string, orderType: 'GTC' | 'FOK'): string {
  return JSON.stringify({ order: { salt: o.salt, maker: o.maker, signer: o.signer, tokenId: o.tokenId, makerAmount: o.makerAmount, takerAmount: o.takerAmount, side: o.side === 0 ? 'BUY' : 'SELL', signatureType: o.signatureType, timestamp: o.timestamp, metadata: o.metadata, builder: o.builder, expiration: '0', signature }, owner, orderType, deferExec: false });
}
export async function postOrder(c: Creds, address: string, body: string, f: F = fetch): Promise<any> {
  const headers = { 'content-type': 'application/json', ...(await l2Headers(c, address, 'POST', '/order', body)) };
  const r = await f(`${CLOB}/order`, { method: 'POST', headers, body, signal: AbortSignal.timeout(15000) });
  const b = await r.json().catch(() => null);
  if (!r.ok || b?.success === false || b?.error || b?.errorMsg) throw new Error(b?.errorMsg || b?.error || `Order rejected (${r.status})`);
  return b;
}
