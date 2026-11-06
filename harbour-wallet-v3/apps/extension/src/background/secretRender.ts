// Paints secrets (recovery-phrase grid, single words, private keys) into PNG images inside the service worker, so the UI only
// ever receives pixels: never a string it could leak through the DOM, the accessibility tree, React state or page memory.
// OffscreenCanvas is available to extension service workers. Theme colours come from the UI and are validated here.
export interface RenderTheme { ink: string; paper: string; line: string; muted: string; scale: number }
export interface RenderedImage { image: string; width: number; height: number }

const DEFAULT_THEME: RenderTheme = { ink: '#111827', paper: '#f3f4f2', line: '#d9dcd8', muted: '#6b7280', scale: 2 };
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s/]+\)|hsla?\([0-9.,%\sdeg/]+\))$/i;
export function sanitizeTheme(t: any): RenderTheme {
  const pick = (v: unknown, fb: string) => (typeof v === 'string' && v.length < 64 && COLOR.test(v.trim()) ? v.trim() : fb);
  const s = Number(t?.scale);
  return { ink: pick(t?.ink, DEFAULT_THEME.ink), paper: pick(t?.paper, DEFAULT_THEME.paper), line: pick(t?.line, DEFAULT_THEME.line), muted: pick(t?.muted, DEFAULT_THEME.muted), scale: Number.isFinite(s) ? Math.min(3, Math.max(1, Math.round(s))) : DEFAULT_THEME.scale };
}

const SANS = '"Harbour Inter", Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

// The popup's Inter font is bundled under a hashed name; the worker loads stable copies from /fonts (best effort).
let fontsReady: Promise<void> | null = null;
function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    const set: any = (self as any).fonts; if (!set || typeof FontFace === 'undefined') return;
    for (const w of ['500', '600']) {
      try { const f = new FontFace('Harbour Inter', `url(${chrome.runtime.getURL(`fonts/inter-latin-${w}-normal.woff2`)})`, { weight: w }); await f.load(); set.add(f); } catch { /* system font fallback */ }
    }
  })();
  return fontsReady;
}

function surface(w: number, h: number, scale: number) {
  if (typeof OffscreenCanvas === 'undefined') throw new Error('RENDER_UNAVAILABLE');
  const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(w * scale)), Math.max(1, Math.ceil(h * scale)));
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('RENDER_UNAVAILABLE');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { canvas, ctx };
}
async function toDataUrl(canvas: OffscreenCanvas): Promise<string> {
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(bin)}`;
}
function box(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); if (typeof (ctx as any).roundRect === 'function') (ctx as any).roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

export const GRID = { width: 360, cellHeight: 44, gap: 8, cols: 3 };
/** Numbered word grid, same layout as the old popup canvas (3 columns, 44 px cells). */
export async function renderPhraseGrid(words: string[], theme: RenderTheme): Promise<RenderedImage> {
  await loadFonts();
  const { cols, gap, cellHeight, width } = GRID;
  const rows = Math.ceil(words.length / cols); const height = rows * cellHeight + (rows - 1) * gap;
  const { canvas, ctx } = surface(width, height, theme.scale);
  const cw = (width - gap * (cols - 1)) / cols;
  for (let i = 0; i < words.length; i++) {
    const x = (i % cols) * (cw + gap), y = Math.floor(i / cols) * (cellHeight + gap);
    box(ctx, x + 0.5, y + 0.5, cw - 1, cellHeight - 1, 10); ctx.fillStyle = theme.paper; ctx.fill(); ctx.strokeStyle = theme.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.font = `500 11px ${SANS}`; ctx.fillStyle = theme.muted; ctx.fillText(String(i + 1), x + 12, y + cellHeight / 2);
    ctx.font = `600 15px ${SANS}`; ctx.fillStyle = theme.ink; ctx.fillText(words[i], x + 34, y + cellHeight / 2 + 1, cw - 42);
  }
  return { image: await toDataUrl(canvas), width, height };
}

/** One word, tightly cropped (the UI draws the chip around it). */
export async function renderWord(word: string, theme: RenderTheme, size = 14): Promise<RenderedImage> {
  await loadFonts();
  const font = `600 ${size}px ${SANS}`; const height = Math.ceil(size * 1.5);
  const probe = surface(1, 1, 1).ctx; probe.font = font;
  const width = Math.ceil(probe.measureText(word).width) + 2;
  const { canvas, ctx } = surface(width, height, theme.scale);
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.fillStyle = theme.ink; ctx.fillText(word, 1, height / 2 + 1);
  return { image: await toDataUrl(canvas), width, height };
}

/** A key as monospace lines of `perLine` characters on a tinted panel. */
export async function renderSecretBlock(text: string, theme: RenderTheme, perLine = 32): Promise<RenderedImage> {
  const lines: string[] = []; for (let i = 0; i < text.length; i += perLine) lines.push(text.slice(i, i + perLine));
  const font = `500 13px ${MONO}`; const pad = 12; const lineHeight = 20;
  const probe = surface(1, 1, 1).ctx; probe.font = font;
  const width = Math.ceil(Math.max(...lines.map((l) => probe.measureText(l).width), 10)) + pad * 2;
  const height = lines.length * lineHeight + pad * 2 - 4;
  const { canvas, ctx } = surface(width, height, theme.scale);
  box(ctx, 0.5, 0.5, width - 1, height - 1, 10); ctx.fillStyle = theme.paper; ctx.fill(); ctx.strokeStyle = theme.line; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = font; ctx.textBaseline = 'top'; ctx.fillStyle = theme.ink;
  lines.forEach((l, i) => ctx.fillText(l, pad, pad + i * lineHeight));
  return { image: await toDataUrl(canvas), width, height };
}
