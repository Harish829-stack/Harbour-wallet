// Buy/sell checkout follow-up (same idea as MetaMask's app/scripts/lib/ramps/checkout-watch.ts). The provider page opens in
// a tab from the service worker, so the popup may close. When that tab reaches the backend's return page (the provider's
// "success" redirect), the tab is turned into Harbour's order list. Orders are then polled with an alarm while any is
// open, and a notification is shown when one finishes.
import browser from 'webextension-polyfill';
import { local, session } from '../core/storage';
import { api } from '../core/harbour/client';
import { orderView, isReturnPrefix, type OnramperOrder } from '../core/ramps/onramper';
import { showNotification } from './notify';
import { logError } from '../core/logger';

export const RAMPS_ALARM = 'harbour:ramps-poll';
export const ORDERS_PAGE = 'src/popup/index.html#/ramps/orders';
const TABS_KEY = 'harbour:ramps:tabs';      // storage.session: tabId -> return prefix (survives a service-worker restart)
const SEEN_KEY = 'wallet:ramp:seen';        // order id -> last status we told the user about
const UNTIL_KEY = 'wallet:ramp:pollUntil';  // keep polling at least until this time after a checkout
const POLL_FOR_MS = 3 * 3600_000;
const OPEN: OnramperOrder['status'][] = ['created', 'pending'];

type TabMap = Record<string, string>;
async function readTabs(): Promise<TabMap> { try { return (await session.get<TabMap>(TABS_KEY)) ?? {}; } catch { return {}; } }
async function writeTabs(m: TabMap): Promise<void> { try { await session.set(TABS_KEY, m); } catch { /* best effort */ } }

/** Open the provider checkout in a new tab and watch it for the return page. */
export async function openCheckoutTab(url: string, returnPrefix?: string): Promise<void> {
  const tab = await browser.tabs.create({ url, active: true });
  if (tab.id !== undefined && isReturnPrefix(returnPrefix)) { const m = await readTabs(); m[String(tab.id)] = returnPrefix; await writeTabs(m); }
  await startRampPolling();
}

browser.tabs.onUpdated.addListener((tabId, info) => {
  const url = info.url; if (!url) return;
  void readTabs().then(async (m) => {
    const prefix = m[String(tabId)]; if (!prefix || !url.startsWith(prefix)) return;
    delete m[String(tabId)]; await writeTabs(m);
    // Replace the finished provider tab with Harbour's order list (closing it could close the last browser window).
    await browser.tabs.update(tabId, { url: browser.runtime.getURL(ORDERS_PAGE) }).catch(() => {});
    void pollRampOrders();
  });
});
browser.tabs.onRemoved.addListener((tabId) => { void readTabs().then((m) => { if (m[String(tabId)]) { delete m[String(tabId)]; void writeTabs(m); } }); });

export async function startRampPolling(): Promise<void> {
  await local.set(UNTIL_KEY, Date.now() + POLL_FOR_MS);
  await browser.alarms.create(RAMPS_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
}

/** Fetch orders, notify on newly finished ones, stop the alarm when nothing is open any more. Returns the orders. */
export async function pollRampOrders(): Promise<OnramperOrder[]> {
  let orders: OnramperOrder[] = [];
  try { orders = ((await api<{ orders: OnramperOrder[] }>('GET', '/v1/ramps/orders'))?.orders ?? []).filter((o) => o && typeof o.id === 'string'); }
  catch (e) { logError('ramp orders', e); return []; }
  const seen = (await local.get<Record<string, string>>(SEEN_KEY)) ?? {};
  for (const o of orders) {
    const prev = seen[o.id];
    if (prev && prev !== o.status && !OPEN.includes(o.status)) {
      const v = orderView(o, []);
      const amount = v.type === 'buy' ? (o.crypto_amount ? `${o.crypto_amount} ${v.symbol}` : v.symbol) : (o.fiat_amount ? `${o.fiat_amount} ${v.fiatCode}` : v.fiatCode);
      const title = o.status === 'completed' ? (o.type === 'buy' ? 'Purchase complete' : 'Sale complete') : o.status === 'failed' ? 'Order failed' : 'Order canceled';
      const msg = o.status === 'completed' ? (o.type === 'buy' ? `${amount} is on its way to your ${v.chainName} wallet.` : `${amount} is being paid out by ${v.providerName}.`)
        : `Your ${v.providerName} order did not go through. No crypto was sent.`;
      await showNotification(title, msg);
    }
    seen[o.id] = o.status;
  }
  const ids = Object.keys(seen); for (const k of ids.slice(0, Math.max(0, ids.length - 100))) delete seen[k];
  await local.set(SEEN_KEY, seen);
  const until = (await local.get<number>(UNTIL_KEY)) ?? 0;
  if (!orders.some((o) => OPEN.includes(o.status)) && Date.now() > until) await browser.alarms.clear(RAMPS_ALARM);
  return orders;
}
