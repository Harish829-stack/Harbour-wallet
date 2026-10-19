import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { T } from '../../theme';
import { Screen, Coin, Row, Empty, Skeleton, Btn } from '../ui';
import type { Ctx } from '../screens';
import { allAssets, assetOf } from '../data';
import { useTokenItems } from '../tokensStore';
import { chainOfAsset } from './lib';
import { SearchBox } from './select';
import { CopyBtn, Notice } from './parts';
import { addressFor } from '../../../core/chains/adapters';
import { chainById } from '../../../core/chains/index';
import { receiveNote } from '../../../core/sendService';
import { networkByChainId } from '../../../core/customTokens';
import type { Asset } from '../data';

const STANDARD: Record<string, string> = { smartchain: 'BEP-20', tron: 'TRC-20', solana: 'SPL', polygon: 'ERC-20' };
const addrFor = (c: Ctx, a: Asset) => { const ch = chainOfAsset(a); if (!ch) return ''; return addressFor(ch, c.addrs) || (ch.kind === 'evm' ? c.addrs.ethereum ?? '' : ''); };

/** `/receive`: searchable list of every network (and token) in the registry. */
export const ReceiveSelect: React.FC<Ctx> = (c) => {
  useTokenItems(); const [q, setQ] = useState('');
  const hidden = new Set(c.hiddenAssets ?? []);
  const rows = useMemo(() => { const t = q.trim().toLowerCase(); return allAssets().filter((a) => !hidden.has(a.id) || !a.token).filter((a) => !t || a.name.toLowerCase().includes(t) || a.sym.toLowerCase().includes(t)); }, [q, c.hiddenAssets]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen title="Receive" onBack={c.nav.pop}>
      <SearchBox value={q} onChange={setQ} placeholder="Search" />
      {rows.length === 0 ? <Empty title="No results" sub="Try a different network or asset name." icon="search" />
        : rows.map((a) => <Row key={a.id} onClick={() => (a.token ? c.nav.push('receiveAsset', { assetId: a.id }) : c.nav.push('receiveChain', { blockchainId: chainOfAsset(a)?.id ?? a.id }))}
          left={<Coin sym={a.sym} assetId={a.id} color={a.color} />} title={a.name} sub={a.id === 'sepolia' ? 'Testnet' : a.token ? `${a.sym} · ${networkByChainId(a.chainId)?.name ?? ''}` : a.sym} />)}
    </Screen>
  );
};

/** QR + copy + share + TW warning for one asset. */
export const ReceiveView: React.FC<{ c: Ctx; a: Asset }> = ({ c, a }) => {
  const addr = addrFor(c, a); const chain = chainOfAsset(a); const [qr, setQr] = useState(''); const [qrErr, setQrErr] = useState(false); const [shared, setShared] = useState('');
  useEffect(() => { setQr(''); setQrErr(false); if (addr) QRCode.toDataURL(addr, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQrErr(true)); }, [addr]);
  const type = a.token ? STANDARD[chain?.id ?? ''] ?? (chain?.kind === 'evm' ? 'ERC-20' : 'token') : a.sym;
  const note = chain ? receiveNote(chain) : null;
  const share = async () => { try { if (navigator.share) await navigator.share({ text: addr }); else { await navigator.clipboard.writeText(addr); setShared('Address copied'); setTimeout(() => setShared(''), 1600); } } catch { /* user cancelled */ } };
  if (!addr) return <Screen title={`Receive ${a.sym}`} onBack={c.nav.pop}><Empty title="No address for this network" sub={`The active account does not have a ${chain?.name ?? a.name} address yet. Switch accounts or refresh and try again.`} icon="receive" /></Screen>;
  return (
    <Screen title={`Receive ${a.sym}`} onBack={c.nav.pop}>
      <div style={{ textAlign: 'center', paddingTop: 8 }} className="hb-rise">
        <Coin sym={a.sym} assetId={a.id} size={44} color={a.color} />
        <div style={{ fontWeight: 700, marginTop: 8 }}>{a.name}</div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 16 }}>{a.token ? `${a.sym} on ${chain?.name ?? ''}` : chain?.name ?? a.name}</div>
        <div style={{ display: 'inline-block', padding: 12, background: 'var(--hb-on-brand)', border: `1px solid ${T.border}`, borderRadius: 16 }}>
          {qr ? <img src={qr} width={200} height={200} alt={`QR code of your ${a.name} address`} data-testid="receive-qr" /> : qrErr ? <div style={{ width: 200, height: 200, display: 'grid', placeItems: 'center', color: T.error, fontSize: 13 }}>QR code could not be drawn. Copy the address below.</div> : <Skeleton w={200} h={200} r={12} />}
        </div>
        <div data-testid="receive-address" style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13, margin: '16px 8px 0' }}>{addr}</div>
        <Notice kind="warning" testid="receive-warning">{`Only send ${a.name} (${type}) assets to this address. Other assets will be lost forever.`}</Notice>
        {note && <Notice kind="info">{note}</Notice>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Btn variant="ghost" onClick={() => void share()}>{shared || 'Share'}</Btn>
          <CopyBtn text={addr} />
        </div>
      </div>
    </Screen>
  );
};
export const ReceiveChain: React.FC<Ctx> = (c) => {
  const ch = chainById(c.params?.blockchainId); const a = (ch && assetOf(ch.id)) || allAssets().find((x) => !x.token && chainOfAsset(x)?.id === c.params?.blockchainId);
  return a ? <ReceiveView c={c} a={a} /> : <Screen title="Receive" onBack={c.nav.pop}><Empty title="Network not found" sub="Pick a network from the Receive list." icon="receive" /></Screen>;
};
export const ReceiveAsset: React.FC<Ctx> = (c) => { useTokenItems(); const a = assetOf(c.params?.assetId ?? ''); return a ? <ReceiveView c={c} a={a} /> : <Screen title="Receive" onBack={c.nav.pop}><Empty title="Asset not found" sub="Pick an asset from the Receive list." icon="receive" /></Screen>; };
/** Entry used by existing callers: `receive` without params lists networks, with `assetId` jumps straight to the QR. */
export const ReceiveScreen: React.FC<Ctx> = (c) => (c.params?.assetId ? <ReceiveAsset {...c} /> : <ReceiveSelect {...c} />);
