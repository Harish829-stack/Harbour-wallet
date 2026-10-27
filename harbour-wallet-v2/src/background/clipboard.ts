// Copies a secret (an imported private key) to the system clipboard without handing it to any UI page. The worker opens a
// background-owned offscreen document (reason CLIPBOARD) and talks to it over a dedicated port (point-to-point, so no other
// extension page receives the text). The document writes the text through a `copy` event and overwrites it after
// `clearAfterMs`; that timer lives in the document, so it still fires if the service worker is stopped in the meantime.
const DOC = 'src/offscreen/clipboard.html';
const PORT = 'harbour-offscreen';
let port: chrome.runtime.Port | null = null;
let onPort: (() => void) | null = null;
const waiting = new Map<string, (ok: boolean) => void>();

try {
  chrome.runtime.onConnect.addListener((p) => {
    if (p.name !== PORT) return;
    if (p.sender?.url !== chrome.runtime.getURL(DOC)) { p.disconnect(); return; }
    port = p;
    p.onMessage.addListener((m: any) => {
      if (m?.op === 'copied' && typeof m.id === 'string') { waiting.get(m.id)?.(m.ok === true); waiting.delete(m.id); }
      if (m?.op === 'cleared') void chrome.offscreen?.closeDocument().catch(() => {});
    });
    p.onDisconnect.addListener(() => { if (port === p) port = null; });
    onPort?.(); onPort = null;
  });
} catch { /* not running as an extension (tests) */ }

async function hasDocument(): Promise<boolean> {
  const contexts = await (chrome.runtime as any).getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).catch(() => null);
  if (Array.isArray(contexts)) return contexts.length > 0;
  return !!(await (chrome.offscreen as any)?.hasDocument?.().catch(() => false));
}

async function ensurePort(): Promise<chrome.runtime.Port> {
  if (port) return port;
  if (!chrome.offscreen) throw new Error('COPY_UNAVAILABLE');
  if (await hasDocument()) await chrome.offscreen.closeDocument().catch(() => {}); // left from a previous worker; its port is gone
  const connected = new Promise<void>((resolve, reject) => { onPort = resolve; setTimeout(() => reject(new Error('COPY_FAILED')), 5000); });
  await chrome.offscreen.createDocument({ url: DOC, reasons: ['CLIPBOARD' as chrome.offscreen.Reason], justification: 'Copy a private key the user asked to copy, then clear the clipboard.' });
  await connected;
  if (!port) throw new Error('COPY_FAILED');
  return port;
}

export async function copySecretToClipboard(text: string, clearAfterMs: number): Promise<void> {
  const p = await ensurePort();
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const ok = await new Promise<boolean>((resolve) => {
    waiting.set(id, resolve);
    setTimeout(() => { if (waiting.delete(id)) resolve(false); }, 5000);
    p.postMessage({ op: 'copy', id, text, clearAfterMs });
  });
  if (!ok) throw new Error('COPY_FAILED');
}
