// Market sentiment screen + Help screen.
import React, { useState } from 'react';
import { T } from '../../theme';
import type { Ctx } from '../types';
import { Screen, Btn, Empty, Ic, ICON, Row, Sheet, Coin } from '../ui';
import { Notice, Chip, ChipRow, ListSkeleton, ErrorBox, openHttps, useAsync, ago } from './rampKit';

interface Item { id: string; kind: 'article' | 'post'; title: string; snippet: string; url: string; source: string; at: number; label: 'positive' | 'neutral' | 'negative'; labelBy: 'source' | 'lexicon' }
interface Sent { symbol: string; name: string; negative: { articles: Item[]; posts: Item[] }; neutral: { articles: Item[]; posts: Item[] }; positive: { articles: Item[]; posts: Item[] }; score: number | null; counts: { positive: number; neutral: number; negative: number }; sources: Array<{ name: string; kind: string; ok: boolean; count: number; error?: string }>; at: number }

const LAB: Array<['negative' | 'neutral' | 'positive', string]> = [['negative', 'Negative'], ['neutral', 'Neutral'], ['positive', 'Positive']];
const tone = (l: string) => (l === 'positive' ? T.success : l === 'negative' ? T.error : T.sub);

export const MarketSentimentScreen: React.FC<Ctx> = (c) => {
  const [sym, setSym] = useState<string>(typeof c.params?.symbol === 'string' ? c.params.symbol.toUpperCase() : 'BTC');
  const [tab, setTab] = useState<'articles' | 'posts'>('articles');
  const [filter, setFilter] = useState<'all' | 'negative' | 'neutral' | 'positive'>('all');
  const assets = useAsync(async () => { const r = await c.bg({ type: 'sentimentAssets' }); return (r?.assets ?? []) as Array<{ symbol: string; name: string }>; }, []);
  const s = useAsync(async () => { const r = await c.bg({ type: 'sentiment', symbol: sym }); if (!r?.ok) throw new Error(r?.error ?? 'Sentiment unavailable'); return r.sentiment as Sent; }, [sym]);
  const d = s.data;
  const items: Item[] = d ? LAB.filter(([l]) => filter === 'all' || filter === l).flatMap(([l]) => (d as any)[l][tab] as Item[]).sort((a, b) => b.at - a.at) : [];
  const list = assets.data ?? [];
  return (
    <Screen title="Market sentiment" onBack={c.nav.pop}>
      <ChipRow>{(list.length ? list : [{ symbol: sym, name: sym }]).map((a) => <Chip key={a.symbol} active={a.symbol === sym} onClick={() => setSym(a.symbol)}>{a.symbol}</Chip>)}</ChipRow>
      {s.loading && !d ? <ListSkeleton n={5} /> : s.error && !d ? <ErrorBox message={s.error} onRetry={s.reload} /> : d && (
        <div className="hb-rise">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: T.bgAlt, borderRadius: 18, padding: 14, marginBottom: 12 }}>
            <Coin sym={d.symbol} size={44} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{d.name}</div><div style={{ fontSize: 12, color: T.sub }}>{d.counts.positive + d.counts.neutral + d.counts.negative} items · updated {ago(d.at)}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 26, fontWeight: 800, color: d.score == null ? T.sub : d.score >= 55 ? T.success : d.score <= 45 ? T.error : T.text }}>{d.score == null ? '—' : `${d.score}%`}</div><div style={{ fontSize: 11, color: T.sub }}>positive</div></div>
          </div>
          <ChipRow><Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>{LAB.map(([l, n]) => <Chip key={l} active={filter === l} onClick={() => setFilter(l)}>{n} {d.counts[l]}</Chip>)}</ChipRow>
          <div role="tablist" style={{ display: 'flex', gap: 20, borderBottom: `1px solid ${T.border}`, marginBottom: 8 }}>
            {(['articles', 'posts'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontWeight: 700, fontSize: 15, color: tab === t ? T.text : T.sub, borderBottom: `2px solid ${tab === t ? T.accent : 'transparent'}` }}>{t === 'articles' ? 'News Articles' : 'Social Posts'}</button>)}
          </div>
          {items.length === 0 ? <Empty title={tab === 'articles' ? 'No articles found' : 'No posts found'} sub="Nothing recent matched this asset and filter." icon="globe" /> : items.map((it) => (
            <button key={it.id} type="button" onClick={() => openHttps(it.url)} className="hb-tap" style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px 2px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', color: T.text }}>
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{it.title}</div>
              {it.snippet && <div style={{ fontSize: 12.5, color: T.sub, margin: '4px 0', lineHeight: 1.4 }}>{it.snippet}</div>}
              <div style={{ fontSize: 11.5, color: T.sub }}>{it.source} · {ago(it.at)} · <span style={{ color: tone(it.label), fontWeight: 700 }}>{it.label}</span>{it.labelBy === 'lexicon' ? ' (estimated)' : ''}</div>
            </button>))}
          <div style={{ marginTop: 12 }}>{d.sources.map((x) => <div key={x.name} style={{ fontSize: 11.5, color: x.ok ? T.sub : T.error }}>{x.name}: {x.ok ? `${x.count} items` : `unavailable${x.error ? ` (${x.error})` : ''}`}</div>)}</div>
          <div style={{ fontSize: 11, color: T.sub, marginTop: 8, lineHeight: 1.5 }}>Scores combine source-provided labels with a simple keyword estimate. They are not financial advice. Links open in a new tab.</div>
        </div>)}
    </Screen>);
};

const ver = (): string => { try { return (globalThis as any).chrome?.runtime?.getManifest?.().version ?? ''; } catch { return ''; } };

export const HelpScreen: React.FC<Ctx> = (c) => {
  const h = useAsync(async () => { const r = await c.bg({ type: 'helpConfigGet' }); if (!r?.ok) throw new Error('Could not load'); return r as { config: { helpCenterUrl: string; guideUrl: string; announcementsUrl: string }; faq: Array<{ title: string; items: Array<{ q: string; a: string }> }> }; }, []);
  const an = useAsync(async () => c.bg({ type: 'announcements' }), [h.data?.config.announcementsUrl]);
  const [edit, setEdit] = useState(false); const [open, setOpen] = useState<string | null>(null);
  const cfg = h.data?.config;
  const link = (label: string, sub: string, url: string | undefined, icon: string) => <Row left={<span style={{ color: T.accent }}><Ic d={ICON[icon]} size={22} /></span>} title={label} sub={url ? sub : 'Not configured. Set a link with Edit support links.'} right={<Ic d={ICON.external} size={16} />} onClick={url ? () => openHttps(url) : () => setEdit(true)} />;
  return (
    <Screen title="Help" onBack={c.nav.pop}>
      {h.loading ? <ListSkeleton n={4} /> : h.error ? <ErrorBox message={h.error} onRetry={h.reload} /> : (
        <div className="hb-rise">
          {link('Help Center', 'Opens in a new tab', cfg?.helpCenterUrl, 'help')}
          {link('Support', 'Opens in a new tab', cfg?.guideUrl, 'support')}
          <button type="button" onClick={() => setEdit(true)} style={{ border: 'none', background: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: '4px 2px 10px' }}>Edit support links</button>
          <h3 style={{ fontSize: 15, margin: '8px 2px' }}>Announcements</h3>
          {an.loading ? <ListSkeleton n={2} /> : !an.data?.configured ? <Notice>Harbour has no public announcements feed. Add your own JSON feed URL under Edit support links to see announcements here.</Notice>
            : an.data.ok === false ? <Notice tone="error" action={{ label: 'Retry', onClick: an.reload }}>{an.data.error ?? 'Announcements are unavailable.'}</Notice>
            : an.data.items.length === 0 ? <Empty title="No announcements" icon="bell" /> : an.data.items.map((x: any) => <Row key={x.id} left={<span style={{ color: T.accent }}><Ic d={ICON.bell} size={20} /></span>} title={x.title} sub={x.body || (x.at ? ago(x.at) : '')} onClick={x.url ? () => openHttps(x.url) : undefined} />)}
          <h3 style={{ fontSize: 15, margin: '14px 2px 6px' }}>FAQ</h3>
          {h.data!.faq.map((g) => <div key={g.title} style={{ marginBottom: 10 }}><div style={{ fontSize: 12, color: T.sub, fontWeight: 700, margin: '6px 2px' }}>{g.title}</div>
            {g.items.map((it) => { const k = `${g.title}:${it.q}`; const o = open === k; return (
              <div key={k} style={{ background: T.bgAlt, borderRadius: 14, marginBottom: 8 }}>
                <button type="button" aria-expanded={o} onClick={() => setOpen(o ? null : k)} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: 'none', background: 'transparent', padding: '12px 14px', cursor: 'pointer', color: T.text, fontWeight: 700, textAlign: 'left', fontSize: 14 }}>{it.q}<Ic d={o ? ICON.down : ICON.chevron} size={16} /></button>
                {o && <div style={{ padding: '0 14px 12px', color: T.sub, fontSize: 13, lineHeight: 1.5 }}>{it.a}</div>}
              </div>); })}</div>)}
          <h3 style={{ fontSize: 15, margin: '14px 2px 6px' }}>Developer</h3>
          <Row left={<span style={{ color: T.accent }}><Ic d={ICON.card} size={22} /></span>} title="Ramp API keys" sub="Provider keys for buy and sell quotes" right={<Ic d={ICON.chevron} size={16} />} onClick={() => c.nav.push('rampApiKeys')} />
          <div style={{ textAlign: 'center', color: T.sub, fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>Harbour Wallet {ver() ? `version ${ver()}` : ''}<br />Data sources: CoinGecko, DeFiLlama, public block explorers, open.er-api.com. No analytics.</div>
        </div>)}
      {edit && cfg && <HelpEdit c={c} cfg={cfg} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); h.reload(); }} />}
    </Screen>);
};

const HelpEdit: React.FC<{ c: Ctx; cfg: { helpCenterUrl: string; guideUrl: string; announcementsUrl: string }; onClose: () => void; onSaved: () => void }> = ({ c, cfg, onClose, onSaved }) => {
  const [v, setV] = useState(cfg); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); setErr(''); try { const r = await c.bg({ type: 'helpConfigSet', patch: v }); if (r?.ok) onSaved(); else setErr(r?.error ?? 'Could not save'); } catch (e: any) { setErr(String(e?.message ?? 'Could not save')); } finally { setBusy(false); } };
  const f = (k: keyof typeof v, label: string, ph: string) => <label style={{ display: 'block', marginBottom: 12, fontSize: 12.5, color: T.sub, fontWeight: 600 }}>{label}<input aria-label={label} value={v[k]} placeholder={ph} spellCheck={false} onChange={(e) => setV({ ...v, [k]: e.target.value })} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgAlt, fontSize: 14 }} /></label>;
  return <Sheet title="Support links" onClose={onClose}>
    {f('helpCenterUrl', 'Help Center URL', 'https://…')}{f('guideUrl', 'Support URL', 'https://…')}{f('announcementsUrl', 'Announcements feed URL (JSON)', 'https://…')}
    {err && <Notice tone="error">{err}</Notice>}<Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></Sheet>;
};
