// Predictions (Polymarket) screens: markets, portfolio, wrap USDC.e -> pUSD, and a buy/sell ticket. Shown only when the remote
// `predictions` flag is on; trading also requires Polymarket's region check to pass (checked in the background).
import React, { useCallback, useEffect, useState } from 'react';
import { T } from '../../theme';
import { Screen, Btn, Row, Empty, Spinner } from '../ui';
import { Notice } from './earnParts';
import type { Ctx } from '../screens';

const usd = (n: number, d = 2) => (Number.isFinite(n) ? `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}` : '—');
const cents = (p?: number) => (p == null ? '—' : `${Math.round(p * 1000) / 10}¢`);
const card: React.CSSProperties = { background: T.bgAlt, borderRadius: 14, padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 18, fontWeight: 700, color: T.text };
const sub: React.CSSProperties = { fontSize: 12, color: T.sub };
const pnl = (n: number) => (n > 0 ? 'var(--hb-success, #2ea36d)' : n < 0 ? T.error : T.sub);
function useLoad<X>(fn: () => Promise<X>, deps: unknown[]) {
  const [s, setS] = useState<{ data: X | null; err: string; loading: boolean }>({ data: null, err: '', loading: true });
  const load = useCallback(() => { setS((p) => ({ ...p, loading: true, err: '' })); fn().then((data) => setS({ data, err: '', loading: false })).catch((e) => setS({ data: null, err: String(e?.message ?? e), loading: false })); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]); return { ...s, reload: load };
}
const must = async (p: Promise<any>) => { const r = await p; if (!r?.ok) throw new Error(r?.error ?? 'Request failed'); return r; };

const PredictionsHome: React.FC<Ctx> = (c) => {
  const [tab, setTab] = useState<'markets' | 'portfolio'>('markets'); const [q, setQ] = useState('');
  const mk = useLoad(() => must(c.bg({ type: 'predictionMarkets', q: q || undefined })), [q]);
  const pf = useLoad(() => (tab === 'portfolio' ? must(c.bg({ type: 'predictionPortfolio' })) : Promise.resolve(null)), [tab]);
  const [wrap, setWrap] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const pill = (on: boolean): React.CSSProperties => ({ flex: 1, padding: '9px 0', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 800, background: on ? T.accent : T.bgAlt, color: on ? 'var(--hb-on-brand)' : T.text });
  const doWrap = async () => { setBusy(true); setMsg(''); const r = await c.bg({ type: 'predictionWrap', amount: String(Math.round(Number(wrap) * 1e6)) }).catch((e) => ({ ok: false, error: String(e?.message ?? e) })); setBusy(false); setMsg(r?.ok ? 'pUSD ready to trade' : r?.error ?? 'Failed'); if (r?.ok) pf.reload(); };
  return (
    <Screen title="Predictions" onBack={c.nav.pop}>
      {mk.data?.tradingBlocked && <Notice>Polymarket does not allow trading from your region{mk.data.country ? ` (${mk.data.country})` : ''}. You can still browse markets.</Notice>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><button type="button" style={pill(tab === 'markets')} onClick={() => setTab('markets')}>Markets</button><button type="button" style={pill(tab === 'portfolio')} onClick={() => setTab('portfolio')}>Portfolio</button></div>
      {tab === 'markets' ? <>
        <div style={{ ...card, padding: '8px 12px' }}><input style={{ ...input, fontSize: 14 }} placeholder="Search markets" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {mk.loading && !mk.data ? <Spinner /> : mk.err ? <Notice tone="error" action={{ label: 'Retry', onClick: mk.reload }}>{mk.err}</Notice> : !mk.data?.markets?.length ? <Empty title="No markets" /> :
          mk.data.markets.map((m: any) => <Row key={m.id} onClick={() => c.nav.push('predictionMarket', { id: m.id })} left={m.image ? <img src={m.image} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 36 }} />}
            title={<span style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{m.question}</span>} sub={`${m.outcomes.map((o: string, i: number) => `${o} ${cents(m.prices[i])}`).join(' · ')} · Vol ${usd(m.volume, 0)}`} />)}
      </> : pf.loading && !pf.data ? <Spinner /> : pf.err ? <Notice tone="error" action={{ label: 'Retry', onClick: pf.reload }}>{pf.err}</Notice> : pf.data && <>
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Balance</div>
          <div style={sub}>pUSD {pf.data.pusd != null ? (Number(pf.data.pusd) / 1e6).toFixed(2) : '—'} · USDC.e {pf.data.usdce != null ? (Number(pf.data.usdce) / 1e6).toFixed(2) : '—'} (Polygon)</div>
          {!pf.data.tradingBlocked && <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input style={input} value={wrap} onChange={(e) => setWrap(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" /><span style={{ ...sub, fontWeight: 700 }}>USDC.e</span>
            <Btn style={{ width: 120 }} disabled={busy || !(Number(wrap) > 0)} onClick={doWrap}>{busy ? '…' : 'Wrap to pUSD'}</Btn>
          </div>}
          {msg && <div role="status" style={{ ...sub, marginTop: 8 }}>{msg}</div>}
        </div>
        <div style={{ fontWeight: 800, margin: '6px 4px' }}>Positions</div>
        {pf.data.positions.length === 0 ? <div style={{ ...sub, margin: '0 4px 12px' }}>No positions yet</div> : pf.data.positions.map((p: any) => (
          <Row key={p.asset} title={<span style={{ whiteSpace: 'normal' }}>{p.title}</span>} sub={`${p.outcome} · ${p.size.toFixed(2)} shares @ ${cents(p.avgPrice)} → ${cents(p.curPrice)}${p.redeemable ? ' · Redeemable on polymarket.com' : ''}`} right={usd(p.value)} rightSub={<span style={{ color: pnl(p.pnl) }}>{usd(p.pnl)}</span>} left={<div style={{ width: 4 }} />} />
        ))}
        {pf.data.activity.length > 0 && <><div style={{ fontWeight: 800, margin: '6px 4px' }}>Activity</div>{pf.data.activity.slice(0, 20).map((a: any, i: number) => (
          <Row key={`${a.tx}-${i}`} left={<div style={{ width: 4 }} />} title={<span style={{ whiteSpace: 'normal' }}>{a.title}</span>} sub={`${a.type} ${a.side} ${a.outcome} · ${new Date(a.time).toLocaleDateString()}`} right={usd(a.usd)} />
        ))}</>}
      </>}
    </Screen>
  );
};

const PredictionMarket: React.FC<Ctx> = (c) => {
  const id: string = c.params?.id;
  const d = useLoad(() => must(c.bg({ type: 'predictionMarket', id })), [id]);
  const [pick, setPick] = useState(0); const [side, setSide] = useState<'BUY' | 'SELL'>('BUY'); const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const m = d.data?.market; const book = d.data?.books?.[pick];
  const price = side === 'BUY' ? book?.bestAsk : book?.bestBid;
  const shares = side === 'BUY' ? (price ? Number(amount) / price : 0) : Number(amount);
  const submit = async () => {
    setBusy(true); setMsg('');
    const r = await c.bg({ type: 'predictionOrder', tokenId: m.tokenIds[pick], side, size: Math.floor(shares * 100) / 100, orderType: 'FOK' }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false); setMsg(r?.ok ? `Order ${r.status ?? 'submitted'}${r.orderId ? ` (#${String(r.orderId).slice(0, 10)}…)` : ''}` : r?.error ?? 'Order failed');
  };
  const pill = (on: boolean): React.CSSProperties => ({ flex: 1, padding: '9px 0', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 800, background: on ? T.accent : T.bgAlt, color: on ? 'var(--hb-on-brand)' : T.text });
  return (
    <Screen title="Market" onBack={c.nav.pop}>
      {d.loading && !d.data ? <Spinner /> : d.err ? <Notice tone="error" action={{ label: 'Retry', onClick: d.reload }}>{d.err}</Notice> : m && <>
        <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.35, marginBottom: 10 }}>{m.question}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>{m.outcomes.map((o: string, i: number) => <button key={o} type="button" style={pill(pick === i)} onClick={() => setPick(i)}>{o} {cents(d.data.books?.[i]?.bestAsk ?? m.prices[i])}</button>)}</div>
        {d.data.tradingBlocked ? <Notice>Trading is not available in your region.</Notice> : book?.version === 'v2' ? <Notice>This market trades on Polymarket's V2 book. Harbour can't trade it yet; use polymarket.com.</Notice> : <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><button type="button" style={pill(side === 'BUY')} onClick={() => setSide('BUY')}>Buy</button><button type="button" style={pill(side === 'SELL')} onClick={() => setSide('SELL')}>Sell</button></div>
          <div style={card}>
            <div style={sub}>{side === 'BUY' ? 'Amount (pUSD)' : 'Shares to sell'}</div>
            <input style={input} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" />
            <div style={sub}>{side === 'BUY' ? `≈ ${shares.toFixed(2)} shares at ${cents(price)} · pays $1 per share if ${m.outcomes[pick]} wins` : `≈ ${usd(shares * (price ?? 0))} at ${cents(price)}`} · min {book?.minSize ?? 5} shares</div>
          </div>
          <Btn disabled={busy || !price || !(shares >= (book?.minSize ?? 5))} onClick={submit}>{busy ? 'Submitting…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${m.outcomes[pick]}`}</Btn>
          {msg && <div role="status" style={{ ...sub, marginTop: 10, textAlign: 'center' }}>{msg}</div>}
          <div style={{ ...sub, marginTop: 12 }}>Fill-or-kill at the best price in the book. The first trade asks for a one-time approval on Polygon (needs a little POL for gas) and a signature to create your Polymarket API key.</div>
        </>}
      </>}
    </Screen>
  );
};

export const SCREENS_predictions: Record<string, React.FC<Ctx>> = { predictionsHome: PredictionsHome, predictionMarket: PredictionMarket };
