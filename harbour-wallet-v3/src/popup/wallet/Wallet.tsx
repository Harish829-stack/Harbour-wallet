import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TokenApprovalsPanel } from './features/provider';
import { T } from '../theme';
import { bg } from '../api';
import { injectStyles, Ic, ICON, IconBtn, Coin, Empty, Skeleton, InkTabs, useTween, reducedMotion } from './ui';
import { SCREENS, type Nav } from './screens';
import { SwapTab } from './swap/SwapTab';
import { EarnTab } from './features/earn';
import { ASSETS, allAssets, usd } from './data';
import { syncNetworks } from './networkStore';
import { useTokenItems, refreshTokens, tokenColor } from './tokensStore';
import { useSettingsState, updateSettings, refreshSettings, startActivityPings, moneyPrice, moneyCompact, fmtNumber } from '../settingsStore';
import { isLowBalance } from '../../core/settings';
import { TokenCell } from './tokenCell';
import { ConnectedSite } from './connectedSite';
import { TW_NETWORKS, TW_CATEGORIES } from '../../core/twTaxonomy';
import { chainByTwId } from '../../core/chains/index';

// Authenticated wallet host — 4 bottom tabs (Home·Trending·Swap·Earn) + a navigation stack of
// pushed full-screen views (send, receive, token detail, settings, …) with slide animations.
// UI/flow reconstructed from the live Trust Wallet extension; neutral branding, no TW assets.

type Tab = 'home' | 'trending' | 'swap' | 'earn';
const TAB_ORDER: Tab[] = ['home', 'trending', 'swap', 'earn'];

// ---- navigation-stack transitions ----
// Each stack entry gets a stable id so React keeps the outgoing screen mounted while the next one animates.
// Only the top screen stays mounted once the animation ends (same remount-on-return semantics as before).
type Entry = { name: string; params?: any };
type Phase = 'enter' | 'idle' | 'under' | 'reveal' | 'leave';
const entryIds = new WeakMap<object, number>(); let entrySeq = 0;
const eid = (e: object) => { let v = entryIds.get(e); if (v == null) { v = ++entrySeq; entryIds.set(e, v); } return v; };
function useStackLayers(stack: Entry[]) {
  const top = stack[stack.length - 1];
  const [layers, setLayers] = useState<Array<{ e: Entry; phase: Phase }>>(() => (top ? [{ e: top, phase: 'idle' }] : []));
  const prev = useRef(stack); const timer = useRef<ReturnType<typeof setTimeout>>();
  useLayoutEffect(() => {
    const before = prev.current; prev.current = stack;
    const prevTop = before[before.length - 1];
    if (prevTop === top) return;
    clearTimeout(timer.current);
    const settle = () => setLayers(top ? [{ e: top, phase: 'idle' }] : []);
    if (reducedMotion()) return settle();
    const popping = !!prevTop && !stack.includes(prevTop) && (!top || before.includes(top));
    setLayers(popping
      ? [...(top ? [{ e: top, phase: 'reveal' as Phase }] : []), { e: prevTop!, phase: 'leave' as Phase }]
      : [...(prevTop ? [{ e: prevTop, phase: 'under' as Phase }] : []), { e: top!, phase: 'enter' as Phase }]);
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hb-nav-ms')) || 320;
    timer.current = setTimeout(settle, ms + 20);
  }, [stack, top]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return layers;
}
const sq = (bg2: string, color: string): React.CSSProperties => ({ width: 52, height: 52, borderRadius: 16, background: bg2, color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' });

export const Wallet: React.FC<{
  addrs: Record<string, string>; balances: Record<string, any>; totalUsd: number | null; loading: boolean;
  accounts?: Array<{ derivationIndex: number; name: string; addresses: Record<string, string> }>; activeAccount?: number;
  hiddenAssets?: string[]; networkFilter?: string | null;
  backupRequired?: boolean; onRefresh: () => void; onBackup?: () => void; onLock: () => void;
}> = ({ addrs, balances, totalUsd, loading, accounts, activeAccount, hiddenAssets, networkFilter, backupRequired, onRefresh, onBackup, onLock }) => {
  injectStyles();
  const [tab, setTab] = useState<Tab>('home');
  const lastTab = useRef<Tab>('home');
  const tabDir = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(lastTab.current) ? 'hb-tab-r' : TAB_ORDER.indexOf(tab) < TAB_ORDER.indexOf(lastTab.current) ? 'hb-tab-l' : 'hb-tab-fade';
  useEffect(() => { lastTab.current = tab; }, [tab]);
  const fromHash = () => {
    const path = window.location.hash.split('?')[0];
    if (path === '#/settings/connections/blacklist' || path === '#/settings/connections-blacklist') return [{ name: 'connections' }, { name: 'connectionsBlacklist' }];
    if (path === '#/settings/connections') return [{ name: 'connections' }];
    const detail = path.match(/^#\/settings\/connection\/([^/]+)$/);
    if (detail) return [{ name: 'connections' }, { name: 'connectionDetail', params: { id: decodeURIComponent(detail[1]) } }];
    return [];
  };
  const [stack, setStack] = useState<Array<{ name: string; params?: any }>>(fromHash);
  useEffect(() => { const change = () => setStack(fromHash()); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  const [sub, setSub] = useState<'crypto' | 'approvals'>('crypto');
  // TW hides the earn branch for hardware accounts: ask the background whether Earn is available for the active wallet.
  const [earnOk, setEarnOk] = useState(true);
  useEffect(() => { bg({ type: 'earnAvailable' }).then((r) => { const ok = r?.available !== false; setEarnOk(ok); if (!ok) setTab((t) => (t === 'earn' ? 'home' : t)); }).catch(() => {}); }, [activeAccount]);
  // Active wallet's real name (Settings > Wallets can rename it); never a hard-coded label.
  const [walletName, setWalletName] = useState<string | null>(null);
  const [, setNetworkVersion] = useState(0);
  useEffect(() => { let dead = false; bg({ type: 'listWallets' }).then((r) => { if (dead || !r?.ok) return; const w = (r.wallets ?? []).find((x: any) => x.id === r.activeWalletId) ?? r.wallets?.[0]; if (w) setWalletName(w.label ?? null); }).catch(() => {}); return () => { dead = true; }; }, [accounts, activeAccount, balances]);
  const { settings } = useSettingsState();
  const hide = settings.privacy.hideBalancesOnDashboard;
  const setHide = (v: boolean) => { void updateSettings(bg, { privacy: { hideBalancesOnDashboard: v } }); };
  const layout = settings.layout.tokenCellLayout;
  // Real settings: pull the persisted state once, and tell the background about user activity (auto-lock timer).
  useEffect(() => {
    void refreshSettings(bg);
    void syncNetworks(bg).then(() => { setNetworkVersion((v) => v + 1); return refreshTokens(bg); });
    return startActivityPings(bg);
  }, []);


  const nav: Nav = {
    push: (name, params) => setStack((s) => [...s, { name, params }]),
    pop: () => setStack((s) => s.slice(0, -1)),
    home: () => { setStack([]); setTab('home'); },
    lock: onLock, backup: () => { setStack([]); onBackup?.(); },
  };
  const ctx = { addrs, balances, bg, nav, accounts, activeAccount, hiddenAssets, networkFilter, refresh: onRefresh } as any;
  // Native coins only: tokens are registered in the asset catalog too (for Send / detail lookups) but render below from tokenItems.
  const visibleAssets = allAssets().filter((a) => a.native && !(hiddenAssets ?? []).includes(a.id) && (!networkFilter || a.id === networkFilter)
    && !(settings.layout.hideLowBalanceAssets && isLowBalance(balances[a.id]?.ok === false ? null : balances[a.id]?.usd)));
  // Custom tokens (per active wallet/account). Re-fetched whenever the native balances refresh.
  const tokenItems = useTokenItems().items;
  useEffect(() => { void refreshTokens(bg); }, [balances, activeAccount]);  
  const visibleTokens = tokenItems.filter((i) => !(hiddenAssets ?? []).includes(i.token.id) && (!networkFilter || i.token.networkId === networkFilter)
    && !(settings.layout.hideLowBalanceAssets && isLowBalance(i.ok ? i.usd : null)));
  const tokenUsd = tokenItems.reduce((n, i) => n + (i.ok && i.usd != null && !(hiddenAssets ?? []).includes(i.token.id) ? i.usd : 0), 0);
  const layers = useStackLayers(stack);
  const total = totalUsd == null ? null : totalUsd + tokenUsd;
  const shownTotal = useTween(total);
  const navTabs = TAB_ORDER.filter((id) => id !== 'earn' || earnOk);

  const fmtAmt = (s?: string) => { const n = Number(s ?? 0); return n === 0 ? '0' : n < 0.0001 ? '<0.0001' : fmtNumber(n, { maximumFractionDigits: 6 }); };

  return (
    <div className="hb-root hb-enter" style={{ position: 'relative', background: T.bg, color: T.text, fontFamily: 'Inter, -apple-system, system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100dvh', maxHeight: '100dvh' }}>
      <div className={stack.length ? 'hb-home under' : 'hb-home'} aria-hidden={stack.length ? true : undefined}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 8px' }}>
        <button className="hb-tap" onClick={() => nav.push('walletSelector')} aria-label="Select wallet" style={{ flex: 1, minWidth: 0, lineHeight: 1.1, cursor: 'pointer', background: 'none', border: 0, padding: 0, textAlign: 'left', color: T.text }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 16, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{walletName ?? <Skeleton w={90} h={16} />}</span> <span style={{ color: T.sub }}><Ic d="down" size={16} /></span></div>
          <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>{accounts?.[activeAccount ?? 0]?.name ?? 'Account 1'}</div>
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ConnectedSite bg={bg} refreshKey={stack.length} />
          <IconBtn icon="globe" title="Networks" onClick={() => nav.push('networkSelector')} />
          <IconBtn icon="search" title="Search" onClick={() => nav.push('search')} />
          <IconBtn icon="gear" title="Settings" onClick={() => nav.push('settings')} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 16px' }} className={tabDir} key={tab}>
        {tab === 'home' && <>
          {backupRequired && (
            <div className="hb-tap" onClick={() => nav.push('backup')} style={{ background: 'var(--hb-warn-bg)', border: '1px solid var(--hb-warn-line)', borderRadius: 12, padding: '10px 12px', margin: '4px 0 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Ic d={ICON.shield} size={18}/><div style={{ flex: 1, fontSize: 13, color: 'var(--hb-warn-ink)' }}>Back up your secret phrase</div><span style={{ color: 'var(--hb-warn-ink)' }}><Ic d={ICON.chevron} size={16} /></span>
            </div>
          )}
          <div style={{ padding: '8px 0 2px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div key={hide ? 'h' : 's'} className="hb-unblur" style={{ fontSize: 34, fontWeight: 800 }}>{loading && totalUsd == null ? <Skeleton w={150} h={34} r={10} /> : (hide ? '••••••' : (shownTotal == null ? '$—' : usd(shownTotal)))}</div>
            <span className={loading ? 'hb-spinning' : ''} style={{ display: 'inline-flex' }}><IconBtn icon="refresh" size={30} bg="transparent" title="Refresh" onClick={onRefresh} /></span>
            <IconBtn icon={hide ? 'eyeoff' : 'eye'} size={30} bg="transparent" title="Hide" onClick={() => setHide(!hide)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, margin: '16px 0 18px' }}>
            {([['Send', 'send', false, 'send'], ['Receive', 'receive', false, 'receive'], ['Swap', 'swap', false, 'swap'], ['Fund', 'fund', true, 'fund']] as const).map(([label, ic, filled, to]) => (
              <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                <button className="hb-action" title={label} aria-label={label} onClick={() => { if (to === 'swap') setTab('swap'); else nav.push(to); }} style={{ ...sq(filled ? T.accent : T.accentSoft, filled ? 'var(--hb-on-brand)' : T.accent), margin: '0 auto' }}><Ic d={ICON[ic]} size={22} /></button>
                <div style={{ fontSize: 12, marginTop: 6, color: T.sub }}>{label}</div>
              </div>
            ))}
          </div>
          <InkTabs tabs={['crypto', 'approvals'] as const} value={sub} onChange={setSub} label={(s) => (s === 'crypto' ? 'Crypto' : 'Approvals')} style={{ marginBottom: 4 }}>
            <div style={{ flex: 1 }} />
            {!settings.layout.hideNFTs && <IconBtn icon="nft" size={30} bg="transparent" title="Collectibles" onClick={() => nav.push('nfts')} />}
            <IconBtn icon="history" size={30} bg="transparent" title="Activity" onClick={() => nav.push('activity')} />
          </InkTabs>
          <div key={sub} className={sub === 'crypto' ? 'hb-stagger hb-tab-l' : 'hb-tab-r'}>
          {sub === 'crypto' ? (visibleAssets.length + visibleTokens.length === 0 && !loading ? <Empty title="No assets to show" sub="Your Preferences hide assets worth less than $0.01 (USD). Change this in Settings › Preferences." icon="search" /> : visibleAssets.map((a) => {
            const b = balances[a.id];
            return <TokenCell key={a.id} layout={layout} hide={hide} onClick={() => nav.push('tokenDetail', { assetId: a.id })}
              d={{ name: a.name, sym: a.sym, assetId: a.id, color: a.color, evm: true, amount: b ? (b.ok === false ? '—' : fmtAmt(b.formatted)) : (loading ? '…' : '—'), fiatUsd: b?.usd != null ? b.usd : null,
                price: b?.price ?? (a.price || null), change: b?.change ?? (a.change ?? null) }} />;
          }).concat(visibleTokens.map((i) => (
            <TokenCell key={i.token.id} layout={layout} hide={hide} onClick={() => nav.push('tokenDetail', { assetId: i.token.id })}
              d={{ name: i.token.name, sym: i.token.symbol, color: tokenColor(i.token.id), evm: true, amount: i.ok ? fmtAmt(i.formatted) : '—', fiatUsd: i.usd, price: i.price, change: i.change }} />
          ))) as any) : <TokenApprovalsPanel send={bg}/>}
          </div>
        </>}

        {tab === 'trending' && <TrendingTab nav={nav} />}

        {tab === 'swap' && <SwapTab nav={nav} />}

        {tab === 'earn' && earnOk && <EarnTab nav={nav} />}
      </div>

      {/* BOTTOM NAV */}
      <div className="hb-navbar" style={{ display: 'flex', flexShrink: 0, borderTop: `1px solid ${T.border}`, padding: '6px 0 10px', background: T.surface }}>
        <span aria-hidden className="hb-nav-pill" style={{ width: `${100 / navTabs.length}%`, transform: `translateX(${Math.max(0, navTabs.indexOf(tab)) * 100}%)` }}><span /></span>
        {([['home', 'Home', ICON.home], ['trending', 'Trending', ICON.trend], ['swap', 'Swap', ICON.swap], ['earn', 'Earn', ICON.leaf]] as const).filter(([id]) => id !== 'earn' || earnOk).map(([id, label, d]) => (
          <button key={id} className={tab === id ? 'hb-nav-btn on' : 'hb-nav-btn'} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: tab === id ? T.accent : T.sub, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span className="hb-nav-ic" key={tab === id ? 'on' : 'off'}><Ic d={d} size={22} fill={tab === id && id === 'home'} /></span><span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </div>
      </div>

      {layers.map(({ e, phase }) => { const S = SCREENS[e.name]; return S ? <div key={eid(e)} className={`hb-layer ${phase}`} {...((phase === 'under' || phase === 'leave') ? { inert: '' } : {}) as any}><S {...ctx} params={e.params} /></div> : null; })}
    </div>
  );
};

// Currency-aware (Settings › Currency): market cap / volume / price convert from USD and format in the base currency.
const compactUsd = (n?: number) => moneyCompact(Number(n ?? 0));
// Price formatting that matches TW's trending table (significant digits for tiny prices).
const fmtPrice = (n?: number) => moneyPrice(Number(n ?? 0));
const fmtPct = (n?: number) => {
  const v = Number(n ?? 0);
  return `${v >= 0 ? '+' : ''}${fmtNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};
const TF: Array<{ key: '1H' | '24H' | '7D' | '1M'; field: 'change1h' | 'change24h' | 'change7d' | 'change30d' }> = [
  { key: '1H', field: 'change1h' }, { key: '24H', field: 'change24h' }, { key: '7D', field: 'change7d' }, { key: '1M', field: 'change30d' },
];
// Categories + network coin ids come from the real TW capture (src/core/twTaxonomy.ts).
const MODES: Array<{ id: string; name: string; clientSort?: 'gain' | 'lose'; hot?: 'tokens' | 'dex' }> = [
  ...TW_CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
  { id: 'hot', name: 'Hot tokens', hot: 'tokens' },
  { id: 'hotdex', name: 'Hot on DEXs', hot: 'dex' },
  { id: 'gainers', name: 'Top Gainers', clientSort: 'gain' },
  { id: 'losers', name: 'Top Losers', clientSort: 'lose' },
];
const Dropdown: React.FC<{ label: React.ReactNode; children: (close: () => void) => React.ReactNode; minWidth?: number; align?: 'left' | 'right' }> = ({ label, children, minWidth = 160, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: open ? T.accentSoft : T.bgAlt, border: 'none', borderRadius: 999, padding: '7px 12px', fontWeight: 700, fontSize: 13, color: open ? T.accent : T.text, cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 160, transition: 'background .15s' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span><Ic d={ICON.chevron} size={14} /></button>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />}
      {open && <div className="hb-menu" style={{ position: 'absolute', top: 40, [align]: 0, zIndex: 20, maxWidth: 'calc(100vw - 32px)', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: 'hidden', minWidth, maxHeight: 300, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>{children(() => setOpen(false))}</div>}
    </div>
  );
};
// Trending — TW "TrendingTokens" parity (evidences/re-evidence/23-trending): sortable Token | Price | Market table
// with the 3 TW dropdowns (Networks / Trending category / timeframe).
const TrendingTab: React.FC<{ nav: Nav }> = ({ nav }) => {
  const [data, setData] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [tf, setTf] = useState<'1H' | '24H' | '7D' | '1M'>('24H');
  const [mode, setMode] = useState(MODES[0]);
  const [net, setNet] = useState<any | null>(null);
  const [netQ, setNetQ] = useState('');
  const [sort, setSort] = useState<{ col: 'price' | 'market'; dir: 'asc' | 'desc' } | null>(null);
  const field = TF.find((t) => t.key === tf)!.field;

  useEffect(() => {
    let cancel = false; setData(null);
    if (mode.hot) {
      // CoinGecko trending / GeckoTerminal trending pools (24h change only); the network filter applies to DEX pools
      bg({ type: 'getHot' }).then((r) => {
        if (cancel) return;
        const list: any[] = r?.ok ? (mode.hot === 'dex' ? r.dex : r.tokens) ?? [] : [];
        const chain = net ? chainByTwId(net.coinId)?.id : undefined;
        setData(list.filter((t) => mode.hot !== 'dex' || !chain || t.chainId === chain).map((t) => ({ ...t, change1h: null, change7d: null, change30d: null, marketCap: t.volume24h ?? 0, hot: true })));
      }).catch(() => { if (!cancel) setData([]); });
      return () => { cancel = true; };
    }
    bg({ type: 'getTrending', categoryId: mode.clientSort ? 'trending' : mode.id, networkCoinId: net?.coinId }).then((r) => { if (!cancel) setData(r?.ok ? (r.list ?? []) : []); }).catch(() => { if (!cancel) setData([]); });
    return () => { cancel = true; };
  }, [net, mode]);
  // Perps / predictions entry points follow the signed remote-config flags
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  useEffect(() => { bg({ type: 'getRemoteConfig' }).then((r) => { if (r?.ok) setFlags(r.flags ?? {}); }).catch(() => {}); }, []);
  // Networks ordered by DeFi TVL (DefiLlama) when available, so the busiest networks come first in the filter
  const [tvl, setTvl] = useState<Record<string, number>>({});
  useEffect(() => { bg({ type: 'getTrendingNetworks' }).then((r) => { if (r?.ok) setTvl(Object.fromEntries((r.list ?? []).map((n: any) => [n.chainId, n.tvl]))); }).catch(() => {}); }, []);

  const base = (data ?? []).filter((t) => {
    const s2 = q.trim().toLowerCase();
    return !s2 || (t.symbol || '').toLowerCase().includes(s2) || (t.name || '').toLowerCase().includes(s2);
  });
  const rows = [...base];
  if (sort) rows.sort((a, b) => { const va = sort.col === 'price' ? (a[field] ?? 0) : (a.marketCap ?? 0); const vb = sort.col === 'price' ? (b[field] ?? 0) : (b.marketCap ?? 0); return sort.dir === 'asc' ? va - vb : vb - va; });
  else if (mode.clientSort) rows.sort((a, b) => mode.clientSort === 'gain' ? (b.change24h ?? 0) - (a.change24h ?? 0) : (a.change24h ?? 0) - (b.change24h ?? 0));

  const toggleSort = (col: 'price' | 'market') => setSort((s2) => s2 && s2.col === col ? { col, dir: s2.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  const Head: React.FC<{ col: 'price' | 'market'; label: string }> = ({ col, label }) => (
    <div onClick={() => toggleSort(col)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, cursor: 'pointer', fontSize: 12, color: T.sub, fontWeight: 600 }}>{label}<span style={{ fontSize: 9, opacity: sort?.col === col ? 1 : 0.4 }}>{sort?.col === col && sort.dir === 'asc' ? '▲' : '▼'}</span></div>
  );
  const netFiltered = TW_NETWORKS.filter((n) => n.cgCategory && (!netQ || n.name.toLowerCase().includes(netQ.toLowerCase())))
    .sort((a, b) => (tvl[chainByTwId(b.coinId)?.id ?? ''] ?? 0) - (tvl[chainByTwId(a.coinId)?.id ?? ''] ?? 0));

  return (
    <>
      <h2 style={{ fontSize: 22, margin: '8px 0 12px', textAlign: 'center' }}>Trending</h2>
      {(flags.perps || flags.predictions) && <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {flags.perps && <button type="button" data-testid="open-perps" className="hb-tap" onClick={() => nav.push('perpsHome')} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: T.accentSoft, color: T.accent, fontWeight: 800, cursor: 'pointer' }}>Perps</button>}
        {flags.predictions && <button type="button" data-testid="open-predictions" className="hb-tap" onClick={() => nav.push('predictionsHome')} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: T.accentSoft, color: T.accent, fontWeight: 800, cursor: 'pointer' }}>Predictions</button>}
      </div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgAlt, borderRadius: 14, padding: '10px 14px', marginBottom: 10 }}>
        <Ic d={ICON.search} size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Token name or contract address" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: T.text }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Dropdown align="left" minWidth={210} label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{net ? <Coin sym={chainByTwId(net.coinId)?.symbol ?? net.name.slice(0, 3).toUpperCase()} assetId={chainByTwId(net.coinId)?.id} size={18} /> : <Ic d={ICON.globe} size={16} />}{net ? net.name : 'Networks'}</span>}>
          {(close) => <div>
            <div style={{ padding: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.bgAlt, borderRadius: 10, padding: '6px 10px' }}><Ic d={ICON.search} size={14} /><input autoFocus value={netQ} onChange={(e) => setNetQ(e.target.value)} placeholder="Network Name" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13 }} /></div></div>
            {!netQ && <div className="hb-tap" onClick={() => { setNet(null); setNetQ(''); close(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}><Ic d={ICON.globe} size={18} /><span style={{ flex: 1, fontWeight: 600 }}>All Networks</span>{net === null && <span style={{ color: T.accent }}><Ic d={ICON.check} size={16} /></span>}</div>}
            {netFiltered.map((n) => <div key={n.coinId} className="hb-tap" onClick={() => { setNet(n); setNetQ(''); close(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}><Coin sym={chainByTwId(n.coinId)?.symbol ?? n.name.slice(0, 3).toUpperCase()} assetId={chainByTwId(n.coinId)?.id} size={22} /><span style={{ flex: 1, fontWeight: 600 }}>{n.name}</span>{net?.coinId === n.coinId && <span style={{ color: T.accent }}><Ic d={ICON.check} size={16} /></span>}</div>)}
          </div>}
        </Dropdown>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dropdown label={mode.name}>
            {(close) => <div>{MODES.map((m) => <div key={m.id} className="hb-tap" onClick={() => { setMode(m); setSort(null); close(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}><span style={{ flex: 1, fontWeight: m.id === mode.id ? 700 : 500, color: m.id === mode.id ? T.accent : T.text }}>{m.name}</span>{m.id === mode.id && <Ic d={ICON.check} size={16} />}</div>)}</div>}
          </Dropdown>
          <Dropdown minWidth={90} label={tf}>
            {(close) => <div>{TF.map((t) => <div key={t.key} className="hb-tap" onClick={() => { setTf(t.key); close(); }} style={{ padding: '10px 14px', fontSize: 14, fontWeight: t.key === tf ? 700 : 500, color: t.key === tf ? T.accent : T.text, cursor: 'pointer' }}>{t.key}</div>)}</div>}
          </Dropdown>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, background: T.bg, zIndex: 5 }}>
        <div style={{ width: '42%', fontSize: 12, color: T.sub, fontWeight: 600 }}>Token</div>
        <div style={{ width: '29%' }}><Head col="price" label="Price" /></div>
        <div style={{ width: '29%' }}><Head col="market" label="Market" /></div>
      </div>
      {data === null ? [0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}><Skeleton w={34} h={34} r={999} /><div style={{ flex: 1 }}><Skeleton w={80} h={12} /><div style={{ height: 6 }} /><Skeleton w={50} h={10} /></div><Skeleton w={60} h={12} /></div>
      )) : rows.length === 0 ? (
        <Empty title="Token not found" sub="Try a different name or network." icon="search" />
      ) : <div className="hb-stagger" key={`${mode.id}|${net?.coinId ?? ''}`}>{rows.map((t: any) => {
        const ch = t[field] ?? 0;
        return (
          <div key={t.id ?? t.symbol} className="hb-tap hb-trow" onClick={() => nav.push('tokenDetail', { assetId: (ASSETS.find((a) => a.sym === (t.symbol || t.sym))?.id) ?? 'ethereum' })} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: '42%', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Coin sym={t.symbol || t.sym} size={34} />
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.symbol || t.sym}</div><div style={{ fontSize: 12, color: T.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{net ? net.name : t.name}</div></div>
            </div>
            <div style={{ width: '29%', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtPrice(t.price)}</div><div style={{ fontSize: 12, fontWeight: 600, color: ch >= 0 ? T.success : T.error }}>{fmtPct(ch)}</div></div>
            <div style={{ width: '29%', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{compactUsd(t.marketCap)}</div><div style={{ fontSize: 12, color: T.sub }}>Vol: {compactUsd(t.volume24h)}</div></div>
          </div>
        );
      })}</div>}
    </>
  );
};
