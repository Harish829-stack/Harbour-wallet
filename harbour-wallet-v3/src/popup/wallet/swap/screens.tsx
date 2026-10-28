import React, { useEffect, useRef, useState } from 'react';
import { T } from '../../theme';
import { Screen, Btn, Row, Spinner, SuccessCheck, Empty, Ic, ICON } from '../ui';
import type { Ctx } from '../screens';
import type { SwapAsset, SwapHistoryItem, SwapRoute } from '../../../core/swap/types';
import { SWAP_DOMAINS, domainById } from '../../../core/swap/domains';
import { fromAtomic, fmtToken, fmtUsd, rateOf } from '../../../core/swap/amount';
import { pollDelayMs } from '../../../core/swap/rules';
import { popularAssets } from '../../../core/swap/tokens';
import { AssetLogo, DetailRow, Notice, networkName } from './parts';
import { getSwap, pickAsset, resetSwapForm, setSwap, useSwapStore } from './swapStore';

const shortHash = (h?: string) => (h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '');
const explorerUrl = (domainId: string, hash?: string) => { const d = domainById(domainId); return d && hash ? d.explorerTx + hash : undefined; };

// ---------- Asset picker (TW: swap asset select page) ----------
export const SwapAssetPickerScreen: React.FC<Ctx> = (c) => {
  const side: 'from' | 'to' = c.params?.side === 'to' ? 'to' : 'from';
  const s = useSwapStore();
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<string | undefined>(undefined);
  const [list, setList] = useState<SwapAsset[]>(() => popularAssets());
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current; setLoading(true);
    const t = setTimeout(() => {
      c.bg({ type: 'swapSearchTokens', query, domainId: domain }).then((r) => {
        if (my !== seq.current) return;
        setList(r?.ok && Array.isArray(r.assets) ? r.assets : popularAssets(domain)); setLoading(false);
      }).catch(() => { if (my === seq.current) { setList(popularAssets(domain)); setLoading(false); } });
    }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, domain]); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch balances for what is on screen (best effort)
  useEffect(() => {
    const need = list.slice(0, 60).filter((a) => s.balances[a.assetId] == null);
    if (!need.length) return;
    c.bg({ type: 'swapBalances', assets: need }).then((r) => { if (r?.ok) setSwap({ balances: { ...getSwap().balances, ...r.balances } }); }).catch(() => {});
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (a: SwapAsset) => { pickAsset(side, a); c.nav.pop(); };
  const recents = !query ? s.settings.recentAssets.filter((a) => !domain || a.domainId === domain) : [];
  const chip = (id: string | undefined, label: string) => (
    <button key={label} type="button" onClick={() => setDomain(id)} style={{ border: `1px solid ${domain === id ? T.accent : T.border}`, background: domain === id ? T.accent : T.surface, color: domain === id ? 'var(--hb-on-brand)' : T.text, borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  );
  const rowFor = (a: SwapAsset) => {
    const b = s.balances[a.assetId];
    return <Row key={a.assetId} onClick={() => choose(a)} left={<AssetLogo asset={a} />} title={a.symbol} sub={`${a.name} · ${networkName(a)}`}
      right={b != null && b !== '0' ? fmtToken(fromAtomic(b, a.decimals)) : undefined} />;
  };
  return (
    <Screen title={side === 'from' ? 'Swap from' : 'Swap to'} onBack={c.nav.pop}>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or paste address" aria-label="Search tokens"
        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: 14, fontFamily: 'inherit', background: T.bgAlt, outline: 'none' }} />
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 0' }}>
        {chip(undefined, 'All networks')}{SWAP_DOMAINS.map((d) => chip(d.id, d.name))}
      </div>
      {recents.length > 0 && <><div style={{ fontWeight: 700, fontSize: 13, color: T.sub, margin: '4px 0' }}>Recently used</div>{recents.map(rowFor)}</>}
      <div style={{ fontWeight: 700, fontSize: 13, color: T.sub, margin: '10px 0 4px' }}>{query ? 'Results' : 'Popular'}</div>
      {loading && list.length === 0 ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div> : list.length === 0 ? <Empty title="No tokens found" sub="Try another name or paste the token address." icon="search" /> : list.map(rowFor)}
    </Screen>
  );
};

// ---------- Confirm + staged execution (approve -> submit) ----------
export const SwapConfirmScreen: React.FC<Ctx> = (c) => {
  const route: SwapRoute | undefined = c.params?.route;
  const unlimited = c.params?.unlimited === true;
  const severity: string = c.params?.severity ?? 'none';
  const s = useSwapStore();
  const [phase, setPhase] = useState<'review' | 'approving' | 'submitting'>('review');
  const [err, setErr] = useState('');
  const busy = useRef(false);
  const step = route?.steps[0];
  if (!route || !step) return <Screen title="Confirm swap" onBack={c.nav.pop}><Empty title="Quote unavailable" sub="Go back and request a new quote." /></Screen>;

  const outAmt = fromAtomic(step.to.amount, step.to.asset.decimals);
  const minAmt = fromAtomic(step.to.minAmount, step.to.asset.decimals);
  const inAmt = fromAtomic(step.from.amount, step.from.asset.decimals);
  const rate = rateOf(step.from.amount, step.from.asset.decimals, step.to.amount, step.to.asset.decimals);
  const needsApproval = step.approval?.needed === true;
  const slip = step.slippage.userSelected ?? Number(s.settings.slippage);
  const expired = Date.now() > route.expiresAt + 5 * 60_000;

  const run = async () => {
    if (busy.current) return; busy.current = true; setErr('');
    try {
      let id: string | undefined;
      if (needsApproval) {
        setPhase('approving');
        const a = await c.bg({ type: 'swapApprove', route, stepIndex: 0, unlimited });
        if (!a?.ok) { setErr(a?.error || 'Approval failed'); setPhase('review'); return; }
        id = a.id;
      }
      setPhase('submitting');
      const r = await c.bg({ type: 'swapSubmit', route, stepIndex: 0, id });
      if (!r?.ok) { setErr(r?.error || 'Swap failed'); setPhase('review'); return; }
      resetSwapForm(); c.refresh?.();
      c.nav.pop(); c.nav.push('swapStatus', { id: r.id });
    } catch (e: any) { setErr(e?.message || 'Swap failed'); setPhase('review'); }
    finally { busy.current = false; }
  };

  const label = phase === 'approving' ? `Approving ${step.from.asset.symbol}…` : phase === 'submitting' ? 'Submitting swap…' : needsApproval ? 'Approve and swap' : 'Confirm swap';
  return (
    <Screen title="Confirm swap" onBack={phase === 'review' ? c.nav.pop : () => {}}>
      <div style={{ background: T.bgAlt, borderRadius: 16, padding: 16, margin: '6px 0 12px' }}>
        <Row left={<AssetLogo asset={step.from.asset} />} title={`${fmtToken(inAmt)} ${step.from.asset.symbol}`} sub={networkName(step.from.asset)} />
        <div style={{ textAlign: 'center', color: T.sub, margin: '2px 0' }}><Ic d={ICON.arrowdown} size={18} /></div>
        <Row left={<AssetLogo asset={step.to.asset} />} title={`${fmtToken(outAmt)} ${step.to.asset.symbol}`} sub={route.toAmountUsd != null ? `≈ ${fmtUsd(route.toAmountUsd)} · ${networkName(step.to.asset)}` : networkName(step.to.asset)} />
      </div>
      <DetailRow label="Provider">{step.provider.name}</DetailRow>
      {rate != null && <DetailRow label="Rate">1 {step.from.asset.symbol} ≈ {fmtToken(rate)} {step.to.asset.symbol}</DetailRow>}
      <DetailRow label="Minimum received">{fmtToken(minAmt)} {step.to.asset.symbol}</DetailRow>
      <DetailRow label="Max slippage">{slip}%</DetailRow>
      {step.priceImpact != null && <DetailRow label="Price impact"><span style={{ color: severity === 'severe' ? T.error : severity === 'moderate' ? 'var(--hb-warn-ink)' : T.text }}>{step.priceImpact.toFixed(2)}%</span></DetailRow>}
      {step.networkFee && <DetailRow label="Network fee">{step.networkFee.upperBound ? '≤ ' : '≈ '}{fmtToken(fromAtomic(step.networkFee.amount, step.networkFee.decimals))} {step.networkFee.symbol}{step.networkFee.usd != null ? ` (${fmtUsd(step.networkFee.usd)})` : ''}</DetailRow>}
      {step.providerFees.map((f, i) => <DetailRow key={i} label={f.name || 'Provider fee'}>{fmtToken(fromAtomic(f.amount, f.decimals))} {f.symbol}</DetailRow>)}
      {needsApproval && <DetailRow label="Token approval">{unlimited ? 'Unlimited' : `${fmtToken(fromAtomic(step.approval!.minAmount, step.from.asset.decimals))} ${step.from.asset.symbol}`}</DetailRow>}
      {step.executionSeconds != null && <DetailRow label="Estimated time">~{Math.max(1, Math.round(step.executionSeconds))}s</DetailRow>}
      {s.settings.mev && step.fromDomainId !== 'solana' && <Notice tone="info">Best price execution is on: the transaction is sent through a MEV-protected RPC where one is available for this network.</Notice>}
      {needsApproval && unlimited && <Notice tone="warning">Unlimited approval lets this contract spend all of your {step.from.asset.symbol} until you revoke it. Turn it off in swap settings to approve only this amount.</Notice>}
      {severity === 'severe' && <Notice tone="warning">High price impact: you may receive much less than the market value of what you send.</Notice>}
      {expired && <Notice tone="error">This quote is too old. Go back to get a fresh one.</Notice>}
      {err && <Notice tone="error">{err}</Notice>}
      <div style={{ marginTop: 18 }}>
        <Btn onClick={run} disabled={phase !== 'review' || expired}>{phase !== 'review' && <span style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }}><Spinner size={16} color="#fff" /></span>}{label}</Btn>
      </div>
    </Screen>
  );
};

// ---------- Status (TW swap progress toast / settlement watcher) ----------
export const SwapStatusScreen: React.FC<Ctx> = (c) => {
  const id: string = c.params?.id;
  const [item, setItem] = useState<SwapHistoryItem | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let dead = false; let timer: any; const t0 = Date.now();
    const tick = async () => {
      try {
        const r = await c.bg({ type: 'swapStatus', id });
        if (dead) return;
        if (!r?.ok) { setMissing(true); return; }
        setItem(r.item);
        if (r.item.status === 'success' || r.item.status === 'failed' || r.item.status === 'timeout') return;
      } catch { /* transient */ }
      if (!dead) timer = setTimeout(tick, pollDelayMs(Date.now() - t0));
    };
    tick();
    return () => { dead = true; clearTimeout(timer); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (missing) return <Screen title="Swap" onBack={c.nav.pop}><Empty title="Swap not found" /></Screen>;
  if (!item) return <Screen title="Swap" onBack={c.nav.pop}><div style={{ textAlign: 'center', paddingTop: 100 }}><Spinner size={36} /></div></Screen>;

  const done = item.status === 'success'; const failed = item.status === 'failed' || item.status === 'timeout';
  const title = done ? 'Processed' : failed ? (item.status === 'timeout' ? 'Taking longer than expected' : 'Swap failed') : 'Processing';
  const url = explorerUrl(item.fromDomainId, item.txHash);
  return (
    <Screen title="" onBack={c.nav.home}>
      <div style={{ textAlign: 'center', paddingTop: 40 }} className="hb-rise">
        {done ? <SuccessCheck /> : failed ? <div style={{ width: 84, height: 84, borderRadius: 999, background: 'hsl(0 70.9% 58.2% / 0.12)', color: T.error, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800 }}>!</div> : <Spinner size={56} />}
        <h2 style={{ margin: '16px 0 4px' }}>{title}</h2>
        <div style={{ color: T.sub, fontSize: 14 }}>{fmtToken(fromAtomic(item.fromAmount, item.fromAsset.decimals))} {item.fromAsset.symbol} → {fmtToken(fromAtomic(item.toAmountExpected, item.toAsset.decimals))} {item.toAsset.symbol}</div>
        {!done && !failed && <div style={{ color: T.sub, fontSize: 12.5, marginTop: 8 }}>{item.status === 'approving' ? 'Waiting for the approval to confirm…' : item.status === 'bridging' ? 'Bridging between networks can take several minutes.' : 'Waiting for the network to confirm.'}</div>}
        {failed && item.error && <div style={{ textAlign: 'left' }}><Notice tone="error">{item.error}</Notice></div>}
      </div>
      <div style={{ marginTop: 22 }}>
        <DetailRow label="Provider">{item.provider}</DetailRow>
        {item.txHash && <DetailRow label="Transaction">{shortHash(item.txHash)}</DetailRow>}
      </div>
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {url && <Btn variant="ghost" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>View on explorer</Btn>}
        <Btn onClick={() => { if (done || failed) resetSwapForm(); c.nav.home(); }}>{done ? 'Swap more' : failed ? 'Swap again' : 'Done'}</Btn>
      </div>
    </Screen>
  );
};

// ---------- History ----------
const STATUS_TXT: Record<string, { t: string; c: string }> = {
  success: { t: 'Processed', c: T.success }, failed: { t: 'Failed', c: T.error }, timeout: { t: 'Delayed', c: 'var(--hb-warn-ink)' },
  approving: { t: 'Approving', c: T.sub }, swapping: { t: 'Processing', c: T.sub }, bridging: { t: 'Bridging', c: T.sub },
};
export const SwapHistoryScreen: React.FC<Ctx> = (c) => {
  const [items, setItems] = useState<SwapHistoryItem[] | null>(null);
  useEffect(() => { c.bg({ type: 'swapHistory' }).then((r) => setItems(r?.ok ? r.history : [])).catch(() => setItems([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen title="Swap history" onBack={c.nav.pop}>
      {items == null ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
        : items.length === 0 ? <Empty title="No swaps yet" sub="Swaps you make in this wallet show up here." icon="history" />
        : items.map((h) => {
          const st = STATUS_TXT[h.status] ?? STATUS_TXT.swapping;
          return <Row key={h.id} onClick={() => c.nav.push('swapStatus', { id: h.id })} left={<AssetLogo asset={h.toAsset} />}
            title={`${h.fromAsset.symbol} to ${h.toAsset.symbol}`} sub={`by ${h.provider} · ${new Date(h.createdAt).toLocaleDateString()}`}
            right={`${fmtToken(fromAtomic(h.toAmountExpected, h.toAsset.decimals))} ${h.toAsset.symbol}`} rightSub={<span style={{ color: st.c }}>{st.t}</span>} />;
        })}
    </Screen>
  );
};

export const SWAP_SCREENS: Record<string, React.FC<Ctx>> = {
  swapAssetPicker: SwapAssetPickerScreen, swapConfirm: SwapConfirmScreen, swapStatus: SwapStatusScreen, swapHistory: SwapHistoryScreen,
};
