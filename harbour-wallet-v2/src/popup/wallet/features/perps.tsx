// Perps (Hyperliquid) screens: account, deposit / withdraw, positions with close, open orders with cancel, markets, and a trade
// ticket. Everything is signed in the background; this UI only sends intents. Shown only when the remote `perps` flag is on.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { T } from '../../theme';
import { Screen, Btn, Row, Empty, Spinner, Skeleton } from '../ui';
import { Notice } from './earnParts';
import type { Ctx } from '../types';

const usd = (n: number | null | undefined, d = 2) => (n == null || !Number.isFinite(n) ? '—' : `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`);
const px = (n: number) => (n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : n.toPrecision(4));
const pnlColor = (n: number) => (n > 0 ? 'var(--hb-success, #2ea36d)' : n < 0 ? T.error : T.sub);
const card: React.CSSProperties = { background: T.bgAlt, borderRadius: 14, padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 18, fontWeight: 700, color: T.text };
const label: React.CSSProperties = { fontSize: 12, color: T.sub, marginBottom: 4 };
const Stat: React.FC<{ k: string; v: React.ReactNode; color?: string }> = ({ k, v, color }) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}><span style={{ color: T.sub }}>{k}</span><span style={{ fontWeight: 700, color }}>{v}</span></div>;

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [s, setS] = useState<{ data: T | null; err: string; loading: boolean }>({ data: null, err: '', loading: true });
  const load = useCallback(() => { setS((p) => ({ ...p, loading: true, err: '' })); fn().then((data) => setS({ data, err: '', loading: false })).catch((e) => setS({ data: null, err: String(e?.message ?? e), loading: false })); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);
  return { ...s, reload: load };
}
const must = async (p: Promise<any>) => { const r = await p; if (!r?.ok) throw new Error(r?.error ?? 'Request failed'); return r; };

const PerpsHome: React.FC<Ctx> = (c) => {
  const acct = useLoad(() => must(c.bg({ type: 'perpsAccount' })), []);
  const mk = useLoad(() => must(c.bg({ type: 'perpsMarkets' })), []);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [dep, setDep] = useState(''); const [wd, setWd] = useState('');
  const run = async (key: string, m: any, ok: string) => { setBusy(key); setMsg(''); const r = await c.bg(m).catch((e) => ({ ok: false, error: String(e?.message ?? e) })); setBusy(''); setMsg(r?.ok ? ok : r?.error ?? 'Failed'); if (r?.ok) { acct.reload(); } };
  const a = acct.data;
  const top = useMemo(() => [...(mk.data?.markets ?? [])].sort((x: any, y: any) => (y.volume24h ?? 0) - (x.volume24h ?? 0)).slice(0, 25), [mk.data]);
  return (
    <Screen title="Perps" onBack={c.nav.pop}>
      {acct.loading && !a ? <div style={card}><Skeleton h={18} /><div style={{ height: 8 }} /><Skeleton h={14} w="60%" /></div>
        : acct.err ? <Notice tone="error" action={{ label: 'Retry', onClick: acct.reload }}>{acct.err}</Notice>
        : a && <>
          <div style={card} data-testid="perps-account">
            <div style={{ fontSize: 26, fontWeight: 800 }}>{usd(a.account.accountValue)}</div>
            <Stat k="Withdrawable" v={usd(a.account.withdrawable)} />
            <Stat k="Unrealized PnL" v={usd(a.account.unrealizedPnl)} color={pnlColor(a.account.unrealizedPnl)} />
            <Stat k="Realized PnL (recent fills, after fees)" v={usd(a.account.realizedPnl)} color={pnlColor(a.account.realizedPnl)} />
            <Stat k="Margin used" v={usd(a.account.marginUsed)} />
          </div>
          {!a.agent?.live && <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Enable trading</div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginBottom: 10 }}>Harbour creates a trading key on this device and your wallet approves it on Hyperliquid. That key can place and cancel orders but can never withdraw funds.{a.builder ? ` Harbour also asks you to approve its builder fee (${a.builder.feeTenthsBp / 10} bp per trade).` : ''}</div>
            <Btn onClick={() => run('enable', { type: 'perpsEnable' }, 'Trading enabled')} disabled={!!busy}>{busy === 'enable' ? 'Approving…' : 'Enable trading'}</Btn>
          </div>}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Deposit USDC from Arbitrum</div>
            <div style={label}>On Arbitrum: {a.arbitrumUsdc != null ? (Number(a.arbitrumUsdc) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'} USDC · minimum 5 USDC · needs a little ETH on Arbitrum for gas</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input data-testid="perps-deposit" style={input} value={dep} onChange={(e) => setDep(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" /><span style={{ color: T.sub, fontWeight: 700 }}>USDC</span>
              <Btn style={{ width: 110 }} disabled={!!busy || !(Number(dep) >= 5)} onClick={() => run('dep', { type: 'perpsDeposit', amount: String(Math.round(Number(dep) * 1e6)) }, 'Deposit sent: it is credited in about a minute')}>{busy === 'dep' ? '…' : 'Deposit'}</Btn>
            </div>
            <div style={{ ...label, marginTop: 10 }}>Withdraw to this address on Arbitrum (1 USDC fee)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input style={input} value={wd} onChange={(e) => setWd(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" /><span style={{ color: T.sub, fontWeight: 700 }}>USDC</span>
              <Btn variant="ghost" style={{ width: 110 }} disabled={!!busy || !(Number(wd) > 1)} onClick={() => run('wd', { type: 'perpsWithdraw', amount: wd }, 'Withdrawal requested')}>{busy === 'wd' ? '…' : 'Withdraw'}</Btn>
            </div>
          </div>
          {msg && <div role="status" style={{ fontSize: 13, color: T.sub, margin: '0 4px 12px' }}>{msg}</div>}
          <div style={{ fontWeight: 800, margin: '6px 4px' }}>Positions</div>
          {a.account.positions.length === 0 ? <div style={{ ...label, margin: '0 4px 12px' }}>No open positions</div> : a.account.positions.map((p: any) => (
            <div key={p.coin} style={{ ...card, padding: 12 }} data-testid="perps-position">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><span style={{ fontWeight: 800 }}>{p.coin}</span> <span style={{ fontSize: 12, fontWeight: 700, color: p.size > 0 ? pnlColor(1) : T.error }}>{p.size > 0 ? 'Long' : 'Short'} {p.leverage}x</span></div>
                <span style={{ fontWeight: 800, color: pnlColor(p.unrealizedPnl) }}>{usd(p.unrealizedPnl)}</span>
              </div>
              <Stat k="Size" v={`${Math.abs(p.size)} ${p.coin} · ${usd(p.positionValue)}`} />
              <Stat k="Entry / Liq." v={`${px(p.entryPx)} / ${p.liquidationPx ? px(p.liquidationPx) : '—'}`} />
              <Btn variant="ghost" disabled={!!busy} onClick={() => run(`close:${p.coin}`, { type: 'perpsClose', coin: p.coin }, `${p.coin} position closed`)}>{busy === `close:${p.coin}` ? 'Closing…' : 'Close at market'}</Btn>
            </div>
          ))}
          {a.account.orders.length > 0 && <><div style={{ fontWeight: 800, margin: '6px 4px' }}>Open orders</div>{a.account.orders.map((o: any) => (
            <Row key={o.oid} left={<span style={{ fontWeight: 800, color: o.side === 'buy' ? pnlColor(1) : T.error }}>{o.side === 'buy' ? 'B' : 'S'}</span>} title={`${o.coin} ${o.sz} @ ${px(o.px)}`} sub={o.reduceOnly ? 'Reduce only' : 'Limit'}
              right={<button type="button" disabled={!!busy} onClick={() => run(`cancel:${o.oid}`, { type: 'perpsCancel', coin: o.coin, oid: o.oid }, 'Order cancelled')} style={{ background: 'none', border: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>} />
          ))}</>}
        </>}
      <div style={{ fontWeight: 800, margin: '12px 4px 6px' }}>Markets</div>
      {mk.loading && !mk.data ? <Spinner /> : mk.err ? <Notice tone="error" action={{ label: 'Retry', onClick: mk.reload }}>{mk.err}</Notice> : top.length === 0 ? <Empty title="No markets" /> : top.map((m: any) => {
        const ch = m.prevDayPx ? ((m.mid - m.prevDayPx) / m.prevDayPx) * 100 : null;
        return <Row key={m.coin} onClick={() => c.nav.push('perpsTrade', { coin: m.coin })} left={<div style={{ width: 34, fontWeight: 800 }}>{m.coin.slice(0, 5)}</div>} title={`${m.coin}-USD`} sub={`Up to ${m.maxLeverage}x · Vol ${usd(m.volume24h, 0)}`} right={px(m.mid)} rightSub={ch == null ? '' : <span style={{ color: pnlColor(ch) }}>{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</span>} />;
      })}
      <div style={{ ...label, margin: '14px 4px' }}>Perpetual futures are leveraged and can lose more than you expect. Hyperliquid runs the order book; Harbour only signs your orders.</div>
    </Screen>
  );
};

const PerpsTrade: React.FC<Ctx> = (c) => {
  const coin: string = c.params?.coin;
  const mk = useLoad(() => must(c.bg({ type: 'perpsMarkets' })), []);
  const m = (mk.data?.markets ?? []).find((x: any) => x.coin === coin);
  const [side, setSide] = useState<'buy' | 'sell'>('buy'); const [type, setType] = useState<'market' | 'limit'>('market');
  const [amountUsd, setAmountUsd] = useState(''); const [lev, setLev] = useState('3'); const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const ref = type === 'limit' && Number(limit) > 0 ? Number(limit) : m?.mid ?? 0;
  const size = ref > 0 ? Number(amountUsd) / ref : 0;
  const place = async () => {
    setBusy(true); setMsg('');
    const r = await c.bg({ type: 'perpsOrder', coin, side, size, orderType: type, price: type === 'limit' ? Number(limit) : undefined, leverage: Number(lev) }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    setMsg(r?.ok ? (r.status?.filled ? `Filled ${r.status.filled.totalSz} ${coin} at ${r.status.filled.avgPx}` : `Order placed (#${r.status?.oid ?? ''})`) : r?.error ?? 'Order rejected');
  };
  const tab = (on: boolean, color?: string): React.CSSProperties => ({ flex: 1, padding: '9px 0', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 800, background: on ? color ?? T.accent : T.bgAlt, color: on ? 'var(--hb-on-brand)' : T.text });
  return (
    <Screen title={`${coin}-USD`} onBack={c.nav.pop}>
      {!m ? (mk.loading ? <Spinner /> : <Notice tone="error">{mk.err || 'Market not found'}</Notice>) : <>
        <div style={{ textAlign: 'center', margin: '4px 0 14px' }}><div style={{ fontSize: 28, fontWeight: 800 }}>{px(m.mid)}</div><div style={label}>Funding {m.funding != null ? `${(m.funding * 100).toFixed(4)}%/h` : '—'} · Max {m.maxLeverage}x</div></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><button type="button" style={tab(side === 'buy', 'var(--hb-success, #2ea36d)')} onClick={() => setSide('buy')}>Long</button><button type="button" style={tab(side === 'sell', T.error)} onClick={() => setSide('sell')}>Short</button></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><button type="button" style={tab(type === 'market')} onClick={() => setType('market')}>Market</button><button type="button" style={tab(type === 'limit')} onClick={() => setType('limit')}>Limit</button></div>
        <div style={card}>
          <div style={label}>Order value (margin × leverage)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 800, color: T.sub }}>$</span><input data-testid="perps-amount" style={input} value={amountUsd} onChange={(e) => setAmountUsd(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" /></div>
          <div style={label}>≈ {size > 0 ? size.toFixed(Math.min(6, m.szDecimals)) : '0'} {coin} · margin {usd(Number(amountUsd) / (Number(lev) || 1))}</div>
        </div>
        {type === 'limit' && <div style={card}><div style={label}>Limit price</div><input style={input} value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d.]/g, ''))} placeholder={px(m.mid)} inputMode="decimal" /></div>}
        <div style={card}>
          <div style={label}>Leverage: {lev}x (cross)</div>
          <input type="range" min={1} max={m.maxLeverage} value={lev} onChange={(e) => setLev(e.target.value)} style={{ width: '100%' }} aria-label="Leverage" />
        </div>
        <Btn disabled={busy || !(size > 0) || (type === 'limit' && !(Number(limit) > 0))} onClick={place}>{busy ? 'Placing…' : `${side === 'buy' ? 'Long' : 'Short'} ${coin}`}</Btn>
        {msg && <div role="status" data-testid="perps-msg" style={{ fontSize: 13, color: T.sub, marginTop: 12, textAlign: 'center' }}>{msg}</div>}
        <div style={{ ...label, marginTop: 14 }}>Market orders fill immediately at up to 5% from the mid price; the rest is cancelled. Liquidation happens when your margin runs out.</div>
      </>}
    </Screen>
  );
};

export const SCREENS_perps: Record<string, React.FC<Ctx>> = { perpsHome: PerpsHome, perpsTrade: PerpsTrade };
