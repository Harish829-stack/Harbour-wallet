// Buy / Sell / P2P / Recurring flow (TW routes /buy/new[/enter-amount|select-fiat|select-crypto|select-network|select-provider|select-payment-method],
// /buy/recurring-setup, /sell/new[...], /fiat-ramps). One state machine, real quotes from background `rampsQuotes`, real widget hand-off through
// `rampsCheckout` (address always from the vault). See evidence/36-ramps/SPEC.md.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../theme';
import type { Ctx } from '../screens';
import { Screen, Btn, Coin, Ic, ICON, Skeleton, SuccessCheck, Sheet } from '../ui';
import { useTokenItems } from '../tokensStore';
import { Notice, Chip, ChipRow, Letter, loadRampCfg, readPrefs, writePrefs, useDebounced, openHttps, download, fmtCrypto, fmtFiat, ON_BRAND, Busy, ErrorBox, type RampCfg } from './rampKit';
import { FiatStep, CryptoStep, NetworkStep, ProviderStep, MethodStep, RecurringStep, type CfgAsset, type QuotesView, type QuoteView } from './rampSteps';

export type FlowMode = 'buy' | 'sell' | 'p2p' | 'recurring';
type Step = 'crypto' | 'fiat' | 'network' | 'provider' | 'method' | 'recurring';
const P2P_SYMBOLS = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC'];
const cleanAmount = (v: string) => { const s = v.replace(/[^\d.]/g, ''); const [w, ...r] = s.split('.'); return (w.slice(0, 12) + (r.length ? '.' + r.join('').slice(0, 18) : '')); };
const validAmt = (v: string) => /^\d{1,12}(\.\d{1,18})?$/.test(v) && Number(v) > 0;

function useQuotes(c: Ctx, mode: 'buy' | 'sell', asset: CfgAsset | null, fiat: string, amount: string, on: boolean) {
  const d = useDebounced(amount, 500); const [s, set] = useState<{ result: QuotesView | null; loading: boolean; error: string }>({ result: null, loading: false, error: '' });
  const seq = useRef(0); const [n, setN] = useState(0);
  const enabled = on && !!asset && validAmt(d);
  useEffect(() => {
    if (!enabled || !asset) { set({ result: null, loading: false, error: '' }); return; }
    const my = ++seq.current; set((x) => ({ ...x, loading: true, error: '' }));
    c.bg({ type: 'rampsQuotes', mode, assetId: asset.assetId, fiat, amount: d }).then((r) => { if (my !== seq.current) return; set(r?.ok ? { result: r as QuotesView, loading: false, error: '' } : { result: null, loading: false, error: r?.error ?? 'Could not get quotes' }); })
      .catch((e) => { if (my === seq.current) set({ result: null, loading: false, error: String(e?.message ?? 'Could not get quotes') }); });
  }, [enabled, asset?.assetId, fiat, d, mode, n]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...s, pending: amount !== d, retry: () => setN((x) => x + 1) };
}

export const RampFlow: React.FC<Ctx & { forced?: FlowMode; embedded?: boolean }> = (c) => {
  const modeP: FlowMode = c.forced ?? (['buy', 'sell', 'p2p', 'recurring'].includes(c.params?.mode) ? c.params.mode : 'buy');
  const mode = modeP; const apiMode: 'buy' | 'sell' = mode === 'sell' ? 'sell' : 'buy';
  const [cfgState, setCfg] = useState<{ cfg: RampCfg | null; error: string }>({ cfg: null, error: '' });
  const loadCfg = () => { setCfg({ cfg: null, error: '' }); loadRampCfg(c.bg, true).then((cfg) => setCfg({ cfg, error: '' })).catch((e) => setCfg({ cfg: null, error: String(e?.message ?? 'Could not load') })); };
  useEffect(loadCfg, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = cfgState.cfg;
  const tokens = useTokenItems().items;
  const [asset, setAsset] = useState<CfgAsset | null>(null);
  const [fiat, setFiat] = useState<string>(readPrefs().fiat ?? 'USD');
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [recurring, setRecurring] = useState(mode === 'recurring');
  const [freq, setFreq] = useState<'weekly' | 'monthly'>('monthly');
  const [start, setStart] = useState(() => new Date(Date.now() + 86400_000).toISOString().slice(0, 10));
  const [stack, setStack] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [errKey, setErrKey] = useState(false);
  const [done, setDone] = useState<null | { provider: string; recurring?: boolean }>(null);
  const [rate, setRate] = useState<number | null>(null); const [pct, setPct] = useState(0);
  const initialised = useRef(false);

  const held = (a: CfgAsset): string | null => {
    if (a.isNative) { const b = c.balances[a.chainId]; return b && b.ok !== false ? String(b.formatted ?? '0') : null; }
    const t = tokens.find((i) => i.token.symbol.toUpperCase() === a.symbol && i.token.networkId === a.chainId); return t?.ok ? t.formatted : null;
  };
  const heldNum = (a: CfgAsset) => Number(held(a) ?? 0);

  // initial asset + default amount once the catalog is here
  useEffect(() => {
    if (!cfg || initialised.current) return; initialised.current = true;
    const want = typeof c.params?.assetId === 'string' ? cfg.assets.find((a) => a.assetId === c.params.assetId) : undefined;
    const f = cfg.fiats.find((x) => x.code === fiat) ?? cfg.fiats.find((x) => x.code === 'USD'); if (f && f.code !== fiat) setFiat(f.code);
    if (mode !== 'sell' && mode !== 'p2p') setAmount(String(f?.defaultAmount ?? 100));
    if (want) setAsset(want); else if (!c.embedded) setStack(['crypto']);
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const fiatInfo = cfg?.fiats.find((x) => x.code === fiat);

  const quotes = useQuotes(c, apiMode, asset, fiat, amount, mode === 'buy' || mode === 'sell' || mode === 'recurring');
  const result = quotes.result;
  useEffect(() => { setCategoryId(null); setQuoteId(null); }, [asset?.assetId, fiat, apiMode]);
  useEffect(() => { // indicative market reference (CoinGecko), only used as a labelled estimate
    setRate(null); if (!asset || !asset.cg) return; let live = true;
    c.bg({ type: 'rampsMarketRef', assetId: asset.assetId, fiat }).then((r) => { if (live && r?.ok) setRate(r.rate); }).catch(() => {});
    return () => { live = false; };
  }, [asset?.assetId, fiat]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCat = result ? (categoryId && result.categories.some((x) => x.id === categoryId) ? categoryId : result.quotes.find((q) => q.id === result.bestQuoteId)?.paymentMethod.categoryId ?? result.categories[0]?.id ?? null) : null;
  const inCat = result?.quotes.filter((q) => q.paymentMethod.categoryId === activeCat) ?? [];
  const chosen: QuoteView | undefined = inCat.find((q) => q.id === quoteId) ?? inCat.find((q) => q.isRecommended) ?? inCat[0];
  const mercuryoReady = !!cfg?.providers.find((p) => p.id === 'mercuryo')?.fields.some((f) => f.field === 'widgetId' && f.configured);
  const go = (s: Step) => setStack((x) => [...x, s]);
  const back = () => setStack((x) => x.slice(0, -1));
  const top = stack[stack.length - 1];
  const pushKeys = () => c.nav.push('rampApiKeys');

  const amountOk = validAmt(amount);
  const balNum = asset ? heldNum(asset) : 0;
  const overBalance = mode === 'sell' && amountOk && Number(amount) > balNum;
  const minMax = fiatInfo && mode === 'buy' && amountOk && Number(amount) <= 0 ? 'Enter an amount greater than 0' : '';
  const estimate = mode === 'buy' ? (chosen?.crypto.amount ?? (rate && amountOk ? Number(amount) / rate : null)) : (chosen?.fiat.amount ?? (rate && amountOk ? Number(amount) * rate : null));
  const estimateIsQuote = chosen && (mode === 'buy' ? chosen.crypto.amount != null : chosen.fiat.amount > 0);

  const remember = (a: CfgAsset) => writePrefs({ fiat, recent: [a.assetId, ...(readPrefs().recent ?? []).filter((x) => x !== a.assetId)].slice(0, 5) });
  const checkout = async (quote: QuoteView, m: 'buy' | 'sell', recurringFlag = false) => {
    if (!asset) return; setBusy(true); setErr(''); setErrKey(false);
    try {
      const r = await c.bg({ type: 'rampsCheckout', mode: m, assetId: asset.assetId, fiat, amount, quote: { id: quote.id, providerId: quote.providerId, categoryId: quote.paymentMethod.categoryId } });
      if (!r?.ok) { setErr(r?.error ?? 'Something went wrong. Please try again.'); setErrKey(!!r?.needsKey); return false; }
      if (!openHttps(r.url)) { setErr('The provider link was blocked because it is not a secure https address.'); return false; }
      remember(asset); setDone({ provider: r.providerName, recurring: recurringFlag }); return true;
    } catch (e: any) { setErr(String(e?.message ?? 'Something went wrong. Please try again.')); return false; } finally { setBusy(false); }
  };
  const onContinue = () => {
    if (mode === 'p2p') return p2p();
    if (recurring && mode !== 'sell') { go('recurring'); return; }
    if (chosen) void checkout(chosen, apiMode);
  };
  const p2p = async () => {
    if (!asset) return; setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'rampsP2pUrl', asset: asset.symbol, fiat }); if (!r?.ok || !openHttps(r.url)) setErr(r?.error ?? 'Could not open Binance P2P'); else { remember(asset); setDone({ provider: 'Binance P2P' }); } }
    catch (e: any) { setErr(String(e?.message ?? 'Could not open Binance P2P')); } finally { setBusy(false); }
  };
  const startRecurring = async () => {
    const m = result?.quotes.find((q) => q.providerId === 'mercuryo') ?? chosen; if (!m || !asset) { setErr('No Mercuryo quote is available for this amount.'); return; }
    const q = result?.quotes.find((x) => x.providerId === 'mercuryo'); if (!q) { setErr('Mercuryo has no quote for this asset and amount, so a recurring buy cannot start.'); return; }
    const ok = await checkout(q, 'buy', true);
    if (ok) { const r = await c.bg({ type: 'rampsRecurringIcs', assetId: asset.assetId, fiat, amount, frequency: freq, start }); if (r?.ok) download(r.filename, 'text/calendar', r.ics); setStack([]); }
  };

  if (cfgState.error) return <Screen title={mode === 'sell' ? 'Sell' : 'Buy crypto'} onBack={c.nav.pop}><ErrorBox message={cfgState.error} onRetry={loadCfg} /></Screen>;
  if (!cfg) { const b = <Busy label="Loading…" />; return c.embedded ? b : <Screen title={mode === 'sell' ? 'Sell' : 'Buy crypto'} onBack={c.nav.pop}>{b}</Screen>; }

  // ---------- overlay steps
  const sellAllowed = (a: CfgAsset) => heldNum(a) > 0 && a.providers.length > 0;
  const p2pAllowed = (a: CfgAsset) => P2P_SYMBOLS.includes(a.symbol) && a.assetId === (a.isNative ? a.chainId : a.assetId) && ['ethereum', 'bitcoin', 'smartchain', 'tron', 'solana'].includes(a.chainId) && (a.symbol !== 'USDC' || a.chainId === 'ethereum');
  const stepEl = (() => {
    if (top === 'crypto') return <CryptoStep cfg={cfg} mode={mode} selectedId={asset?.assetId} network={network} fiat={fiat} recent={readPrefs().recent ?? []} allowed={mode === 'sell' ? sellAllowed : mode === 'p2p' ? p2pAllowed : undefined}
      held={mode === 'sell' ? (a) => `${fmtCrypto(heldNum(a), 6)}` : undefined} onNetwork={() => go('network')} onBack={() => (asset ? back() : c.nav.pop())}
      onPick={(a) => { setAsset(a); setPct(0); if (mode === 'sell') setAmount(''); setStack([]); }} />;
    if (top === 'fiat') return <FiatStep cfg={cfg} selected={fiat} onBack={back} onPick={(code) => { setFiat(code); writePrefs({ fiat: code }); const f = cfg.fiats.find((x) => x.code === code); if (mode === 'buy' && f) setAmount(String(f.defaultAmount)); back(); }} />;
    if (top === 'network') return <NetworkStep cfg={cfg} selected={network} onBack={back} onPick={(id) => { setNetwork(id); back(); }} />;
    if (top === 'provider') return <ProviderStep result={result} loading={quotes.loading} category={activeCat} selectedId={chosen?.id ?? null} mode={apiMode} fiat={fiat} symbol={asset?.symbol ?? ''} onBack={back} onMethod={() => go('method')} onKeys={pushKeys} onPick={(q) => { setQuoteId(q.id); back(); }} />;
    if (top === 'method') return <MethodStep result={result} loading={quotes.loading} selected={activeCat} onBack={back} onPick={(id) => { setCategoryId(id); setQuoteId(null); back(); }} />;
    if (top === 'recurring' && asset) return <RecurringStep asset={asset} fiat={fiat} amount={amount} frequency={freq} start={start} mercuryoReady={mercuryoReady} busy={busy} error={err} onFrequency={setFreq} onStart={setStart} onContinue={startRecurring} onKeys={pushKeys} onBack={back} />;
    return null;
  })();

  // ---------- main (enter amount) view
  const title = mode === 'sell' ? 'Sell' : mode === 'p2p' ? 'Buy with P2P' : mode === 'recurring' ? 'Set a recurring buy' : 'Buy crypto';
  const assetChip = (
    <button type="button" onClick={() => go('crypto')} className="hb-tap" aria-label="Select crypto" style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: T.surface, borderRadius: 999, padding: '6px 12px 6px 6px', cursor: 'pointer', color: T.text, fontWeight: 700 }}>
      {asset ? <Coin sym={asset.symbol} assetId={asset.isNative ? asset.chainId : undefined} size={30} /> : <Letter name="?" size={30} />}<span style={{ textAlign: 'left', lineHeight: 1.15 }}>{asset ? asset.symbol : 'Select'}{asset && <div style={{ fontSize: 11, color: T.sub, fontWeight: 500 }}>{asset.chainName}</div>}</span><Ic d={ICON.chevron} size={14} />
    </button>);
  const fiatChip = (
    <button type="button" onClick={() => go('fiat')} className="hb-tap" aria-label="Select currency" style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: T.surface, borderRadius: 999, padding: '6px 12px 6px 6px', cursor: 'pointer', color: T.text, fontWeight: 700 }}>
      <Letter name={fiat} size={30} /><span>{fiat}</span><Ic d={ICON.chevron} size={14} />
    </button>);
  const input = (value: string, onChange: (v: string) => void, label: string, hasError: boolean) => (
    <input aria-label={label} inputMode="decimal" autoComplete="off" value={value} placeholder="0" onChange={(e) => onChange(cleanAmount(e.target.value))} style={{ flex: 1, minWidth: 0, textAlign: 'right', border: 'none', background: 'transparent', outline: 'none', fontSize: 28, fontWeight: 800, color: hasError ? T.error : T.text }} />);
  const card = (chip: React.ReactNode, body: React.ReactNode) => <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bgAlt, borderRadius: 18, padding: 14 }}>{chip}{body}</div>;
  const outValue = (txt: string, loading: boolean) => loading ? <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}><Skeleton w={120} h={30} /></div> : <div aria-live="polite" style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 28, fontWeight: 800, color: txt === '0' ? T.sub : T.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{txt}</div>;
  const pendingQ = amountOk && (quotes.loading || quotes.pending) && mode !== 'p2p';
  const hasKeyIssue = result?.providers.some((p) => p.state === 'needs_key');
  const anyOk = !!result && result.quotes.length > 0;

  const body = (
    <div className="hb-rise">
      {mode === 'sell' && asset && <div style={{ textAlign: 'center', color: T.sub, fontSize: 13, margin: '0 0 10px' }}>Balance: {fmtCrypto(balNum, 8)} {asset.symbol}</div>}
      {mode === 'sell'
        ? card(assetChip, input(amount, (v) => { setAmount(v); setPct(0); }, `Amount of ${asset?.symbol ?? 'crypto'} to sell`, overBalance))
        : card(fiatChip, input(amount, setAmount, `Amount in ${fiat}`, !!minMax))}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0', position: 'relative', zIndex: 1 }}><span style={{ width: 32, height: 32, borderRadius: '50%', background: T.surface, border: `1px solid ${T.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.sub }}><Ic d={ICON.arrowdown} size={16} /></span></div>
      {mode === 'sell'
        ? card(fiatChip, outValue(estimate != null && amountOk ? fmtFiat(estimate, fiat) : '0', pendingQ && !chosen))
        : mode === 'p2p' ? card(assetChip, outValue(asset?.symbol ?? '—', false))
        : card(assetChip, outValue(estimate != null && amountOk ? `${fmtCrypto(estimate)}` : '0', pendingQ && !chosen))}
      {mode !== 'p2p' && amountOk && estimate != null && !estimateIsQuote && !pendingQ && <div style={{ textAlign: 'right', fontSize: 11, color: T.sub, margin: '4px 6px 0' }}>Market estimate before provider fees (not a quote)</div>}

      {mode === 'buy' || mode === 'recurring' ? <ChipRow>{(fiatInfo?.suggested ?? []).map((a) => <Chip key={a} active={amount === String(a)} onClick={() => setAmount(String(a))}>{a.toLocaleString()}</Chip>)}</ChipRow> : null}
      {mode === 'sell' && asset && balNum > 0 && (
        <div style={{ margin: '14px 4px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.sub, fontSize: 12 }}>Min
            <input type="range" min={0} max={100} step={1} value={pct} aria-label="Percentage of balance" onChange={(e) => { const p = Number(e.target.value); setPct(p); setAmount(p === 0 ? '' : p === 100 ? String(held(asset)) : String(Math.floor((balNum * p) / 100 * 1e8) / 1e8)); }} style={{ flex: 1, accentColor: 'var(--hb-brand)' }} />Max <b style={{ color: T.text, minWidth: 34, textAlign: 'right' }}>{pct}%</b></div>
          {pct === 100 && asset.isNative && <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>Keep a little {asset.symbol} for the network fee of the transfer to the provider.</div>}
        </div>)}

      {/* provider / quote */}
      <div style={{ margin: '12px 0' }}>
        {!asset ? <Notice>Select a crypto to continue.</Notice>
          : mode === 'p2p' ? <Notice>Binance P2P opens in a new tab. You trade with another user and the crypto arrives in your Binance account. Withdraw it to Harbour afterwards with Fund › Deposit from exchange. Harbour does not receive or hold P2P funds.</Notice>
          : mode === 'sell' && balNum <= 0 ? <Notice tone="error">No balance available</Notice>
          : !amountOk ? <Notice>{mode === 'sell' ? 'Enter amount' : 'Enter amount and select payment'}</Notice>
          : overBalance ? <Notice tone="error">Insufficient balance</Notice>
          : pendingQ && !anyOk ? <div style={{ padding: 4 }}><Skeleton h={64} r={16} /></div>
          : quotes.error ? <Notice tone="error" action={{ label: 'Try again', onClick: quotes.retry }}>{quotes.error}</Notice>
          : chosen ? (
            <div style={{ background: T.bgAlt, borderRadius: 16, overflow: 'hidden' }}>
              <button type="button" onClick={() => go('provider')} className="hb-tap" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: T.text, textAlign: 'left' }}>
                <Letter name={chosen.providerName} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{chosen.paymentMethod.label}</div><div style={{ fontSize: 12, color: T.sub }}>with {chosen.providerName}{chosen.isRecommended ? ' · Recommended' : ''}{chosen.crypto.amount == null && mode === 'buy' ? ' · price shown in widget' : ''}</div></div>
                <Ic d={ICON.chevron} size={18} />
              </button>
              {mode === 'buy' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${T.border}` }}>
                <label htmlFor="rb-toggle" style={{ fontSize: 13, color: T.sub, fontWeight: 600 }}>Recurring buy</label>
                <input id="rb-toggle" type="checkbox" role="switch" checked={recurring} onChange={(e) => { setRecurring(e.target.checked); if (e.target.checked) go('recurring'); }} style={{ width: 20, height: 20, accentColor: 'var(--hb-brand)' }} />
              </div>}
            </div>)
          : <div>
              <Notice tone={hasKeyIssue ? 'warn' : 'info'} action={hasKeyIssue ? { label: 'Open Ramp API keys', onClick: pushKeys } : undefined}>{hasKeyIssue ? <><b>No provider is configured for this pair.</b> {mode === 'sell' ? 'Sell' : 'Buy'} quotes need provider keys that you add yourself; Harbour never shows invented prices.</> : 'No available payment method'}</Notice>
              {result && result.providers.length > 0 && <button type="button" onClick={() => go('provider')} style={{ border: 'none', background: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', padding: '2px 4px', fontSize: 13 }}>Why? Provider status</button>}
            </div>}
      </div>
      {minMax && <Notice tone="error">{minMax}</Notice>}
      {err && <Notice tone="error" action={errKey ? { label: 'Open Ramp API keys', onClick: pushKeys } : undefined}>{err}</Notice>}
      <Btn onClick={onContinue} disabled={busy || !asset || !amountOk && mode !== 'p2p' || overBalance || (mode !== 'p2p' && !chosen) || (mode === 'p2p' && !asset)}>
        {busy ? 'Opening…' : mode === 'p2p' ? 'Open Binance P2P' : amountOk ? 'Continue' : mode === 'sell' ? 'Enter amount' : 'Enter amount'}</Btn>
      <div style={{ fontSize: 11, color: T.sub, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>{mode === 'p2p' ? 'Third-party marketplace.' : 'Payment and identity checks happen on the provider’s own page. Harbour passes only your public wallet address.'}</div>
    </div>);

  const doneSheet = done && (
    <Sheet onClose={() => { setDone(null); setStack([]); }}>
      <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
        <SuccessCheck size={64} />
        <div style={{ fontWeight: 800, fontSize: 18, margin: '10px 0 6px' }}>{done.provider} opened in a new tab</div>
        <div style={{ color: T.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>{mode === 'sell' ? 'Finish the sale there. You will be asked to send the crypto from this wallet to the provider.' : mode === 'p2p' ? 'Complete the trade on Binance P2P, then withdraw to Harbour.' : `Complete the payment there. ${asset?.symbol ?? 'Your crypto'} arrives at your Harbour ${asset?.chainName ?? ''} address once the provider finishes.`}{done.recurring ? ' A recurring reminder (.ics) was downloaded.' : ''}</div>
        <Btn onClick={() => { setDone(null); c.nav.home(); }}>Return to home</Btn>
      </div>
    </Sheet>);

  const inner = (<>{c.embedded ? body : <Screen title={title} onBack={c.nav.pop}>{body}</Screen>}{stepEl}{doneSheet}</>);
  return inner;
};
export { ON_BRAND };
