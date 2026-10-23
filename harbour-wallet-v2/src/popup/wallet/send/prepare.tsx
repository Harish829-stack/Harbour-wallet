import React, { useEffect, useMemo, useState } from 'react';
import { T } from '../../theme';
import { Screen, Btn, Coin, Spinner, IconBtn, Empty } from '../ui';
import type { Ctx } from '../types';
import { useTokenItems } from '../tokensStore';
import { useDraft, setDraft, resetDraft, getDraft } from './store';
import { sendTarget, useSendSupport, useQuote, fmtAmount, decimalOnly, priceUsd, fiatToCrypto, shortAddr, MEMO_LABEL, tierOf } from './lib';
import { Notice, AddressScanner, ContactsSheet, FeeRow, FeeSheet, type Contact } from './parts';
import { money, getSettingsState } from '../../settingsStore';
import { chainById } from '../../../core/chains/index';
import type { PaymentRequest } from '../../../core/sendService';

const box: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: 14, border: `1px solid ${T.border}`, background: T.bgAlt, color: T.text, fontSize: 15, outline: 'none' };
const label: React.CSSProperties = { fontSize: 13, color: T.sub, margin: '16px 0 6px', fontWeight: 600 };
const chip: React.CSSProperties = { border: 'none', background: T.accentSoft, color: T.accent, borderRadius: 999, padding: '6px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer' };

type Check = { status: 'idle' | 'checking' | 'valid' | 'invalid'; address?: string; name?: string; error?: string };
/** Validate / resolve (ENS, SNS) the typed recipient in the background; debounced. */
export function useRecipient(bg: Ctx['bg'], chainId: string, input: string): Check {
  const [r, setR] = useState<Check>({ status: 'idle' });
  useEffect(() => {
    const v = input.trim(); if (!v || !chainId) { setR({ status: 'idle' }); return; }
    setR({ status: 'checking' }); let dead = false;
    const t = setTimeout(async () => {
      const res = await bg({ type: 'sendValidateAddress', chainId, address: v }).catch(() => null); if (dead) return;
      if (!res?.ok) setR({ status: 'invalid', error: res?.error ?? 'Could not validate this address' });
      else if (res.valid) setR({ status: 'valid', address: res.resolved?.address ?? v, name: res.resolved?.name });
      else setR({ status: 'invalid', error: res.nameError ?? 'Invalid address' });
    }, 350);
    return () => { dead = true; clearTimeout(t); };
  }, [bg, chainId, input]);
  return r;
}

export const SendPrepare: React.FC<Ctx> = (c) => {
  useTokenItems();
  const assetId: string = c.params?.assetId ?? '';
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const p = c.params ?? {};
    if (getDraft().assetId !== assetId) resetDraft(assetId);
    const patch: any = {};
    if (typeof p.to === 'string' && p.to) patch.to = p.to;
    if (p.isMax) { patch.isMax = true; patch.amount = ''; patch.fiat = false; }
    else if (typeof p.amount === 'string' && p.amount) { patch.amount = p.amount; patch.fiat = false; }
    if (typeof p.memo === 'string' && p.memo) patch.memo = p.memo;
    if (Object.keys(patch).length) setDraft(patch);
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const d = useDraft(); const { a, chain, chainId, tokenId } = useMemo(() => sendTarget(assetId), [assetId, useTokenItems()]); // eslint-disable-line react-hooks/exhaustive-deps
  const support = useSendSupport(c.bg, chainId);
  const [scan, setScan] = useState(false); const [book, setBook] = useState<Contact[] | null>(null); const [showBook, setShowBook] = useState(false); const [feeSheet, setFeeSheet] = useState(false); const [note, setNote] = useState('');
  const sup = support?.[chainId]; const decimals = a?.token?.decimals ?? a?.decimals ?? chain?.decimals ?? 18;
  const rcp = useRecipient(c.bg, chainId, ready ? d.to : '');
  const price = a ? priceUsd(c, assetId) : null; const usdPer = getSettingsState().fiat.usdPer;
  const typed = d.amount.replace(/\.$/, '');
  const cryptoAmount = d.isMax ? '' : d.fiat ? (price ? fiatToCrypto(typed, price, decimals) : '') : typed;
  const memoKind = sup?.memo ?? 'none';
  const req = ready && chainId && sup?.supported ? { chainId, tokenId, to: rcp.status === 'valid' ? rcp.address! : '', amount: cryptoAmount, memo: d.memo.trim(), isMax: d.isMax, tier: d.tier } : null;
  const q = useQuote(c.bg, req);
  useEffect(() => { void c.bg({ type: 'addressBookList' }).then((r: any) => { if (r?.ok) setBook(r.items ?? []); }).catch(() => setBook([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a || !chain) return <Screen title="Send" onBack={c.nav.pop}><Empty title="Asset not found" sub="Choose an asset from the Send list." icon="send" /></Screen>;
  if (support && !sup?.supported) return <Screen title={`Send ${a.sym}`} onBack={c.nav.pop}><Empty title={`Sending ${chain.name} is not supported yet`} sub={sup?.reason ?? 'Harbour cannot sign transactions for this network yet.'} icon="send" /></Screen>;

  const quote = q.data?.quote; const issues = quote?.issues ?? []; const blocking = issues.some((i) => i.blocking);
  const amountRaw = q.data?.amountRaw ?? '0'; const haveAmount = d.isMax ? amountRaw !== '0' : Number(cryptoAmount) > 0;
  const shownAmount = d.isMax && q.data ? (d.fiat && price ? ((Number(fmtAmount(amountRaw, decimals, 12)) * price) / usdPer).toFixed(2) : fmtAmount(amountRaw, decimals, Math.min(decimals, 8))) : d.amount;
  const usdVal = (cryptoAmount ? Number(cryptoAmount) : d.isMax && q.data ? Number(fmtAmount(amountRaw, decimals, 12)) : 0) * (price ?? 0);
  const balanceTxt = q.data ? `${fmtAmount(quote!.assetBalance, decimals)} ${a.sym}` : `${c.balances[assetId]?.formatted ?? '0'} ${a.sym}`;
  const feeFiat = (raw: string) => { const fp = chainById(chainId)?.id ? priceUsd(c, chainId) : null; return fp ? money(Number(fmtAmount(raw, quote?.feeDecimals ?? 18, 12)) * fp) : undefined; };
  const addrOk = rcp.status === 'valid';
  const canNext = addrOk && haveAmount && !!q.data && !blocking && !q.loading && !q.error;
  const apply = (r: PaymentRequest) => {
    setScan(false); const patch: any = { to: r.address }; if (r.amount && /^\d*\.?\d+$/.test(r.amount)) { patch.amount = r.amount; patch.fiat = false; patch.isMax = false; } if (r.memo) patch.memo = r.memo.slice(0, 120);
    setDraft(patch); setNote(r.chainHint && chain.evmChainId && String(chain.evmChainId) !== r.chainHint ? `This QR code is for chain ${r.chainHint}, but you are sending on ${chain.name}. Check the network before continuing.` : '');
  };
  const paste = async () => { try { const t = await navigator.clipboard.readText(); if (t) apply({ ...({ address: t.trim() } as PaymentRequest) }); } catch { setNote('Clipboard is not available. Paste with Ctrl/Cmd+V into the field instead.'); } };
  const toggleFiat = () => {
    if (!price || d.isMax) { setDraft({ fiat: !d.fiat }); return; }
    if (d.fiat) setDraft({ fiat: false, amount: cryptoAmount }); else setDraft({ fiat: true, amount: d.amount && Number(d.amount) > 0 ? ((Number(d.amount) * price) / usdPer).toFixed(2).replace(/\.?0+$/, '') : '' });
  };
  const err = q.error;

  return (
    <Screen title={`Send ${a.sym}`} onBack={c.nav.pop}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Coin sym={a.sym} assetId={a.id} color={a.color} size={32} /><div><div style={{ fontWeight: 700 }}>{a.name}</div><div style={{ fontSize: 12, color: T.sub }}>{a.token ? `on ${chain.name}` : chain.name}</div></div></div>
      <div style={label}>Address or Domain Name</div>
      <div style={{ position: 'relative' }}>
        <input data-testid="send-to" aria-label="Recipient address" value={d.to} onChange={(e) => { setNote(''); setDraft({ to: e.target.value }); }} placeholder={`${chain.name} address${chain.kind === 'evm' ? ' or ENS name' : chain.kind === 'solana' ? ' or .sol name' : ''}`} spellCheck={false} autoComplete="off" style={{ ...box, paddingRight: 130, borderColor: rcp.status === 'invalid' ? T.error : T.border }} />
        <span style={{ position: 'absolute', right: 6, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          {!d.to && <button className="hb-tap" style={chip} onClick={paste} data-testid="send-paste">Paste</button>}
          <IconBtn icon="qr" size={32} title="Scan QR code" onClick={() => setScan(true)} />
          {(book ?? []).length > 0 && <IconBtn icon="contacts" size={32} title="Address book" onClick={() => setShowBook(true)} />}
        </span>
      </div>
      <div style={{ minHeight: 18, fontSize: 12, marginTop: 6, color: rcp.status === 'invalid' ? T.error : T.sub }} aria-live="polite">
        {rcp.status === 'checking' && <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Spinner size={12} />Checking address…</span>}
        {rcp.status === 'invalid' && rcp.error}
        {rcp.status === 'valid' && rcp.name && <span data-testid="send-resolved">{rcp.name} → {shortAddr(rcp.address!, 8)}</span>}
        {rcp.status === 'valid' && !rcp.name && q.data?.risk?.contactName && <span>Saved contact: {q.data.risk.contactName}</span>}
      </div>
      {note && <Notice kind="warning">{note}</Notice>}
      {memoKind !== 'none' && <>
        <div style={label}>{MEMO_LABEL[memoKind].label}</div>
        <input data-testid="send-memo" aria-label={MEMO_LABEL[memoKind].label} value={d.memo} onChange={(e) => setDraft({ memo: memoKind === 'tag' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value.slice(0, 120) })} inputMode={memoKind === 'tag' ? 'numeric' : 'text'} placeholder={MEMO_LABEL[memoKind].placeholder} style={box} />
      </>}
      <div style={{ ...label, display: 'flex', justifyContent: 'space-between' }}><span>Amount</span><span>Available: <span data-testid="send-balance">{balanceTxt}</span></span></div>
      <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px' }}>
        <input data-testid="send-amount" aria-label={d.fiat ? 'Amount in fiat' : `Amount in ${a.sym}`} value={shownAmount} onChange={(e) => setDraft({ amount: decimalOnly(e.target.value, d.fiat ? 2 : decimals), isMax: false })} placeholder="0" inputMode="decimal" style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: T.text, fontSize: 22, fontWeight: 700, outline: 'none' }} />
        <span style={{ color: T.sub, fontWeight: 600 }}>{d.fiat ? getSettingsState().fiat.code : a.sym}</span>
        <button className="hb-tap" style={{ ...chip, background: d.isMax ? T.accent : T.accentSoft, color: d.isMax ? 'var(--hb-on-brand)' : T.accent }} onClick={() => setDraft({ isMax: !d.isMax, amount: d.isMax ? '' : d.amount })} aria-pressed={d.isMax} data-testid="send-max">Max</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, minHeight: 28 }}>
        <span style={{ fontSize: 13, color: T.sub }} data-testid="send-fiat-hint">{price ? (d.fiat ? `≈ ${fmtAmount(String(Math.round(Number(cryptoAmount || (d.isMax && q.data ? fmtAmount(amountRaw, decimals, 12) : 0)) * 10 ** Math.min(decimals, 12))), Math.min(decimals, 12), 6)} ${a.sym}` : `≈ ${money(usdVal)}`) : 'Price unavailable'}</span>
        {price && <button className="hb-tap" style={chip} onClick={toggleFiat} data-testid="send-fiat-toggle" aria-label="Switch between crypto and fiat input">⇅ {d.fiat ? a.sym : getSettingsState().fiat.code}</button>}
      </div>
      <FeeRow quote={quote} tier={d.tier} loading={q.loading || (!q.data && !q.error)} fiat={quote ? feeFiat(tierOf(quote, d.tier)?.fee ?? '0') : undefined} onEdit={quote ? () => setFeeSheet(true) : undefined} />
      {err && <Notice kind="error" testid="send-error">{err} <button className="hb-tap" style={{ ...chip, marginLeft: 6 }} onClick={() => void q.refresh()}>Retry</button></Notice>}
      {issues.map((i, k) => <Notice key={k} kind={i.blocking ? 'error' : 'warning'} testid={`send-issue-${i.code}`}>{i.message}</Notice>)}
      <div style={{ marginTop: 22 }}><Btn disabled={!canNext} onClick={() => c.nav.push('sendConfirm', { assetId })}>Next</Btn></div>
      {scan && <AddressScanner onResult={apply} onClose={() => setScan(false)} />}
      {showBook && <ContactsSheet contacts={book ?? []} ct={chain.ct} evm={chain.kind === 'evm'} onPick={(_c, address) => { setDraft({ to: address }); setShowBook(false); }} onClose={() => setShowBook(false)} />}
      {feeSheet && quote && <FeeSheet quote={quote} tier={d.tier} fiatOf={feeFiat} onPick={(t) => setDraft({ tier: t })} onClose={() => setFeeSheet(false)} />}
    </Screen>
  );
};
