// "Dumb UI" helpers for secrets (recovery phrase, private key, password, one-time codes).
//  * Secret inputs are UNCONTROLLED: React never gets a `value` prop for them. A controlled input makes React mirror every
//    keystroke into the `value` attribute (and a controlled <textarea> into its text node), which puts the secret in the DOM
//    where selectors, the accessibility tree and any script can read it. The value is read once at submit (`take`), handed to
//    the worker and cleared; components keep only derived flags (filled, valid, strength), never the text.
//  * Secrets the worker shows (phrase, private key) arrive as PNG images painted in the worker (background/secretRender);
//    the popup never receives them as text.
import React, { useEffect, useRef, useState } from 'react';

export type SecretElement = HTMLInputElement | HTMLTextAreaElement;
export function useSecretField<T extends SecretElement = HTMLInputElement>() {
  const ref = useRef<T>(null);
  return {
    ref,
    /** Reads the value and clears the control. Send it to the worker right away and do not keep it. */
    take: (): string => { const el = ref.current; if (!el) return ''; const v = el.value; el.value = ''; return v; },
    /** Reads without clearing (live validation). Do not store the result. */
    peek: (): string => ref.current?.value ?? '',
    clear: (): void => { if (ref.current) ref.current.value = ''; },
  };
}

/** Theme colours for images the worker paints (normalised to hex/rgba through a canvas so any CSS colour works). */
export function readSecretTheme(): { ink: string; paper: string; line: string; muted: string; scale: number } {
  const css = getComputedStyle(document.documentElement);
  const ctx = document.createElement('canvas').getContext('2d');
  const color = (name: string, fallback: string) => {
    const raw = css.getPropertyValue(name).trim() || fallback;
    if (!ctx) return fallback;
    ctx.fillStyle = fallback; ctx.fillStyle = raw; return String(ctx.fillStyle);
  };
  return { ink: color('--hb-ink', '#111827'), paper: color('--hb-paper', '#f3f4f2'), line: color('--hb-line', '#d9dcd8'), muted: color('--hb-muted', '#6b7280'), scale: Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1))) };
}

export interface SecretPicture { image: string; width: number; height: number }
/** A secret painted by the worker. Pixels only: no text node, no accessible name containing the secret, no copy/drag. */
export const SecretImage: React.FC<{ pic: SecretPicture; label: string; testid?: string; style?: React.CSSProperties }> = ({ pic, label, testid, style }) => (
  <img src={pic.image} width={pic.width} height={pic.height} alt={label} data-testid={testid} draggable={false} onContextMenu={(e) => e.preventDefault()}
    style={{ display: 'block', maxWidth: '100%', height: 'auto', userSelect: 'none', WebkitUserSelect: 'none', ...style }} />
);

/** Hide-on-leave hook: calls `hide` when the window loses focus or the page is hidden (screen-share / switching apps), and once on
 *  page hide. Used to re-mask secrets; it never clears what the user typed. */
export function useHideOnLeave(hide: () => void, active = true): void {
  const ref = useRef(hide); ref.current = hide;
  useEffect(() => {
    if (!active) return;
    const h = () => ref.current();
    const vis = () => { if (document.visibilityState === 'hidden') h(); };
    window.addEventListener('blur', h); document.addEventListener('visibilitychange', vis); window.addEventListener('pagehide', h);
    return () => { window.removeEventListener('blur', h); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', h); };
  }, [active]);
}

export const HOLD_TO_REVEAL_MS = 1200;
export const REVEAL_VISIBLE_MS = 60_000;
/** Press-and-hold to reveal a secret (MetaMask-style), so a stray click, a clickjack or a screen-sharing session does not show it
 *  by accident. Once revealed it stays visible for at most `visibleMs`, and is hidden again as soon as the window loses focus or
 *  the page is hidden; revealing again needs another hold. Keyboard: hold Space or Enter. */
export const HoldToReveal: React.FC<{ children: React.ReactNode; placeholder: React.ReactNode; disabled?: boolean; visibleMs?: number; holdMs?: number; label?: string; onReveal?: () => void; testid?: string }> =
  ({ children, placeholder, disabled, visibleMs = REVEAL_VISIBLE_MS, holdMs = HOLD_TO_REVEAL_MS, label = 'Hold to reveal', onReveal, testid }) => {
  const [shown, setShown] = useState(false); const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined); const start = useRef(0);
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = undefined; setProgress(0); };
  const begin = () => {
    if (disabled || shown || timer.current) return;
    start.current = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start.current) / holdMs); setProgress(p);
      if (p >= 1) { stop(); setShown(true); onReveal?.(); }
    }, 30);
  };
  useEffect(() => () => stop(), []);
  useEffect(() => { if (!shown) return; const t = setTimeout(() => setShown(false), visibleMs); return () => clearTimeout(t); }, [shown, visibleMs]);
  useHideOnLeave(() => { stop(); setShown(false); });
  return (
    <div style={{ position: 'relative' }} data-testid={testid}>
      {shown ? children : placeholder}
      {!shown && <button type="button" data-testid="hold-to-reveal" disabled={disabled} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'transparent', border: 0, cursor: disabled ? 'default' : 'pointer', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }} aria-label={`${label}. Press and hold.`}
        onPointerDown={(e) => { e.preventDefault(); begin(); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); } }} onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }} onBlur={stop}>
        <span style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', borderRadius: 14, background: 'var(--hb-scrim, rgba(0,0,0,.6))', color: 'var(--hb-on-brand, #fff)', padding: '10px 18px', fontWeight: 600, textAlign: 'center', maxWidth: '90%' }}>
          <i aria-hidden="true" style={{ position: 'absolute', inset: 0, width: `${Math.round(progress * 100)}%`, background: 'rgba(255,255,255,.22)', transition: 'width 30ms linear' }}/>
          <span style={{ position: 'relative' }}>{progress > 0 ? 'Keep holding…' : label}<small style={{ display: 'block', fontWeight: 400, opacity: .85 }}>Make sure no one is watching and you are not sharing your screen</small></span>
        </span>
      </button>}
    </div>
  );
};
