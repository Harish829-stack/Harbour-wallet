import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { T } from '../theme';
import { Btn, Spinner } from './ui';
import { createQrSyncReader, ONE_TIME_CODE } from '../../core/qrSync';

// Sync with Mobile (TW: Settings > "Sync with Mobile" -> onboarding flow IMPORT_QR, 4 steps) [certain, bundle]:
//   1. a QR with the deep link https://link.trustwallet.com/extension_sync opens the mobile app's export screen;
//   2. the desktop camera reads the phone's animated QR (UR frames);  3. the phone's 6-character one-time code unlocks it;  4. done.
// Harbour imports the seed-phrase wallets exported by the Trust Wallet mobile app. It needs a webcam, so it runs in a full tab.
export const SYNC_LINK = 'https://link.trustwallet.com/extension_sync';
type Step = 'intro' | 'scan' | 'code' | 'done';

export const SyncWithMobile: React.FC<{ bg: (m: any) => Promise<any>; onClose: () => void; onImported?: () => void }> = ({ bg, onClose, onImported }) => {
  const [step, setStep] = useState<Step>('intro');
  const [qr, setQr] = useState(''); const [err, setErr] = useState('');
  const keysRef = useRef<any[] | null>(null);
  const [result, setResult] = useState<{ imported: number; duplicates: number; skipped: number } | null>(null);
  useEffect(() => { void QRCode.toDataURL(SYNC_LINK, { margin: 1, width: 220 }).then(setQr).catch(() => {}); }, []);

  if (step === 'intro') return (
    <div data-testid="sync-intro" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: T.sub }}>Step 1 of 3</div>
      <h2 style={{ margin: '6px 0' }}>Connect to mobile</h2>
      <div style={{ color: T.sub, fontSize: 14 }}>Scan this QR code with your phone camera. After the scan, continue in your Trust Wallet mobile app.</div>
      <div style={{ display: 'inline-block', padding: 12, background: 'var(--hb-on-brand)', border: `1px solid ${T.border}`, borderRadius: 16, margin: '18px 0' }}>{qr ? <img src={qr} width={200} height={200} alt="Sync QR" /> : <Spinner size={28} />}</div>
      <div style={{ color: T.sub, fontSize: 12, marginBottom: 14 }}>Only seed-phrase wallets are imported. Your phone keeps its own copy.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Btn onClick={() => { setErr(''); setStep('scan'); }}>I completed the scan</Btn><Btn variant="ghost" onClick={onClose}>Cancel</Btn></div>
    </div>
  );
  if (step === 'scan') return <Scan onKeys={(k) => { keysRef.current = k; setStep('code'); }} onBack={() => setStep('intro')} />;
  if (step === 'code') return <Code bg={bg} keysRef={keysRef} onBack={() => setStep('scan')} onDone={(r) => { setResult(r); setStep('done'); onImported?.(); }} />;
  return (
    <div data-testid="sync-done" style={{ textAlign: 'center', paddingTop: 30 }}>
      <h2>Wallet synced</h2>
      <div style={{ color: T.sub, fontSize: 14, margin: '8px 0 20px' }}>
        {result!.imported} wallet{result!.imported === 1 ? '' : 's'} imported{result!.duplicates ? `, ${result!.duplicates} already in Harbour` : ''}{result!.skipped ? `, ${result!.skipped} skipped (not a seed phrase)` : ''}.
      </div>
      <Btn onClick={onClose}>Done</Btn>
    </div>
  );
};

const Scan: React.FC<{ onKeys: (k: any[]) => void; onBack: () => void }> = ({ onKeys, onBack }) => {
  const video = useRef<HTMLVideoElement>(null); const [err, setErr] = useState(''); const [pct, setPct] = useState(0); const [denied, setDenied] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let dead = false; let raf = 0; let stream: MediaStream | null = null; let last = 0;
    const reader = createQrSyncReader(); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const stop = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    (async () => {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); }
      catch (e: any) { if (!dead) { setDenied(true); setErr(e?.name === 'NotAllowedError' ? 'Camera access denied. Please enable camera permissions.' : 'Camera is unavailable. Close other apps using it and try again.'); } return; }
      if (dead) { stop(); return; }
      const v = video.current!; v.srcObject = stream; await v.play().catch(() => {});
      const tick = async (t: number) => {
        if (dead) return; raf = requestAnimationFrame(tick);
        if (t - last < 80 || v.readyState < 2 || !v.videoWidth) return; last = t;
        canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (!code?.data) return;
        try {
          const keys = await reader.receive(code.data); setPct(Math.round((reader.progress || 0) * 100));
          if (keys && !dead) { dead = true; stop(); onKeys(keys); }
        } catch { if (!dead) { setErr('Scan failed. Ensure you are scanning the correct QR code. Hold still and try again.'); reader.reset(); } }
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => { dead = true; stop(); };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-testid="sync-scan" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: T.sub }}>Step 2 of 3</div>
      <h2 style={{ margin: '6px 0' }}>Connect to wallet</h2>
      <div style={{ color: T.sub, fontSize: 14 }}>Hold your mobile QR code in front of the computer camera. Hold straight and ensure good lighting.</div>
      <div style={{ position: 'relative', margin: '16px 0', borderRadius: 16, overflow: 'hidden', background: 'var(--hb-scrim)', aspectRatio: '4 / 3' }}>
        <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        {pct > 0 && <div style={{ position: 'absolute', left: 0, bottom: 0, height: 6, width: `${pct}%`, background: T.accent }} />}
      </div>
      {err && <div role="alert" data-testid="sync-scan-error" style={{ color: T.error, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(denied || err) && <Btn onClick={() => { setErr(''); setDenied(false); setAttempt((n) => n + 1); }}>Try again</Btn>}
        <Btn variant="ghost" onClick={onBack}>Back</Btn>
      </div>
    </div>
  );
};

const Code: React.FC<{ bg: (m: any) => Promise<any>; keysRef: React.MutableRefObject<any[] | null>; onBack: () => void; onDone: (r: any) => void }> = ({ bg, keysRef, onBack, onDone }) => {
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async (c: string) => {
    if (busy || !ONE_TIME_CODE.test(c)) return; setBusy(true); setErr('');
    const r = await bg({ type: 'qrSyncImport', storedKeys: keysRef.current, code: c }).catch(() => null);
    setBusy(false);
    if (r?.ok) onDone(r); else { setErr(r?.error === 'INCORRECT_CODE' ? 'Incorrect one-time code. Try again.' : r?.error || 'Import failed'); setCode(''); }
  };
  return (
    <div data-testid="sync-code" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: T.sub }}>Step 3 of 3</div>
      <h2 style={{ margin: '6px 0' }}>Verification required</h2>
      <div style={{ color: T.sub, fontSize: 14 }}>Enter the one-time code from mobile. Tap “Request a one-time code” in your mobile app.</div>
      <input data-testid="sync-code-input" autoFocus value={code} maxLength={6} disabled={busy} spellCheck={false} autoComplete="off" aria-label="One-time code"
        onChange={(e) => { const v = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6); setCode(v); setErr(''); if (v.length === 6) void submit(v); }}
        style={{ width: '100%', margin: '20px 0 8px', padding: 14, textAlign: 'center', letterSpacing: 12, fontSize: 24, fontWeight: 700, borderRadius: 14, border: `2px solid ${err ? T.error : T.border}`, background: T.surface, color: T.text, boxSizing: 'border-box' }} />
      {busy && <div style={{ color: T.sub, fontSize: 13 }}>Verifying…</div>}
      {err && <div role="alert" data-testid="sync-code-error" style={{ color: T.error, fontSize: 13 }}>{err}</div>}
      <div style={{ marginTop: 18 }}><Btn variant="ghost" onClick={onBack}>Back</Btn></div>
    </div>
  );
};
