// Shared provider-adapter kit: error type, descriptors, payment-category mapping, asset code tables, small fetch helpers.
// Confidence (see evidences/re-evidence/36-ramps/SPEC.md): provider URL parameter names follow each provider's public integration docs [likely];
// quote response shapes follow public docs [likely]/[guessing] and are UNVERIFIED live (build sandbox egress is blocked).
import type { Fetcher, PaymentCategoryId, RampAsset, RampMode, RampProviderId, RampQuote, QuoteRequest } from './types';
import { chainById } from '../chains/index';

export class ProviderError extends Error {
  constructor(public kind: 'needs_key' | 'unsupported' | 'error', message: string) { super(message); }
}
export interface KeyField { field: string; label: string; hint: string; pattern: RegExp; optional?: boolean }
export interface ProviderCode { crypto: string; network: string }
export interface WidgetInput { mode: RampMode; asset: RampAsset; fiat: string; amount: string; address: string; category?: PaymentCategoryId; subProvider?: string }
export interface ProviderDef {
  id: RampProviderId; name: string; modes: RampMode[]; docsUrl: string; hosts: readonly string[];
  keyFields: KeyField[];
  quoteNeeds: string[]; widgetNeeds: string[];
  widgetOnly?: boolean;
  note?: string;
  code(asset: RampAsset): ProviderCode | undefined;
  quote?(req: QuoteRequest, code: ProviderCode, keys: Record<string, string>, f: Fetcher): Promise<RampQuote[]>;
  widget(input: WidgetInput, code: ProviderCode, keys: Record<string, string>): { url: URL; addressField?: string };
}

export const KEY = /^[A-Za-z0-9_.\-]{4,128}$/;
const TIMEOUT = 8000;

export const PAYMENT_CATEGORIES: Record<PaymentCategoryId, string> = {
  card: 'Credit / debit card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank: 'Bank transfer', sepa: 'SEPA bank transfer', ach: 'ACH bank transfer', instant: 'Instant bank payment', other: 'Other',
};
export function categoryOf(method: string): PaymentCategoryId {
  const m = String(method ?? '').toLowerCase().replace(/[\s\-]+/g, '_');
  if (m.includes('apple')) return 'apple_pay';
  if (m.includes('google')) return 'google_pay';
  if (m.includes('sepa')) return 'sepa';
  if (m.includes('ach')) return 'ach';
  if (m.includes('open_banking') || m.includes('instant') || m.includes('pix') || m.includes('faster') || m.includes('fps')) return 'instant';
  if (m.includes('bank') || m.includes('wire') || m.includes('transfer')) return 'bank';
  if (m.includes('card') || m.includes('credit') || m.includes('debit') || m.includes('visa') || m.includes('master')) return 'card';
  return 'other';
}
export const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) && n >= 0 ? n : null; };
export const qid = (p: RampProviderId, cat: string, extra = '') => `${p}:${cat}${extra ? ':' + extra : ''}`;
export async function getJson(f: Fetcher, url: string, init: RequestInit = {}): Promise<any> {
  const res = await f(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), headers: { accept: 'application/json', ...(init.headers as any) } });
  let body: any = null; try { body = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new ProviderError('needs_key', `Rejected the API key (HTTP ${res.status})`);
    throw new ProviderError('error', String(body?.error?.message ?? body?.message ?? (typeof body?.error === 'string' ? body.error : '') ?? '').slice(0, 200) || `HTTP ${res.status}`);
  }
  return body;
}
export const need = (keys: Record<string, string>, fields: string[], name: string) => {
  const miss = fields.filter((k) => !keys[k]);
  if (miss.length) throw new ProviderError('needs_key', `${name} needs ${miss.join(', ')}`);
};
export const toUnits = (amount: string, decimals: number): string => {
  const [w, fr = ''] = amount.split('.'); const frac = (fr + '0'.repeat(decimals)).slice(0, decimals);
  return (BigInt(w || '0') * 10n ** BigInt(decimals) + BigInt(frac || '0')).toString();
};
export const fromUnits = (raw: unknown, decimals: number): number | null => {
  try { const b = BigInt(String(raw)); const base = 10n ** BigInt(decimals); return Number(b / base) + Number(b % base) / Number(base); } catch { return null; }
};
export const assetDecimals = (a: RampAsset): number => a.isNative ? (chainById(a.chainId)?.decimals ?? 18) : 6;
export const firstRejection = (rows: PromiseSettledResult<unknown>[], fallback: string): ProviderError => {
  const r = rows.find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined;
  return r?.reason instanceof ProviderError ? r.reason : new ProviderError('error', fallback);
};

// ---- per-provider network code tables (chain id -> provider network) [likely]
export const TRANSAK_NET: Record<string, string> = { ethereum: 'ethereum', smartchain: 'bsc', polygon: 'polygon', arbitrum: 'arbitrum', optimism: 'optimism', base: 'base', avalanchec: 'avaxcchain', solana: 'solana', bitcoin: 'mainnet', tron: 'tron', ton: 'ton' };
export const RAMP_PREFIX: Record<string, string> = { ethereum: 'ETH', smartchain: 'BSC', polygon: 'MATIC', arbitrum: 'ARBITRUM', optimism: 'OPTIMISM', base: 'BASE', avalanchec: 'AVAX', solana: 'SOLANA', bitcoin: 'BITCOIN', tron: 'TRON', ton: 'TON' };
export const MERCURYO_NET: Record<string, string> = { ethereum: 'ETHEREUM', smartchain: 'BINANCESMARTCHAIN', polygon: 'POLYGON', arbitrum: 'ARBITRUM', optimism: 'OPTIMISM', base: 'BASE', avalanchec: 'AVALANCHE', solana: 'SOLANA', bitcoin: 'BITCOIN', tron: 'TRON', ton: 'TON' };
export const BANXA_NET: Record<string, string> = { ethereum: 'ETH', smartchain: 'BSC', polygon: 'MATIC', arbitrum: 'ARBITRUM', optimism: 'OPTIMISM', base: 'BASE', avalanchec: 'AVAX', solana: 'SOL', bitcoin: 'BTC', tron: 'TRON', ton: 'TON' };
const MP_SUFFIX: Record<string, string> = { smartchain: 'bsc', polygon: 'polygon', arbitrum: 'arbitrum', optimism: 'optimism', base: 'base', avalanchec: 'cchain', solana: 'sol', tron: 'trx', ton: 'ton' };
/** MoonPay/Onramper-style composite crypto id: "eth", "bnb_bsc", "usdc_polygon". */
export function compositeCode(a: RampAsset): string | undefined {
  const sym = a.symbol.toLowerCase();
  if (a.chainId === 'ethereum' || a.chainId === 'bitcoin') return sym;
  if (a.isNative && ['solana', 'ton', 'tron'].includes(a.chainId)) return sym;
  const sfx = MP_SUFFIX[a.chainId]; if (!sfx) return undefined;
  if (a.chainId === 'polygon' && a.isNative) return 'pol_polygon';
  if (a.isNative && sym === 'eth') return `eth_${sfx}`;
  if (!a.isNative && a.chainId === 'solana') return `${sym}_sol`;
  return `${sym}_${sfx}`;
}
