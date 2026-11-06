import React, { useEffect, useRef } from 'react';

// Hidden-state placeholder for the secret-phrase grid: numbered cells with dots, drawn locally. It never receives words.
// The real phrase is painted by the service worker into an image (background/secretRender) and shown only after the user
// chooses to reveal it, so the popup never holds the phrase as text (no DOM text, attribute, accessible name or JS string).
const W = 360, CELL_H = 44, GAP = 8;

export const SeedPlaceholder: React.FC<{ count: number; cols?: number }> = ({ count, cols = 3 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const n = Math.max(count, 12); const rows = Math.ceil(n / cols); const H = rows * CELL_H + (rows - 1) * GAP;
  useEffect(() => {
    const draw = () => {
      const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
      const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const css = getComputedStyle(document.documentElement); const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
      const fill = v('--hb-paper', '#f3f4f2'), line = v('--hb-line', '#d9dcd8'), ink = v('--hb-ink', '#111'), muted = v('--hb-muted', '#6b7280');
      const cw = (W - GAP * (cols - 1)) / cols;
      for (let i = 0; i < n; i++) {
        const x = (i % cols) * (cw + GAP), y = Math.floor(i / cols) * (CELL_H + GAP);
        ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, cw - 1, CELL_H - 1, 10); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke();
        ctx.textBaseline = 'middle'; ctx.font = '500 11px Inter, system-ui, sans-serif'; ctx.fillStyle = muted; ctx.fillText(String(i + 1), x + 12, y + CELL_H / 2);
        ctx.font = '600 15px Inter, system-ui, sans-serif'; ctx.fillStyle = ink; ctx.fillText('••••••', x + 34, y + CELL_H / 2 + 1, cw - 42);
      }
    };
    draw();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)'); mq?.addEventListener?.('change', draw);
    const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => { mq?.removeEventListener?.('change', draw); mo.disconnect(); };
  }, [cols, n, H]);
  return <canvas ref={ref} data-testid="seed-placeholder" role="img" aria-label="Secret phrase hidden"
    style={{ display: 'block', width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}`, margin: '0 auto', userSelect: 'none' }} />;
};
