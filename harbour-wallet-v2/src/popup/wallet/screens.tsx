import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { T } from '../theme';
import { Screen, Sheet, Btn, IconBtn, Ic, ICON, Coin, Row, Spinner, Skeleton, SuccessCheck, Empty, useDebouncedLoading } from './ui';
import { SWAP_SCREENS } from './swap/screens';
import { FEATURE_SCREENS } from './features';
import { SETTINGS_SCREENS } from './settingsScreens';
import { NETWORK_SCREENS } from './networkScreens';
import { RevealGate } from './revealGate';
import { TOKEN_SCREENS, CustomTokenDetailScreen } from './tokenScreens';
import { tokenItem, refreshTokens, useTokenItems } from './tokensStore';
import { networkByChainId } from '../../core/customTokens';
import { useChart, PriceChart, useHistory, HistoryList, HistoryRow, useInfo, AboutPanel } from './tokenData';
import { CHART_RANGES, type ChartRange } from '../../core/marketData';
import type { HistoryItem } from '../../core/txHistory';
import { historySupported } from '../../core/txHistory';
import { chainById } from '../../core/chains/index';
import { addressFor } from '../../core/chains/adapters';
import { DappsPanel } from './features/dappsPanel';
import { ASSETS, allAssets, explorerTx, assetOf, networkOptions, usd, pct, short } from './data';
import { syncNetworks } from './networkStore';

export type Nav = { push: (name: string, params?: any) => void; pop: () => void; home: () => void; lock?: () => void; backup?: () => void };
export interface Account { derivationIndex: number; name: string; addresses: Record<string, string> }
export interface Ctx { addrs: Record<string, string>; balances: Record<string, any>; bg: (m: any) => Promise<any>; params: any; nav: Nav; accounts?: Account[]; activeAccount?: number; hiddenAssets?: string[]; networkFilter?: string | null; refresh?: () => void }

const evmAddr = (c: Ctx) => c.addrs.ethereum ?? Object.values(c.addrs)[0] ?? '';
// Address of the account that holds an asset: the chain's own address (registry), or the EVM address for custom tokens.
const assetAddr = (c: Ctx, a: { id: string; evm: boolean }) => { const ch = chainById(a.id); return ch ? addressFor(ch, c.addrs) : (a.evm ? evmAddr(c) : (c.addrs[a.id] ?? '')); };

// ---------- Sparkline ----------
const Spark: React.FC<{ data: number[]; up: boolean; w?: number; h?: number }> = ({ data, up, w = 320, h = 90 }) => {
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - v * (h - 8) - 4}`).join(' ');
  const col = up ? T.success : T.error;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={col} opacity="0.08" />
    </svg>
  );
};

// ---------- Send / Receive / Transaction detail: implemented in ./send (feature 33); thin re-exports keep the old imports working ----------
export { SendScreen, ReceiveScreen } from './send';
import { SendScreen, ReceiveScreen } from './send';

// ---------- Token detail (exact TW layout: price, range pills, Holdings/History/About, bottom actions) ----------
const RANGES = ['1H', '1D', '1W', '1M', '1Y', 'All'];
export const TokenDetailScreen: React.FC<Ctx> = (c) => (assetOf(c.params?.assetId)?.token ? <CustomTokenDetailScreen {...c} /> : <NativeTokenDetailScreen {...c} />);
const NativeTokenDetailScreen: React.FC<Ctx> = (c) => {
  const a = assetOf(c.params?.assetId) ?? ASSETS[0];
  const b = c.balances[a.id];
  const [range, setRange] = useState<ChartRange>('1D');
  const [tab, setTab] = useState<'holdings' | 'history' | 'about'>('holdings');
  const chart = useChart(c.bg, a.id, range);
  const [scrub, setScrub] = useState<{ t: number; p: number } | null>(null);
  // Never fall back to the static sample price: live balance price, else the chart's latest point.
  const price: number | null = scrub?.p ?? b?.price ?? chart.data?.last ?? null;
  const change: number | null = chart.data?.changePct ?? b?.change ?? null;
  const up = (change ?? 0) >= 0;
  const bal = b ? Number(b.formatted) : 0;
  const address = assetAddr(c, a);
  return (
    <div className="hb-screen" style={{ position: 'absolute', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', zIndex: 20 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 8 }}>
        <IconBtn icon="back" onClick={c.nav.pop} />
        <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: 16 }}>{a.name}</div><div style={{ fontSize: 12, color: T.sub }}>{a.id === 'sepolia' ? 'Sepolia testnet' : a.name}</div></div>
        <IconBtn icon="star" />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
        {/* price */}
        <div style={{ textAlign: 'center', paddingTop: 10 }} className="hb-rise">
          <div style={{ fontSize: 30, fontWeight: 800 }}>{price != null ? usd(price) : '—'}</div>
          {change != null && <div style={{ color: up ? T.success : T.error, fontWeight: 600, fontSize: 14, marginTop: 2 }}>{up ? '▲' : '▼'} {pct(change)}</div>}
        </div>
        {/* chart (real CoinGecko market chart) */}
        <div style={{ margin: '18px 0', minHeight: 130 }}>
          {chart.loading ? <Skeleton h={130} r={0} />
            : chart.data ? <PriceChart points={chart.data.points} up={up} range={range} h={130} onScrub={setScrub} />
            : <div style={{ height: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.sub, fontSize: 13, textAlign: 'center', padding: '0 24px' }}>{chart.error}{a.id !== 'sepolia' && <button type="button" className="hb-tap" onClick={chart.retry} style={{ marginTop: 10, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 999, padding: '6px 16px', fontWeight: 700, cursor: 'pointer' }}>Retry</button>}</div>}
        </div>
        {/* range pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
          {CHART_RANGES.map((r) => <button key={r} onClick={() => { setScrub(null); setRange(r); }} style={{ border: 'none', background: range === r ? T.bgAlt : 'transparent', color: range === r ? T.text : T.sub, fontWeight: 600, fontSize: 13, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>{r}</button>)}
        </div>
        {/* tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, padding: '0 16px', marginTop: 8 }}>
          {(['holdings', 'history', 'about'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 2px', marginRight: 22, fontWeight: 700, fontSize: 15, color: tab === t ? T.text : T.sub, borderBottom: tab === t ? `2px solid ${T.accent}` : '2px solid transparent' }}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        <div style={{ padding: '12px 16px' }}>
          {tab === 'holdings' && <>
            <div style={{ fontWeight: 700, margin: '4px 0 8px' }}>My Balance</div>
            <div style={{ background: T.bgAlt, borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Coin sym={a.sym} assetId={a.id} color={a.color} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 12, color: T.sub }}>{price != null ? usd(price) : '—'}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700 }} data-testid="native-balance">{!b ? '…' : b.ok === false ? 'Unavailable' : `${Number(b.formatted).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${a.sym}`}</div><div style={{ fontSize: 12, color: T.sub }}>{b?.ok === false ? "Couldn't load balance" : b?.usd != null ? usd(b.usd) : '—'}</div></div>
            </div>
            {a.evm && a.native && a.id !== 'sepolia' && <Row onClick={() => c.nav.push('gasStation', { assetId: a.id })} left={<Coin sym="GAS" color={a.color} />} title="Gas station" sub="Live network fees" right={<Ic d={ICON.chevron} size={18} />} />}
          </>}
          {tab === 'history' && <TokenHistory c={c} assetId={a.id} address={address} color={a.color} />}
          {tab === 'about' && <TokenAbout c={c} assetId={a.id} sym={a.sym} name={a.name} />}
        </div>
      </div>
      {/* fixed bottom actions */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: 10, padding: '12px 16px', borderTop: `1px solid ${T.border}`, background: T.surface }}>
        {[['Send', 'send'], ['Receive', 'receive']].map(([label, to]) => (
          <button key={label} className="hb-tap" onClick={() => c.nav.push(to, { assetId: a.id })} style={{ flex: 1, border: 'none', background: to === 'send' ? T.accent : T.accentSoft, color: to === 'send' ? 'var(--hb-on-brand)' : T.accent, borderRadius: 999, padding: '13px 0', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ic d={ICON[to === 'send' ? 'send' : 'receive']} size={18} />{label}
          </button>
        ))}
      </div>
    </div>
  );
};
// Mounted only while its tab is open, so the explorer/market requests fire on demand.
const TokenHistory: React.FC<{ c: Ctx; assetId: string; address: string; color?: string }> = ({ c, assetId, address, color }) => <HistoryList s={useHistory(c.bg, assetId, address)} color={color} />;
const TokenAbout: React.FC<{ c: Ctx; assetId: string; sym: string; name: string }> = ({ c, assetId, sym, name }) => <AboutPanel s={useInfo(c.bg, assetId, true)} sym={sym} name={name} />;

// ---------- Activity (real: aggregated native-asset history across the active account's networks) ----------
// Every visible network whose public history source is wired (core/txHistory.historySupported), fetched with bounded concurrency.
const ACTIVITY_MAX_CHAINS = 30;
export const ActivityScreen: React.FC<Ctx> = (c) => {
  const [state, setState] = useState<{ items: HistoryItem[] | null; failed: string[] }>({ items: null, failed: [] });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let dead = false; setState({ items: null, failed: [] });
    const ids = ASSETS.map((a) => a.id).filter((id) => !(c.hiddenAssets ?? []).includes(id) && historySupported(id) && !!assetAddr(c, assetOf(id)!)).slice(0, ACTIVITY_MAX_CHAINS);
    const results: Array<{ id: string; items: HistoryItem[]; failed?: boolean }> = []; let next = 0;
    const one = async () => { while (next < ids.length) {
      const id = ids[next++]; const a = assetOf(id)!; const address = assetAddr(c, a);
      try { const r = await c.bg({ type: 'txHistory', assetId: id, address }); results.push(r?.ok ? { id, items: r.items as HistoryItem[] } : { id, items: [], failed: true }); }
      catch { results.push({ id, items: [], failed: true }); } } };
    Promise.all(Array.from({ length: Math.min(6, ids.length) }, one)).then(() => {
      if (dead) return; const rs = results;
      const seen = new Set<string>(); const items: HistoryItem[] = [];
      for (const r of rs) for (const x of r.items) { const k = `${x.assetId}:${x.id}`; if (!seen.has(k)) { seen.add(k); items.push(x); } }
      items.sort((x, y) => y.timestamp - x.timestamp);
      setState({ items: items.slice(0, 100), failed: rs.filter((r: any) => r.failed).map((r) => assetOf(r.id)!.name) });
    });
    return () => { dead = true; };
  }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const colorOf = (id: string) => assetOf(id)?.color;
  return <Screen title="Activity" onBack={c.nav.pop}>
    {state.items == null ? [0, 1, 2, 3].map((i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'center' }}><Skeleton w={40} h={40} r={999} /><div style={{ flex: 1 }}><Skeleton w={120} h={12} /><div style={{ height: 6 }} /><Skeleton w={80} h={10} /></div></div>)
      : <>
        {state.failed.length > 0 && <div style={{ background: T.bgAlt, color: T.sub, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, marginBottom: 6 }}>Couldn't load history for {state.failed.join(', ')}. <button type="button" onClick={() => setNonce((n) => n + 1)} style={{ border: 'none', background: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Retry</button></div>}
        {state.items.length === 0 ? <Empty title="No transactions yet" sub="Your activity will appear here." icon="history" /> : state.items.map((x) => <HistoryRow key={`${x.assetId}:${x.id}`} x={x} color={colorOf(x.assetId)} />)}
      </>}
  </Screen>;
};

// Buy / Fund / Discover screens live in features/ramps.tsx and features/discover.tsx (real providers + DeFiLlama directory).

// ---------- Search (TW ManageCrypto: Crypto + DApps tabs) — evidence 19/20/21 ----------
const MiniToggle: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button onClick={onClick} style={{ width: 44, height: 26, borderRadius: 999, border: 'none', background: on ? T.accent : T.border, position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
    <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: 'var(--hb-on-brand)', transition: 'left .2s' }} />
  </button>
);
export const SearchScreen: React.FC<Ctx> = (c) => {
  const [tab, setTab] = useState<'crypto' | 'dapps'>('crypto');
  const [cq, setCq] = useState('');
  const [net, setNet] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>(c.hiddenAssets ?? []);
  useEffect(() => { c.bg({ type: 'getUiPrefs' }).then((r) => { if (r?.ok) setHidden(r.hiddenAssets ?? []); }); }, []);
  const toggleAsset = async (id: string) => {
    const willHide = !hidden.includes(id);
    setHidden((h) => willHide ? [...h, id] : h.filter((x) => x !== id));
    await c.bg({ type: 'setAssetHidden', assetId: id, hidden: willHide });
    c.refresh?.();
  };
  const q = cq.trim().toLowerCase();
  useTokenItems(); useEffect(() => { void refreshTokens(c.bg); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const looksAddr = /^0x[0-9a-fA-F]{40}$/.test(cq.trim());
  let cryptoAssets = allAssets().filter((a) => !net || a.id === net || a.token?.networkId === net);
  if (q) cryptoAssets = cryptoAssets.filter((a) => a.sym.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.token?.address.toLowerCase() === q);
  const nets = networkOptions();
  const netCount = nets.length;

  return (
    <Screen title="Search" onBack={c.nav.pop} right={tab === 'crypto' ? <IconBtn icon="plus" title="Add custom token" onClick={() => c.nav.push('selectTokenNetwork')} /> : undefined}>
      <div style={{ display: 'flex', gap: 20, borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
        {(['crypto', 'dapps'] as const).map((t2) => (
          <button key={t2} onClick={() => setTab(t2)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontWeight: 700, fontSize: 15, color: tab === t2 ? T.text : T.sub, borderBottom: tab === t2 ? `2px solid ${T.accent}` : '2px solid transparent' }}>{t2 === 'crypto' ? 'Crypto' : 'DApps'}</button>
        ))}
      </div>
      {tab === 'crypto' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgAlt, borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
        <Ic d={ICON.search} size={18} />
        <input autoFocus value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Token name or contract address" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: T.text }} />
      </div>}
      {tab === 'crypto' ? <>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }} className="scrollbar-hide">
          <button onClick={() => setNet(null)} title="All Networks" style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 999, border: `2px solid ${net === null ? T.accent : 'transparent'}`, background: T.bgAlt, color: net === null ? T.accent : T.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>All</button>
          {nets.map((n) => (
            <button key={n.id} onClick={() => setNet(n.id)} title={n.name} style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 999, border: `2px solid ${net === n.id ? T.accent : 'transparent'}`, background: 'transparent', cursor: 'pointer', padding: 0 }}>
              <Coin sym={n.sym} assetId={n.id} size={36} color={n.color} />
            </button>
          ))}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', height: 40, borderRadius: 999, border: `2px solid ${T.border}`, color: T.sub, fontWeight: 700, fontSize: 13 }}>{netCount}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
          {cryptoAssets.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Coin sym={a.sym} assetId={a.id} size={38} color={a.color} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{a.sym}</div><div style={{ fontSize: 12, color: T.sub }}>{a.token ? `${a.name} · ${networkByChainId(a.chainId)?.name ?? ''}` : a.name}</div></div>
              <MiniToggle on={!hidden.includes(a.id)} onClick={() => toggleAsset(a.id)} />
            </div>
          ))}
          {looksAddr && !cryptoAssets.length && (
            <Row data-testid="search-import-contract" onClick={() => c.nav.push('selectTokenNetwork', { address: cq.trim() })} left={<Coin sym="+" />} title="Import this contract as a custom token" sub="Choose the network it is on" right={<Ic d={ICON.chevron} size={18} />} />
          )}
          {!cryptoAssets.length && !looksAddr && <Empty title="No tokens found" sub="Try a different name or address, or add a custom token with +." icon="search" />}
        </div>
      </> : <DappsPanel c={c} />}
    </Screen>
  );
};

// ---------- Network selector (globe) — evidence 21 (Select network) ----------
export const NetworkSelectorScreen: React.FC<Ctx> = (c) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(c.networkFilter ?? null);
  const [, bump] = useState(0);
  useEffect(() => { void syncNetworks(c.bg).then(() => bump((v) => v + 1)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const nq = q.trim().toLowerCase();
  const nets = networkOptions().filter((n) => !nq || n.name.toLowerCase().includes(nq) || n.sym.toLowerCase().includes(nq));
  const choose = async (id: string | null) => {
    setSel(id);
    await c.bg({ type: 'setNetworkFilter', networkId: id });
    c.refresh?.();
    c.nav.pop();
  };
  return (
    <Screen title="Select network" onBack={c.nav.pop}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgAlt, borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
        <Ic d={ICON.search} size={18} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Network Name" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: T.text }} />
      </div>
      {!nq && (
        <Row onClick={() => choose(null)} left={<div style={{ width: 40, height: 40, borderRadius: 999, background: T.bgAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON.globe} size={20} /></div>} title="All Networks" right={<Radio on={sel === null} />} />
      )}
      {nets.map((n) => <Row key={n.id} onClick={() => choose(n.id)} left={<Coin sym={n.sym} assetId={n.id} size={40} color={n.color} />} title={n.name} right={<Radio on={sel === n.id} />} />)}
      {nq && !nets.length && <Empty title="No networks found" sub="Try a different name." icon="globe" />}
    </Screen>
  );
};

// ---------- Wallet selector ----------
// ---------- shared bits for wallet management ----------
const WalletAvatar: React.FC<{ seed: number }> = ({ seed }) => (
  <div aria-label={`Wallet account ${seed + 1}`} style={{ width: 40, height: 40, borderRadius: 12, background: T.accentSoft, color: T.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ic d={ICON.wallet} size={20} /></div>
);
const Radio: React.FC<{ on: boolean }> = ({ on }) => (
  <span style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${on ? T.accent : T.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    {on && <span style={{ width: 10, height: 10, borderRadius: 999, background: T.accent }} />}
  </span>
);
const IconCircle: React.FC<{ icon: string }> = ({ icon }) => (
  <div style={{ width: 40, height: 40, borderRadius: 12, background: T.bgAlt, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON[icon]} size={20} /></div>
);

// ---------- Wallet selector (TW parity: seed-phrase groups -> accounts, add account,
// add new wallet, manage wallets) ----------
export const WalletSelectorScreen: React.FC<Ctx> = (c) => {
  const [wallets, setWallets] = useState<any[] | null>(null);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const r = await c.bg({ type: 'listWallets' });
    if (r?.ok) { setWallets(r.wallets ?? []); setActiveWalletId(r.activeWalletId ?? null); }
  };
  useEffect(() => { load(); }, []);
  const addAccount = async (walletId: string) => {
    if (busy) return; setBusy(true);
    try { await c.bg({ type: 'switchWallet', walletId }); const r = await c.bg({ type: 'addAccount' }); if (r?.ok) { c.refresh?.(); await load(); } }
    finally { setBusy(false); }
  };
  const selectAccount = async (walletId: string, index: number) => {
    if (busy) return; setBusy(true);
    try { await c.bg({ type: 'switchWallet', walletId }); await c.bg({ type: 'switchAccount', index }); c.refresh?.(); c.nav.pop(); }
    finally { setBusy(false); }
  };
  return (
    <Screen title="Wallets" onBack={c.nav.pop} right={<IconBtn icon="gear" onClick={() => c.nav.push('settings')} />}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.sub, margin: '6px 2px 8px' }}>Mnemonic</div>
      {wallets === null ? <div style={{ color: T.sub, textAlign: 'center', marginTop: 20 }}>Loading…</div> :
        wallets.map((w, wi) => (
          <div key={w.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 6px' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{w.label}</div>
            </div>
            <div style={{ background: T.bgAlt, borderRadius: 14, padding: '2px 12px' }}>
              {w.accounts.map((a: any, i: number) => {
                const evm = a.addresses?.ethereum ?? Object.values(a.addresses ?? {})[0] ?? '';
                const selected = w.id === activeWalletId && i === w.activeAccount;
                return (
                  <Row key={a.derivationIndex ?? i} onClick={() => selectAccount(w.id, i)}
                    left={<WalletAvatar seed={wi + i} />}
                    title={a.name} sub={short(evm)}
                    right={<Radio on={selected} />} />
                );
              })}
              <div className="hb-tap" onClick={() => addAccount(w.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', marginTop: 4, color: T.text, fontWeight: 700, borderTop: `1px solid ${T.border}`, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
                Add account <Ic d={ICON.plus} size={18} />
              </div>
            </div>
          </div>
        ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" onClick={() => c.nav.push('addWallet')} style={{ flex: 1 }}>Add new wallet →</Btn>
        <Btn variant="ghost" onClick={() => c.nav.push('manageWallets')} style={{ flex: 1 }}>Manage wallets →</Btn>
      </div>
    </Screen>
  );
};

// ---------- Add new wallet (create fresh seed, or import existing) ----------
export const AddWalletScreen: React.FC<Ctx> = (c) => {
  const [mode, setMode] = useState<'choose' | 'import'>('choose');
  const [phrase, setPhrase] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const createNew = async () => {
    if (busy) return; setBusy(true); setErr('');
    try {
      const r = await c.bg({ type: 'addWallet' });
      if (r?.ok) { c.refresh?.(); c.nav.pop(); if (r.mnemonic) c.nav.push('backup', { mnemonic: r.mnemonic, label: r.label }); }
      else setErr(r?.error || 'Could not create wallet');
    } finally { setBusy(false); }
  };
  const importExisting = async () => {
    if (busy) return; setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'addWallet', mnemonic: phrase.trim() }); if (r?.ok) { c.refresh?.(); c.nav.pop(); } else setErr(r?.error || 'Could not import wallet'); }
    finally { setBusy(false); }
  };
  if (mode === 'import') return (
    <Screen title="Import wallet" onBack={() => setMode('choose')}>
      <div style={{ color: T.sub, fontSize: 13, margin: '4px 0 10px' }}>Enter your 12 or 24-word secret phrase, words separated by spaces.</div>
      <textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} rows={4} placeholder="word1 word2 word3 …" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${T.border}`, padding: 12, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
      {err && <div style={{ color: T.error, fontSize: 13, marginTop: 8 }}>{err}</div>}
      <Btn onClick={importExisting} disabled={busy || phrase.trim().split(/\s+/).filter(Boolean).length < 12} style={{ marginTop: 14 }}>{busy ? 'Importing…' : 'Import wallet'}</Btn>
    </Screen>
  );
  return (
    <Screen title="Add new wallet" onBack={c.nav.pop}>
      <div style={{ marginTop: 6 }}>
        <Row onClick={createNew} left={<IconCircle icon="plus" />} title={busy ? 'Creating…' : 'Create new wallet'} sub="Generate a brand-new secret phrase" right={<Ic d={ICON.chevron} size={18} />} />
        <Row onClick={() => setMode('import')} left={<IconCircle icon="wallet" />} title="Add existing wallet" sub="Import with a secret phrase" right={<Ic d={ICON.chevron} size={18} />} />
      </div>
      {err && <div style={{ color: T.error, fontSize: 13, marginTop: 8 }}>{err}</div>}
    </Screen>
  );
};

// ---------- Manage wallets (list seed phrases, each with a backup link) ----------
export const ManageWalletsScreen: React.FC<Ctx> = (c) => {
  const [wallets, setWallets] = useState<any[] | null>(null);
  useEffect(() => { c.bg({ type: 'listWallets' }).then((r) => { if (r?.ok) setWallets(r.wallets ?? []); }); }, []);
  return (
    <Screen title="Manage wallets" onBack={c.nav.pop}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.sub, margin: '6px 2px 8px' }}>Mnemonic</div>
      {(wallets ?? []).map((w) => (
        <div key={w.id} style={{ background: T.bgAlt, borderRadius: 14, padding: '2px 14px', marginBottom: 12 }}>
          <Row onClick={() => c.nav.push('editWallet', { walletId: w.id, label: w.label })}
            left={<WalletAvatar seed={w.accounts.length} />}
            title={w.label} sub={`${w.accounts.length} Account${w.accounts.length === 1 ? '' : 's'}`}
            right={<Ic d={ICON.chevron} size={18} />} />
          <div className="hb-tap" onClick={() => c.nav.push('backup', { walletId: w.id, label: w.label })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', color: T.accent, fontWeight: 600, cursor: 'pointer', borderTop: `1px solid ${T.border}` }}>
            <span>Back up your Secret Phrase</span><Ic d={ICON.chevron} size={18} />
          </div>
        </div>
      ))}
      <Btn onClick={() => c.nav.push('addWallet')} style={{ marginTop: 6 }}>Add new wallet</Btn>
    </Screen>
  );
};

// ---------- Back up / reveal a wallet's secret phrase ----------
export const BackupScreen: React.FC<Ctx> = (c) => {
  const presetM: string | undefined = c.params?.mnemonic;
  const [m, setM] = useState<string>(presetM ?? '');
  const [granted, setGranted] = useState(!!presetM || c.params?.granted === true);
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(!presetM);
  const [shown, setShown] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (presetM || !granted) return;
    setLoading(true);
    c.bg({ type: 'revealMnemonic', walletId: c.params?.walletId })
      .then((r) => { if (r?.ok) setM(r.mnemonic); else setErr(r?.error === 'AUTH_REQUIRED' ? 'Verification expired. Go back and try again.' : r?.error || 'Could not reveal phrase'); })
      .finally(() => setLoading(false));
  }, [granted]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = m.split(' ').filter(Boolean);
  const proceed = async () => {
    if (busy) return; setBusy(true);
    try { await c.bg({ type: 'markBackedUp', walletId: c.params?.walletId }); c.refresh?.(); c.nav.pop(); }
    finally { setBusy(false); }
  };
  return (
    <Screen title="Back Up Your Secret Phrase" onBack={c.nav.pop}>
      {!granted ? <RevealGate bg={c.bg} walletId={c.params?.walletId} autoBiometric={c.params?.autoBiometric} onGranted={() => setGranted(true)} onCancel={c.nav.pop} /> : <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: T.accentSoft, borderRadius: 14, padding: 14, margin: '6px 0 14px' }}>
        <span style={{ fontSize: 22 }}>🔑</span>
        <div style={{ fontSize: 13, color: T.text }}>Back up safely these {words.length || 12} words in a piece of paper and never share it with anyone.</div>
      </div>
      {loading ? <div style={{ color: T.sub, textAlign: 'center', marginTop: 30 }}>Revealing…</div> :
        err ? <div style={{ color: T.error, marginTop: 16 }}>{err}</div> : <>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, filter: shown ? 'none' : 'blur(6px)', transition: 'filter .2s', userSelect: shown ? 'text' : 'none' }}>
              {words.map((w, i) => (
                <div key={i} style={{ background: T.bgAlt, borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>
                  <span style={{ color: T.sub, marginRight: 6 }}>{i + 1}</span>{w}
                </div>
              ))}
            </div>
            {!shown && (
              <div onClick={() => setShown(true)} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--hb-scrim)', color: 'var(--hb-on-brand)', borderRadius: 999, padding: '8px 16px', fontWeight: 700, fontSize: 13 }}><Ic d={ICON.eye} size={16} /> Tap to reveal</span>
              </div>
            )}
          </div>
          <Btn onClick={() => (shown ? proceed() : setShown(true))} disabled={busy} style={{ marginTop: 18 }}>{shown ? (busy ? 'Saving…' : 'Proceed') : 'Show'}</Btn>
        </>}
      </>}
    </Screen>
  );
};

// ---------- Edit Wallet (rename, reveal phrase, remove, accounts list) ----------
export const EditWalletScreen: React.FC<Ctx> = (c) => {
  const walletId: string = c.params?.walletId;
  const [label, setLabel] = useState<string>(c.params?.label ?? 'Seed Phrase 1');
  const [wallet, setWallet] = useState<any>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(label);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const load = async () => {
    const r = await c.bg({ type: 'listWallets' });
    if (r?.ok) { const w = (r.wallets ?? []).find((x: any) => x.id === walletId); if (w) { setWallet(w); setLabel(w.label); } }
  };
  useEffect(() => { load(); }, []);
  const saveName = async () => {
    const name = nameDraft.trim(); if (!name) return;
    setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'renameWallet', walletId, name }); if (r?.ok) { setLabel(name); setRenaming(false); c.refresh?.(); } else setErr(r?.error || 'Rename failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'removeWallet', walletId }); if (r?.ok) { c.refresh?.(); c.nav.pop(); } else { setErr(r?.error || 'Remove failed'); setConfirmRemove(false); } }
    finally { setBusy(false); }
  };
  return (
    <Screen title="Edit Wallet" onBack={c.nav.pop}>
      <div style={{ background: T.bgAlt, borderRadius: 16, padding: '2px 16px', marginTop: 6 }}>
        {renaming ? (
          <div style={{ padding: '14px 0', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Wallet Name</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit' }} />
              <Btn onClick={saveName} disabled={busy} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Save</Btn>
            </div>
          </div>
        ) : (
          <div className="hb-tap" onClick={() => { setNameDraft(label); setRenaming(true); }} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>Wallet Name</div><div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>{label}</div></div>
            <span style={{ color: T.sub }}><Ic d={ICON.edit} size={18} /></span>
          </div>
        )}
        <div className="hb-tap" onClick={() => c.nav.push('backup', { walletId, label })} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
          <div style={{ flex: 1, fontWeight: 700 }}>Secret Phrase</div>
          <span style={{ color: T.sub }}><Ic d={ICON.eye} size={18} /></span>
        </div>
        <div className="hb-tap" onClick={() => setConfirmRemove(true)} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', cursor: 'pointer', color: T.error }}>
          <div style={{ flex: 1, fontWeight: 700 }}>Remove wallet</div>
          <Ic d={ICON.trash} size={18} />
        </div>
      </div>

      <div style={{ fontWeight: 800, fontSize: 18, margin: '20px 2px 8px' }}>Accounts</div>
      <div style={{ background: T.bgAlt, borderRadius: 16, padding: '2px 14px' }}>
        {(wallet?.accounts ?? []).map((a: any, i: number) => {
          const evm = a.addresses?.ethereum ?? Object.values(a.addresses ?? {})[0] ?? '';
          return (
            <Row key={a.derivationIndex ?? i} onClick={() => c.nav.push('accountDetail', { walletId, index: i, name: a.name, address: evm })}
              left={<WalletAvatar seed={i + 1} />} title={a.name} sub="$0.00"
              right={<Ic d={ICON.chevron} size={18} />} />
          );
        })}
      </div>
      {err && <div style={{ color: T.error, fontSize: 13, marginTop: 12 }}>{err}</div>}

      {confirmRemove && (
        <Sheet title="Remove wallet?" onClose={() => setConfirmRemove(false)}>
          <div style={{ color: T.sub, fontSize: 14, marginBottom: 14 }}>This removes {label} from this device. Make sure its secret phrase is backed up — without it this wallet cannot be recovered.</div>
          <Btn onClick={remove} disabled={busy} style={{ background: T.error }}>{busy ? 'Removing…' : 'Remove wallet'}</Btn>
          <Btn variant="ghost" onClick={() => setConfirmRemove(false)} style={{ marginTop: 8 }}>Cancel</Btn>
        </Sheet>
      )}
    </Screen>
  );
};

// ---------- Edit Account (rename + address) ----------
export const AccountDetailScreen: React.FC<Ctx> = (c) => {
  const { walletId, index } = c.params ?? {};
  const [name, setName] = useState<string>(c.params?.name ?? 'Account 1');
  const [draft, setDraft] = useState(name); const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [copied, setCopied] = useState(false);
  const addr: string = c.params?.address ?? '';
  const save = async () => {
    const n = draft.trim(); if (!n) return; setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'renameAccount', walletId, index, name: n }); if (r?.ok) { setName(n); setEditing(false); c.refresh?.(); } else setErr(r?.error || 'Rename failed'); }
    finally { setBusy(false); }
  };
  return (
    <Screen title="Edit Account" onBack={c.nav.pop}>
      <div style={{ background: T.bgAlt, borderRadius: 16, padding: '2px 16px', marginTop: 6 }}>
        {editing ? (
          <div style={{ padding: '14px 0' }}>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Account Name</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit' }} />
              <Btn onClick={save} disabled={busy} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Save</Btn>
            </div>
          </div>
        ) : (
          <div className="hb-tap" onClick={() => { setDraft(name); setEditing(true); }} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', cursor: 'pointer' }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>Account Name</div><div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>{name}</div></div>
            <span style={{ color: T.sub }}><Ic d={ICON.edit} size={18} /></span>
          </div>
        )}
      </div>
      {addr && <>
        <div style={{ fontWeight: 800, fontSize: 16, margin: '18px 2px 8px' }}>EVM Address</div>
        <div className="hb-tap" onClick={() => { navigator.clipboard?.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} style={{ background: T.bgAlt, borderRadius: 16, padding: 16, wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>{addr}</span><span style={{ color: T.accent }}><Ic d={ICON.copy} size={16} /></span>
        </div>
        {copied && <div style={{ color: T.success, fontSize: 12, marginTop: 6 }}>Copied</div>}
      </>}
      {err && <div style={{ color: T.error, fontSize: 13, marginTop: 12 }}>{err}</div>}
    </Screen>
  );
};

export const SCREENS: Record<string, React.FC<Ctx>> = {
  send: SendScreen, receive: ReceiveScreen, tokenDetail: TokenDetailScreen, activity: ActivityScreen,
  search: SearchScreen, networkSelector: NetworkSelectorScreen,
  walletSelector: WalletSelectorScreen, addWallet: AddWalletScreen, manageWallets: ManageWalletsScreen, backup: BackupScreen,
  editWallet: EditWalletScreen, accountDetail: AccountDetailScreen,
  ...SETTINGS_SCREENS,
  ...TOKEN_SCREENS,
  ...NETWORK_SCREENS,
  ...SWAP_SCREENS,
  ...FEATURE_SCREENS,
};
