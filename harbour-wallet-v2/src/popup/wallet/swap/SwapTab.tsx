import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../theme';
import { bg } from '../../api';
import { Btn, Ic, ICON, IconBtn } from '../ui';
import type { Nav } from '../screens';
import type { SwapQuoteResult, SwapRoute, SwapStep } from '../../../core/swap/types';
import { toAtomic, fromAtomic, fmtToken, fmtUsd, rateOf } from '../../../core/swap/amount';
import { priceImpactSeverity, resolveCta, isHighSlippage, QUOTE_REFRESH_SECONDS } from '../../../core/swap/rules';
import { nativeAsset } from '../../../core/swap/tokens';
import { domainById } from '../../../core/swap/domains';
import { setSwap, getSwap, useSwapStore, flipPair, pendingCount } from './swapStore';
import { AssetLogo, networkName, Notice, DetailRow, QuoteRing, Chevron } from './parts';
import { SwapSettingsSheet, ProvidersSheet } from './sheets';

type QErr = { message: string; code?: string; minAmount?: string };
interface QState { loading: boolean; key: string; result?: SwapQuoteResult; error?: QErr; at: number }

// Quote feed (TW useSwapQuoteFeed): debounced fetch, 60s auto-refresh, paused while the document is hidden.
function useQuoteFeed(key: string, req: { from: any; to: any; atomic: bigint | null; slippage: string; sortBy: string; turbo: boolean }) {
  const [st, setSt] = useState<QState>({ loading: false, key: '', at: 0 });
  const [tick, setTick] = useState(0);
  const gen = useRef(0);
  useEffect(() => {
    if (!req.from || !req.to || !req.atomic || req.atomic <= 0n) { gen.current++; setSt({ loading: false, key: '', at: 0 }); return; }
    const g = ++gen.current;
    setSt((s) => ({ ...s, loading: true, error: undefined, key, result: s.key === key ? s.result : undefined }));
    const t = setTimeout(async () => {
      const r = await bg({ type: 'swapQuote', from: req.from, to: req.to, amount: req.atomic!.toString(), slippage: req.slippage }).catch(() => ({ ok: false, error: 'Couldn’t fetch a quote. Please try again.' }));
      if (g !== gen.current) return;
      if (r?.ok) setSt({ loading: false, key, result: r.result, at: Date.now() });
      else setSt({ loading: false, key, error: { message: r?.error || 'Couldn’t fetch a quote. Please try again.', code: r?.code, minAmount: r?.minAmount }, at: Date.now() });
    }, tick === 0 ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { ...st, result: st.key === key ? st.result : undefined, refresh };
}

export const SwapTab: React.FC<{ nav: Nav }> = ({ nav }) => {
  const s = useSwapStore();
  const { from, to, amount, settings, balances } = s;
  const [sheet, setSheet] = useState<'settings' | 'providers' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feesOpen, setFeesOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [now, setNow] = useState(Date.now());

  // initial load: persisted settings + history
  useEffect(() => { bg({ type: 'swapState' }).then((r) => { if (r?.ok) setSwap({ settings: r.settings, history: r.history, gaslessAvailable: r.gaslessAvailable === true }); }).catch(() => {}); }, []);
  // balances for both sides + native gas token of the spend chain
  useEffect(() => {
    const list = [from, to, from ? nativeAsset(from.domainId) : null].filter(Boolean);
    if (!list.length) return;
    bg({ type: 'swapBalances', assets: list }).then((r) => { if (r?.ok) setSwap({ balances: { ...getSwap().balances, ...r.balances } }); }).catch(() => {});
  }, [from?.assetId, to?.assetId]);

  const atomic = from ? toAtomic(amount, from.decimals) : null;
  const key = `${from?.assetId}|${to?.assetId}|${atomic ?? ''}|${settings.slippage}|${settings.sortBy}|${settings.solanaTurbo}`;
  const q = useQuoteFeed(key, { from, to, atomic, slippage: settings.slippage, sortBy: settings.sortBy, turbo: settings.solanaTurbo });

  // countdown ring + auto refresh (paused when hidden)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const interval = q.result?.refreshInterval ?? QUOTE_REFRESH_SECONDS;
  const remaining = q.result ? Math.max(0, Math.ceil(interval - (now - q.at) / 1000)) : 0;
  useEffect(() => { if (q.result && !q.loading && remaining <= 0 && document.visibilityState === 'visible') q.refresh(); }, [remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  const routes = q.result?.routes ?? [];
  const route: SwapRoute | undefined = routes.find((r) => r.id === selectedId) ?? routes[0];
  const step: SwapStep | undefined = route?.steps[0];
  useEffect(() => { setSelectedId(null); }, [key]);

  const outAmt = step ? fromAtomic(step.to.amount, step.to.asset.decimals) : '';
  const minAmt = step ? fromAtomic(step.to.minAmount, step.to.asset.decimals) : '';
  const rate = step ? rateOf(step.from.amount, step.from.asset.decimals, step.to.amount, step.to.asset.decimals) : null;
  const impact = route?.priceImpact ?? step?.priceImpact;
  const severity = priceImpactSeverity(impact, q.result?.priceImpactMediumLevel, q.result?.priceImpactHighLevel);

  const bal = from ? BigInt(balances[from.assetId] ?? '0') : 0n;
  const nativeBal = from ? BigInt(balances[nativeAsset(from.domainId).assetId] ?? '0') : 0n;
  const insufficientBalance = !!atomic && atomic > bal;
  const fee = step?.networkFee ? BigInt(step.networkFee.amount) : 0n;
  const nativeSell = from?.address === 'native';
  const feeNative = step?.networkFee?.isNative !== false;
  // gasless (beta) EVM swaps get their fee sponsored; if sponsorship fails the background falls back and the chain rejects an unfunded tx
  const sponsored = !!s.gaslessAvailable && s.settings.gasless && !!from && domainById(from.domainId)?.kind === 'evm';
  const cannotCoverGas = !sponsored && !!step && !insufficientBalance && feeNative && nativeBal < fee + (nativeSell && atomic ? atomic : 0n);
  const feeSymbol = step?.networkFee?.symbol ?? (from ? domainById(from.domainId)?.nativeSymbol : '');
  const showsAllowance = step?.approval?.needed === true;
  const needsPriceImpactAck = severity === 'severe' && !s.ack;
  const cta = resolveCta({
    isPairSet: !!from && !!to, hasSpendAmount: !!atomic && atomic > 0n, cannotCoverGas, feeSymbol,
    showsAllowance, spendSymbol: from?.symbol, needsPriceImpactAck, insufficientBalance, balanceSymbol: from?.symbol,
    isLoading: q.loading && !q.result, hasQuoteError: !!q.error || (!!atomic && !q.loading && !route),
  });

  const setAmount = (v: string) => {
    if (!/^\d*\.?\d*$/.test(v)) return;
    const dec = v.split('.')[1]; if (from && dec && dec.length > from.decimals) return;
    setMsg(''); setSwap({ amount: v, ack: false });
  };
  const onMax = async () => {
    if (!from) return; setMsg('');
    const r = await bg({ type: 'swapMax', asset: from }).catch(() => null);
    if (!r?.ok) return setMsg(r?.error || 'Couldn’t compute the max amount');
    if (r.belowFee) return setMsg('Balance is too low to cover network fees');
    setSwap({ amount: fromAtomic(r.max, from.decimals), ack: false });
  };
  const onCta = () => {
    if (!cta.enabled || !route || !from || !to) return;
    if (cta.kind === 'accept-price-impact') return setSwap({ ack: true });
    nav.push('swapConfirm', { route, unlimited: settings.unlimitedAllowance, priceImpact: impact, severity });
  };

  const fromUsd = from && amount && from.priceUsd ? Number(amount) * from.priceUsd : route?.fromAmountUsd;
  const toUsd = route?.toAmountUsd;
  const feeUsd = (step?.providerFees ?? []).reduce((a, f) => a + (f.usd ?? 0), 0);
  const quoteError = q.error;
  const errText = quoteError ? (quoteError.code === 'amount_too_low' && quoteError.minAmount && from ? `Minimum amount: ${fmtToken(fromAtomic(quoteError.minAmount, from.decimals))} ${from.symbol}` : quoteError.message) : '';
  const pending = pendingCount(s.history);
  const noFunds = from && Object.keys(balances).length > 0 && Object.values(balances).every((b) => b === '0');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 14px' }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>Swap</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ position: 'relative' }}>
            <IconBtn icon="history" size={34} bg="transparent" title="Swap history" onClick={() => nav.push('swapHistory')} />
            {pending > 0 && <span data-testid="swap-history-badge" style={{ position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 7, background: T.accent, color: 'var(--hb-on-brand)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{pending}</span>}
          </span>
          <IconBtn icon="gear" size={34} bg="transparent" title="Swap settings" onClick={() => setSheet('settings')} />
        </div>
      </div>

      <Block label="You pay" side="from" asset={from} amount={amount} onAmount={setAmount} fiat={fromUsd} balance={from ? fromAtomic(bal, from.decimals) : undefined}
        onMax={onMax} onSelect={() => nav.push('swapAssetPicker', { side: 'from' })} showFund={!!noFunds} onFund={() => nav.push('buy')} />
      <div style={{ display: 'flex', justifyContent: 'center', margin: '-12px 0', position: 'relative', zIndex: 2 }}>
        <QuoteRing progress={q.result ? remaining / interval : 0}>
          <button className="hb-tap" aria-label="Switch swap direction" data-testid="swap-switch" onClick={() => { flipPair(); setMsg(''); }}
            style={{ width: 32, height: 32, borderRadius: 999, border: `3px solid ${T.bg}`, background: T.bgAlt, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Ic d={ICON.swap} size={16} />
          </button>
        </QuoteRing>
      </div>
      <Block label="You will receive" side="to" asset={to} amount={q.loading && !outAmt ? '' : (outAmt ? fmtToken(outAmt, 8) : '')} placeholder="0" readOnly loading={q.loading}
        fiat={toUsd} onSelect={() => nav.push('swapAssetPicker', { side: 'to' })} balance={to ? fromAtomic(balances[to.assetId] ?? '0', to.decimals) : undefined} />

      {severity === 'severe' && step && <Notice tone="error">This trade has a high price impact of {Math.abs(impact!).toFixed(2)}%. You may receive significantly less than expected.</Notice>}
      {severity === 'moderate' && step && <Notice tone="warning">This trade has a price impact of {Math.abs(impact!).toFixed(2)}%. You may receive less than expected.</Notice>}
      {errText && <Notice tone="error">{errText}</Notice>}
      {msg && <Notice tone="error">{msg}</Notice>}
      {cannotCoverGas && <Notice tone="warning">Not enough {feeSymbol} to cover network fee</Notice>}

      {(step || q.loading) && atomic && atomic > 0n && !errText && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${T.border}`, paddingTop: 4 }} data-testid="swap-details">
          <DetailRow label="Rate" loading={!step}>{rate != null && step ? `1 ${step.from.asset.symbol} ≈ ${fmtToken(rate, 6)} ${step.to.asset.symbol}` : '—'}</DetailRow>
          {impact != null && step && <DetailRow label="Price impact"><span style={{ color: severity === 'severe' ? T.error : severity === 'moderate' ? 'var(--hb-warn-ink)' : T.text }}>{impact === 0 ? '0%' : `${impact > 0 ? '+' : ''}${impact.toFixed(2)}%`}</span></DetailRow>}
          <DetailRow label="Minimum received" loading={!step}>{step && `${fmtToken(minAmt, 6)} ${step.to.asset.symbol}`}</DetailRow>
          <DetailRow label="Slippage tolerance" loading={false}>
            <span>{settings.slippage}%</span>
            <button type="button" aria-label="Edit slippage tolerance" onClick={() => setSheet('settings')} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', padding: 0, display: 'inline-flex' }}><Ic d={ICON.edit} size={14} /></button>
          </DetailRow>
          {isHighSlippage(settings.slippage) && <Notice tone="warning">High slippage tolerance — your transaction may be front-run and you could receive significantly less.</Notice>}
          <DetailRow label="Network fee" loading={!step}>{step?.networkFee ? `${step.networkFee.upperBound ? '≤ ' : '≈ '}${fmtToken(fromAtomic(step.networkFee.amount, step.networkFee.decimals), 6)} ${step.networkFee.symbol}${step.networkFee.usd ? ` (${fmtUsd(step.networkFee.usd)})` : ''}` : '—'}</DetailRow>
          {step && step.providerFees.length > 0 && <>
            <DetailRow label={<button type="button" aria-expanded={feesOpen} onClick={() => setFeesOpen((o) => !o)} style={{ background: 'none', border: 'none', padding: 0, color: T.sub, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Fees <Chevron down={feesOpen} /></button>}>{feeUsd > 0 ? fmtUsd(feeUsd) : 'Included'}</DetailRow>
            {feesOpen && step.providerFees.map((f, i) => <DetailRow key={i} label={<span style={{ paddingLeft: 10 }}>{f.name || 'Swapper fee'}</span>}>{f.usd != null ? fmtUsd(f.usd) : `${fmtToken(fromAtomic(f.amount, f.decimals), 6)} ${f.symbol}`}</DetailRow>)}
          </>}
          {step && <DetailRow label="Provider">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>via {step.provider.name}</span>
            {routes.length > 1 && <button type="button" data-testid="swap-change-quote-button" onClick={() => setSheet('providers')} style={{ background: T.accentSoft, color: T.accent, border: 'none', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Change</button>}
          </DetailRow>}
          {route?.totalSeconds ? <DetailRow label="Estimated time">{route.totalSeconds < 60 ? `~${route.totalSeconds}s` : `~${Math.round(route.totalSeconds / 60)} min`}</DetailRow> : null}
        </div>
      )}

      <Btn onClick={onCta} disabled={!cta.enabled} style={{ marginTop: 16 }}>{cta.label}</Btn>
      {!!from && !!to && from.domainId !== to.domainId && <div style={{ fontSize: 12, color: T.sub, textAlign: 'center', marginTop: 10 }}>Cross-chain swap: {networkName(from)} → {networkName(to)}</div>}

      {sheet === 'settings' && <SwapSettingsSheet onClose={() => setSheet(null)} fromDomainId={from?.domainId} />}
      {sheet === 'providers' && <ProvidersSheet routes={routes} selectedId={route?.id} onSelect={(id) => { setSelectedId(id); setSheet(null); }} onClose={() => setSheet(null)} />}
    </>
  );
};

const Block: React.FC<{
  label: string; side: 'from' | 'to'; asset: any; amount: string; onAmount?: (v: string) => void; placeholder?: string; readOnly?: boolean; loading?: boolean;
  fiat?: number; balance?: string; onMax?: () => void; onSelect: () => void; showFund?: boolean; onFund?: () => void;
}> = ({ label, side, asset, amount, onAmount, placeholder = '0', readOnly, loading, fiat, balance, onMax, onSelect, showFund, onFund }) => (
  <div data-testid={`swap-${side}`} style={{ background: T.bgAlt, borderRadius: 16, padding: '14px 16px' }}>
    <div style={{ fontSize: 12, color: T.sub, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      {asset && balance !== undefined && <span>Balance: {fmtToken(balance, 6)}{side === 'from' && onMax && Number(balance) > 0 && <button type="button" onClick={onMax} data-testid="swap-max" style={{ marginLeft: 8, background: T.accentSoft, color: T.accent, border: 'none', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Max</button>}</span>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {readOnly
          ? <div aria-live="polite" style={{ fontSize: 26, fontWeight: 700, color: amount ? T.text : T.sub, minHeight: 34, overflow: 'hidden', textOverflow: 'ellipsis' }}>{loading && !amount ? <span className="hb-skel" style={{ display: 'inline-block', width: 110, height: 24 }} /> : (amount || placeholder)}</div>
          : <input aria-label="Amount to swap" value={amount} onChange={(e) => onAmount?.(e.target.value)} placeholder={placeholder} inputMode="decimal" autoComplete="off" style={{ width: '100%', fontSize: 26, fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: T.text, padding: 0, minHeight: 34 }} />}
        <div style={{ fontSize: 12, color: T.sub, minHeight: 16 }}>{fiat != null && fiat > 0 ? fmtUsd(fiat) : ''}</div>
      </div>
      {side === 'from' && showFund && !asset
        ? <button type="button" onClick={onFund} className="hb-tap" style={pill}>Fund</button>
        : <button type="button" data-testid={asset ? `swap-${side}-asset` : `swap-${side}-asset-empty`} onClick={onSelect} className="hb-tap" style={pill}>
            {asset ? <><AssetLogo asset={asset} size={24} /><span style={{ lineHeight: 1.1, textAlign: 'left' }}><div style={{ fontWeight: 700, fontSize: 14 }}>{asset.symbol}</div><div style={{ fontSize: 10, color: T.sub, fontWeight: 500 }}>{networkName(asset)}</div></span></> : <span style={{ fontWeight: 600, fontSize: 14, padding: '2px 4px' }}>Select Token</span>}
            <Chevron down />
          </button>}
    </div>
  </div>
);
const pill: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, borderRadius: 999, padding: '6px 10px 6px 8px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: T.text, flexShrink: 0 };
