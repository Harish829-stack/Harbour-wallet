// Selection steps of the Buy / Sell flow (TW: BuySelectFiat, BuySelectCrypto, BuySelectNetwork, BuySelectProvider, BuySelectPaymentMethod,
// RecurringBuySetup; evidences/re-evidence/36-ramps/SPEC.md). Each is a full-screen pushed view that reports its choice through a callback.
import React, { useMemo, useState } from 'react';
import { T } from '../../theme';
import { Screen, Row, Btn, Empty, Coin, Ic, ICON } from '../ui';
import { ALL_CHAINS, DEFAULT_HOME_CHAINS, chainLogo } from '../../../core/chains/index';
import { SearchBox, Chip, ChipRow, Notice, Letter, fmtCrypto, fmtFiat, ON_BRAND, readPrefs, type RampCfg } from './rampKit';

export type CfgAsset = RampCfg['assets'][number];
export interface QuoteView { id: string; providerId: string; providerName: string; paymentMethod: { categoryId: string; label: string; providerName?: string }; fiat: { currency: string; amount: number }; crypto: { symbol: string; amount: number | null }; feeFiat?: number; isRecommended: boolean; badges: string[]; mode: string }
export interface ProviderStateView { id: string; name: string; state: 'ok' | 'needs_key' | 'unsupported' | 'error' | 'widget_only'; message?: string }
export interface QuotesView { quotes: QuoteView[]; categories: Array<{ id: string; displayName: string }>; providers: ProviderStateView[]; bestQuoteId?: string }

const Header: React.FC<{ title: string; onBack: () => void; children: React.ReactNode }> = ({ title, onBack, children }) => <Screen title={title} onBack={onBack}>{children}</Screen>;

// ---------------------------------------------------------------- fiat
export const FiatStep: React.FC<{ cfg: RampCfg; selected: string; onPick: (code: string) => void; onBack: () => void }> = ({ cfg, selected, onPick, onBack }) => {
  const [q, setQ] = useState(''); const last = readPrefs().fiat;
  const s = q.trim().toLowerCase();
  const match = (f: RampCfg['fiats'][number]) => !s || f.code.toLowerCase().includes(s) || f.name.toLowerCase().includes(s);
  const popular = cfg.fiats.filter((f) => f.popular && match(f)); const other = cfg.fiats.filter((f) => !f.popular && match(f));
  const row = (f: RampCfg['fiats'][number]) => (
    <Row key={f.code} onClick={() => onPick(f.code)} left={<Letter name={f.code.slice(0, 1)} size={36} />} title={f.code} sub={f.name}
      right={f.code === selected ? <span style={{ color: T.accent }}><Ic d={ICON.check} size={18} /></span> : last === f.code ? <span style={{ fontSize: 11, color: T.sub }}>Last used</span> : undefined} />
  );
  return (
    <Header title="Select currency" onBack={onBack}>
      <SearchBox value={q} onChange={setQ} placeholder="Search currency" autoFocus />
      {popular.length > 0 && <><div style={{ color: T.sub, fontSize: 12, fontWeight: 700, margin: '4px 0' }}>Popular</div>{popular.map(row)}</>}
      {other.length > 0 && <><div style={{ color: T.sub, fontSize: 12, fontWeight: 700, margin: '12px 0 4px' }}>Other</div>{other.map(row)}</>}
      {!popular.length && !other.length && <Empty title="No currency found" sub="Try a different name or code." icon="search" />}
    </Header>
  );
};

// ---------------------------------------------------------------- crypto
const POPULAR_IDS = new Set(DEFAULT_HOME_CHAINS);
export const CryptoStep: React.FC<{ cfg: RampCfg; mode: 'buy' | 'sell' | 'p2p' | 'recurring'; selectedId?: string; network: string | null; onNetwork: () => void; onPick: (a: CfgAsset) => void; onBack: () => void;
  fiat: string; held?: (a: CfgAsset) => string | null; allowed?: (a: CfgAsset) => boolean; recent: string[] }> = ({ cfg, mode, selectedId, network, onNetwork, onPick, onBack, fiat, held, allowed, recent }) => {
  const [q, setQ] = useState(''); const [tab, setTab] = useState<'all' | 'popular' | 'stables'>('all');
  const s = q.trim().toLowerCase();
  const base = useMemo(() => cfg.assets.filter((a) => (!allowed || allowed(a)) && (!network || a.chainId === network)), [cfg, allowed, network]);
  const list = base.filter((a) => (!s || a.symbol.toLowerCase().includes(s) || a.name.toLowerCase().includes(s) || a.chainName.toLowerCase().includes(s)) && (s || tab === 'all' || (tab === 'stables' ? !a.isNative : a.isNative ? POPULAR_IDS.has(a.chainId) : POPULAR_IDS.has(a.chainId))));
  const recents = mode === 'buy' && !s && tab === 'all' ? recent.map((id) => base.find((a) => a.assetId === id)).filter(Boolean) as CfgAsset[] : [];
  const row = (a: CfgAsset, k = '') => {
    const bal = held?.(a);
    return <Row key={k + a.assetId} onClick={() => onPick(a)} left={<Coin sym={a.symbol} assetId={a.isNative ? a.chainId : undefined} size={38} />} title={a.symbol} sub={a.isNative ? a.name : `${a.name} · ${a.chainName}`}
      right={bal != null ? bal : a.assetId === selectedId ? <span style={{ color: T.accent }}><Ic d={ICON.check} size={18} /></span> : undefined} />;
  };
  const title = mode === 'p2p' ? 'Buy with P2P' : mode === 'sell' ? 'Sell' : 'Buy crypto';
  return (
    <Header title={title} onBack={onBack}>
      <SearchBox value={q} onChange={setQ} placeholder="Search" autoFocus />
      {mode === 'p2p' && <div style={{ color: T.sub, fontSize: 13, marginBottom: 8 }}>Available to {fiat} pair</div>}
      {mode !== 'p2p' && <>
        <ChipRow>{(['all', 'popular', 'stables'] as const).map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t === 'all' ? 'All' : t === 'popular' ? 'Popular' : 'Stables'}</Chip>)}</ChipRow>
        <button type="button" onClick={onNetwork} className="hb-tap" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: T.bgAlt, border: 'none', borderRadius: 14, padding: '10px 14px', cursor: 'pointer', color: T.text, fontWeight: 600, marginBottom: 10 }}>
          <Ic d={ICON.globe} size={18} /><span style={{ flex: 1, textAlign: 'left' }}>{network ? ALL_CHAINS.find((c) => c.id === network)?.name ?? network : 'All networks'}</span><Ic d={ICON.chevron} size={16} />
        </button></>}
      {recents.length > 0 && <><div style={{ color: T.sub, fontSize: 12, fontWeight: 700, margin: '4px 0' }}>Recently purchased</div>{recents.map((a) => row(a, 'r:'))}<div style={{ color: T.sub, fontSize: 12, fontWeight: 700, margin: '12px 0 4px' }}>All assets</div></>}
      {list.map((a) => row(a))}
      {list.length === 0 && <Empty title={mode === 'sell' ? 'Nothing to sell' : 'No tokens found'} sub={mode === 'sell' ? 'Only assets you hold, that a provider supports, can be sold.' : 'Try a different name, symbol or network.'} icon="search" />}
    </Header>
  );
};

// ---------------------------------------------------------------- network
export const NetworkStep: React.FC<{ cfg: RampCfg; selected: string | null; onPick: (chainId: string | null) => void; onBack: () => void }> = ({ cfg, selected, onPick, onBack }) => {
  const [q, setQ] = useState(''); const s = q.trim().toLowerCase();
  const ids = new Set(cfg.assets.map((a) => a.chainId));
  const chains = ALL_CHAINS.filter((c) => ids.has(c.id) && (!s || c.name.toLowerCase().includes(s) || c.symbol.toLowerCase().includes(s)));
  const pop = chains.filter((c) => POPULAR_IDS.has(c.id)); const az = [...chains].sort((a, b) => a.name.localeCompare(b.name));
  const row = (c: typeof chains[number], k: string) => <Row key={k + c.id} onClick={() => onPick(c.id)} left={<img src={chainLogo(c.id)} alt="" width={36} height={36} style={{ borderRadius: '50%' }} />} title={c.name} sub={c.symbol} right={selected === c.id ? <span style={{ color: T.accent }}><Ic d={ICON.check} size={18} /></span> : undefined} />;
  return (
    <Header title="Select network" onBack={onBack}>
      <SearchBox value={q} onChange={setQ} placeholder="Search for network" autoFocus />
      {!s && <Row onClick={() => onPick(null)} left={<span style={{ width: 36, height: 36, borderRadius: '50%', background: T.bgAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON.globe} size={18} /></span>} title="All networks" right={selected === null ? <span style={{ color: T.accent }}><Ic d={ICON.check} size={18} /></span> : undefined} />}
      {!s && pop.length > 0 && <><div style={{ color: T.sub, fontSize: 12, fontWeight: 700, margin: '10px 0 2px' }}>Popular networks</div>{pop.map((c) => row(c, 'p:'))}</>}
      <div style={{ color: T.sub, fontSize: 12, fontWeight: 700, margin: '10px 0 2px' }}>A-Z networks</div>
      {az.map((c) => row(c, 'a:'))}
      {az.length === 0 && <Empty title="No network found" icon="search" />}
    </Header>
  );
};

// ---------------------------------------------------------------- provider
export const ProviderStep: React.FC<{ result: QuotesView | null; loading: boolean; category: string | null; selectedId: string | null; mode: 'buy' | 'sell'; fiat: string; symbol: string;
  onPick: (q: QuoteView) => void; onMethod: () => void; onKeys: () => void; onBack: () => void }> = ({ result, loading, category, selectedId, mode, fiat, symbol, onPick, onMethod, onKeys, onBack }) => {
  const qs = (result?.quotes ?? []).filter((q) => !category || q.paymentMethod.categoryId === category);
  const catName = result?.categories.find((c) => c.id === category)?.displayName;
  const down = (result?.providers ?? []).filter((p) => p.state !== 'ok' && p.state !== 'widget_only');
  return (
    <Header title="Select provider" onBack={onBack}>
      {catName && <Row onClick={onMethod} left={<span style={{ width: 40, height: 40, borderRadius: 12, background: T.accentSoft, color: T.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON.card} size={20} /></span>} title={catName} sub="Payment method" right={<Ic d={ICON.chevron} size={18} />} />}
      {loading && !qs.length ? <div style={{ padding: 24, textAlign: 'center', color: T.sub }}>Loading quotes…</div> : qs.length === 0
        ? <Empty title="No providers available for this payment method." icon="card" /> : qs.map((q) => (
          <Row key={q.id} onClick={() => onPick(q)} left={<Letter name={q.providerName} size={40} />}
            title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{q.providerName}{q.badges.includes('BestPrice') && <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, background: T.accentSoft, borderRadius: 999, padding: '2px 8px' }}>Best quote</span>}</span>}
            sub={q.paymentMethod.label}
            right={q.crypto.amount == null && mode === 'buy' ? 'See in widget' : mode === 'buy' ? `${fmtCrypto(q.crypto.amount)} ${symbol}` : fmtFiat(q.fiat.amount, fiat)}
            rightSub={q.id === selectedId ? <span style={{ color: T.accent }}>Selected</span> : q.feeFiat ? `Fee ≈ ${fmtFiat(q.feeFiat, fiat)}` : undefined} />
        ))}
      {down.length > 0 && <>
        <div style={{ color: T.sub, fontSize: 12, fontWeight: 700, margin: '16px 0 4px' }}>Unavailable providers</div>
        {down.map((p) => <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', color: T.sub, fontSize: 13 }}><Letter name={p.name} size={28} /><div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: T.text }}>{p.name}</div><div>{p.state === 'needs_key' ? 'Needs API key' : p.state === 'unsupported' ? 'Not available for this asset' : 'Quote failed'}{p.message ? ` · ${p.message}` : ''}</div></div></div>)}
        {down.some((p) => p.state === 'needs_key') && <Notice action={{ label: 'Open Ramp API keys', onClick: onKeys }}>Providers marked "Needs API key" only quote registered integrators. Add your own key to enable them; Harbour never shows invented prices.</Notice>}
      </>}
    </Header>
  );
};

// ---------------------------------------------------------------- payment method
export const MethodStep: React.FC<{ result: QuotesView | null; loading: boolean; selected: string | null; onPick: (categoryId: string) => void; onBack: () => void }> = ({ result, loading, selected, onPick, onBack }) => (
  <Header title="Payment methods" onBack={onBack}>
    {loading && !result ? <div style={{ padding: 24, textAlign: 'center', color: T.sub }}>Loading…</div> : !result || result.categories.length === 0 ? <Empty title="No payment methods available." icon="card" />
      : <div role="radiogroup" aria-label="Payment methods">{result.categories.map((c) => (
        <div key={c.id} role="radio" aria-checked={selected === c.id} tabIndex={0} className="hb-tap" onClick={() => onPick(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(c.id); } }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', cursor: 'pointer' }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: T.bgAlt, color: T.sub, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={c.id === 'bank' || c.id === 'sepa' || c.id === 'ach' || c.id === 'instant' ? ICON.bank : ICON.card} size={20} /></span>
          <span style={{ flex: 1, fontWeight: 600 }}>{c.displayName}</span>
          <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${selected === c.id ? T.accent : T.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{selected === c.id && <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.accent }} />}</span>
        </div>))}</div>}
  </Header>
);

// ---------------------------------------------------------------- recurring setup
export const RecurringStep: React.FC<{ asset: CfgAsset; fiat: string; amount: string; frequency: 'weekly' | 'monthly'; start: string; mercuryoReady: boolean; busy: boolean; error: string;
  onFrequency: (f: 'weekly' | 'monthly') => void; onStart: (d: string) => void; onContinue: () => void; onKeys: () => void; onBack: () => void }> = (p) => {
  const min = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  return (
    <Header title="Set a recurring buy" onBack={p.onBack}>
      <Notice>Recurring buy refers to Dollar-cost averaging (DCA). This is a very efficient investment strategy, where you buy regularly in up and down markets.</Notice>
      <Row left={<Coin sym={p.asset.symbol} assetId={p.asset.isNative ? p.asset.chainId : undefined} size={36} />} title={p.asset.symbol} sub="Asset" right={`${p.amount} ${p.fiat}`} />
      <Row left={<Letter name="Mercuryo" size={36} />} title="Mercuryo" sub="Provider" right={p.mercuryoReady ? undefined : <span style={{ color: T.error, fontSize: 12 }}>Needs widget ID</span>} />
      <div style={{ fontSize: 12, color: T.sub, margin: '0 0 12px' }}>*Mercuryo is the only available provider for recurring buy</div>
      <div style={{ fontWeight: 700, margin: '8px 0' }}>Repeat</div>
      <ChipRow>{(['weekly', 'monthly'] as const).map((f) => <Chip key={f} active={p.frequency === f} onClick={() => p.onFrequency(f)}>{f === 'weekly' ? 'Weekly' : 'Monthly'}</Chip>)}</ChipRow>
      <label style={{ display: 'block', fontWeight: 700, margin: '8px 0 6px' }} htmlFor="rb-start">Start date</label>
      <input id="rb-start" type="date" min={min} value={p.start} onChange={(e) => p.onStart(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 14, border: `1px solid ${T.border}`, background: T.bgAlt, color: T.text, fontSize: 15 }} />
      <Notice tone="warn">Harbour has no provider-side scheduler. Continue makes your first purchase with Mercuryo and downloads a calendar reminder (.ics) repeating {p.frequency} so each next purchase is one tap.</Notice>
      {!p.mercuryoReady && <Notice tone="error" action={{ label: 'Open Ramp API keys', onClick: p.onKeys }}>Add your Mercuryo widget ID to continue.</Notice>}
      {p.error && <Notice tone="error">{p.error}</Notice>}
      <div style={{ marginTop: 12 }}><Btn onClick={p.onContinue} disabled={!p.mercuryoReady || p.busy || !p.start}>{p.busy ? 'Opening…' : 'Continue'}</Btn></div>
    </Header>
  );
};
export { ON_BRAND };
