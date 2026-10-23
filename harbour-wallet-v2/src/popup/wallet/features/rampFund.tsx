// Fund menu, Deposit-from-exchange (CEX) flow and Developer > Ramp API keys. TW routes: /fund, /fund/cex/{providers,platform,assets,qr}.
import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { T } from '../../theme';
import type { Ctx } from '../types';
import { Screen, Btn, Coin, Ic, ICON, Row, Sheet, Empty } from '../ui';
import { Notice, Chip, ChipRow, SearchBox, Letter, ListSkeleton, ErrorBox, Busy, openHttps, useAsync, useDebounced, loadRampCfg, type KeyProvider } from './rampKit';

const MenuRow: React.FC<{ icon: string; title: string; sub: string; onClick: () => void; testid?: string }> = ({ icon, title, sub, onClick, testid }) => (
  <button type="button" data-testid={testid} onClick={onClick} className="hb-tap" style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 12px', border: 'none', background: T.bgAlt, borderRadius: 16, cursor: 'pointer', textAlign: 'left', color: T.text, marginBottom: 10 }}>
    <span style={{ width: 42, height: 42, borderRadius: 14, background: T.surface, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.accent }}><Ic d={ICON[icon] ?? ICON.plus} size={20} /></span>
    <span style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{title}</div><div style={{ fontSize: 12.5, color: T.sub, marginTop: 2, lineHeight: 1.35 }}>{sub}</div></span>
    <Ic d={ICON.chevron} size={18} />
  </button>);

/** TW FundingMethods (/fund): buy / deposit from exchange / receive / P2P / recurring. "Sell" is a Harbour addition (TW has a separate Sell action). */
export const FundScreen: React.FC<Ctx> = (c) => (
  <Screen title="Fund your wallet" onBack={c.nav.pop}>
    <div className="hb-rise">
      <MenuRow testid="fund-buy" icon="card" title="Buy crypto" sub="Pay with card, bank transfer or Apple/Google Pay through a provider" onClick={() => c.nav.push('buy')} />
      <MenuRow testid="fund-cex" icon="bank" title="Deposit from exchange" sub="Withdraw from Binance or Coinbase to your Harbour address" onClick={() => c.nav.push('fundCex')} />
      <MenuRow testid="fund-receive" icon="receive" title="Receive from another wallet" sub="Show your address and QR code" onClick={() => c.nav.push('receive')} />
      <MenuRow testid="fund-p2p" icon="contacts" title="Buy with P2P" sub="Trade directly with other people on Binance P2P" onClick={() => c.nav.push('buy', { mode: 'p2p' })} />
      <MenuRow testid="fund-recurring" icon="history" title="Set a recurring buy" sub="Buy a fixed amount on a schedule" onClick={() => c.nav.push('buy', { mode: 'recurring' })} />
      <MenuRow testid="fund-sell" icon="send" title="Sell crypto" sub="Cash out to your bank or card through a provider" onClick={() => c.nav.push('sell')} />
    </div>
  </Screen>);

const Tabs: React.FC<{ value: 'buy' | 'sell'; onChange: (v: 'buy' | 'sell') => void }> = ({ value, onChange }) => (
  <div role="tablist" style={{ display: 'flex', background: T.bgAlt, borderRadius: 999, padding: 3, marginBottom: 14 }}>
    {(['buy', 'sell'] as const).map((t) => <button key={t} role="tab" aria-selected={value === t} type="button" onClick={() => onChange(t)} style={{ flex: 1, border: 'none', borderRadius: 999, padding: '8px 0', fontWeight: 700, cursor: 'pointer', background: value === t ? T.surface : 'transparent', color: value === t ? T.text : T.sub }}>{t === 'buy' ? 'Buy' : 'Sell'}</button>)}
  </div>);

// ---------- Deposit from exchange
export const FundCexScreen: React.FC<Ctx> = (c) => {
  const cfg = useAsync(() => loadRampCfg(c.bg), []);
  return (
    <Screen title="Deposit from exchange" onBack={c.nav.pop}>
      {cfg.loading ? <ListSkeleton n={2} /> : cfg.error ? <ErrorBox message={cfg.error} onRetry={cfg.reload} /> : (
        <div className="hb-rise">
          <Notice>Pick the exchange you hold funds on. Harbour shows your own deposit address and the right network; the withdrawal itself happens on the exchange.</Notice>
          <div style={{ height: 10 }} />
          {cfg.data!.cexProviders.map((p) => <Row key={p.id} left={<Letter name={p.name} />} title={p.name} right={<Ic d={ICON.chevron} size={18} />} onClick={() => c.nav.push(p.needsPlatform ? 'fundCexPlatform' : 'fundCexAssets', { providerId: p.id })} />)}
        </div>)}
    </Screen>);
};

export const FundCexPlatformScreen: React.FC<Ctx> = (c) => {
  const pid = c.params?.providerId;
  return (
    <Screen title="Choose your platform" onBack={c.nav.pop}>
      <div className="hb-rise">
        <Notice>Where will you use the Binance app to withdraw? This only changes the instructions we show.</Notice>
        <div style={{ height: 10 }} />
        {(['Android', 'iOS', 'Web'] as const).map((p) => <Row key={p} left={<Letter name={p} />} title={p} right={<Ic d={ICON.chevron} size={18} />} onClick={() => c.nav.push('fundCexAssets', { providerId: pid, platform: p })} />)}
      </div>
    </Screen>);
};

export const FundCexAssetsScreen: React.FC<Ctx> = (c) => {
  const pid: string = c.params?.providerId ?? 'coinbase-pay';
  const [q, setQ] = useState(''); const dq = useDebounced(q, 150); const [net, setNet] = useState<string | null>(null);
  const r = useAsync(async () => { const x = await c.bg({ type: 'cexAssets', providerId: pid }); if (!x?.ok) throw new Error(x?.error ?? 'Could not load assets'); return x as { assets: any[]; source: string; note?: string }; }, [pid]);
  const nets = useMemo(() => { const m = new Map<string, string>(); for (const a of r.data?.assets ?? []) m.set(a.chainId, a.chainName); return [...m]; }, [r.data]);
  const list = useMemo(() => (r.data?.assets ?? []).filter((a) => (!net || a.chainId === net) && (!dq || `${a.symbol} ${a.name} ${a.chainName}`.toLowerCase().includes(dq.toLowerCase()))), [r.data, net, dq]);
  const name = pid === 'binance-pay' ? 'Binance' : 'Coinbase';
  return (
    <Screen title={`Deposit from ${name}`} onBack={c.nav.pop}>
      <SearchBox value={q} onChange={setQ} placeholder="Search assets" autoFocus />
      {r.loading ? <ListSkeleton /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> : (
        <>
          {r.data!.source === 'registry' && <Notice tone="warn">{r.data!.note ?? 'Showing Harbour’s own limited list; the exchange may not support every asset.'}</Notice>}
          {r.data!.source !== 'registry' && <div style={{ fontSize: 11, color: T.sub, margin: '0 2px 8px' }}>Source: {r.data!.source === 'coinbase-exchange-api' ? 'Coinbase Exchange public API' : 'Binance public API (unofficial endpoint)'}</div>}
          <ChipRow><Chip active={!net} onClick={() => setNet(null)}>All networks</Chip>{nets.map(([id, n]) => <Chip key={id} active={net === id} onClick={() => setNet(id)}>{n}</Chip>)}</ChipRow>
          {list.length === 0 ? <Empty title="No assets found" sub="Try another search or network." /> :
            list.slice(0, 200).map((a) => <Row key={a.key} left={<Coin sym={a.symbol} assetId={a.isNative ? a.chainId : undefined} size={40} />} title={a.symbol} sub={`${a.name} · ${a.chainName}`} right={<Ic d={ICON.chevron} size={18} />} onClick={() => c.nav.push('fundCexQr', { providerId: pid, assetKey: a.key, platform: c.params?.platform })} />)}
          {list.length > 200 && <div style={{ textAlign: 'center', color: T.sub, fontSize: 12, padding: 10 }}>Showing the first 200. Search to narrow down.</div>}
        </>)}
    </Screen>);
};

export const FundCexQrScreen: React.FC<Ctx> = (c) => {
  const { providerId, assetKey, platform } = c.params ?? {};
  const [qr, setQr] = useState(''); const [copied, setCopied] = useState(false); const [ack, setAck] = useState(false);
  const r = useAsync(async () => { const x = await c.bg({ type: 'cexDeposit', providerId, assetKey }); if (!x?.ok) throw new Error(x?.error ?? 'Could not prepare the deposit'); return x as any; }, [providerId, assetKey]);
  const addr: string = r.data?.address ?? '';
  useEffect(() => { if (addr) QRCode.toDataURL(r.data.qrData ?? addr, { margin: 1, width: 220 }).then(setQr).catch(() => setQr('')); }, [addr]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = r.data?.asset;
  return (
    <Screen title={a ? `Deposit ${a.symbol}` : 'Deposit'} onBack={c.nav.pop}>
      {r.loading ? <Busy label="Preparing your address…" /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> : (
        <div className="hb-rise" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}><Coin sym={a.symbol} assetId={a.isNative ? a.chainId : undefined} size={36} /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 800 }}>{a.symbol}</div><div style={{ fontSize: 12, color: T.sub }}>{a.networkLabel}</div></div></div>
          <div style={{ background: 'white', display: 'inline-block', padding: 10, borderRadius: 16, lineHeight: 0 }}>{qr ? <img src={qr} width={200} height={200} alt={`QR code of your ${a.chainName} address`} /> : <div style={{ width: 200, height: 200 }} />}</div>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }} className="hb-tap" aria-label="Copy address" style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, background: T.bgAlt, border: 'none', borderRadius: 16, padding: 14, margin: '14px 0', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13, color: T.text, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ flex: 1 }}>{addr}</span><span style={{ color: T.accent, fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>{copied ? 'Copied!' : <Ic d={ICON.copy} size={16} />}</span>
          </button>
          <div style={{ textAlign: 'left' }}>{(r.data.warnings as string[]).map((w, i) => <Notice key={i} tone={i < 2 ? 'warn' : 'info'}>{w}</Notice>)}</div>
          {platform && <div style={{ fontSize: 12, color: T.sub, textAlign: 'left', margin: '8px 2px' }}>In the Binance {platform} app: Wallets, Withdraw, Crypto, choose {a.symbol}, paste this address and pick the network “{a.networkLabel}”.</div>}
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', fontSize: 13, color: T.text, margin: '12px 2px' }}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--hb-brand)' }} />I will select the {a.networkLabel} network on the exchange.</label>
          <Btn disabled={!ack} onClick={() => { openHttps(r.data.exchangeUrl); }}>Open {providerId === 'binance-pay' ? 'Binance' : 'Coinbase'}</Btn>
          <div style={{ fontSize: 11, color: T.sub, marginTop: 10 }}>Address source: your Harbour vault. Asset list: {r.data.source === 'registry' ? 'Harbour registry (not exchange-confirmed)' : 'exchange public data'}.</div>
        </div>)}
    </Screen>);
};

// ---------- Developer > Ramp API keys (publishable keys only, local only)
const KeySheet: React.FC<{ c: Ctx; p: KeyProvider; onClose: () => void; onSaved: (ps: KeyProvider[]) => void }> = ({ c, p, onClose, onSaved }) => {
  const [vals, setVals] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => { setBusy(true); setErr(''); try { const r = await c.bg({ type: 'rampsKeysSet', providerId: p.id, keys: vals }); if (!r?.ok) setErr(r?.error ?? 'Could not save'); else { onSaved(r.providers); onClose(); } } catch (e: any) { setErr(String(e?.message ?? 'Could not save')); } finally { setBusy(false); } };
  const clear = async () => { setBusy(true); try { const r = await c.bg({ type: 'rampsKeysClear', providerId: p.id }); if (r?.ok) { onSaved(r.providers); onClose(); } else setErr(r?.error ?? 'Could not clear'); } finally { setBusy(false); } };
  return (
    <Sheet title={p.name} onClose={onClose}>
      <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5, marginBottom: 10 }}>{p.note ?? (p.widgetOnly ? 'This provider has no public quote API; it opens its widget.' : 'Enter the publishable key from your own provider dashboard.')} Keys are stored only in this browser profile and are never sent anywhere except to {p.name}. Use publishable keys only, never secret keys.</div>
      {p.fields.length === 0 ? <Notice>{p.name} needs no key.</Notice> : p.fields.map((f) => (
        <label key={f.field} style={{ display: 'block', marginBottom: 12, fontSize: 12.5, color: T.sub, fontWeight: 600 }}>{f.label}{f.optional ? ' (optional)' : ''}
          <input aria-label={f.label} autoComplete="off" spellCheck={false} value={vals[f.field] ?? ''} placeholder={f.configured ? `Saved: ${f.preview} (leave blank to keep)` : f.hint} onChange={(e) => setVals((v) => ({ ...v, [f.field]: e.target.value }))} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgAlt, fontSize: 14 }} />
        </label>))}
      {err && <Notice tone="error">{err}</Notice>}
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        {p.fields.some((f) => f.configured) && <Btn variant="ghost" onClick={clear} disabled={busy}>Clear</Btn>}
        {p.fields.length > 0 && <Btn onClick={save} disabled={busy || Object.values(vals).every((v) => !v.trim())}>{busy ? 'Saving…' : 'Save'}</Btn>}
      </div>
      <div style={{ textAlign: 'center', marginTop: 10 }}><button type="button" onClick={() => openHttps(p.docsUrl)} style={{ border: 'none', background: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Open {p.name} developer docs</button></div>
    </Sheet>);
};

export const RampApiKeysScreen: React.FC<Ctx> = (c) => {
  const r = useAsync(async () => { const x = await c.bg({ type: 'rampsKeysGet' }); if (!x?.ok) throw new Error(x?.error ?? 'Could not load'); return x.providers as KeyProvider[]; }, []);
  const [override, setOverride] = useState<KeyProvider[] | null>(null); const [sel, setSel] = useState<string | null>(null);
  const list = override ?? r.data ?? [];
  const p = list.find((x) => x.id === sel);
  return (
    <Screen title="Ramp API keys" onBack={c.nav.pop}>
      <Notice>Buy and sell quotes come from providers that require your own partner key. Harbour ships none and never invents prices. Keys stay in this browser only.</Notice>
      <div style={{ height: 10 }} />
      {r.loading ? <ListSkeleton n={6} /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> : list.map((x) => {
        const n = x.fields.filter((f) => f.configured).length;
        return <Row key={x.id} left={<Letter name={x.name} />} title={x.name} sub={x.fields.length === 0 ? 'No key needed' : n > 0 ? `${n} of ${x.fields.length} saved` : x.widgetOnly ? 'Widget only, no quotes' : 'Needs API key'} right={<Ic d={ICON.chevron} size={18} />} onClick={() => setSel(x.id)} />;
      })}
      {p && <KeySheet c={c} p={p} onClose={() => setSel(null)} onSaved={setOverride} />}
    </Screen>);
};
export { Tabs };
