// Service-worker side of the Harbour backend: keeps the device's tracked addresses in step with the wallet, holds the
// realtime (Centrifugo) connection while a wallet UI is open, and manages Web Push. Only public addresses are sent.
import { local } from '../core/storage';
import { store, actions } from './store';
import { onUiOpenChange } from './kernel/port';
import { refsFor, syncTracked, invalidatePortfolio } from '../core/harbour/data';
import { realtimeToken, vapidKey, putPush, deletePush } from '../core/harbour/client';
import { chainIdOfBackend } from '../core/harbour/config';
import { chainById, explorerTxUrl } from '../core/chains/index';
import { logWarn } from '../core/logger';

const TRACKED_KEY = 'harbour:tracked';
type GetState = () => Promise<any>;

// ---------- address sync ----------
/** Every EVM address of every wallet and account (public vault metadata). */
export function evmAddresses(st: any): string[] {
  const out = new Set<string>();
  for (const w of Object.values<any>(st?.wallets ?? {})) {
    const accts: any[] = Array.isArray(w?.accounts) && w.accounts.length ? w.accounts : [{ addresses: w?.addresses ?? {} }];
    for (const a of accts) { const e = a?.addresses?.ethereum; if (typeof e === 'string' && /^0x[0-9a-fA-F]{40}$/.test(e)) out.add(e.toLowerCase()); }
  }
  return [...out].sort();
}
let syncing: Promise<void> | null = null; let timer: ReturnType<typeof setTimeout> | undefined;
/** Tracks every wallet address on the Harbour networks (and untracks removed ones). Needs the wallet unlocked. */
export function syncAddresses(getState: GetState): Promise<void> {
  syncing ??= (async () => {
    let st: any; try { st = await getState(); } catch { return; } // locked: try again after unlock
    const addrs = evmAddresses(st); const fp = addrs.join(',');
    if ((await local.get<string>(TRACKED_KEY)) === fp) return;
    const r = await syncTracked(addrs.flatMap((a) => refsFor(a)));
    await local.set(TRACKED_KEY, fp);
    if (r.added || r.removed) { invalidatePortfolio(); void reconnectRealtime(); }
  })().catch((e) => logWarn(`harbour address sync failed: ${e?.message ?? e}`)).finally(() => { syncing = null; });
  return syncing;
}
/** Debounced: called after wallet messages (create, import, add account, remove...). */
export const scheduleAddressSync = (getState: GetState): void => { clearTimeout(timer); timer = setTimeout(() => void syncAddresses(getState), 1500); };

// ---------- realtime ----------
let ws: WebSocket | null = null; let uiOpen = false; let retry = 0; let renewTimer: ReturnType<typeof setTimeout> | undefined;
const live = () => (store.getState() as any).live ?? {};
function onPush(channel: string, data: any): void {
  if (channel.startsWith('balances:')) {
    invalidatePortfolio();
    store.dispatch(actions.live.patch({ balanceTick: (live().balanceTick ?? 0) + 1 }));
  } else if (channel.startsWith('tx:') && data && typeof data.tx_hash === 'string') {
    invalidatePortfolio();
    store.dispatch(actions.live.patch({ txTick: (live().txTick ?? 0) + 1, lastTx: { chain: String(data.chain ?? ''), hash: data.tx_hash, status: String(data.status ?? '') } }));
    if (data.status && data.status !== 'pending') void import('./activityRuntime').then((m) => m.reconcilePendingActivity());
  }
}
async function connectRealtime(): Promise<void> {
  if (ws || !uiOpen) return;
  let tok: Awaited<ReturnType<typeof realtimeToken>>;
  try { tok = await realtimeToken(); } catch { return scheduleRetry(); }
  if (!uiOpen || ws) return;
  const sock = new WebSocket(tok.url); ws = sock;
  const send = (m: unknown) => { try { sock.send(JSON.stringify(m)); } catch { /* closing */ } };
  sock.onopen = () => {
    retry = 0; store.dispatch(actions.live.patch({ connected: true }));
    send({ id: 1, connect: { token: tok.token, name: 'harbour-extension' } });
    tok.subscriptions.forEach((s, i) => send({ id: i + 2, subscribe: { channel: s.channel, token: s.token } }));
    clearTimeout(renewTimer); renewTimer = setTimeout(() => void reconnectRealtime(), Math.max(60_000, (tok.expires_at * 1000 - Date.now()) - 120_000));
  };
  sock.onmessage = (ev) => {
    for (const line of String(ev.data).split('\n')) {
      const t = line.trim(); if (!t) continue;
      if (t === '{}') { try { sock.send('{}'); } catch { /* ignore */ } continue; } // ping -> pong
      try { const m = JSON.parse(t); if (m?.push?.pub) onPush(String(m.push.channel ?? ''), m.push.pub.data); } catch { /* not ours */ }
    }
  };
  sock.onclose = () => { if (ws === sock) { ws = null; store.dispatch(actions.live.patch({ connected: false })); scheduleRetry(); } };
  sock.onerror = () => { try { sock.close(); } catch { /* ignore */ } };
}
function scheduleRetry(): void {
  if (!uiOpen) return;
  const ms = Math.min(30_000, 1000 * 2 ** retry++);
  setTimeout(() => void connectRealtime(), ms);
}
/** Reconnects with fresh tokens (new addresses or a new pending transaction need new channel tokens). */
export async function reconnectRealtime(): Promise<void> {
  const old = ws; ws = null; clearTimeout(renewTimer);
  try { old?.close(); } catch { /* ignore */ }
  await connectRealtime();
}
export function wireRealtime(): void {
  onUiOpenChange((open) => {
    uiOpen = open;
    if (open) void connectRealtime();
    else { const old = ws; ws = null; clearTimeout(renewTimer); try { old?.close(); } catch { /* ignore */ } store.dispatch(actions.live.patch({ connected: false })); }
  });
}

// ---------- Web Push ----------
const b64u = (buf: ArrayBuffer | null): string => {
  if (!buf) return ''; let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const pushManager = (): any => (self as any).registration?.pushManager;
/** Subscribes this browser to Web Push and registers it with the API (or removes it). Returns whether push is on. */
export async function syncWebPush(enabled: boolean): Promise<boolean> {
  const pm = pushManager(); if (!pm) return false;
  try {
    let sub = await pm.getSubscription();
    if (!enabled) { if (sub) { await sub.unsubscribe().catch(() => {}); } await deletePush().catch(() => {}); return false; }
    const key = await vapidKey();
    // A subscription made with another server key can't receive our pushes: replace it.
    const current = sub?.options?.applicationServerKey ? b64u(sub.options.applicationServerKey) : '';
    if (sub && current && current !== key) { await sub.unsubscribe().catch(() => {}); sub = null; }
    sub ??= await pm.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
    const j = sub.toJSON();
    await putPush({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
    return true;
  } catch (e: any) { logWarn(`web push setup failed: ${e?.message ?? e}`); return false; }
}
/** Shows pushes from the Harbour notifier ({title, body, data: {chain, tx_hash}}). Push requires a visible notification,
 *  so it is shown with the service worker's own showNotification (clicking opens the explorer). */
export function wirePushEvents(): void {
  const sw = self as any;
  sw.addEventListener('push', (ev: any) => {
    let p: any = {}; try { p = ev.data?.json() ?? {}; } catch { /* not JSON */ }
    const reg = chainIdOfBackend(String(p?.data?.chain ?? ''));
    const hash = String(p?.data?.tx_hash ?? '');
    const url = reg && /^0x[0-9a-f]{64}$/.test(hash) ? explorerTxUrl(chainById(reg), hash) : '';
    invalidatePortfolio();
    store.dispatch(actions.live.patch({ balanceTick: (live().balanceTick ?? 0) + 1 }));
    ev.waitUntil(sw.registration.showNotification(String(p.title ?? 'Harbour').slice(0, 80), {
      body: String(p.body ?? '').slice(0, 200), icon: sw.registration.scope + 'icons/icon128.png', tag: hash || undefined, data: { url },
    }));
  });
  sw.addEventListener('notificationclick', (ev: any) => {
    ev.notification.close();
    const url = ev.notification?.data?.url;
    if (typeof url === 'string' && /^https:\/\//.test(url)) ev.waitUntil(sw.clients.openWindow(url));
  });
}
