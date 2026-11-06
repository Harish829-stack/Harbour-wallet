import React, { useEffect, useRef, useState } from 'react';
import { T } from '../../theme';
import { Screen, Btn, Spinner, Empty, SuccessCheck, IconBtn } from '../ui';
import type { Ctx } from '../screens';
import { useRecipient } from './prepare';
import { Notice, AddressScanner, FeeRow, FeeSheet } from './parts';
import { fmtAmount, shortAddr, tierOf, type WireQuote } from './lib';
import type { FeeTierId } from '../../../core/chains/send/types';
import { chainById } from '../../../core/chains/index';

/** Shape other features pass in `params.nft` (the NFT feature owns its own `nftSend` screen; this is the generic engine-backed screen). */
export interface NftRef { chainId: string; standard: 'erc721' | 'erc1155' | string; contract: string; tokenId: string; amount?: string; name?: string; image?: string }
const box: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 14, border: `1px solid ${T.border}`, background: T.bgAlt, color: T.text, fontSize: 15, outline: 'none' };

export const SendNft: React.FC<Ctx> = (c) => {
  const nft: NftRef | undefined = c.params?.nft ?? (c.params?.contract ? { chainId: c.params.chainId, standard: c.params.standard, contract: c.params.contract, tokenId: String(c.params.nftId ?? c.params.tokenId), name: c.params.name } : undefined);
  const [to, setTo] = useState(''); const [tier, setTier] = useState<FeeTierId>('average'); const [scan, setScan] = useState(false); const [feeSheet, setFeeSheet] = useState(false);
  const [quote, setQuote] = useState<WireQuote | null>(null); const [qErr, setQErr] = useState(''); const [qBusy, setQBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle'); const [fail, setFail] = useState(''); const [res, setRes] = useState<{ id: string; hash: string } | null>(null); const busy = useRef(false);
  const chain = chainById(nft?.chainId); const rcp = useRecipient(c.bg, nft?.chainId ?? '', to);
  const body = nft && rcp.status === 'valid' ? { chainId: nft.chainId, standard: nft.standard, contract: nft.contract, tokenId: nft.tokenId, amount: nft.amount, to: rcp.address, tier } : null;
  const key = JSON.stringify(body);
  useEffect(() => {
    if (!body) { setQuote(null); setQErr(''); return; } let dead = false; setQBusy(true); setQErr('');
    const t = setTimeout(async () => { const r = await c.bg({ type: 'sendNftQuote', ...body }).catch(() => null); if (dead) return; setQBusy(false); if (r?.ok) setQuote(r.quote); else { setQuote(null); setQErr(r?.error ?? 'Could not reach the network.'); } }, 350);
    return () => { dead = true; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!nft || !chain) return <Screen title="Send NFT" onBack={c.nav.pop}><Empty title="NFT not found" sub="Open the NFT from your collectibles and choose Send." icon="nft" /></Screen>;
  const issues = quote?.issues ?? []; const blocking = issues.some((i) => i.blocking); const ready = !!quote && !blocking && !qBusy && rcp.status === 'valid' && phase === 'idle';
  const send = async () => {
    if (busy.current || !body) return; busy.current = true; setPhase('sending'); setFail('');
    const r = await c.bg({ type: 'sendNftSubmit', ...body }).catch((e: any) => ({ ok: false, error: e?.message }));
    if (r?.ok) { setRes({ id: r.id, hash: r.hash }); setPhase('done'); } else { setFail(r?.error ?? 'The transfer was not sent.'); setPhase('failed'); busy.current = false; }
  };
  if (phase === 'done' && res) return <Screen title="Sent" onBack={() => c.nav.home()}><div style={{ textAlign: 'center', paddingTop: 28 }}><SuccessCheck /><div style={{ fontWeight: 800, fontSize: 20, marginTop: 14 }}>Transfer submitted</div><div style={{ color: T.sub, fontSize: 13, margin: '8px 12px 18px' }}>{nft.name ?? 'Your NFT'} is on its way to {shortAddr(rcp.address ?? to, 8)}.</div><Btn onClick={() => c.nav.push('transaction', { id: res.id })}>View transaction</Btn></div></Screen>;
  return (
    <Screen title="Send NFT" onBack={c.nav.pop}>
      <div style={{ fontWeight: 700 }}>{nft.name ?? `Token #${nft.tokenId}`}</div><div style={{ fontSize: 12, color: T.sub }}>{chain.name} · {nft.standard === 'erc1155' ? 'ERC-1155' : nft.standard === 'erc721' ? 'ERC-721' : String(nft.standard)}</div>
      <div style={{ fontSize: 13, color: T.sub, margin: '16px 0 6px', fontWeight: 600 }}>Address or Domain Name</div>
      <div style={{ position: 'relative' }}><input data-testid="nft-to" aria-label="Recipient address" value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} autoComplete="off" placeholder={`${chain.name} address`} style={{ ...box, paddingRight: 50, borderColor: rcp.status === 'invalid' ? T.error : T.border }} /><span style={{ position: 'absolute', right: 6, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}><IconBtn icon="qr" size={32} title="Scan QR code" onClick={() => setScan(true)} /></span></div>
      <div style={{ minHeight: 18, fontSize: 12, marginTop: 6, color: rcp.status === 'invalid' ? T.error : T.sub }} aria-live="polite">{rcp.status === 'checking' ? 'Checking address…' : rcp.status === 'invalid' ? rcp.error : rcp.status === 'valid' && rcp.name ? `${rcp.name} → ${shortAddr(rcp.address!, 8)}` : ''}</div>
      <FeeRow quote={quote} tier={tier} loading={qBusy} onEdit={quote ? () => setFeeSheet(true) : undefined} />
      {qErr && <Notice kind="error">{qErr}</Notice>}
      {issues.map((i, k) => <Notice key={k} kind={i.blocking ? 'error' : 'warning'}>{i.message}</Notice>)}
      <div style={{ marginTop: 22 }}><Btn disabled={!ready} onClick={() => void send()}>{phase === 'sending' ? <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Spinner size={16} color="currentColor" />Sending…</span> : 'Confirm'}</Btn></div>
      {phase === 'failed' && <Notice kind="error" testid="nft-failed">{fail} <button className="hb-tap" onClick={() => setPhase('idle')} style={{ border: 'none', background: 'transparent', color: T.accent, fontWeight: 700, cursor: 'pointer' }}>Try again</button></Notice>}
      {scan && <AddressScanner onResult={(r) => { setTo(r.address); setScan(false); }} onClose={() => setScan(false)} />}
      {feeSheet && quote && <FeeSheet quote={quote} tier={tier} onPick={setTier} onClose={() => setFeeSheet(false)} />}
      <div style={{ fontSize: 12, color: T.sub, textAlign: 'center', marginTop: 10 }}>{quote ? `Network fee about ${fmtAmount(tierOf(quote, tier)!.fee, quote.feeDecimals, 8)} ${quote.feeSymbol}. ` : ''}Transfers cannot be reversed.</div>
    </Screen>
  );
};

const Unsupported: React.FC<{ c: Ctx; title: string; heading: string; why: string; action?: { label: string; run: () => void } }> = ({ c, title, heading, why, action }) => (
  <Screen title={title} onBack={c.nav.pop}><Empty title={heading} sub={why} icon="send" />{action && <div style={{ marginTop: 16 }}><Btn onClick={action.run}>{action.label}</Btn></div>}</Screen>
);
export const SendBridge: React.FC<Ctx> = (c) => <Unsupported c={c} title="Bridge & send" heading="Bridge & send is not available yet" why="Trust Wallet's bridge-and-send routes through its private quote gateway. Harbour has no public equivalent wired into Send, so nothing is signed here." action={{ label: 'Back to wallet', run: () => c.nav.home() }} />;
export const SendInscriptions: React.FC<Ctx> = (c) => <Unsupported c={c} title="Inscriptions" heading="Inscriptions are not supported yet" why="Listing and moving Ordinals or BRC-20 inscriptions needs an inscription indexer that Trust Wallet reaches through its private gateway. Harbour never spends a UTXO that might carry an inscription as ordinary funds." />;
export const SendInscribe: React.FC<Ctx> = (c) => <Unsupported c={c} title="Inscribe" heading="Inscribing is not supported yet" why="Creating an inscription needs a commit and reveal transaction pair and an indexer. Harbour does not implement that flow, so nothing is signed here." />;
