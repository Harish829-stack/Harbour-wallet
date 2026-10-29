import React, { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../theme';
import { Screen, Sheet, Btn, IconBtn, Ic, ICON, Coin, Row, Skeleton, Empty, InkTabs } from './ui';
import { SWAP_SCREENS } from './swap/screens';
import { FEATURE_SCREENS } from './features';
import { SETTINGS_SCREENS } from './settingsScreens';
import { NETWORK_SCREENS } from './networkScreens';
import { TOKEN_SCREENS, CustomTokenDetailScreen } from './tokenScreens';
import { refreshTokens, useTokenItems } from './tokensStore';
import { networkByChainId } from '../../core/customTokens';
import { useChart, PriceChart, useHistory, HistoryList, HistoryRow, useInfo, AboutPanel } from './tokenData';
import { CHART_RANGES, type ChartRange } from '../../core/marketData';
import type { HistoryItem } from '../../core/txHistory';
import { activitySupported } from '../../core/activity/index';
import { mergeActivity, activityNetworks, orderChains } from '../../core/activityFeed';
import { chainById, NETWORK_CATEGORIES, NETWORK_CATEGORY_LABEL } from '../../core/chains/index';
import { addressFor } from '../../core/chains/adapters';
import { DappsPanel } from './features/dappsPanel';
import { useWorkerState } from '../api';
import { ASSETS, allAssets, assetOf, networkOptions, usd, pct, short } from './data';
import { syncNetworks } from './networkStore';

export type Nav = { push: (name: string, params?: any) => void; pop: () => void; home: () => void; lock?: () => void; backup?: () => void };
export interface Account { derivationIndex: number; name: string; addresses: Record<string, string> }
export interface Ctx { addrs: Record<string, string>; balances: Record<string, any>; bg: (m: any) => Promise<any>; params: any; nav: Nav; accounts?: Account[]; activeAccount?: number; hiddenAssets?: string[]; networkFilter?: string | null; refresh?: () => void }

const evmAddr = (c: Ctx) => c.addrs.ethereum ?? Object.values(c.addrs)[0] ?? '';
// Address of the account that holds an asset: the chain's own address (registry), or the EVM address for custom tokens.
const assetAddr = (c: Ctx, a: { id: string; evm: boolean }) => { const ch = chainById(a.id); return ch ? addressFor(ch, c.addrs) : (a.evm ? evmAddr(c) : (c.addrs[a.id] ?? '')); };

// ---------- Sparkline ----------

// ---------- Send / Receive / Transaction detail: implemented in ./send (feature 33); thin re-exports keep the old imports working ----------
export { SendScreen, ReceiveScreen } from './send';
import { SendScreen, ReceiveScreen } from './send';

// ---------- Token detail (exact TW layout: price, range pills, Holdings/History/About, bottom actions) ----------
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
          {CHART_RANGES.map((r) => <button key={r} onClick={() => { setScrub(null); setRange(r); }} className="hb-tap" style={{ border: 'none', background: range === r ? T.bgAlt : 'transparent', color: range === r ? T.text : T.sub, fontWeight: 600, fontSize: 13, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>{r}</button>)}
        </div>
        {/* tabs */}
        <InkTabs tabs={['holdings', 'history', 'about'] as const} value={tab} onChange={setTab} label={(t) => t[0].toUpperCase() + t.slice(1)} gap={22} pad="12px 2px" style={{ padding: '0 16px', marginTop: 8 }} />
        <div key={tab} className="hb-tab-fade" style={{ padding: '12px 16px' }}>
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

// ---------- Activity (real: history of every network the active account holds, with a per-network filter) ----------
// Every visible network whose public history source is wired (core/txHistory.historySupported) is fetched with bounded concurrency and
// streamed into one feed. Networks are queried in priority order (the filtered network, then funded ones) so a cap can never starve them.
const ACTIVITY_MAX_CHAINS = 150;      // upper bound on networks queried per open (registry + testnets is well below this today)
const ACTIVITY_CONCURRENCY = 8;
const ACTIVITY_ALL_LIMIT = 100;       // rows shown in the "All networks" feed; a single network shows everything it returned
type ChainResult = { items: HistoryItem[]; failed: boolean };
const names = (list: string[]) => list.length <= 3 ? list.join(', ').replace(/, ([^,]*)$/, list.length > 1 ? ' and $1' : ', $1') : `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`;
export const ActivityScreen: React.FC<Ctx> = (c) => {
  const cRef = useRef(c); cRef.current = c;
  const hidden = c.hiddenAssets ?? [];
  const tokenItems = useTokenItems().items;
  // A network is in scope when it is not hidden, or when one of its tokens is still shown (hiding a coin must not hide that token's transfers).
  const visibleTokenNets = new Set(tokenItems.filter((i) => !hidden.includes(i.token.id)).map((i) => i.token.networkId));
  const funded = new Set(allAssets().filter((a) => { const b = c.balances?.[a.id]; return b?.ok !== false && Number(b?.formatted) > 0; }).map((a) => a.id));
  const eligible = allAssets().filter((a) => a.native && (!hidden.includes(a.id) || visibleTokenNets.has(a.id)) && activitySupported(a.id) && !!assetAddr(c, a)).map((a) => a.id);
  const ids = orderChains(eligible, c.networkFilter, funded).slice(0, ACTIVITY_MAX_CHAINS);
  const scope = [...ids].sort().map((id) => `${id}@${assetAddr(c, assetOf(id)!)}`).join('|');   // account / visibility / network set only; fetch ORDER (balances, filter) must not retrigger a reload
  const idsRef = useRef(ids); idsRef.current = ids;

  const [results, setResults] = useState<Record<string, ChainResult>>({});
  const [remaining, setRemaining] = useState(ids.length);
  const gen = useRef(0);
  const [picked, setPicked] = useState<string | null>(c.networkFilter && ids.includes(c.networkFilter) ? c.networkFilter : null);

  // Fetches `targets` with a small worker pool; a result is applied only if the scope has not changed since it was requested.
  const load = (targets: string[], g: number) => {
    let next = 0;
    const worker = async () => { while (next < targets.length) {
      const id = targets[next++]; const cur = cRef.current; const a = assetOf(id); const address = a ? assetAddr(cur, a) : '';
      let res: ChainResult;
      try { const r = address ? await cur.bg({ type: 'txHistory', assetId: id, address }) : null; res = r?.ok ? { items: r.items as HistoryItem[], failed: false } : { items: [], failed: true }; }
      catch { res = { items: [], failed: true }; }
      if (gen.current !== g) return;
      setResults((p) => ({ ...p, [id]: res })); setRemaining((n) => Math.max(0, n - 1));
    } };
    void Promise.all(Array.from({ length: Math.min(ACTIVITY_CONCURRENCY, targets.length) }, worker));
  };
  useEffect(() => {
    const g = ++gen.current; setResults({}); setRemaining(idsRef.current.length); load(idsRef.current, g);
    return () => { gen.current++; }; // eslint-disable-line react-hooks/exhaustive-deps -- gen is a request counter, not a DOM ref
  }, [scope]);
  // A transaction status pushed by the backend: reload in place (rows stay on screen while the new ones arrive).
  const txTick = useWorkerState((s) => s.live?.txTick ?? 0);
  useEffect(() => { if (txTick) load(idsRef.current, gen.current); }, [txTick]);
  const failedIds = ids.filter((id) => results[id]?.failed);
  const retry = (only?: string[]) => {
    const targets = (only ?? failedIds).filter((id) => results[id]?.failed); if (!targets.length) return;
    setResults((p) => { const n = { ...p }; for (const id of targets) delete n[id]; return n; }); setRemaining((n) => n + targets.length); load(targets, gen.current);
  };

  const feed = useMemo(() => mergeActivity(ids.map((id) => results[id]?.items ?? [])), [results, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = remaining > 0;
  const sel = picked && ids.includes(picked) ? picked : null;                 // a stale pick (account / visibility change) falls back to All
  const nameOf = (id: string) => assetOf(id)?.name ?? id;
  const chips = activityNetworks(feed).map((n) => n.assetId); if (sel && !chips.includes(sel)) chips.push(sel);
  const rows = sel ? feed.filter((x) => x.assetId === sel) : feed.slice(0, ACTIVITY_ALL_LIMIT);
  const truncated = !sel && feed.length > ACTIVITY_ALL_LIMIT;
  const selFailed = !!sel && !!results[sel]?.failed;
  const pill = (on: boolean): React.CSSProperties => ({ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? T.accentSoft : 'transparent', color: on ? T.accent : T.text, borderRadius: 999, padding: '6px 12px 6px 8px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' });
  const banner = (msg: React.ReactNode, onRetry: () => void) => <div role="status" style={{ background: T.bgAlt, color: T.sub, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, marginBottom: 6 }}>{msg} <button type="button" onClick={onRetry} style={{ border: 'none', background: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Retry</button></div>;
  const skeleton = [0, 1, 2, 3].map((i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'center' }}><Skeleton w={40} h={40} r={999} /><div style={{ flex: 1 }}><Skeleton w={120} h={12} /><div style={{ height: 6 }} /><Skeleton w={80} h={10} /></div></div>);

  return <Screen title="Activity" onBack={c.nav.pop}>
    {chips.length > 0 && <div role="tablist" aria-label="Filter by network" className="scrollbar-hide" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
      <button type="button" role="tab" aria-selected={!sel} onClick={() => setPicked(null)} style={{ ...pill(!sel), padding: '6px 14px' }}>All networks</button>
      {chips.map((id) => <button key={id} type="button" role="tab" aria-selected={sel === id} onClick={() => setPicked(id)} style={pill(sel === id)}><Coin sym={assetOf(id)?.sym ?? ''} assetId={id} size={22} color={assetOf(id)?.color} />{nameOf(id)}</button>)}
    </div>}
    {loading && ids.length > 1 && rows.length > 0 && <div style={{ color: T.sub, fontSize: 12, padding: '0 2px 6px' }}>Loading {remaining} more network{remaining === 1 ? '' : 's'}…</div>}
    {!loading && !sel && failedIds.length > 0 && banner(<>Couldn't load history for {names(failedIds.map(nameOf))}.</>, () => retry())}
    {rows.length > 0 ? <>
      {selFailed && !loading && banner(<>Couldn't load all history for {nameOf(sel!)}.</>, () => retry([sel!]))}
      {rows.map((x) => <HistoryRow key={`${x.assetId}:${x.id}`} x={x} color={assetOf(x.assetId)?.color} network={sel ? undefined : nameOf(x.assetId)} />)}
      {truncated && <div style={{ color: T.sub, fontSize: 12.5, textAlign: 'center', padding: '14px 8px' }}>Showing the latest {ACTIVITY_ALL_LIMIT} transactions. Pick a network to see more.</div>}
    </>
      : loading && (!sel || !results[sel]) ? skeleton
      : selFailed ? <div style={{ textAlign: 'center', padding: '28px 12px', color: T.sub, fontSize: 14 }}>Couldn't load history for {nameOf(sel!)} right now.<div><button type="button" className="hb-tap" onClick={() => retry([sel!])} style={{ marginTop: 12, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 999, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', color: T.text }}>Retry</button></div></div>
      : ids.length > 0 && failedIds.length === ids.length ? <div style={{ textAlign: 'center', padding: '28px 12px', color: T.sub, fontSize: 14 }}>Couldn't load your activity right now.<div><button type="button" className="hb-tap" onClick={() => retry()} style={{ marginTop: 12, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 999, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', color: T.text }}>Retry</button></div></div>
      : sel ? <Empty title={`No transactions on ${nameOf(sel)}`} sub="Activity on this network will appear here." icon="history" />
      : <Empty title="No transactions yet" sub="Your activity will appear here." icon="history" />}
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {NETWORK_CATEGORIES.map((cat) => {
        const list = nets.filter((n) => n.category === cat); if (!list.length) return null;
        return <div key={cat} data-testid={`networks-${cat}`}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.sub, margin: '14px 2px 6px' }}>{NETWORK_CATEGORY_LABEL[cat]}</div>
          {list.map((n) => <Row key={n.id} onClick={() => choose(n.id)} left={<Coin sym={n.sym} assetId={n.id} size={40} color={n.color} />} title={n.name} right={<Radio on={sel === n.id} />} />)}
        </div>;
      })}
      {nq && !nets.length && <Empty title="No networks found" sub="Try a different name." icon="globe" />}
      <div style={{ padding: '14px 0 20px' }}><Btn variant="ghost" onClick={() => c.nav.push('customNetworks')} data-testid="manage-networks">Manage networks</Btn></div>
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

// Add-wallet and back-up screens live in wallet/features/onboarding.tsx (the phrase is shown only as a worker-painted image).

// ---------- Manage wallets (list seed phrases, each with a backup link) ----------
export const ManageWalletsScreen: React.FC<Ctx> = (c) => {
  const [wallets, setWallets] = useState<any[] | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  walletSelector: WalletSelectorScreen, manageWallets: ManageWalletsScreen,
  editWallet: EditWalletScreen, accountDetail: AccountDetailScreen,
  ...SETTINGS_SCREENS,
  ...TOKEN_SCREENS,
  ...NETWORK_SCREENS,
  ...SWAP_SCREENS,
  ...FEATURE_SCREENS,
};
