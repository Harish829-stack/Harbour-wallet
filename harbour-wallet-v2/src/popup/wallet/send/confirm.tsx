import React, { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../theme';
import { Screen, Btn, Coin, Spinner, Sheet, SuccessCheck, Empty } from '../ui';
import type { Ctx } from '../screens';
import { useDraft, resetDraft, setDraft } from './store';
import { sendTarget, useQuote, fmtAmount, priceUsd, fiatToCrypto, shortAddr, MEMO_LABEL, tierOf, TIER_LABEL } from './lib';
import { useRecipient } from './prepare';
import { Notice, FeeRow, FeeSheet, CopyBtn } from './parts';
import { money } from '../../settingsStore';
import { chainById } from '../../../core/chains/index';

/** Documented assumption: TW shows no value threshold publicly; 1,000 USD-equivalent triggers the extra review step. */
// Hardware wallets: the background prepares the exact transaction, the Ledger signs it over WebHID, the background verifies + broadcasts.
async function isLedgerWallet(c: any): Promise<boolean> {
  const w = await c.bg({ type: 'listWallets' }).catch(() => null);
  return w?.ok && w.wallets?.find((x: any) => x.id === w.activeWalletId)?.type === 'ledger';
}
async function sendWithLedger(c: any, req: any, note: (m: string) => void): Promise<any> {
  const p = await c.bg({ type: 'ledgerSendPrepare', ...req });
  if (!p?.ok) return p;
  const L = await import('../../ledger/device');
  let t: any = null;
  try {
    note('Confirm the transaction on your Ledger.');
    t = await L.open(false);
    if (p.kind === 'evm') return await c.bg({ type: 'ledgerSendSubmit', id: p.id, signature: await L.ethSign(t, p.path, p.unsignedTx) });
    return await c.bg({ type: 'ledgerSendSubmit', id: p.id, signedTx: await L.btcSign(t, p.path, p.inputs, p.outputs) });
  } catch (e: any) { return { ok: false, error: L.ledgerError(e) }; }
  finally { note(''); await L.close(t); }
}

export const HIGH_VALUE_USD = 1000;
const Line: React.FC<{ k: string; children: React.ReactNode; testid?: string }> = ({ k, children, testid }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: `1px solid ${T.border}` }}>
    <span style={{ color: T.sub, flexShrink: 0 }}>{k}</span><span data-testid={testid} style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all', minWidth: 0 }}>{children}</span>
  </div>
);

export const SendConfirm: React.FC<Ctx> = (c) => {
  const assetId: string = c.params?.assetId ?? ''; const d = useDraft();
  const { a, chain, chainId, tokenId } = useMemo(() => sendTarget(assetId), [assetId]);
  const decimals = a?.token?.decimals ?? a?.decimals ?? chain?.decimals ?? 18; const price = a ? priceUsd(c, assetId) : null;   const rcp = useRecipient(c.bg, chainId, d.to);
  const typed = d.amount.replace(/\.$/, ''); const cryptoAmount = d.isMax ? '' : d.fiat ? (price ? fiatToCrypto(typed, price, decimals) : '') : typed;
  const req = chainId && rcp.status === 'valid' && (d.isMax || Number(cryptoAmount) > 0) ? { chainId, tokenId, to: rcp.address!, amount: cryptoAmount, memo: d.memo.trim(), isMax: d.isMax, tier: d.tier } : null;
  const q = useQuote(c.bg, req, { refreshMs: 10000 });
  const [feeSheet, setFeeSheet] = useState(false); const [guard, setGuard] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle'); const [fail, setFail] = useState(''); const [res, setRes] = useState<{ id: string; hash: string } | null>(null);
  const busy = useRef(false);
  // Fee shown when the user last looked at this tier: the submit guard only allows a modest increase before a re-review is required.
  const [base, setBase] = useState<{ tier: string; fee: bigint } | null>(null);
  const quote = q.data?.quote; const picked = tierOf(quote, d.tier);
  useEffect(() => { if (picked && (!base || base.tier !== d.tier)) setBase({ tier: d.tier, fee: BigInt(picked.fee) }); }, [picked?.fee, d.tier]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a || !chain || (!d.to && phase === 'idle')) return <Screen title="Confirm" onBack={c.nav.pop}><Empty title="Nothing to confirm" sub="Start again from the Send screen." icon="send" /></Screen>;

  const amountRaw = q.data?.amountRaw ?? '0'; const amountTxt = q.data ? fmtAmount(amountRaw, decimals, Math.min(decimals, 8)) : '…';
  const usdVal = q.data ? Number(fmtAmount(amountRaw, decimals, 12)) * (price ?? 0) : 0;
  const issues = quote?.issues ?? []; const blocking = issues.some((i) => i.blocking);
  const feeFiat = (raw: string) => { const fp = priceUsd(c, chainId); return fp ? money(Number(fmtAmount(raw, quote?.feeDecimals ?? 18, 12)) * fp) : undefined; };
  const risks: string[] = [];
  if (issues.some((i) => i.code === 'smart-contract') || quote?.recipientIsContract) risks.push('The recipient is a smart contract. Sending to a contract that cannot handle this asset can permanently lock your funds.');
  if (q.data?.risk?.flagged) risks.push(`Security warning: this address is flagged as malicious (${(q.data.risk.flags ?? []).slice(0, 3).join(', ') || 'scam list'}). Sending to it will very likely lose your funds.`);
  if (q.data?.risk?.lookalike) risks.push(`Possible address poisoning: this address looks like ${q.data.risk.lookalike} (an address you have used) but is different. Compare every character before sending.`);
  if (q.data?.risk?.newRecipient) risks.push('You have not sent to this address before. Check every character with the person or service you are paying.');
  if (q.data?.risk?.selfSend) risks.push('The recipient is your own address. You will only pay the network fee.');
  if (price && usdVal >= HIGH_VALUE_USD) risks.push(`This transfer is worth about ${money(usdVal)}. Transactions cannot be reversed.`);
  const ready = !!q.data && !q.loading && !q.error && !blocking && rcp.status === 'valid' && phase === 'idle';

  const submit = async () => {
    if (busy.current || !req) return; busy.current = true; setGuard(false); setPhase('sending'); setFail('');
    try {
      const cap = base ? ((base.fee * 125n) / 100n + 1n).toString() : undefined;
      const r = (await isLedgerWallet(c)) ? await sendWithLedger(c, req, setFail) : await c.bg({ type: 'sendSubmit', ...req, feeCap: cap, planHash: q.data?.planHash });
      if (r?.ok) { setRes({ id: r.id, hash: r.hash }); setPhase('done'); c.refresh?.(); } else { setFail(r?.error ?? 'The transaction was not sent.'); setPhase('failed'); busy.current = false; }
    } catch (e: any) { setFail(e?.message ?? 'The transaction was not sent.'); setPhase('failed'); busy.current = false; }
  };
  const onConfirm = () => (risks.length ? setGuard(true) : void submit());
  const nextMigration = async () => {
    const m = c.params?.migration; if (!m?.remaining?.length) return; const [next, ...rest] = m.remaining as string[];
    const w = await c.bg({ type: 'walletsDetailed' }).catch(() => null); const dest = w?.wallets?.find((x: any) => x.id === m.destination); const ch = chainById(next);
    const to = ch ? dest?.accounts?.[0]?.addresses?.[ch.ct] : undefined; resetDraft(next);
    c.nav.push('send', { assetId: next, to, isMax: true, migration: { destination: m.destination, remaining: rest } });
  };

  if (phase === 'done' && res) return (
    <Screen title="Sent" onBack={() => { resetDraft(); c.nav.home(); }}>
      <div style={{ textAlign: 'center', paddingTop: 28 }} className="hb-rise">
        <SuccessCheck />
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 14 }} data-testid="send-success">Transaction submitted</div>
        <div style={{ color: T.sub, fontSize: 13, margin: '8px 12px 0' }}>{amountTxt} {a.sym} to {shortAddr(rcp.address ?? d.to, 8)} is waiting for network confirmation.</div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', margin: '14px 8px 0', color: T.sub }}>{res.hash}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}><CopyBtn text={res.hash} label="Copy hash" copiedLabel="Copied" ghost /><Btn onClick={() => { resetDraft(); c.nav.push('transaction', { id: res.id }); }}>View transaction</Btn></div>
        {c.params?.migration?.remaining?.length > 0 && <div style={{ marginTop: 12 }}><Btn variant="ghost" onClick={() => void nextMigration()}>Next asset</Btn></div>}
        <div style={{ marginTop: 12 }}><Btn variant="ghost" onClick={() => { resetDraft(); c.nav.home(); }}>Done</Btn></div>
      </div>
    </Screen>
  );

  return (
    <Screen title="Confirm" onBack={phase === 'sending' ? () => {} : c.nav.pop}>
      <div style={{ textAlign: 'center', padding: '8px 0 14px' }}>
        <Coin sym={a.sym} assetId={a.id} color={a.color} size={48} />
        <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }} data-testid="confirm-amount">{amountTxt} {a.sym}</div>
        {price && q.data && <div style={{ color: T.sub, marginTop: 4 }}>≈ {money(usdVal)}</div>}
      </div>
      <Line k="From">{shortAddr(q.data?.from ?? (c.addrs[chain.ct] ?? ''), 8) || '—'}</Line>
      <Line k="To" testid="confirm-to">{rcp.name ? <>{rcp.name}<br /></> : q.data?.risk?.contactName ? <>{q.data.risk.contactName}<br /></> : null}<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{rcp.address ?? d.to}</span></Line>
      <Line k="Network">{a.token ? `${chain.name} (${a.sym})` : chain.name}</Line>
      {q.data && q.data.memoKind !== 'none' && d.memo.trim() && <Line k={MEMO_LABEL[q.data.memoKind].label}>{d.memo.trim()}</Line>}
      <FeeRow quote={quote} tier={d.tier} loading={q.loading && !q.data} fiat={picked ? feeFiat(picked.fee) : undefined} onEdit={quote && phase === 'idle' ? () => setFeeSheet(true) : undefined} />
      {quote && quote.tiers.length > 1 && <div style={{ fontSize: 12, color: T.sub }}>Speed: {TIER_LABEL[d.tier]}{picked?.detail ? ` · ${picked.detail}` : ''}</div>}
      {q.error && <Notice kind="error" testid="confirm-error">{q.error}</Notice>}
      {issues.map((i, k) => <Notice key={k} kind={i.blocking ? 'error' : 'warning'}>{i.message}</Notice>)}
      <div style={{ marginTop: 22 }}>
        <Btn disabled={!ready} onClick={onConfirm}>{phase === 'sending' ? <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}><Spinner size={16} color="currentColor" />Sending…</span> : 'Confirm'}</Btn>
      </div>
      <div style={{ fontSize: 12, color: T.sub, textAlign: 'center', marginTop: 10 }}>Signed on this device with your active account. Transactions cannot be reversed.</div>
      {feeSheet && quote && <FeeSheet quote={quote} tier={d.tier} fiatOf={feeFiat} onPick={(t) => setDraft({ tier: t })} onClose={() => setFeeSheet(false)} />}
      {guard && <Sheet title="Before you send" onClose={() => setGuard(false)}>
        {risks.map((r, i) => <Notice key={i} kind="warning">{r}</Notice>)}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><Btn variant="ghost" onClick={() => { setGuard(false); c.nav.pop(); }}>Stop, go back</Btn><Btn onClick={() => void submit()}>Continue anyway</Btn></div>
      </Sheet>}
      {phase === 'failed' && <Sheet title="Transaction failed" onClose={() => setPhase('idle')}>
        <Notice kind="error" testid="send-failed">{fail}</Notice>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><Btn variant="ghost" onClick={() => setPhase('idle')}>Close</Btn><Btn onClick={() => { setPhase('idle'); void submit(); }}>Try again</Btn></div>
      </Sheet>}
    </Screen>
  );
};
