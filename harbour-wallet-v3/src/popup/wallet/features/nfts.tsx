// Collectibles screens: collections grid -> collection (items) -> NFT detail (+ send), Hidden collections. Flow follows TW v26.41.0
// (evidences/re-evidence/35-nfts/SPEC.md). Data: public indexers via the background `nft*` messages. Images are sanitised in core/nfts/media.ts
// and rendered with referrerpolicy=no-referrer; nothing is hard-coded.
import { userText } from '../../../core/errors';
import React, { useCallback, useEffect, useState } from 'react';
import { T } from '../../theme';
import { bg } from '../../api';
import { Screen, Row, Btn, Coin, Empty, Skeleton, Sheet, Ic, ICON, SuccessCheck, IconBtn, inputStyle, FieldLabel } from '../ui';
import { NetworkField, type PickNetwork } from '../pickers';
import type { Ctx } from '../screens';
import { chainById, ENABLED_CHAINS } from '../../../core/chains/index';
import { fmtRaw, Notice } from './earnParts';

interface CollectionView { id: string; chainId: string; contract: string; name: string; symbol: string; image: string; owned: number; standard: string; suspicious: boolean; floorPrice?: number; preview: string[]; reason?: 'reported' | 'suspected' }
interface ItemView { id: string; collectionId: string; chainId: string; contract: string; name: string; description: string; image: string; animationUrl: string; attributes: Array<{ key: string; value: string }>; standard: string; balance: string; externalUrl: string; transferable: boolean }
const subtle: React.CSSProperties = { fontSize: 12, color: T.sub };
const short = (a?: string) => (a && a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a ?? '');
const EVENT = 'hb-nfts-changed';
const notify = () => { try { window.dispatchEvent(new Event(EVENT)); } catch { /* no window */ } };
const netName = (id: string) => chainById(id)?.name ?? id;

/** Sanitised URL only (core/nfts/media.ts); falls back to a placeholder glyph when missing or broken. */
export const NftImage: React.FC<{ src: string; alt: string; size?: number | string; radius?: number; fit?: 'cover' | 'contain' }> = ({ src, alt, size = '100%', radius = 14, fit = 'cover' }) => {
  const [broken, setBroken] = useState(false);
  const box: React.CSSProperties = { width: size, aspectRatio: '1', borderRadius: radius, background: T.bgAlt, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.sub, flexShrink: 0 };
  return <div style={box}>{src && !broken ? <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} /> : <Ic d={ICON.nft} size={28} />}</div>;
};
function useChanged(fn: () => void) { useEffect(() => { window.addEventListener(EVENT, fn); return () => window.removeEventListener(EVENT, fn); }, [fn]); }
const Retry: React.FC<{ text: string; detail?: string; onRetry: () => void }> = ({ text, detail, onRetry }) => (
  <div role="alert" style={{ textAlign: 'center', padding: '40px 20px' }}><div style={{ marginBottom: 14 }}>{text}</div><div style={{ maxWidth: 200, margin: '0 auto' }}><Btn onClick={onRetry}>Retry</Btn></div>{detail && <div style={{ ...subtle, marginTop: 10 }}>{userText(detail)}</div>}</div>
);

// ---------------------------------------------------------------- collections list
const Tile: React.FC<{ c: CollectionView; onClick: () => void }> = ({ c, onClick }) => (
  <div role="button" tabIndex={0} className="hb-tap" data-testid="nft-collection-item" onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }} style={{ cursor: 'pointer', minWidth: 0 }}>
    <div style={{ position: 'relative' }}>
      <NftImage src={c.image || c.preview[0] || ''} alt={c.name} />
      <span title={netName(c.chainId)} style={{ position: 'absolute', right: 8, bottom: 8, borderRadius: 999, background: T.surface, padding: 2, display: 'inline-flex' }}><Coin sym={chainById(c.chainId)?.symbol ?? '?'} assetId={c.chainId} size={18} /></span>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'baseline' }}><div data-testid="nft-collection-name" style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div><div style={{ fontWeight: 700, fontSize: 13 }}>{c.owned}</div></div>
  </div>
);
const NftsScreen: React.FC<Ctx> = (c) => {
  const [data, setData] = useState<{ active: CollectionView[]; hidden: CollectionView[]; errors: Array<{ chainId: string; error: string }>; stale?: boolean; error?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const filter = c.networkFilter && chainById(c.networkFilter) ? [c.networkFilter] : undefined;
  const load = useCallback((refresh = false) => {
    setLoading(true); setErr(null);
    bg({ type: 'nftList', refresh, chainIds: filter }).then((r) => { setLoading(false); if (r?.ok) setData(r); else setErr(r?.error ?? 'Request failed'); }).catch((e) => { setLoading(false); setErr(String(e?.message ?? e)); });
  }, [c.networkFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(false); }, [load]); useChanged(useCallback(() => load(false), [load]));
  const right = <div style={{ display: 'flex', gap: 6 }}><IconBtn icon="refresh" size={32} title="Refresh" onClick={() => load(true)} /><IconBtn icon="plus" size={32} title="Import NFT" onClick={() => c.nav.push('nftImport')} /><IconBtn icon="eyeoff" size={32} title="Hidden collections" onClick={() => c.nav.push('nftHidden')} /></div>;
  return (
    <Screen title="Collectibles" onBack={c.nav.pop} right={right}>
      {!data && !err && <div role="status" aria-label="Loading collectibles" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{[0, 1, 2, 3].map((i) => <div key={i}><Skeleton w="100%" h={150} r={14} /><div style={{ height: 6 }} /><Skeleton w={90} h={12} /></div>)}</div>}
      {!data && err && <Retry text="We couldn’t load your collectibles." detail={err} onRetry={() => load(true)} />}
      {data && (
        <>
          {data.stale && <Notice action={{ label: 'Retry', onClick: () => load(true) }}>Couldn’t refresh. Showing recent data.</Notice>}
          {data.errors.length > 0 && data.active.length + data.hidden.length > 0 && <Notice action={{ label: 'Retry', onClick: () => load(true) }}>Couldn’t load collectibles from {data.errors.map((e) => netName(e.chainId)).join(', ')}.</Notice>}
          {data.active.length === 0 ? (
            data.errors.length > 0 && data.hidden.length === 0 ? <Retry text="We couldn’t load your collectibles." detail={data.errors[0].error} onRetry={() => load(true)} />
              : <div><Empty title="No collectibles yet" sub={data.hidden.length ? `${data.hidden.length} collection${data.hidden.length > 1 ? 's are' : ' is'} hidden.` : 'NFTs you import will appear here. Add one with its network, contract address and token ID.'} icon="nft" /><div style={{ maxWidth: 220, margin: '0 auto' }}><Btn onClick={() => c.nav.push('nftImport')}>Import NFT</Btn></div></div>
          ) : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 6 }}>{data.active.map((col) => <Tile key={col.id} c={col} onClick={() => c.nav.push('nftCollection', { id: col.id })} />)}</div>}
          {loading && <div style={{ ...subtle, textAlign: 'center', marginTop: 10 }}>Refreshing…</div>}
          <div style={{ ...subtle, marginTop: 16 }}>Only NFTs you import are shown. Details come from public indexers and the chain, and may be delayed.</div>
        </>
      )}
    </Screen>
  );
};

// ---------------------------------------------------------------- collection
const NftCollectionScreen: React.FC<Ctx> = (c) => {
  const id: string = c.params?.id;
  const [d, setD] = useState<{ collection: CollectionView; items: ItemView[]; itemsError?: string; hidden: boolean; reason?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null); const [menu, setMenu] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(() => { setErr(null); setD(null); bg({ type: 'nftCollection', id }).then((r) => (r?.ok ? setD(r) : setErr(r?.error ?? 'Request failed'))).catch((e) => setErr(String(e?.message ?? e))); }, [id]);
  useEffect(() => { load(); }, [load]);
  const toggle = async () => { if (!d) return; setBusy(true); await bg({ type: 'nftReport', id, reported: !d.hidden }).catch(() => null); setBusy(false); setMenu(false); notify(); c.nav.pop(); };
  return (
    <Screen title={d?.collection.name ?? 'Collection'} onBack={c.nav.pop} right={d ? <IconBtn icon="dots" size={32} title="More" onClick={() => setMenu(true)} /> : undefined}>
      {err && <Retry text="We couldn’t load this collection." detail={err} onRetry={load} />}
      {!d && !err && <div role="status" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i}><Skeleton w="100%" h={96} r={12} /><div style={{ height: 6 }} /><Skeleton w={60} h={11} /></div>)}</div>}
      {d && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...subtle, marginBottom: 10 }}><Coin sym={chainById(d.collection.chainId)?.symbol ?? '?'} assetId={d.collection.chainId} size={18} />{netName(d.collection.chainId)} · {d.collection.standard} · {d.collection.owned} owned{d.collection.floorPrice ? ` · Floor ${d.collection.floorPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${chainById(d.collection.chainId)?.symbol ?? ''}` : ''}{d.hidden ? ` · Hidden${d.reason === 'suspected' ? ' (suspected spam)' : ''}` : ''}</div>
          {d.itemsError && <Notice>Showing a partial list: {d.itemsError}</Notice>}
          {d.items.length === 0
            ? <div><Empty title="You haven’t bought anything from this collection yet" icon="nft" /><div style={{ maxWidth: 220, margin: '0 auto' }}><Btn onClick={() => c.nav.push('receive')}>Receive</Btn></div></div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {d.items.map((it) => (
                <div key={it.id} role="button" tabIndex={0} className="hb-tap" data-testid="nft-collection-item" onClick={() => c.nav.push('nftItem', { collectionId: id, itemId: it.id })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.nav.push('nftItem', { collectionId: id, itemId: it.id }); } }} style={{ cursor: 'pointer', minWidth: 0, textAlign: 'center' }}>
                  <NftImage src={it.image} alt={it.name} radius={12} />
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                  {it.standard === 'ERC-1155' && it.balance !== '1' && <div style={subtle}>×{it.balance}</div>}
                </div>
              ))}
            </div>}
        </>
      )}
      {menu && d && (
        <Sheet title={d.collection.name} onClose={() => setMenu(false)}>
          <Row onClick={busy ? undefined : toggle} left={<Ic d={d.hidden ? ICON.eye : ICON.eyeoff} size={22} />} title={d.hidden ? 'Show collection' : 'Hide collection'} sub={d.hidden ? 'Move it back to your collectibles' : 'Move it to Hidden collections (use this for spam)'} />
        </Sheet>
      )}
    </Screen>
  );
};

// ---------------------------------------------------------------- hidden collections
const NftHiddenScreen: React.FC<Ctx> = (c) => {
  const [list, setList] = useState<CollectionView[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { setErr(null); bg({ type: 'nftList' }).then((r) => (r?.ok ? setList(r.hidden) : setErr(r?.error ?? 'Request failed'))).catch((e) => setErr(String(e?.message ?? e))); }, []);
  useEffect(() => { load(); }, [load]); useChanged(load);
  return (
    <Screen title="Hidden collections" onBack={c.nav.pop}>
      {err && <Retry text="We couldn’t load hidden collections." detail={err} onRetry={load} />}
      {!list && !err && <div role="status"><Skeleton w="100%" h={56} /></div>}
      {list && list.length === 0 && <Empty title="You have no hidden collections" sub="Collections you hide, and suspected spam, are listed here." icon="eyeoff" />}
      {list && list.map((col) => (
        <Row key={col.id} onClick={() => c.nav.push('nftCollection', { id: col.id })} left={<div style={{ width: 44 }}><NftImage src={col.image || col.preview[0] || ''} alt={col.name} radius={10} /></div>} title={col.name} sub={`${netName(col.chainId)} · ${col.owned} owned${col.reason === 'suspected' ? ' · Suspected spam' : ''}`} />
      ))}
    </Screen>
  );
};

// ---------------------------------------------------------------- item detail
const Collapsible: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false); const long = text.length > 160;
  return <div><div style={{ fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...(open || !long ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }) }}>{text}</div>{long && <button className="hb-tap" onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>{open ? 'Show less' : 'Show more'}</button>}</div>;
};
const Detail: React.FC<{ label: string; value: React.ReactNode; copy?: string }> = ({ label, value, copy }) => {
  const [ok, setOk] = useState(false);
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${T.border}` }}><span style={{ color: T.sub, fontWeight: 600 }}>{label}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, minWidth: 0 }}>{value}{copy && <button aria-label={`Copy ${label}`} title="Copy" className="hb-tap" onClick={() => { navigator.clipboard?.writeText(copy).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }).catch(() => {}); }} style={{ background: 'none', border: 'none', color: ok ? T.success : T.sub, cursor: 'pointer', display: 'inline-flex' }}><Ic d={ok ? ICON.check : ICON.copy} size={16} /></button>}</span></div>;
};
const NftItemScreen: React.FC<Ctx> = (c) => {
  const { collectionId, itemId } = c.params as { collectionId: string; itemId: string };
  const [d, setD] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { setErr(null); setD(null); bg({ type: 'nftItem', collectionId, itemId }).then((r) => (r?.ok ? setD(r) : setErr(r?.error ?? 'Request failed'))).catch((e) => setErr(String(e?.message ?? e))); }, [collectionId, itemId]);
  useEffect(() => { load(); }, [load]);
  const it: ItemView | undefined = d?.item; const col: CollectionView | undefined = d?.collection;
  return (
    <Screen title={col?.name ?? 'NFT'} onBack={c.nav.pop}>
      {err && <Retry text="We couldn’t load this NFT." detail={err} onRetry={load} />}
      {!d && !err && <div role="status"><Skeleton w="100%" h={300} r={16} /><div style={{ height: 12 }} /><Skeleton w={140} h={16} /></div>}
      {it && col && (
        <div className="hb-rise">
          <NftImage src={it.image} alt={it.name} radius={16} fit="contain" />
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 17, margin: '14px 0 4px', overflowWrap: 'anywhere' }}>{it.name}</div>
          {d.canSend && <div style={{ marginTop: 12 }}><Btn onClick={() => c.nav.push('nftSend', { collectionId, itemId })}>Send</Btn></div>}
          {!d.canSend && d.sendBlocked && <div style={{ ...subtle, textAlign: 'center', marginTop: 8 }}>{d.sendBlocked === 'hardware' ? 'Sending collectibles is not available for hardware wallets here.' : d.sendBlocked === 'not_transferable' ? 'This NFT type can’t be sent from Harbour.' : 'Sending is not available for this wallet.'}</div>}
          {d.openseaUrl && <div style={{ marginTop: 10 }}><a href={d.openseaUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 999, color: T.accent, fontWeight: 700 }}>View on OpenSea</a></div>}
          {it.description && <div style={{ marginTop: 14 }}><div style={{ fontWeight: 800, marginBottom: 6 }}>Description</div><Collapsible text={it.description} /></div>}
          <div style={{ marginTop: 14 }}>
            <Detail label="Network" value={d.network} />
            {col.contract && <Detail label="Contract address" value={short(col.contract)} copy={col.contract} />}
            <Detail label={col.chainId === 'solana' ? 'Mint address' : 'Token ID'} value={short(it.id)} copy={it.id} />
            <Detail label="Type" value={it.standard} />
            <Detail label="Balance" value={it.balance} />
          </div>
          {d.explorerUrl && <a href={d.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.accent, fontWeight: 700, margin: '12px 0' }}>View on explorer <Ic d={ICON.external} size={16} /></a>}
          {it.attributes.length > 0 && (
            <div style={{ paddingTop: 8 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Attributes</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {it.attributes.map((a, i) => <div key={i} style={{ background: T.bgAlt, borderRadius: 16, padding: 12, minWidth: 0 }}><div style={subtle}>{a.key}</div><div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{a.value}</div></div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </Screen>
  );
};

// ---------------------------------------------------------------- send
const NftSendScreen: React.FC<Ctx> = (c) => {
  const { collectionId, itemId } = c.params as { collectionId: string; itemId: string };
  const [d, setD] = useState<any>(null); const [to, setTo] = useState(''); const [qty, setQty] = useState('1');
  const [sum, setSum] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ hash: string; explorerUrl?: string } | null>(null);
  useEffect(() => { bg({ type: 'nftItem', collectionId, itemId }).then((r) => (r?.ok ? setD(r) : setErr(r?.error ?? 'Request failed'))).catch((e) => setErr(String(e?.message ?? e))); }, [collectionId, itemId]);
  const it: ItemView | undefined = d?.item; const multi = it?.standard === 'ERC-1155';
  const req = { collectionId, itemId, to: to.trim(), quantity: multi ? qty : undefined };
  const review = async () => { setBusy(true); setErr(null); const r = await bg({ type: 'nftTransferPrepare', ...req }).catch((e) => ({ ok: false, error: String(e?.message ?? e) })); setBusy(false); if (r?.ok) setSum(r.summary); else setErr(r?.error ?? 'Could not prepare the transfer'); };
  const send = async () => { setBusy(true); setErr(null); const r = await bg({ type: 'nftTransferSubmit', ...req }).catch((e) => ({ ok: false, error: String(e?.message ?? e) })); setBusy(false); if (r?.ok) { setDone({ hash: r.hash, explorerUrl: r.explorerUrl }); notify(); } else setErr(r?.error ?? 'Transfer failed'); };
  if (done) return (
    <Screen title="Send" onBack={() => { c.nav.pop(); c.nav.pop(); c.nav.pop(); }}>
      <div className="hb-rise" style={{ textAlign: 'center', paddingTop: 30 }}><SuccessCheck /><div style={{ fontSize: 20, fontWeight: 800, margin: '14px 0 4px' }}>Transaction submitted</div><div style={{ ...subtle, marginBottom: 12 }}>It may take a moment to be confirmed. Your collection updates shortly.</div><div style={{ ...subtle, wordBreak: 'break-all', marginBottom: 14 }}>{done.hash}</div>
        {done.explorerUrl && <a href={done.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>View on explorer <Ic d={ICON.external} size={16} /></a>}
        <Btn onClick={() => { c.nav.pop(); c.nav.pop(); c.nav.pop(); }}>Done</Btn></div>
    </Screen>
  );
  return (
    <Screen title="Send" onBack={sum ? () => setSum(null) : c.nav.pop}>
      {!d && !err && <div role="status"><Skeleton w="100%" h={80} r={16} /></div>}
      {err && !d && <Retry text="We couldn’t load this NFT." detail={err} onRetry={() => c.nav.pop()} />}
      {it && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.bgAlt, borderRadius: 16, padding: 12 }}>
            <div style={{ width: 64 }}><NftImage src={it.image} alt={it.name} radius={12} /></div>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{it.name}</div><div style={subtle}>{d.collection.name} · {d.network}</div></div>
          </div>
          {!sum ? (
            <>
              <div style={{ fontWeight: 600, margin: '14px 0 6px' }}>Recipient</div>
              <input data-testid="nft-send-to" aria-label="Recipient address" value={to} onChange={(e) => { setTo(e.target.value); setErr(null); }} placeholder={it.chainId === 'solana' ? 'Solana address' : '0x address'} spellCheck={false} autoCapitalize="off" autoCorrect="off" style={{ width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 14 }} />
              {multi && <><div style={{ fontWeight: 600, margin: '14px 0 6px' }}>Quantity (you own {it.balance})</div><input aria-label="Quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} style={{ width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 14 }} /></>}
              {err && <Notice tone="error">{err}</Notice>}
              <div style={{ marginTop: 16 }}><Btn disabled={busy || !to.trim() || (multi && !Number(qty))} onClick={review}>{busy ? 'Checking…' : 'Next'}</Btn></div>
            </>
          ) : (
            <>
              <div style={{ background: T.bgAlt, borderRadius: 16, padding: '8px 16px', marginTop: 14 }}>
                <Detail label="From" value={short(sum.from)} /><Detail label="To" value={short(sum.to)} />
                {multi && <Detail label="Quantity" value={sum.quantity} />}
                <Detail label="Network" value={sum.network} />
                <Detail label={sum.feeExact ? 'Network fee' : 'Network fee (estimate)'} value={`${fmtRaw(sum.fee, sum.decimals, 8)} ${sum.symbol}`} />
              </div>
              <div style={{ ...subtle, margin: '10px 4px 0' }}>Check the address carefully: NFT transfers can’t be reversed.</div>
              {err && <Notice tone="error">{err}</Notice>}
              <div style={{ marginTop: 16 }}><Btn disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Confirm'}</Btn></div>
            </>
          )}
        </>
      )}
    </Screen>
  );
};

// ---------------------------------------------------------------- import
const nftField = inputStyle;
const NftImportScreen: React.FC<Ctx> = (c) => {
  const nets = ENABLED_CHAINS.filter((n) => n.kind === 'evm');
  const [chainId, setChainId] = useState<string>(c.networkFilter && nets.some((n) => n.id === c.networkFilter) ? c.networkFilter : (nets.find((n) => n.id === 'ethereum') ?? nets[0])?.id ?? '');
  const [contract, setContract] = useState(''); const [tokenId, setTokenId] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const ok = /^0x[0-9a-fA-F]{40}$/.test(contract) && /^\d{1,78}$/.test(tokenId) && !!chainId;
  const add = async () => {
    setBusy(true); setErr('');
    const r = await bg({ type: 'nftAdd', chainId, contract, tokenId }).catch(() => null); setBusy(false);
    if (r?.ok) { notify(); c.nav.pop(); } else setErr(r?.error ? userText(r.error) : 'Could not import this NFT. Try again.');
  };
  const picks: PickNetwork[] = nets.map((n) => ({ key: n.id, id: n.id, name: n.name, sym: n.symbol, testnet: !!(n as any).testnet }));
  return (
    <Screen title="Import NFT" onBack={c.nav.pop} footer={<>
      {err && <div role="alert" data-testid="nft-import-error" style={{ color: T.error, fontSize: 13 }}>{err}</div>}
      <Btn disabled={!ok || busy} onClick={add}>{busy ? 'Importing…' : 'Import NFT'}</Btn>
    </>}>
      <FieldLabel htmlFor="nft-net" first>Network</FieldLabel>
      <NetworkField id="nft-net" testid="nft-import-network" items={picks} value={chainId} onChange={setChainId} />
      <FieldLabel htmlFor="nft-contract">Contract address</FieldLabel>
      <input id="nft-contract" data-testid="nft-import-contract" value={contract} onChange={(e) => setContract(e.target.value.trim())} placeholder="0x…" spellCheck={false} autoComplete="off" aria-invalid={!!contract && !/^0x[0-9a-fA-F]{40}$/.test(contract)} style={{ ...nftField, fontFamily: 'monospace', borderColor: contract && !/^0x[0-9a-fA-F]{40}$/.test(contract) ? T.error : T.border }} />
      {contract && !/^0x[0-9a-fA-F]{40}$/.test(contract) && <div role="alert" style={{ color: T.error, fontSize: 13, marginTop: 6 }}>Enter a valid contract address.</div>}
      <FieldLabel htmlFor="nft-token">Token ID</FieldLabel>
      <input id="nft-token" data-testid="nft-import-token-id" value={tokenId} inputMode="numeric" onChange={(e) => setTokenId(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter' && ok && !busy) void add(); }} placeholder="e.g. 1234" autoComplete="off" style={nftField} />
      <div style={{ ...subtle, marginTop: 12, lineHeight: 1.5 }}>You can find the contract address and token ID under “Blockchain details” on a marketplace. The NFT must be in your wallet’s address on the chosen network.</div>
    </Screen>
  );
};

export const SCREENS_nfts: Record<string, React.FC<Ctx>> = { nftImport: NftImportScreen, nfts: NftsScreen, nftCollection: NftCollectionScreen, nftItem: NftItemScreen, nftHidden: NftHiddenScreen, nftSend: NftSendScreen };
