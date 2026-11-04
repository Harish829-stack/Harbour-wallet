// Popup transport: one long-lived `harbour-ui` port with request ids and server-pushed state (plan A5). Falls back to sendMessage.
import browser from 'webextension-polyfill';
import { friendlyMessage } from '../core/errors';
import { useSyncExternalStore } from 'react';

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

// Operations the worker guards with a one-shot "manage" re-authentication (PT-04). On AUTH_REQUIRED the popup asks for the password
// (or biometrics) in place and retries once; a cancelled prompt returns the original refusal.
const MANAGE_GUARDED: Record<string, string> = {
  removeWallet: 'remove this wallet', passkeyDisable: 'turn off biometric unlock', setSettings: 'change this security setting',
  providerPrefs: 'turn off biometric approval for sites', providerBlacklistRemove: 'unblock this site',
};
async function guarded(msg: any): Promise<any> {
  const r = await rawBg(msg);
  if (r?.error !== 'AUTH_REQUIRED' || !msg || !MANAGE_GUARDED[msg.type] || typeof document === 'undefined') return r;
  const { promptReauth } = await import('./reauthModal');
  if (!(await promptReauth(rawBg, MANAGE_GUARDED[msg.type]))) return { ok: false, error: 'Cancelled.' };
  return rawBg(msg);
}
export const bg = (msg: any): Promise<any> => guarded(msg).catch((e) => { throw new Error(friendlyMessage(e)); }); // transport failures read as plain sentences
const rawBg = (msg: any): Promise<any> => {
  const p = connect();
  if (!p) return browser.runtime.sendMessage(msg) as Promise<any>;
  return new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    try { p.postMessage({ id, msg }); } catch { waiting.delete(id); resolve(browser.runtime.sendMessage(msg)); }
  });
};

/** Subscribes a component to a worker-store selector (the popup holds a read-only mirror). */
export function useWorkerState<T>(select: (s: Record<string, any>) => T): T {
  connect();
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => select(state));
}
