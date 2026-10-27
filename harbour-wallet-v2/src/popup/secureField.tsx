// "Dumb UI" helpers for secrets (recovery phrase, private key, password, one-time codes).
//  * Secret inputs are UNCONTROLLED: React never gets a `value` prop for them. A controlled input makes React mirror every
//    keystroke into the `value` attribute (and a controlled <textarea> into its text node), which puts the secret in the DOM
//    where selectors, the accessibility tree and any script can read it. The value is read once at submit (`take`), handed to
//    the worker and cleared; components keep only derived flags (filled, valid, strength), never the text.
//  * Secrets the worker shows (phrase, private key) arrive as PNG images painted in the worker (background/secretRender);
//    the popup never receives them as text.
import React, { useRef } from 'react';

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
