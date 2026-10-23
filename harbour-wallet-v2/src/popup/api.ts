// Popup transport: one long-lived `harbour-ui` port with request ids and server-pushed state (plan A5). Falls back to sendMessage.
import browser from 'webextension-polyfill';
import { friendlyMessage } from '../core/errors';

let port: browser.Runtime.Port | null = null;
let seq = 0;
const waiting = new Map<number, (v: any) => void>();
let state: Record<string, any> = {};
const subs = new Set<() => void>();

function connect(): browser.Runtime.Port | null {
  if (port) return port;
  try {
    const p = browser.runtime.connect({ name: 'harbour-ui' });
    p.onMessage.addListener((m: any) => {
      if (m.kind === 'snapshot') state = m.state;
      else if (m.kind === 'patch') state = { ...state, ...m.patch };
      else if (m.kind === 'response') { waiting.get(m.id)?.(m.result); waiting.delete(m.id); return; }
      subs.forEach((f) => f());
    });
    p.onDisconnect.addListener(() => {
      port = null;
      for (const [, r] of waiting) r({ ok: false, error: 'DISCONNECTED' });
      waiting.clear();
    });
    port = p;
  } catch { port = null; }
  return port;
}

export const bg = (msg: any): Promise<any> => rawBg(msg).catch((e) => { throw new Error(friendlyMessage(e)); }); // transport failures read as plain sentences
const rawBg = (msg: any): Promise<any> => {
  const p = connect();
  if (!p) return browser.runtime.sendMessage(msg) as Promise<any>;
  return new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    try { p.postMessage({ id, msg }); } catch { waiting.delete(id); resolve(browser.runtime.sendMessage(msg)); }
  });
};

