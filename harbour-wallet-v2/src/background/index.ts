import { logError } from '../core/logger';
// Harbour Wallet background service worker entry. Boot, then route every popup message through the kernel event registry.
import './globalShims';
import browser from 'webextension-polyfill';
import { getCore } from '../core/walletCore';
import { VaultService } from '../core/vaultService';
import { isInternalWalletSender } from './accessPolicy';
import { loadSettings, applySidePanel, LOCK_ALARM } from './settingsService';
import { registerEvents, dispatchEvent, stripExternalFlags } from './kernel/events';
import { bootWith, queue } from './kernel/boot';
import { runMigrations } from './store/migrations';
import { hydrateStore, store, actions } from './store';
import { applyRemoteConfig } from './handlers/kitEvents';
import { servePort } from './kernel/port';
import { syncStore, initStoreFromVault } from './store/sync';
import { buildCtx } from './modules/shared';
import { handlers as walletEvents } from './modules/wallet';
import { handlers as marketEvents } from './modules/market';
import { handlers as swapEvents } from './modules/swap';
import { handlers as tokenEvents } from './modules/tokens';
import { handlers as sendEvents } from './modules/send';
import { handlers as settingsCoreEvents } from './modules/settingsCore';
import { allExtraHandlers } from './handlers';
import { ACTIVITY_ALARM, pollActivity, syncRemotePush, wireNotifications } from './notify';
import { initProviderBackground, initWalletConnectBackground } from './provider/index'; // dApp provider (content-script ports, approval window, inpage registration)

const CONFIG_ALARM = 'harbour:remote-config';
const ONBOARDING_URL = 'src/popup/index.html#/onboarding'; // RE §3.0: full-page onboarding

browser.runtime.onInstalled.addListener((d) => {
  if (d.reason === 'install') browser.tabs.create({ url: browser.runtime.getURL(ONBOARDING_URL) }).catch(() => {});
});
// Auto-lock: the alarm fires `lockTimeInMinutes` after the last activity ping; it drops the session keys.
browser.alarms.create(CONFIG_ALARM, { periodInMinutes: 360 });
browser.alarms.onAlarm.addListener(async (a) => {
  if (a.name === CONFIG_ALARM) { void applyRemoteConfig(); void syncRemotePush(vaultState); return; }
  if (a.name === ACTIVITY_ALARM) { void pollActivity(vaultState); return; }
  if (a.name !== LOCK_ALARM) return;
  try { await new VaultService(await getCore()).lock(); } catch { /* already locked */ }
  store.dispatch(actions.wallet.patch({ unlocked: false }));
});
void loadSettings().then((st) => applySidePanel(st.preferSidePanel)).catch(() => {});
// Public account metadata (addresses) for the notification watcher; readable while the wallet is locked.
async function vaultState(): Promise<any> { return new VaultService(await getCore()).getState(); }
wireNotifications(vaultState);

// Every handler becomes a named INTERNAL_ event with the shared wallet context. Order of precedence: first registration wins (duplicates throw).
const withCtx = (map: Record<string, (m: any, c: any) => any>) =>
  Object.fromEntries(Object.entries(map).map(([name, h]) => [name, async (m: any, c: any) => h(m, await buildCtx(c.sender))]));
for (const m of [walletEvents, marketEvents, swapEvents, tokenEvents, sendEvents, settingsCoreEvents, allExtraHandlers()]) registerEvents('INTERNAL', withCtx(m as any));

// Boot: pre-migrations, wasm core, post-migrations, queue replay. Messages wait on this.
const ready = bootWith([
  { name: 'pre-migrations', run: () => runMigrations('pre') },
  { name: 'core', run: () => getCore() },
  { name: 'post-migrations', run: () => runMigrations('post') },
  { name: 'store', run: async () => { await hydrateStore(); await initStoreFromVault(); } },
  { name: 'queue', run: () => queue.drain() },
  { name: 'config', run: async () => { void applyRemoteConfig(); } }, // refresh in the background; never blocks boot
]);
ready.catch((e) => logError('boot failed', e));

async function handleRequest(raw: unknown, sender: any): Promise<any> {
  if (!isInternalWalletSender(sender, browser.runtime.id)) return { ok: false, error: 'UNAUTHORIZED' };
  if (!raw || typeof raw !== 'object' || typeof (raw as any).type !== 'string') return { ok: false, error: 'INVALID_REQUEST' };
  try { await ready; } catch { return { ok: false, error: 'BOOT_FAILED' }; }
  const msg = stripExternalFlags(raw as { type: string });
  const hit = await dispatchEvent('INTERNAL', msg.type, msg, { sender });
  const result = hit !== undefined ? hit : { error: 'unknown_message' };
  syncStore(msg, result);
  return result;
}
browser.runtime.onMessage.addListener((raw: unknown, sender: any) => handleRequest(raw, sender));
servePort(handleRequest);
initProviderBackground();
initWalletConnectBackground();
self.addEventListener('unhandledrejection', (e) => { logError('unhandled rejection', (e as PromiseRejectionEvent).reason); });
