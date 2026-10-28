// Notifications (TW: gcm push + topic preferences). Two delivery paths, both governed by Settings > Notifications:
//   1. Remote push (when built with VITE_HB_FCM_SENDER_ID and a gateway): chrome.instanceID FCM token registered with
//      harbour-gateway `/push/register`; the gateway's cron watches the addresses and sends FCM messages, shown here.
//   2. Local watcher (always available, no server): a 5-minute alarm reads recent history for the active account's main
//      chains and notifies new incoming transfers. It stands down while remote push is registered.
// Product announcements from the signed remote config are notified once each when that topic is on.
import browser from 'webextension-polyfill';
import { local } from '../core/storage';
import { chainById, explorerTxUrl, ENABLED_CHAIN_IDS } from '../core/chains/index';
import { isHarbourChain } from '../core/harbour/config';
import { fetchActivity } from '../core/activity/index';
import { syncWebPush } from './harbour';
import { fetchHistory, historySupportedFor } from '../core/txHistory';
import { newIncoming } from '../core/notifyRules';
import { solanaRpcUrl } from '../core/rpc';
import { GATEWAY_URL } from '../kit/endpoints';
import { getDeviceId } from '../kit/gateway';
import { loadSettings } from './settingsService';

export const ACTIVITY_ALARM = 'harbour:activity';
const SEEN_KEY = 'wallet:notify:seen';
const ANN_KEY = 'wallet:notify:announcements';
const REMOTE_KEY = 'wallet:notify:remote';
const LINKS_KEY = 'wallet:notify:links';
// Harbour v3: the backend-served networks (pushed by the Harbour notifier; the local watcher is the fallback).
export const WATCH_CHAINS: string[] = [...ENABLED_CHAIN_IDS];
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;
export const FCM_SENDER_ID = env.VITE_HB_FCM_SENDER_ID ?? '';

type Prefs = { isPushEnabled: boolean; isSendAndReceiveEnabled: boolean; topics: Record<string, boolean> };
const prefs = async (): Promise<Prefs> => (await loadSettings()).pushNotifications as Prefs;
const activityOn = (p: Prefs) => p.isPushEnabled && p.isSendAndReceiveEnabled;

/** Active account's public addresses for the watched chains (vault metadata only, works while locked). */
export async function watchedAddresses(getState: () => Promise<any>): Promise<Array<{ chainId: string; address: string }>> {
  const st = await getState();
  const id = st?.activeWalletId && st.wallets?.[st.activeWalletId] ? st.activeWalletId : Object.keys(st?.wallets ?? {})[0];
  const w = id ? st.wallets[id] : null; if (!w) return [];
  const accounts: any[] = Array.isArray(w.accounts) && w.accounts.length ? w.accounts : [{ addresses: w.addresses ?? {} }];
  const a = accounts[typeof w.activeAccount === 'number' && accounts[w.activeAccount] ? w.activeAccount : 0]?.addresses ?? {};
  return WATCH_CHAINS.map((chainId) => { const c = chainById(chainId); const address = c ? (a[c.ct] ?? (c.kind === 'evm' ? a.ethereum : '')) : ''; return { chainId, address }; })
    .filter((x) => x.address && (isHarbourChain(x.chainId) || historySupportedFor(chainById(x.chainId))));
}

export async function showNotification(title: string, message: string, url?: string): Promise<void> {
  const id = `hb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await browser.notifications.create(id, { type: 'basic', iconUrl: browser.runtime.getURL('icons/icon128.png'), title: title.slice(0, 80), message: message.slice(0, 200) });
    if (url && /^https:\/\//.test(url)) { const links = (await local.get<Record<string, string>>(LINKS_KEY)) ?? {}; links[id] = url; const keys = Object.keys(links); for (const k of keys.slice(0, Math.max(0, keys.length - 30))) delete links[k]; await local.set(LINKS_KEY, links); }
  } catch { /* notifications permission missing or OS blocked */ }
}

export async function pollActivity(getState: () => Promise<any>, f: typeof fetch = fetch): Promise<number> {
  const p = await prefs(); if (!activityOn(p)) return 0;
  if (await local.get<boolean>(REMOTE_KEY)) return 0; // the gateway pushes instead
  const seenAll = (await local.get<Record<string, string[]>>(SEEN_KEY)) ?? {};
  let shown = 0;
  for (const { chainId, address } of await watchedAddresses(getState)) {
    const key = `${chainId}:${address}`;
    const r = await (isHarbourChain(chainId) ? fetchActivity(chainId, address) : fetchHistory(chainId, address, { solanaRpc: solanaRpcUrl() }, f)).catch(() => null);
    if (!r || !r.ok) continue;
    const { fresh, seen } = newIncoming(r.items.slice(0, 25), seenAll[key]); seenAll[key] = seen;
    for (const it of fresh.slice(0, 3 - shown)) {
      const c = chainById(chainId);
      await showNotification(`Received ${it.amount ? `${it.amount} ` : ''}${it.symbol}`, `On ${c?.name ?? chainId}${it.counterparty ? ` from ${it.counterparty.slice(0, 8)}…${it.counterparty.slice(-4)}` : ''}`, it.url ?? explorerTxUrl(c, it.id));
      shown++;
    }
    if (shown >= 3) break;
  }
  await local.set(SEEN_KEY, seenAll);
  return shown;
}

/** Announcements from the signed remote config: each new id is notified once (the first sync only records them). */
export async function notifyAnnouncements(list: Array<{ id: string; title: string; body: string; url?: string }>): Promise<void> {
  const p = await prefs(); const seen = await local.get<string[]>(ANN_KEY);
  const ids = list.map((a) => a.id);
  if (seen && p.isPushEnabled && p.topics.product_announcement !== false) for (const a of list.filter((x) => !seen.includes(x.id)).slice(0, 2)) await showNotification(a.title, a.body, a.url);
  await local.set(ANN_KEY, [...ids, ...(seen ?? [])].slice(0, 100));
}

/** Register (or drop) this browser for Web Push with the Harbour API (the notifier pushes incoming transfers and settled
 *  sends for every tracked address). Falls back to the gateway's FCM path only when that is configured instead. */
export async function syncRemotePush(getState: () => Promise<any>, f: typeof fetch = fetch): Promise<boolean> {
  const p = await prefs();
  const ok = await syncWebPush(activityOn(p));
  if (ok || !FCM_SENDER_ID || !GATEWAY_URL) { await local.set(REMOTE_KEY, ok); return ok; }
  return syncGatewayPush(getState, f);
}
async function syncGatewayPush(getState: () => Promise<any>, f: typeof fetch): Promise<boolean> {
  const iid = (globalThis as any).chrome?.instanceID;
  const p = await prefs();
  if (!FCM_SENDER_ID || !GATEWAY_URL || !iid?.getToken) { await local.set(REMOTE_KEY, false); return false; }
  try {
    const token: string = await iid.getToken({ authorizedEntity: FCM_SENDER_ID, scope: 'FCM' });
    const device = await getDeviceId();
    if (!p.isPushEnabled) { await f(`${GATEWAY_URL}/push/unregister`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hb-device-id': device }, body: JSON.stringify({ token }) }).catch(() => null); await local.set(REMOTE_KEY, false); return false; }
    const addresses = activityOn(p) ? await watchedAddresses(getState) : [];
    const r = await f(`${GATEWAY_URL}/push/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hb-device-id': device }, body: JSON.stringify({ token, addresses, topics: { activity: activityOn(p), product_announcement: p.topics.product_announcement !== false } }), signal: AbortSignal.timeout(10000) });
    const ok = r.ok; await local.set(REMOTE_KEY, ok); return ok;
  } catch { await local.set(REMOTE_KEY, false); return false; }
}

/** Alarm on/off follows the preferences; wire listeners once at startup. */
export async function applyNotifySchedule(): Promise<void> {
  const p = await prefs();
  if (activityOn(p)) browser.alarms.create(ACTIVITY_ALARM, { periodInMinutes: 5 }); else await browser.alarms.clear(ACTIVITY_ALARM);
}
export function wireNotifications(getState: () => Promise<any>): void {
  browser.notifications?.onClicked.addListener(async (id) => {
    const links = (await local.get<Record<string, string>>(LINKS_KEY)) ?? {};
    if (links[id]) await browser.tabs.create({ url: links[id] }).catch(() => {});
    await browser.notifications.clear(id).catch(() => {});
  });
  const gcm = (globalThis as any).chrome?.gcm;
  gcm?.onMessage?.addListener((m: any) => {
    const d = m?.data ?? {};
    void showNotification(String(d.title ?? 'Harbour'), String(d.body ?? ''), typeof d.url === 'string' ? d.url : undefined);
  });
  void applyNotifySchedule().then(() => syncRemotePush(getState)).catch(() => {});
}

/** For Settings > Notifications: which delivery path is active. */
export async function notifyStatus(): Promise<{ remote: boolean; remoteConfigured: boolean; watching: string[] }> {
  return { remote: !!(await local.get<boolean>(REMOTE_KEY)), remoteConfigured: true, watching: WATCH_CHAINS };
}
