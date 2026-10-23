// Popup-side helpers for Send / Receive / Transaction detail. Imports only `core/chains/send/{types,util}` (no wallet-core) so the popup bundle stays light.
import { useCallback, useEffect, useRef, useState } from 'react';
import { assetOf, type Asset } from '../data';
import { tokenItem } from '../tokensStore';
import { customNetworks } from '../../../core/networkRegistry';
import { resolveSendChain } from '../../../core/sendService';
import type { ChainInfo } from '../../../core/chains/types';
import type { FeeTierId, IssueCode, MemoKind } from '../../../core/chains/send/types';
import { formatUnits } from '../../../core/chains/send/util';
import { getSettingsState } from '../../settingsStore';
import type { Ctx } from '../types';

export interface WireTier { id: FeeTierId; fee: string; feeMax?: string; max: string; detail?: string }
export interface WireIssue { code: IssueCode; message: string; blocking: boolean }
export interface WireQuote { tiers: WireTier[]; defaultTier: FeeTierId; feeSymbol: string; feeDecimals: number; nativeBalance: string; assetBalance: string; issues: WireIssue[]; reserve?: string; recipientIsContract?: boolean; recipientInactive?: boolean }
export interface QuoteResp { ok: true; quote: WireQuote; tier: FeeTierId; amountRaw: string; from: string; to: string; memoKind: MemoKind; symbol: string; decimals: number; assetKey: string; risk: null | { newRecipient: boolean; inAddressBook: boolean; contactName?: string; selfSend: boolean ; flagged?: boolean; flags?: string[] } }
export interface SupportInfo { id: string; supported: boolean; reason?: string; memo: MemoKind; tokens: boolean }

export const chainOfAsset = (a: Asset | undefined): ChainInfo | undefined => (a ? (a.token ? resolveSendChain(undefined, a.token.chainId, customNetworks()) : resolveSendChain(a.id, undefined, customNetworks())) : undefined);
/** Asset descriptor the background understands: chain registry id + optional custom-token id. */
export const sendTarget = (assetId: string) => { const a = assetOf(assetId); const chain = chainOfAsset(a); return { a, chain, chainId: chain?.id ?? '', tokenId: a?.token ? a.id : undefined }; };

export const fmtAmount = (raw: string | bigint, decimals: number, maxFrac = 8): string => {
  const s = formatUnits(BigInt(raw), decimals); const [w, f = ''] = s.split('.'); const frac = f.slice(0, maxFrac).replace(/0+$/, '');
  return `${w}${frac ? '.' + frac : ''}`;
};
export const decimalOnly = (v: string, decimals: number): string => { let s = v.replace(/,/g, '.').replace(/[^0-9.]/g, ''); const i = s.indexOf('.'); if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, decimals); return s; };
export const shortAddr = (a: string, n = 6) => (a && a.length > 2 * n + 3 ? `${a.slice(0, n)}…${a.slice(-4)}` : a);

/** USD price per unit of the asset (live, from balances / token store), or null when unknown. */
export function priceUsd(c: Ctx, assetId: string): number | null {
  const a = assetOf(assetId); if (!a) return null;
  if (a.token) { const t = tokenItem(assetId); return t?.price ?? null; }
  const p = c.balances[assetId]?.price; return typeof p === 'number' && p > 0 ? p : null;
}
export const fiatCtx = () => getSettingsState().fiat;
/** crypto amount text from a fiat text typed in the user's base currency. */
export function fiatToCrypto(fiatText: string, price: number, decimals: number): string {
  const f = Number(fiatText); if (!(f > 0) || !(price > 0)) return '';
  const usd = f * fiatCtx().usdPer; return (usd / price).toFixed(Math.min(decimals, 12)).replace(/\.?0+$/, '');
}

let supportCache: Record<string, SupportInfo> | null = null; let supportPending: Promise<void> | null = null;
export function useSendSupport(bg: Ctx['bg'], needId?: string): Record<string, SupportInfo> | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (supportCache && (!needId || supportCache[needId])) return; // a network added after the first fetch must trigger a refresh
    supportPending ??= bg({ type: 'sendSupport' }).then((r) => { if (r?.ok) supportCache = Object.fromEntries((r.chains as SupportInfo[]).map((c) => [c.id, c])); }).catch(() => {}).finally(() => { supportPending = null; });
    void supportPending.then(() => force((n) => n + 1));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bg]);
  return supportCache;
}

export interface QuoteReq { chainId: string; tokenId?: string; to: string; amount: string; memo: string; isMax: boolean; tier: FeeTierId }
/** Debounced fee / balance / validation quote from the background with periodic refresh and stale-response protection. */
export function useQuote(bg: Ctx['bg'], req: QuoteReq | null, opts: { refreshMs?: number; enabled?: boolean } = {}) {
  const { refreshMs = 15000, enabled = true } = opts;
  const [state, setState] = useState<{ data: QuoteResp | null; error: string | null; loading: boolean; at: number }>({ data: null, error: null, loading: false, at: 0 });
  const seq = useRef(0); const key = req ? JSON.stringify(req) : '';
  const run = useCallback(async (silent: boolean) => {
    if (!req || !enabled) return; const my = ++seq.current; if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    const r = await bg({ type: 'sendQuote', ...req }).catch(() => null);
    if (my !== seq.current) return;
    if (r?.ok) setState({ data: r, error: null, loading: false, at: Date.now() });
    else setState((s) => ({ data: silent ? s.data : null, error: r?.error ?? 'Could not reach the network. Check your connection and try again.', loading: false, at: s.at }));
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!req || !enabled) { seq.current++; setState({ data: null, error: null, loading: false, at: 0 }); return; } const t = setTimeout(() => void run(false), 350); return () => clearTimeout(t); }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!req || !enabled || !refreshMs) return; const t = setInterval(() => void run(true), refreshMs); return () => clearInterval(t); }, [key, enabled, refreshMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, refresh: () => run(false) };
}
export const tierOf = (q: WireQuote | undefined | null, id: FeeTierId): WireTier | undefined => q?.tiers.find((t) => t.id === id) ?? q?.tiers[1];
export const tiersDiffer = (q: WireQuote | undefined | null) => !!q && new Set(q.tiers.map((t) => t.fee)).size > 1;

export const TIER_LABEL: Record<FeeTierId, string> = { slow: 'Safe', average: 'Average', fast: 'Fast' };
export const MEMO_LABEL: Record<MemoKind, { label: string; placeholder: string }> = {
  none: { label: '', placeholder: '' }, memo: { label: 'Memo', placeholder: 'Memo (optional)' }, tag: { label: 'Destination Tag', placeholder: 'Destination Tag (optional)' }, comment: { label: 'Comment', placeholder: 'Comment (optional)' },
};
export const openExternal = (url: string) => { if (/^https:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer'); };
export const copyText = async (t: string): Promise<boolean> => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };
