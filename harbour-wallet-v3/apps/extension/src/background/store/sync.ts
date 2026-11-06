// Keeps the worker store in step with the legacy handlers: derives slice state from event results and from the vault at boot.
import { store, actions } from './index';
import { readStore } from './migrations';
import { local, session, KEYS } from '../../core/storage';
import { loadSettings } from '../settingsService';

export async function initStoreFromVault(): Promise<void> {
  const [pre, post] = await readStore();
  const d = store.dispatch;
  d(actions.migration.patch({ preVersion: pre, postVersion: post }));
  d(actions.app.patch({ booted: true, lastActiveAt: Date.now() }));
  d(actions.wallet.patch({ hasVault: Boolean(await local.get(KEYS.VAULT)), unlocked: Boolean(await session.get(KEYS.UNLOCK)) }));
  try {
    const s = await loadSettings();
    d(actions.settings.patch({ lockTimeInMinutes: s.lockTimeInMinutes, preferSidePanel: s.preferSidePanel, language: s.locale }));
    d(actions.fiat.patch({ currency: s.baseCurrency }));
    d(actions.notification.patch({ enabled: s.pushNotifications.isPushEnabled }));
  } catch { /* defaults */ }
  const ui = (await local.get<any>(KEYS.UI)) ?? {};
  d(actions.asset.patch({ hidden: ui.hiddenAssets ?? [] }));
  d(actions.blockchains.patch({ networkFilter: ui.networkFilter ?? null }));
}

/** Called after every handled event; maps results into slices. Never throws. */
export function syncStore(msg: { type: string; [k: string]: any }, r: any): void {
  try {
    const d = store.dispatch;
    switch (msg.type) {
      case 'unlock': case 'passkeyUnlock': if (r?.ok) d(actions.wallet.patch({ unlocked: true, hasVault: true, ...(r.state?.activeWalletId ? { activeWalletId: r.state.activeWalletId } : {}) })); break;
      case 'lock': d(actions.wallet.patch({ unlocked: false })); break;
      case 'switchWallet': if (r?.ok && typeof msg.walletId === 'string') d(actions.wallet.patch({ activeWalletId: msg.walletId })); break;
      case 'createWallet': if (r?.ok) d(actions.wallet.patch({ hasVault: true, unlocked: true })); break;
      case 'setAssetHidden': if (r?.ok) d(actions.asset.patch({ hidden: r.hiddenAssets })); break;
      case 'setNetworkFilter': if (r?.ok) d(actions.blockchains.patch({ networkFilter: r.networkFilter })); break;
      case 'setSettings': if (r?.ok && r.settings) {
        const s = r.settings;
        d(actions.settings.patch({ lockTimeInMinutes: s.lockTimeInMinutes, preferSidePanel: s.preferSidePanel, language: s.locale }));
        d(actions.fiat.patch({ currency: s.baseCurrency }));
      } break;
    }
  } catch { /* store sync is best-effort */ }
}
