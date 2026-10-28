// Shared pieces for the ramps / fund / discover screens: external-link helper, cached catalog loader, tiny view-state helpers,
// per-viewer preferences (localStorage, always try/catch) and small presentational components. Uses only theme tokens (no raw colors).
import { userText } from '../../../core/errors';
import React, { useEffect, useState } from 'react';
import { T } from '../../theme';
import { Ic, ICON, Skeleton, Btn, Spinner } from '../ui';

export type Bg = (m: any) => Promise<any>;
export const ON_BRAND = 'var(--hb-on-brand)';

/** Open an https URL in a new tab, never an in-extension navigation. Returns false when the URL is not https. */
export function openHttps(url: string): boolean {
  try { const u = new URL(url); if (u.protocol !== 'https:' || u.username || u.password) return false; window.open(u.toString(), '_blank', 'noopener,noreferrer'); return true; } catch { return false; }
}
export function download(filename: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---- per-viewer preferences (a convenience only; the screens work without it)
const PREF = 'harbour:ramps:prefs';
export interface RampPrefs { fiat?: string; recent?: string[] }
export const readPrefs = (): RampPrefs => { try { const v = JSON.parse(localStorage.getItem(PREF) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
export const writePrefs = (p: Partial<RampPrefs>) => { try { localStorage.setItem(PREF, JSON.stringify({ ...readPrefs(), ...p })); } catch { /* storage blocked */ } };

// ---- catalog (rampsConfig) loaded once per popup session
export interface RampCfg {
  fiats: Array<{ code: string; name: string; popular: boolean; suggested: number[]; defaultAmount: number }>;
  assets: Array<{ assetId: string; symbol: string; name: string; chainId: string; chainName: string; isNative: boolean; cg?: string; providers: string[] }>;
  providers: KeyProvider[]; categories: Record<string, string>; cexProviders: Array<{ id: string; name: string; needsPlatform: boolean }>;
}
export interface KeyProvider { id: string; name: string; docsUrl: string; note?: string; widgetOnly: boolean; modes: string[]; fields: Array<{ field: string; label: string; hint: string; optional: boolean; configured: boolean; preview: string }> }
let cfgPromise: Promise<RampCfg> | null = null;
export const loadRampCfg = (bg: Bg, force = false): Promise<RampCfg> => {
  if (!cfgPromise || force) cfgPromise = bg({ type: 'rampsConfig' }).then((r) => { if (!r?.ok) throw new Error(r?.error ?? 'Could not load'); return r as RampCfg; }).catch((e) => { cfgPromise = null; throw e; });
  return cfgPromise;
};
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string; loading: boolean; reload: () => void } {
  const [s, set] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true; set((x) => ({ ...x, loading: true, error: '' }));
    fn().then((data) => { if (live) set({ data, error: '', loading: false }); }).catch((e) => { if (live) set({ data: null, error: String(e?.message ?? 'Something went wrong'), loading: false }); });
    return () => { live = false; };
  }, [...deps, n]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...s, reload: () => setN((x) => x + 1) };
}
export const useDebounced = <V,>(v: V, ms: number): V => { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; };

// ---- presentational
export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; label?: string }> = ({ value, onChange, placeholder, autoFocus, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgAlt, borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
    <Ic d={ICON.search} size={18} />
    <input aria-label={label ?? placeholder} autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: T.text, minWidth: 0 }} />
  </label>
);
export const Chip: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }> = ({ active, onClick, children, title }) => (
  <button type="button" onClick={onClick} title={title} aria-pressed={!!active} className="hb-tap" style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 999, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: active ? T.accent : T.bgAlt, color: active ? ON_BRAND : T.sub }}>{children}</button>
);
export const ChipRow: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="scrollbar-hide" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 12px' }}>{children}</div>;
export const Notice: React.FC<{ tone?: 'info' | 'error' | 'warn'; children: React.ReactNode; action?: { label: string; onClick: () => void } }> = ({ tone = 'info', children, action }) => {
  const c = tone === 'error' ? { bg: 'var(--hb-error-soft)', line: T.error, ink: T.error } : tone === 'warn' ? { bg: 'var(--hb-warn-bg)', line: 'var(--hb-warn-line)', ink: 'var(--hb-warn-ink)' } : { bg: T.bgAlt, line: T.border, ink: T.text };
  return (
    <div role={tone === 'error' ? 'alert' : 'note'} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: c.bg, border: `1px solid ${c.line}`, color: c.ink, borderRadius: 14, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, margin: '8px 0' }}>
      <span style={{ marginTop: 1 }}><Ic d={ICON.info} size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>{tone === 'error' && typeof children === 'string' ? userText(children) : children}{action && <div><button type="button" onClick={action.onClick} style={{ border: 'none', background: 'none', padding: '6px 0 0', color: T.accent, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{action.label}</button></div>}</div>
    </div>
  );
};
export const Letter: React.FC<{ name: string; size?: number; src?: string }> = ({ name, size = 40, src }) => {
  const [bad, setBad] = useState(false);
  if (src && !bad) return <img src={src} alt="" width={size} height={size} onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: size * 0.3, objectFit: 'cover', flexShrink: 0, background: T.bgAlt }} />;
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: size * 0.3, background: T.accentSoft, color: T.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.42, flexShrink: 0 }}>{(name.trim()[0] ?? '?').toUpperCase()}</span>;
};
export const ListSkeleton: React.FC<{ n?: number }> = ({ n = 6 }) => <>{Array.from({ length: n }, (_, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}><Skeleton w={40} h={40} r={12} /><div style={{ flex: 1 }}><Skeleton w="55%" h={13} /><div style={{ height: 6 }} /><Skeleton w="35%" h={10} /></div></div>)}</>;
export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" style={{ textAlign: 'center', padding: '36px 16px', color: T.sub }}>
    <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>{userText(message)}</div>
    {onRetry && <div style={{ maxWidth: 200, margin: '12px auto 0' }}><Btn variant="ghost" onClick={onRetry}>Try again</Btn></div>}
  </div>
);
export const Busy: React.FC<{ label?: string }> = ({ label }) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, color: T.sub, fontSize: 13 }}><Spinner size={18} />{label}</div>;
export const ago = (ms: number): string => {
  if (!ms) return ''; const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`; if (s < 86400) return `${Math.round(s / 3600)}h ago`; if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(ms).toLocaleDateString();
};
export const fmtCrypto = (n: number | null | undefined, max = 6): string => (n == null ? '—' : n === 0 ? '0' : n < 10 ** -max ? `<${(10 ** -max).toFixed(max)}` : Number(n.toPrecision(Math.min(12, max + 4))).toLocaleString(undefined, { maximumFractionDigits: max }));
export const fmtFiat = (n: number, cur: string): string => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n); } catch { return `${n.toLocaleString()} ${cur}`; } };
