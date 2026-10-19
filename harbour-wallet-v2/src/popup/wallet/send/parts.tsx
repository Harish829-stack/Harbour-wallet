import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { T } from '../../theme';
import { Sheet, Row, Btn, Spinner, Ic, ICON } from '../ui';
import { requestCamera } from '../../onboarding/qrScanner';
import { CAMERA_MESSAGES, QR_SCAN_INTERVAL_MS, type CameraError } from '../../../core/onboardingRules';
import { parsePaymentUri, type PaymentRequest } from '../../../core/sendService';
import { TIER_LABEL, copyText, fmtAmount, tiersDiffer, type WireQuote } from './lib';
import type { FeeTierId } from '../../../core/chains/send/types';
import { money } from '../../settingsStore';

/** TW-style inline notice (design-system classes, no raw colours). */
export const Notice: React.FC<{ kind?: 'info' | 'warning' | 'error'; children: React.ReactNode; testid?: string }> = ({ kind = 'info', children, testid }) => (
  <div className={`hb-notice ${kind === 'info' ? '' : kind}`} role={kind === 'error' ? 'alert' : 'status'} data-testid={testid} style={{ marginTop: 12 }}>{children}</div>
);

export const CopyBtn: React.FC<{ text: string; label?: string; copiedLabel?: string; ghost?: boolean }> = ({ text, label = 'Copy', copiedLabel = 'Address copied', ghost }) => {
  const [done, setDone] = useState(false);
  return <Btn variant={ghost ? 'ghost' : 'primary'} onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1600); } }}>{done ? copiedLabel : label}</Btn>;
};

/** Camera QR scanner for recipient addresses, with an image-upload fallback (extension popups often cannot show the camera prompt). */
export const AddressScanner: React.FC<{ onResult: (r: PaymentRequest) => void; onClose: () => void; onRaw?: (text: string) => void }> = ({ onResult: onPayment, onClose, onRaw }) => {
  // `onRaw` receives the QR text untouched (WalletConnect links must not be parsed as payment URIs).
  const onResult = onRaw ? (_r: PaymentRequest, text?: string) => onRaw(text ?? '') : onPayment;
  const video = useRef<HTMLVideoElement>(null); const [state, setState] = useState<'starting' | 'live' | 'denied'>('starting'); const [kind, setKind] = useState<CameraError>('denied'); const [err, setErr] = useState('');
  useEffect(() => {
    let dead = false; let stream: MediaStream | null = null; let timer: ReturnType<typeof setInterval> | undefined;
    const canvas = document.createElement('canvas'); const g = canvas.getContext('2d', { willReadFrequently: true });
    const stop = () => { if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); stream = null; };
    (async () => {
      const perm = await requestCamera(); if (dead) return; if (!perm.ok) { setKind(perm.kind); setState('denied'); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch { if (!dead) setState('denied'); return; }
      if (dead) { stop(); return; }
      const v = video.current; if (!v || !g) { stop(); return; } v.srcObject = stream; await v.play().catch(() => {}); setState('live');
      timer = setInterval(() => {
        if (v.readyState < 2 || !v.videoWidth) return; canvas.width = v.videoWidth; canvas.height = v.videoHeight; g.drawImage(v, 0, 0);
        const img = g.getImageData(0, 0, canvas.width, canvas.height); const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) { stop(); (onResult as any)(parsePaymentUri(code.data), code.data); }
      }, QR_SCAN_INTERVAL_MS);
    })();
    return () => { dead = true; stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fromFile = (f?: File) => {
    if (!f) return; const url = URL.createObjectURL(f); const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d')!; x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height); const code = jsQR(d.data, d.width, d.height); URL.revokeObjectURL(url); if (code?.data) (onResult as any)(parsePaymentUri(code.data), code.data); else setErr('No QR code found in this image.'); };
    im.onerror = () => { URL.revokeObjectURL(url); setErr('Could not read this image.'); }; im.src = url;
  };
  return (
    <Sheet title="Scan QR code" onClose={onClose}>
      {state === 'denied' ? <Notice kind="warning">{CAMERA_MESSAGES[kind] ?? CAMERA_MESSAGES.denied} You can still choose a picture of the QR code below.</Notice>
        : <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: T.bgAlt, minHeight: 220, display: 'grid', placeItems: 'center' }}>
          <video ref={video} muted playsInline aria-label="Camera preview" style={{ width: '100%', display: state === 'live' ? 'block' : 'none' }} />
          {state === 'starting' && <Spinner size={28} />}
        </div>}
      {err && <Notice kind="error">{err}</Notice>}
      <label className="hb-tap" style={{ display: 'block', textAlign: 'center', marginTop: 14, padding: '13px 16px', border: `1px solid ${T.border}`, borderRadius: 999, fontWeight: 700, cursor: 'pointer' }}>
        Choose image<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => fromFile(e.target.files?.[0])} />
      </label>
    </Sheet>
  );
};

export interface Contact { id: string; name: string; addresses: Record<string, string> }
/** Address book picker filtered to the contacts that have an address for this chain (TW: address-book-modal reused by the Send flow). */
export const ContactsSheet: React.FC<{ contacts: Contact[]; ct: string; evm: boolean; onPick: (c: Contact, address: string) => void; onClose: () => void }> = ({ contacts, ct, evm, onPick, onClose }) => {
  const rows = contacts.map((c) => ({ c, address: c.addresses[ct] ?? (evm ? c.addresses.ethereum : undefined) })).filter((r): r is { c: Contact; address: string } => !!r.address);
  return (
    <Sheet title="Address Book" onClose={onClose}>
      {rows.length === 0 ? <div style={{ color: T.sub, fontSize: 13, padding: '16px 0' }}>No saved addresses for this network yet. Add contacts in Settings › Address Book.</div>
        : rows.map(({ c, address }) => <Row key={c.id} onClick={() => onPick(c, address)} left={<span style={{ width: 36, height: 36, borderRadius: '50%', background: T.accentSoft, color: T.accent, display: 'inline-grid', placeItems: 'center', fontWeight: 700 }}>{c.name.slice(0, 1).toUpperCase()}</span>} title={c.name} sub={`${address.slice(0, 10)}…${address.slice(-6)}`} />)}
    </Sheet>
  );
};

/** Slow / Average / Fast picker with fee per tier (TW: edit-network-fee-button -> edit-fee modal). */
export const FeeSheet: React.FC<{ quote: WireQuote; tier: FeeTierId; fiatOf?: (rawFee: string) => string | undefined; onPick: (t: FeeTierId) => void; onClose: () => void }> = ({ quote, tier, fiatOf, onPick, onClose }) => (
  <Sheet title="Network fee" onClose={onClose}>
    {quote.tiers.map((t) => (
      <Row key={t.id} onClick={() => { onPick(t.id); onClose(); }} left={<span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${t.id === tier ? T.accent : T.border}`, background: t.id === tier ? T.accent : 'transparent' }} />}
        title={TIER_LABEL[t.id]} sub={t.detail} right={`${fmtAmount(t.fee, quote.feeDecimals, 8)} ${quote.feeSymbol}`} rightSub={fiatOf?.(t.fee)} />
    ))}
    <div style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>Estimated fee. The network decides the final amount; any unused part is not charged.</div>
  </Sheet>
);

/** One-line fee row with Edit affordance (only when the chain has real tiers). */
export const FeeRow: React.FC<{ quote: WireQuote | null | undefined; tier: FeeTierId; loading?: boolean; fiat?: string; onEdit?: () => void }> = ({ quote, tier, loading, fiat, onEdit }) => {
  const t = quote?.tiers.find((x) => x.id === tier) ?? quote?.tiers[1];
  const warn = quote?.issues.some((i) => i.code === 'insufficient-fee' || i.code === 'low-gas');
  return (
    <div data-testid="send-fee-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 0' }}>
      <span style={{ color: warn ? T.error : T.sub }}>Estimated network fee</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
        {loading && !t ? <Spinner size={14} /> : t ? <span data-testid="send-fee"><span>{fmtAmount(t.fee, quote!.feeDecimals, 8)} {quote!.feeSymbol}</span>{fiat && <span style={{ color: T.sub, fontWeight: 400 }}> · {fiat}</span>}</span> : <span style={{ color: T.sub }}>—</span>}
        {onEdit && tiersDiffer(quote) && <button className="hb-tap" onClick={onEdit} data-testid="edit-network-fee-button" aria-label="Edit network fee" style={{ border: 'none', background: T.accentSoft, color: T.accent, borderRadius: 999, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' }}>{TIER_LABEL[tier]}</button>}
      </span>
    </div>
  );
};
export { Ic, ICON, money };
