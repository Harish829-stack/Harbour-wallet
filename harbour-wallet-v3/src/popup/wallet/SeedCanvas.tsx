import React, { useEffect, useLayoutEffect, useRef } from 'react';

// Secret-phrase display (matches Trust Wallet, which paints the phrase on a <canvas>). The words are never placed in the DOM as text,
// so they cannot be picked up by page scripts, text selection, accessibility trees or "copy". Until the user chooses to reveal them
// nothing but placeholder dots is painted, so the hidden state does not just blur real words.
const W = 360, CELL_H = 44, GAP = 8, PAD = 0;

export const SeedCanvas: React.FC<{ words: string[]; revealed: boolean; cols?: number }> = ({ words, revealed, cols = 3 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const n = Math.max(words.length, 12); const rows = Math.ceil(n / cols); const H = rows * CELL_H + (rows - 1) * GAP + PAD * 2;
  useEffect(() => {
    const draw = () => {
      const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
      const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const css = getComputedStyle(document.documentElement); const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
      const fill = v('--hb-paper', '#f3f4f2'), line = v('--hb-line', '#d9dcd8'), ink = v('--hb-ink', '#111'), muted = v('--hb-muted', '#6b7280');
      const cw = (W - PAD * 2 - GAP * (cols - 1)) / cols;
      for (let i = 0; i < n; i++) {
        const x = PAD + (i % cols) * (cw + GAP), y = PAD + Math.floor(i / cols) * (CELL_H + GAP);
        ctx.beginPath(); ctx.roundRect(x, y, cw, CELL_H, 10); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke();
        ctx.textBaseline = 'middle'; ctx.font = '500 11px Inter, system-ui, sans-serif'; ctx.fillStyle = muted; ctx.fillText(String(i + 1), x + 12, y + CELL_H / 2);
        ctx.font = '600 15px Inter, system-ui, sans-serif'; ctx.fillStyle = ink;
        ctx.fillText(revealed && words[i] ? words[i] : '••••••', x + 34, y + CELL_H / 2 + 1, cw - 42);
      }
    };
    draw();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)'); mq?.addEventListener?.('change', draw);
    const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => { mq?.removeEventListener?.('change', draw); mo.disconnect(); };
  }, [words, revealed, cols, n, H]);
  return <canvas ref={ref} data-testid="seed-canvas" role="img" aria-label={revealed ? 'Secret phrase shown on screen' : 'Secret phrase hidden'} onContextMenu={(e) => e.preventDefault()}
    style={{ display: 'block', width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}`, margin: '0 auto', userSelect: 'none' }} />;
};

/** One secret-phrase word painted on its own <canvas> (used by the backup "verify" step for the shuffled chips and the picked slots),
 *  so even there no word is ever a DOM text node, attribute or accessible name. Callers must label the surrounding control by position,
 *  never by word. */
export const SecretWord: React.FC<{ word?: string; size?: number; weight?: number }> = ({ word = '', size = 14, weight = 600 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const H = Math.ceil(size * 1.5);
  useLayoutEffect(() => {
    const draw = () => {
      const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
      const font = `${weight} ${size}px Inter, system-ui, sans-serif`; ctx.font = font;
      const tw = word ? Math.ceil(ctx.measureText(word).width) + 2 : 0; const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      c.width = Math.max(tw, 1) * dpr; c.height = H * dpr; c.style.width = `${tw}px`; c.style.height = `${H}px`;
      if (!word) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = font; ctx.textBaseline = 'middle';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--hb-ink').trim() || '#111'; ctx.fillText(word, 1, H / 2 + 1);
    };
    draw();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)'); mq?.addEventListener?.('change', draw);
    const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => { mq?.removeEventListener?.('change', draw); mo.disconnect(); };
  }, [word, size, weight, H]);
  return <canvas ref={ref} aria-hidden="true" onContextMenu={(e) => e.preventDefault()} style={{ display: 'inline-block', verticalAlign: 'middle', userSelect: 'none', pointerEvents: 'none' }} />;
};
