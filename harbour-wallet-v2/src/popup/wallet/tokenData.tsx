import React, { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../theme';
import { Ic, ICON, Coin, Row, Skeleton, Empty, Spinner } from './ui';
import type { ChartPoint, ChartResult, ChartRange, MarketInfo } from '../../core/marketData';
import type { HistoryItem } from '../../core/txHistory';

type Bg = (m: any) => Promise<any>;

// ---------- chart ----------
export function useChart(bg: Bg, assetId: string, range: ChartRange) {
  const [state, setState] = useState<{ data: ChartResult | null; error: string; loading: boolean }>({ data: null, error: '', loading: true });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let dead = false; setState({ data: null, error: '', loading: true });
    bg({ type: 'tokenChart', assetId, range }).then((r) => {
      if (dead) return;
      setState(r?.ok ? { data: r.data, error: '', loading: false } : { data: null, error: r?.error || 'Price chart unavailable right now.', loading: false });
    }).catch(() => { if (!dead) setState({ data: null, error: 'Price chart unavailable right now.', loading: false }); });
    return () => { dead = true; };
  }, [assetId, range, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, retry: () => setNonce((n) => n + 1) };
}

const fmtTime = (t: number, range: ChartRange) => {
  const d = new Date(t);
  return range === '1H' || range === '1D' ? d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const PriceChart: React.FC<{ points: ChartPoint[]; up: boolean; range: ChartRange; h?: number; onScrub?: (p: ChartPoint | null) => void }> = ({ points, up, range, h = 130, onScrub }) => {
  const w = 320; const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    const ps = points.map((x) => x.p); const min = Math.min(...ps); const max = Math.max(...ps); const span = max - min || max * 0.01 || 1;
    const t0 = points[0].t; const t1 = points[points.length - 1].t; const tspan = t1 - t0 || 1;
    const xy = points.map((x) => [((x.t - t0) / tspan) * w, h - 6 - ((x.p - min) / span) * (h - 14)] as const);
    return xy;
  }, [points, h]);
  const col = up ? T.success : T.error;
  const line = geo.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect(); if (!r || !r.width) return;
    const x = ((clientX - r.left) / r.width) * w; let best = 0; let bd = Infinity;
    geo.forEach(([gx], i) => { const d = Math.abs(gx - x); if (d < bd) { bd = d; best = i; } });
    setHover(best); onScrub?.(points[best]);
  };
  const leave = () => { setHover(null); onScrub?.(null); };
  const hp = hover != null ? points[hover] : null;
  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Price chart" style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
        onPointerMove={(e) => move(e.clientX)} onPointerDown={(e) => move(e.clientX)} onPointerLeave={leave} onPointerUp={leave}>
        <polyline points={line} fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,${h} ${line} ${w},${h}`} fill={col} opacity="0.08" />
        {hover != null && <line x1={geo[hover][0]} x2={geo[hover][0]} y1={0} y2={h} stroke={T.sub} strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hp && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: T.sub, pointerEvents: 'none' }}>{fmtTime(hp.t, range)}</div>}
    </div>
  );
};

// ---------- history ----------
export function useHistory(bg: Bg, assetId: string, address: string) {
  const [s, setS] = useState<{ items: HistoryItem[] | null; error: string }>({ items: null, error: '' });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let dead = false; setS({ items: null, error: '' });
    bg({ type: 'txHistory', assetId, address }).then((r) => { if (!dead) setS(r?.ok ? { items: r.items, error: '' } : { items: [], error: r?.error || 'Could not load history right now.' }); })
      .catch(() => { if (!dead) setS({ items: [], error: 'Could not load history right now.' }); });
    return () => { dead = true; };
  }, [assetId, address, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...s, retry: () => setNonce((n) => n + 1) };
}

const short = (a?: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? '');
const when = (t: number) => {
  if (!t) return 'Pending';
  const d = new Date(t); const now = new Date();
  return d.toDateString() === now.toDateString() ? `Today ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};
const trim = (amt: string) => { const n = Number(amt); return !amt ? '' : n === 0 ? '0' : n < 0.0001 ? '<0.0001' : n.toLocaleString(undefined, { maximumFractionDigits: 6 }); };

export const HistoryRow: React.FC<{ x: HistoryItem; color?: string; network?: string }> = ({ x, color, network }) => {
  const minted = x.kind === 'receive' && x.method === 'Mint';
  const title = x.kind === 'send' ? 'Sent' : x.kind === 'receive' ? (minted ? 'Minted' : 'Received') : x.kind === 'self' ? 'Sent to self' : x.kind === 'approve' ? 'Approved' : x.kind === 'revoke' ? 'Revoked' : x.kind === 'swap' ? 'Swapped'
    : (x.method && x.method !== 'Transaction' ? x.method.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Contract interaction');
  const sign = x.kind === 'send' ? '-' : x.kind === 'receive' || x.kind === 'swap' ? '+' : x.kind === 'contract' && x.token ? (x.method === 'Deposit' || x.method === 'Repay' ? '-' : x.method === 'Withdraw' || x.method === 'Borrow' ? '+' : '') : '';
  const amt = x.kind === 'approve' && x.unlimited ? 'Unlimited' : trim(x.amount);
  const icon = x.kind === 'send' ? 'send' : x.kind === 'receive' ? 'receive' : x.kind === 'approve' ? 'check' : x.kind === 'revoke' ? 'close' : 'swap';
  const who = x.kind === 'swap' && x.swap ? `-${trim(x.swap.sent.amount)} ${x.swap.sent.symbol}`
    : (x.kind === 'approve' || x.kind === 'revoke') ? (x.spender ? `Spender ${short(x.spender)}` : undefined)
    : x.counterparty && !minted ? `${x.kind === 'receive' ? 'From' : 'To'} ${short(x.counterparty)}` : undefined;
  const chip = x.status === 'failed' ? <span style={{ color: T.error, fontWeight: 600 }}>Failed</span> : x.status === 'pending' ? <span style={{ fontWeight: 600 }}>Pending</span> : null;
  const detail = chip ? (who ? <>{chip} · {who}</> : chip) : who;
  // In the all-networks feed the row also names its network, since the same address and symbol repeat across chains.
  const sub = network ? (detail ? <>{detail} · {network}</> : network) : detail;
  const good = (x.kind === 'receive' || x.kind === 'swap') && x.status !== 'failed';
  return (
    <Row onClick={x.url ? () => window.open(x.url, '_blank', 'noopener,noreferrer') : undefined}
      left={<div style={{ position: 'relative' }}><Coin sym={x.symbol} color={color} /><span style={{ position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 999, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.sub }}><Ic d={ICON[icon]} size={12} /></span></div>}
      title={title} sub={sub}
      right={amt ? <span style={{ color: good ? T.success : T.text }}>{sign}{amt} {x.symbol}</span> : undefined} rightSub={when(x.timestamp)} />
  );
};

export const HistoryList: React.FC<{ s: ReturnType<typeof useHistory>; color?: string; explorerHint?: string }> = ({ s, color }) => {
  if (s.items == null) return <>{[0, 1, 2].map((i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'center' }}><Skeleton w={40} h={40} r={999} /><div style={{ flex: 1 }}><Skeleton w={120} h={12} /><div style={{ height: 6 }} /><Skeleton w={80} h={10} /></div></div>)}</>;
  if (s.error) return <div style={{ textAlign: 'center', padding: '28px 12px', color: T.sub, fontSize: 14 }}>{s.error}<div><button type="button" className="hb-tap" onClick={s.retry} style={{ marginTop: 12, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 999, padding: '8px 18px', fontWeight: 700, cursor: 'pointer' }}>Retry</button></div></div>;
  if (!s.items.length) return <Empty title="No transactions yet" sub="Your activity for this asset will appear here." icon="history" />;
  return <>{s.items.map((x) => <HistoryRow key={x.id} x={x} color={color} />)}</>;
};

// ---------- market info (About tab) ----------
export function useInfo(bg: Bg, assetId: string, enabled: boolean) {
  const [s, setS] = useState<{ info: MarketInfo | null; error: string; loading: boolean }>({ info: null, error: '', loading: true });
  useEffect(() => {
    if (!enabled) return; let dead = false;
    bg({ type: 'tokenInfo', assetId }).then((r) => { if (!dead) setS(r?.ok ? { info: r.data, error: '', loading: false } : { info: null, error: r?.error || 'Market info unavailable right now.', loading: false }); })
      .catch(() => { if (!dead) setS({ info: null, error: 'Market info unavailable right now.', loading: false }); });
    return () => { dead = true; };
  }, [assetId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}
const compact = (n?: number) => (n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
const supply = (n: number | undefined, sym: string) => (n == null ? '—' : `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${sym}`);
export const AboutPanel: React.FC<{ s: ReturnType<typeof useInfo>; sym: string; name: string }> = ({ s, sym, name }) => {
  if (s.loading) return <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>;
  if (!s.info) return <div style={{ color: T.sub, fontSize: 14, textAlign: 'center', padding: 20 }}>{s.error}</div>;
  const i = s.info;
  const rows: Array<[string, string]> = [['Market cap', compact(i.marketCap)], ['24h volume', compact(i.volume24h)], ['Circulating supply', supply(i.circulating, sym)], ['Total supply', supply(i.total, sym)]];
  return <>
    <div style={{ background: T.bgAlt, borderRadius: 14, padding: '4px 14px' }}>
      {rows.map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: 14 }}><span style={{ color: T.sub }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>)}
    </div>
    {i.description && <div style={{ color: T.sub, fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>{i.description}</div>}
    {i.website && <a href={i.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 10, color: T.accent, fontWeight: 600, fontSize: 14 }}>{name} website</a>}
    <div style={{ color: T.sub, fontSize: 11.5, marginTop: 12 }}>Market data: CoinGecko.</div>
  </>;
};

