// Camera QR scanner shared by onboarding (import with QR) and Settings > Sync with Mobile.
// Evidence: chunks/import-qr `ImportWithQr` / `ScannerBox` - camera permission check/request, denied + in-use messages, 80 ms scan loop,
// every media track stopped on cleanup, UR multi-frame decode (core/qrSync.ts) with a "scan again" reset on a bad frame.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera } from 'lucide-react';
import { createQrSyncReader } from '../../core/qrSync';
import { CAMERA_MESSAGES, QR_PARSE_ERROR, QR_SCAN_INTERVAL_MS, cameraErrorKind, type CameraError } from '../../core/onboardingRules';

type Perm = 'checking' | 'granted' | 'denied';
export type StoredKeys = Awaited<ReturnType<ReturnType<typeof createQrSyncReader>['receive']>>;

/** Asks the browser for camera permission (stops the probe stream right away). */
export async function requestCamera(): Promise<{ ok: true } | { ok: false; kind: CameraError }> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return { ok: false, kind: 'unsupported' };
    const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); return { ok: true };
  } catch (e) { return { ok: false, kind: cameraErrorKind(e) }; }
}

export const QrScanner: React.FC<{ onKeys: (keys: NonNullable<StoredKeys>) => void }> = ({ onKeys }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [perm, setPerm] = useState<Perm>('checking'); const [kind, setKind] = useState<CameraError | null>(null);
  const [err, setErr] = useState(''); const [pct, setPct] = useState(0); const [seen, setSeen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reader = useRef(createQrSyncReader()); const done = useRef(false);

  const ask = useCallback(async () => {
    setPerm('checking'); setKind(null);
    const r = await requestCamera();
    if (r.ok) setPerm('granted'); else { setKind(r.kind); setPerm('denied'); }
  }, []);
  // Permission: use the Permissions API when present (so "prompt" asks, "granted" skips the prompt, "denied" explains how to fix it).
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const st = await (navigator as any).permissions?.query({ name: 'camera' });
        if (dead) return;
        if (st?.state === 'granted') { setPerm('granted'); return; }
        if (st?.state === 'denied') { setKind('denied'); setPerm('denied'); return; }
      } catch { /* Permissions API unavailable for camera: fall through to a direct request */ }
      if (!dead) await ask();
    })();
    return () => { dead = true; };
  }, [ask]);

  useEffect(() => {
    if (perm !== 'granted') return;
    let dead = false; let timer: ReturnType<typeof setInterval> | undefined; let stream: MediaStream | null = null;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
    reader.current.reset(); done.current = false;
    const stop = () => { if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); stream = null; if (video.current) video.current.srcObject = null; };
    (async () => {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); }
      catch (e) { if (!dead) { setKind(cameraErrorKind(e)); setPerm('denied'); } return; }
      if (dead) { stop(); return; }
      const v = video.current; if (!v || !ctx) { stop(); return; }
      v.srcObject = stream; await v.play().catch(() => {});
      let busy = false;
      timer = setInterval(async () => {
        if (dead || busy || done.current || v.readyState < 2 || !v.videoWidth) return;
        busy = true;
        try {
          canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (!code?.data) return;
          setSeen(true);
          try {
            const keys = await reader.current.receive(code.data); setPct(Math.round((reader.current.progress || 0) * 100));
            if (keys && !done.current) { done.current = true; stop(); onKeys(keys); }
          } catch { if (!dead && !done.current) { setErr(QR_PARSE_ERROR); setSeen(false); } }
        } finally { busy = false; }
      }, QR_SCAN_INTERVAL_MS);
    })();
    return () => { dead = true; stop(); };
  }, [perm, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const again = () => { reader.current.reset(); setErr(''); setPct(0); setSeen(false); setAttempt((n) => n + 1); };
  if (perm === 'checking') return <div className="ob-camera-state" role="status"><span className="ob-spin" aria-hidden="true"/><p className="ob-muted">Checking camera access…</p></div>;
  if (perm === 'denied') return (
    <div className="ob-camera-state" data-testid="qr-camera-denied">
      <Camera size={32} aria-hidden="true"/>
      <p role="alert">{CAMERA_MESSAGES[kind ?? 'denied']}</p>
      {kind === 'denied' && <p className="ob-muted">Allow the camera for this page in the address bar, then try again.</p>}
      <button type="button" className="ob-primary ob-half" onClick={() => { setErr(''); void ask(); }}>Request Camera Access</button>
    </div>
  );
  return (
    <div className="ob-qr-scan" data-testid="qr-scanner">
      {err && <div className="ob-notice err" role="alert" data-testid="qr-scan-error"><div>{err}<br/><button type="button" className="ob-link" onClick={again}>Please scan again here</button></div></div>}
      <p style={{ margin: '12px 0' }}>{seen ? 'Scanning... Almost there...' : 'Hold straight and ensure good lighting'}</p>
      <div className="ob-scanner"><video ref={video} muted playsInline aria-label="Camera preview"/><div className="ob-scanner-frame" aria-hidden="true"/>{pct > 0 && <div className="ob-scanner-bar" style={{ width: `${pct}%` }}/>}</div>
    </div>
  );
};
