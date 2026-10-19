import React, { useState } from 'react';
import { T } from '../theme';
import { bg } from '../api';
import { injectStyles, Ic, ICON, IconBtn, Coin, Btn, Empty } from './ui';
import { SCREENS, type Nav } from './screens';
import { ASSETS, TRENDING, usd, pct } from './data';

// Authenticated wallet host — 4 bottom tabs (Home·Trending·Swap·Earn) + a navigation stack of
// pushed full-screen views (send, receive, token detail, settings, …) with slide animations.
// UI/flow reconstructed from the live Trust Wallet extension; neutral branding, no TW assets.

type Tab = 'home' | 'trending' | 'swap' | 'earn';
const W = 375;
const sq = (bg2: string, color: string): React.CSSProperties => ({ width: 52, height: 52, borderRadius: 16, background: bg2, color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' });

export const Wallet: React.FC<{
  addrs: Record<string, string>; balances: Record<string, any>; totalUsd: number | null; loading: boolean;
  backupRequired?: boolean; onRefresh: () => void; onBackup?: () => void; onLock: () => void;
}> = ({ addrs, balances, totalUsd, loading, backupRequired, onRefresh, onBackup, onLock }) => {
  injectStyles();
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<Array<{ name: string; params?: any }>>([]);
  const [sub, setSub] = useState<'crypto' | 'approvals'>('crypto');
  const [hide, setHide] = useState(false);

  const nav: Nav = {
    push: (name, params) => setStack((s) => [...s, { name, params }]),
    pop: () => setStack((s) => s.slice(0, -1)),
    home: () => { setStack([]); setTab('home'); },
    lock: onLock, backup: () => { setStack([]); onBackup?.(); },
  };
  const ctx = { addrs, balances, bg, nav } as any;
  const top = stack[stack.length - 1];
  const Pushed = top ? SCREENS[top.name] : null;

  const mask = (s: string) => (hide ? '••••' : s);
  const fmtAmt = (s?: string) => { const n = Number(s ?? 0); return n === 0 ? '0' : n < 0.0001 ? '<0.0001' : n.toLocaleString(undefined, { maximumFractionDigits: 6 }); };

  return (
    <div style={{ position: 'relative', width: W, minHeight: 600, background: T.bg, color: T.text, fontFamily: 'Inter, -apple-system, system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 8px' }}>
        <div className="hb-tap" onClick={() => nav.push('walletSelector')} style={{ flex: 1, lineHeight: 1.1, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 16 }}>Seed Phrase 1 <span style={{ color: T.sub }}><Ic d={'M6 9l6 6 6-6'} size={16} /></span></div>
          <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>Account 1</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn icon="globe" title="Discover" onClick={() => nav.push('discover')} />
          <IconBtn icon="search" title="Search" onClick={() => nav.push('search')} />
          <IconBtn icon="gear" title="Settings" onClick={() => nav.push('settings')} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }} className="hb-fade" key={tab}>
        {tab === 'home' && <>
          {backupRequired && (
            <div className="hb-tap" onClick={() => onBackup?.()} style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: '10px 12px', margin: '4px 0 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <span style={{ fontSize: 16 }}>⚠️</span><div style={{ flex: 1, fontSize: 13, color: '#92400E' }}>Back up your secret phrase</div><span style={{ color: '#92400E' }}><Ic d={ICON.chevron} size={16} /></span>
            </div>
          )}
          <div style={{ padding: '8px 0 2px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{loading && totalUsd == null ? '…' : (hide ? '••••••' : (totalUsd == null ? '$—' : usd(totalUsd)))}</div>
            <IconBtn icon="refresh" size={30} bg="transparent" title="Refresh" onClick={onRefresh} />
            <IconBtn icon={hide ? 'eyeoff' : 'eye'} size={30} bg="transparent" title="Hide" onClick={() => setHide(!hide)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, margin: '16px 0 18px' }}>
            {([['Send', 'send', false, 'send'], ['Receive', 'receive', false, 'receive'], ['Swap', 'swap', false, 'swap'], ['Fund', 'fund', true, 'buy']] as const).map(([label, ic, filled, to]) => (
              <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                <button className="hb-tap" title={label} aria-label={label} onClick={() => { if (to === 'swap') setTab('swap'); else nav.push(to); }} style={{ ...sq(filled ? T.accent : T.accentSoft, filled ? '#fff' : T.accent), margin: '0 auto' }}><Ic d={ICON[ic]} size={22} /></button>
                <div style={{ fontSize: 12, marginTop: 6, color: T.sub }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${T.border}`, marginBottom: 4 }}>
            {(['crypto', 'approvals'] as const).map((s) => (
              <button key={s} onClick={() => setSub(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 2px', marginRight: 18, fontWeight: 700, fontSize: 15, color: sub === s ? T.text : T.sub, borderBottom: sub === s ? `2px solid ${T.accent}` : '2px solid transparent' }}>{s === 'crypto' ? 'Crypto' : 'Approvals'}</button>
            ))}
            <div style={{ flex: 1 }} />
            <IconBtn icon="nft" size={30} bg="transparent" title="Collectibles" onClick={() => nav.push('nfts')} />
            <IconBtn icon="history" size={30} bg="transparent" title="Activity" onClick={() => nav.push('activity')} />
          </div>
          {sub === 'crypto' ? ASSETS.map((a) => {
            const b = balances[a.id];
            const amt = a.evm ? (b ? `${mask(fmtAmt(b.formatted))} ${a.sym}` : (loading ? '…' : `0 ${a.sym}`)) : '—';
            const val = a.evm && b?.usd != null ? usd(b.usd) : (a.evm ? '$0.00' : '');
            return (
              <div key={a.id} className="hb-tap" onClick={() => nav.push('tokenDetail', { assetId: a.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer' }}>
                <Coin sym={a.sym} size={38} color={a.color} />
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 12, color: T.sub }}>{usd(a.price)} <span style={{ color: a.change >= 0 ? T.success : T.error }}>{pct(a.change)}</span></div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, fontSize: 14 }}>{amt}</div><div style={{ fontSize: 12, color: T.sub }}>{val}</div></div>
              </div>
            );
          }) : <Empty title="No token approvals" sub="dApp approvals you grant will appear here." icon="shield" />}
        </>}

        {tab === 'trending' && <>
          <h2 style={{ fontSize: 22, margin: '8px 0 12px' }}>Trending</h2>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
            {['All', 'Ethereum', 'BNB', 'Polygon', 'Base', 'Solana'].map((n, i) => <span key={n} style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: i === 0 ? T.accent : T.bgAlt, color: i === 0 ? '#fff' : T.sub }}>{n}</span>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}><div style={{ fontWeight: 700 }}>Hot tokens</div><span style={{ fontSize: 13, color: T.sub }}>24H ▾</span></div>
          {TRENDING.map((t) => (
            <div key={t.sym} className="hb-tap" onClick={() => nav.push('tokenDetail', { assetId: (ASSETS.find((a) => a.sym === t.sym)?.id) ?? 'ethereum' })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer' }}>
              <span style={{ width: 18, color: T.sub, fontWeight: 700, fontSize: 13 }}>{t.rank}</span>
              <Coin sym={t.sym} size={36} color={t.color} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{t.name}</div><div style={{ fontSize: 12, color: T.sub }}>{t.sym}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, fontSize: 14 }}>{usd(t.price)}</div><div style={{ fontSize: 12, color: t.change >= 0 ? T.success : T.error }}>{pct(t.change)}</div></div>
            </div>
          ))}
        </>}

        {tab === 'swap' && <SwapTab nav={nav} />}

        {tab === 'earn' && <>
          <h2 style={{ fontSize: 22, margin: '8px 0 12px' }}>Earn</h2>
          <div className="hb-tap" onClick={() => nav.push('staking')} style={{ background: `linear-gradient(135deg, ${T.accent}, #60A5FA)`, color: '#fff', borderRadius: 18, padding: 18, cursor: 'pointer' }}>
            <div style={{ opacity: 0.85, fontSize: 13 }}>Native Staking</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>Earn up to 7.2% APR</div><div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>Stake ETH, BNB, SOL and more →</div>
          </div>
          <div style={{ fontWeight: 700, margin: '18px 0 2px' }}>More ways to earn</div>
          {[['Liquidity pools', 'Provide liquidity, earn fees'], ['Lending', 'Supply assets, earn interest']].map(([t2, s2]) => (
            <div key={t2} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}><div style={{ width: 40, height: 40, borderRadius: 12, background: T.bgAlt, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON.leaf} size={20} /></div><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{t2}</div><div style={{ fontSize: 12, color: T.sub }}>{s2}</div></div><Ic d={ICON.chevron} size={18} /></div>
          ))}
        </>}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ display: 'flex', borderTop: `1px solid ${T.border}`, padding: '8px 0 10px', background: '#fff' }}>
        {([['home', 'Home', ICON.home], ['trending', 'Trending', ICON.trend], ['swap', 'Swap', ICON.swap], ['earn', 'Earn', ICON.leaf]] as const).map(([id, label, d]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: tab === id ? T.accent : T.sub, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Ic d={d} size={22} fill={tab === id && id === 'home'} /><span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </div>

      {Pushed && <Pushed {...ctx} params={top!.params} />}
    </div>
  );
};

const SwapTab: React.FC<{ nav: Nav }> = ({ nav }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 14px' }}><h2 style={{ fontSize: 22, margin: 0 }}>Swap</h2><IconBtn icon="gear" size={32} bg="transparent" /></div>
    {([['From', 'ETH', '#6372f0'], ['To', 'Select token', T.sub]] as const).map(([label, tok, col], i) => (
      <div key={label} style={{ background: T.bgAlt, borderRadius: 16, padding: 16, marginBottom: i === 0 ? 6 : 0 }}>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.sub }}>0</div>
          <span style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 999, padding: '6px 12px', fontWeight: 700, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{i === 0 && <Coin sym={tok} size={20} color={col as string} />}{tok} ▾</span>
        </div>
      </div>
    ))}
    <Btn onClick={() => nav.push('swapConfirm')} style={{ marginTop: 16 }}>Review swap</Btn>
    <div style={{ fontSize: 12, color: T.sub, marginTop: 12, textAlign: 'center' }}>Live quotes load in your browser; amounts here are sample data.</div>
  </>
);
