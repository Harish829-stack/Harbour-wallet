// Long-lived UI port (plan A5): `harbour-ui`. Server pushes a snapshot, then per-slice patches; the UI sends id-tagged requests.
import browser from 'webextension-polyfill';
import { store } from '../store';
import { isInternalWalletSender } from '../accessPolicy';

export type RequestHandler = (msg: any, sender: any) => Promise<any>;
const ports = new Set<browser.Runtime.Port>();
let last: Record<string, unknown> = {};

store.subscribe(() => {
  const now = store.getState() as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(now)) if (now[k] !== last[k]) patch[k] = now[k];
  last = now;
  if (!Object.keys(patch).length) return;
  for (const p of ports) { try { p.postMessage({ kind: 'patch', patch }); } catch { ports.delete(p); } }
});

export function servePort(handle: RequestHandler): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'harbour-ui') return;
    if (!isInternalWalletSender(port.sender as any, browser.runtime.id)) { port.disconnect(); return; }
    ports.add(port);
    last = store.getState() as Record<string, unknown>;
    port.postMessage({ kind: 'snapshot', state: last });
    port.onMessage.addListener(async (m: any) => {
      if (!m || typeof m.id !== 'number') return;
      let result: any;
      try { result = await handle(m.msg, port.sender); } catch (e: any) { result = { ok: false, error: e?.message ?? 'failed' }; }
      try { port.postMessage({ kind: 'response', id: m.id, result }); } catch { /* port closed */ }
    });
    port.onDisconnect.addListener(() => ports.delete(port));
  });
}
