// Real dApp directory UI (DeFiLlama): sections + categories + chain filter + search + detail sheet. Used by the Discover screen and by SearchScreen's DApps tab.
import React, { useMemo, useState } from 'react';
import { T } from '../../theme';
import type { Ctx } from '../screens';
import { Sheet, Btn, Empty, Ic, ICON } from '../ui';
import { Notice, Chip, ChipRow, SearchBox, Letter, ListSkeleton, ErrorBox, openHttps, useAsync, useDebounced, ago } from './rampKit';

export interface DappV { id: string; name: string; desc: string; url: string; logo: string; category: string; categoryId: string; chains: string[]; tvl: number; change1d: number | null; change7d: number | null; listedAt: number | null; twitter: string; symbol: string }
interface Resp { ok: boolean; error?: string; at: number; stale: boolean; categories: Array<{ id: string; name: string; count: number }>; chains: Array<{ name: string; tvl: number; chainId?: string }>; sections?: Array<{ id: string; name: string; items: DappV[] }>; results?: DappV[]; total?: number }

const fmtTvl = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`);
const Pct: React.FC<{ v: number | null; label: string }> = ({ v, label }) => v == null ? null : <span style={{ color: v >= 0 ? T.success : T.error, fontWeight: 600 }}>{label} {v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>;

const Logo: React.FC<{ d: DappV; size?: number }> = ({ d, size = 44 }) => {
  const [bad, setBad] = useState(false);
  return d.logo && !bad ? <img src={d.logo} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: size / 3.2, objectFit: 'cover', background: T.bgAlt, flexShrink: 0 }} /> : <Letter name={d.name} size={size} />;
};

export const DappRow: React.FC<{ d: DappV; onOpen: (d: DappV) => void }> = ({ d, onOpen }) => (
  <button type="button" onClick={() => onOpen(d)} className="hb-tap" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: T.text, textAlign: 'left' }}>
    <Logo d={d} />
    <span style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div><div style={{ fontSize: 12, color: T.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.category} · TVL {fmtTvl(d.tvl)}</div></span>
    <Ic d={ICON.chevron} size={16} />
  </button>);

export const DappSheet: React.FC<{ d: DappV; onClose: () => void }> = ({ d, onClose }) => (
  <Sheet title={d.name} onClose={onClose}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}><Logo d={d} size={56} /><div><div style={{ fontWeight: 800, fontSize: 18 }}>{d.name}</div><div style={{ color: T.sub, fontSize: 13 }}>{d.category}{d.symbol ? ` · ${d.symbol}` : ''}</div></div></div>
    {d.desc && <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>{d.desc}</div>}
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, margin: '0 0 10px' }}><span style={{ color: T.sub }}>TVL <b style={{ color: T.text }}>{fmtTvl(d.tvl)}</b></span><Pct v={d.change1d} label="1d" /><Pct v={d.change7d} label="7d" /></div>
    {d.chains.length > 0 && <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 12 }}>Chains: {d.chains.slice(0, 12).join(', ')}{d.chains.length > 12 ? ` +${d.chains.length - 12}` : ''}</div>}
    <Notice tone="warn">Harbour lists public protocols from DeFiLlama and does not audit or endorse them. Check the address before connecting a wallet.</Notice>
    <div style={{ height: 10 }} />
    <Btn onClick={() => { openHttps(d.url); }}>Open {(() => { try { return new URL(d.url).hostname.replace(/^www\./, ''); } catch { return 'website'; } })()}</Btn>
    {d.twitter && <div style={{ textAlign: 'center', marginTop: 10 }}><button type="button" onClick={() => openHttps(`https://x.com/${encodeURIComponent(d.twitter)}`)} style={{ border: 'none', background: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer' }}>@{d.twitter} on X</button></div>}
  </Sheet>);

/** compact = embedded inside SearchScreen (no own search box; takes `query` prop). */
export const DappsPanel: React.FC<{ c: Ctx; query?: string }> = ({ c, query }) => {
  const [own, setOwn] = useState(''); const q = useDebounced(query ?? own, 250);
  const [cat, setCat] = useState('all'); const [chain, setChain] = useState(''); const [sel, setSel] = useState<DappV | null>(null);
  const r = useAsync(async () => { const x = await c.bg({ type: 'dappsQuery', query: q, categoryId: cat, chain }); if (!x?.ok) throw new Error(x?.error ?? 'DApps are unavailable right now'); return x as Resp; }, [q, cat, chain]);
  const d = r.data;
  const chainOpts = useMemo(() => (d?.chains ?? []).filter((x) => x.chainId).slice(0, 20), [d]);
  return (
    <div>
      {query === undefined && <SearchBox value={own} onChange={setOwn} placeholder="Search DApps" label="Search DApps" />}
      <ChipRow><Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>{(d?.categories ?? []).map((x) => <Chip key={x.id} active={cat === x.id} onClick={() => setCat(x.id)}>{x.name}</Chip>)}</ChipRow>
      {chainOpts.length > 0 && <ChipRow><Chip active={!chain} onClick={() => setChain('')}>Any chain</Chip>{chainOpts.map((x) => <Chip key={x.name} active={chain === x.name} onClick={() => setChain(x.name)}>{x.name}</Chip>)}</ChipRow>}
      {r.loading && !d ? <ListSkeleton n={7} /> : r.error && !d ? <ErrorBox message={r.error} onRetry={r.reload} /> : d && (
        <>
          {d.stale && <Notice tone="warn" action={{ label: 'Retry', onClick: r.reload }}>Showing saved data from {ago(d.at)}; the directory could not be refreshed.</Notice>}
          {d.sections ? d.sections.map((s) => s.items.length > 0 && (
            <section key={s.id} style={{ marginBottom: 14 }}><h3 style={{ fontSize: 15, margin: '6px 2px' }}>{s.name}</h3>{s.items.map((x) => <DappRow key={`${s.id}:${x.id}`} d={x} onOpen={setSel} />)}</section>))
            : (d.results?.length ? <>{d.results.map((x) => <DappRow key={x.id} d={x} onOpen={setSel} />)}{(d.total ?? 0) > (d.results?.length ?? 0) && <div style={{ textAlign: 'center', color: T.sub, fontSize: 12, padding: 8 }}>Showing {d.results.length} of {d.total}. Search to narrow down.</div>}</> : <Empty title="No DApps found" sub="Try another search, category or chain." icon="globe" />)}
          {d.sections && d.sections.every((s) => s.items.length === 0) && <Empty title="No DApps found" sub="The directory returned no entries." icon="globe" />}
          <div style={{ fontSize: 11, color: T.sub, textAlign: 'center', padding: '8px 0' }}>Data: DeFiLlama · updated {ago(d.at)}</div>
        </>)}
      {sel && <DappSheet d={sel} onClose={() => setSel(null)} />}
    </div>);
};
