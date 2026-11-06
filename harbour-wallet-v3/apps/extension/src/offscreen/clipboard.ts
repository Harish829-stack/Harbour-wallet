// Offscreen clipboard helper (opened only by background/clipboard.ts). It has no UI and receives text only over its own port
// from the service worker. The text is written through a `copy` event, so it never sits in a DOM node, and is overwritten
// with an empty string after the requested delay.
const port = chrome.runtime.connect({ name: 'harbour-offscreen' });
let timer: ReturnType<typeof setTimeout> | undefined;

function write(text: string): boolean {
  let done = false;
  const onCopy = (e: ClipboardEvent) => { e.clipboardData?.setData('text/plain', text); e.preventDefault(); done = true; };
  document.addEventListener('copy', onCopy);
  try { document.execCommand('copy'); } catch { done = false; } finally { document.removeEventListener('copy', onCopy); }
  return done;
}

port.onMessage.addListener((m: any) => {
  if (m?.op !== 'copy' || typeof m.text !== 'string' || typeof m.id !== 'string') return;
  const ok = write(m.text);
  const delay = Math.min(Math.max(Number(m.clearAfterMs) || 60_000, 5_000), 120_000);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { write(''); try { port.postMessage({ op: 'cleared' }); } catch { /* worker gone */ } }, delay);
  port.postMessage({ op: 'copied', id: m.id, ok });
});
