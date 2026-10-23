import React, { useCallback, useEffect, useRef, useState } from 'react';
import { T } from '../../theme';
import { Screen, Btn, Coin, Skeleton, Spinner, Empty } from '../ui';
import type { Ctx } from '../types';
import { fmtAmount, shortAddr, openExternal } from './lib';
import { Notice, CopyBtn } from './parts';
import { chainById, explorerTxUrl } from '../../../core/chains/index';
import type { SentTx } from '../../../core/sendService';

const POLL_MS = 6000; const STUCK_AFTER_MS = 10 * 60 * 1000; // assumption: TW shows its "still pending" notice after an unspecified delay
interface Detail { record: SentTx | null; status: { state: 'pending' | 'confirmed' | 'failed' | 'unknown'; block?: string; confirmations?: number; fee?: string; error?: string; from?: string; to?: string; value?: string; timestamp?: number }; chain: { id: string; name: string; symbol: string; decimals: number } }

const Line: React.FC<{ k: string; children: React.ReactNode; testid?: string }> = ({ k, children, testid }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: `1px solid ${T.border}` }}>
    <span style={{ color: T.sub, flexShrink: 0 }}>{k}</span><span data-testid={testid} style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all', minWidth: 0 }}>{children}</span>
  </div>
);
const STATE_UI = { pending: { t: 'Pending', c: T.accent }, confirmed: { t: 'Confirmed', c: T.success }, failed: { t: 'Failed', c: T.error }, unknown: { t: 'Not found yet', c: T.sub } } as const;

export const TransactionScreen: React.FC<Ctx> = (c) => {
  const p = c.params ?? {}; const item = p.item as { id?: string; assetId?: string; hash?: string; amount?: string; symbol?: string; kind?: string; status?: string; timestamp?: number; counterparty?: string; url?: string } | undefined;
  const id: string | undefined = typeof p.id === 'string' ? p.id : undefined; const hash: string | undefined = typeof p.hash === 'string' ? p.hash : item?.hash ?? (item?.id && /^[0-9a-zA-Z]{20,}$/.test(item.id) ? item.id : undefined);
  const chainId: string | undefined = typeof p.chainId === 'string' ? p.chainId : item?.assetId ? chainById(item.assetId)?.id : undefined;
  const [d, setD] = useState<Detail | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const seq = useRef(0);
  const load = useCallback(async (silent: boolean) => {
    const my = ++seq.current; if (!silent) { setLoading(true); setError(''); }
    const r = await c.bg({ type: 'sendTxDetail', id, hash, chainId, from: p.from }).catch(() => null);
    if (my !== seq.current) return; setLoading(false);
    if (r?.ok) { setD(r); setError(''); } else if (!silent || !d) setError(r?.error ?? 'Could not load this transaction. Check your connection and try again.');
  }, [id, hash, chainId]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(false); return () => { seq.current++; }; }, [load]);
  const state = d?.status.state ?? 'unknown'; const rec = d?.record ?? null;
  useEffect(() => { if (state !== 'pending' && !(state === 'unknown' && rec)) return; const t = setInterval(() => void load(true), POLL_MS); return () => clearInterval(t); }, [state, !!rec, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !d) return <Screen title="Transaction" onBack={c.nav.pop}><Skeleton h={60} /><div style={{ height: 12 }} /><Skeleton h={180} /></Screen>;
  if (!d) return <Screen title="Transaction" onBack={c.nav.pop}><Empty title="Transaction not available" sub={error || 'This transaction could not be found.'} icon="history" /><div style={{ marginTop: 16 }}><Btn onClick={() => void load(false)}>Try again</Btn></div>{item?.url && <div style={{ marginTop: 10 }}><Btn variant="ghost" onClick={() => openExternal(item.url!)}>View on explorer</Btn></div>}</Screen>;

  const chain = chainById(d.chain.id); const url = explorerTxUrl(chain, rec?.hash ?? hash ?? '') || item?.url || '';
  const decimals = rec?.decimals ?? d.chain.decimals; const symbol = rec?.symbol ?? item?.symbol ?? d.chain.symbol;
  const amount = rec ? fmtAmount(rec.amount, decimals, 8) : d.status.value ? fmtAmount(d.status.value, d.chain.decimals, 8) : item?.amount ?? '';
  const from = rec?.from ?? d.status.from; const to = rec?.to ?? d.status.to ?? item?.counterparty;
  const feeRaw = rec?.feeActual ?? d.status.fee ?? rec?.feeEst; const feeIsEst = !rec?.feeActual && !d.status.fee;
  const ts = rec?.ts ?? d.status.timestamp ?? item?.timestamp; const ui = STATE_UI[state];
  const stuck = state === 'pending' && !!ts && Date.now() - ts > STUCK_AFTER_MS; const theHash = rec?.hash ?? hash ?? '';
  const memoLabel = chain?.kind === 'ripple' ? 'Destination Tag' : 'Memo';
  return (
    <Screen title="Transaction" onBack={c.nav.pop}>
      <div style={{ textAlign: 'center', padding: '6px 0 14px' }} className="hb-rise">
        <Coin sym={symbol} assetId={chain?.id} size={44} />
        {amount && <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10 }} data-testid="tx-amount">{rec?.kind === 'nft' ? (rec.nftName ?? 'NFT') : `${amount} ${symbol}`}</div>}
        <div data-testid="tx-status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 12px', borderRadius: 999, background: T.bgAlt, color: ui.c, fontWeight: 700, fontSize: 13 }}>{state === 'pending' && <Spinner size={12} />}{ui.t}</div>
      </div>
      {state === 'failed' && <Notice kind="error">{d.status.error ?? rec?.error ?? 'The network rejected this transaction. Any fee used is not refunded.'}</Notice>}
      {stuck && <Notice kind="warning" testid="tx-stuck"><b>This transaction is still pending</b><br />It's taking longer than usual to confirm. You can check its status on the block explorer.</Notice>}
      {state === 'unknown' && rec && <Notice kind="info">The network has not reported this transaction yet. It was just broadcast, so this can take a few seconds.</Notice>}
      {error && <Notice kind="warning">{error}</Notice>}
      <div style={{ marginTop: 8 }}>
        <Line k="Network">{d.chain.name}</Line>
        {from && <Line k="From"><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{from}</span></Line>}
        {to && <Line k="To" testid="tx-to"><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{to}</span></Line>}
        {rec?.memo && <Line k={memoLabel}>{rec.memo}</Line>}
        {feeRaw && <Line k={feeIsEst ? 'Network fee (estimated)' : 'Network fee'}>{fmtAmount(feeRaw, rec?.feeDecimals ?? d.chain.decimals, 8)} {rec?.feeSymbol ?? d.chain.symbol}</Line>}
        {d.status.block && <Line k="Block">{d.status.block}</Line>}
        {d.status.confirmations != null && state === 'confirmed' && <Line k="Confirmations">{d.status.confirmations}</Line>}
        {ts ? <Line k="Date">{new Date(ts).toLocaleString()}</Line> : null}
        {theHash && <Line k="Transaction ID" testid="tx-hash"><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortAddr(theHash, 10)}</span></Line>}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        {theHash && <CopyBtn text={theHash} label="Copy hash" copiedLabel="Copied" ghost />}
        {url ? <Btn onClick={() => openExternal(url)}>View on explorer</Btn> : <div style={{ flex: 1, fontSize: 12, color: T.sub, alignSelf: 'center' }}>No block explorer is configured for this network.</div>}
      </div>
    </Screen>
  );
};
