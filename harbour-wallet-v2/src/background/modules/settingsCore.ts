import browser from 'webextension-polyfill';
import { applyNotifySchedule, syncRemotePush, showNotification, notifyStatus } from '../notify';
import { getCore } from '../../core/walletCore';
import { VaultService } from '../../core/vaultService';
import { WalletService } from '../../core/walletService';
import { local, session, KEYS } from '../../core/storage';
import { validatePassword } from '../../core/passwordPolicy';
import { ALL_CHAINS, TESTNET_CHAINS, chainById, chainByEvmId, DEFAULT_HOME_CHAINS } from '../../core/chains/index';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { fetchNativeBalances, addressFor } from '../../core/chains/adapters';
import { fetchNativePrices, fetchTrending } from '../../core/priceService';
import { createWalletClient, http, parseEther, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rpcUrl, solanaRpcUrl } from '../../core/rpc';
import { CHART_RANGES, fetchChart, fetchInfo, type ChartRange } from '../../core/marketData';
import { fetchHistory } from '../../core/txHistory';
import * as swapSvc from '../swapService';
import { loadSettings, saveSettings, armLockTimer, clearLockTimer, applySidePanel, sidePanelSupported, cachedRate, rateStore, LOCK_ALARM } from '../settingsService';
import { getRate, CURRENCY_CODES } from '../../core/fiat';
import { passkeyMeta, enrollPasskey, removePasskey, unlockWithPasskey } from '../../core/passkeyService';
import { probeToken, clientFor, tokenBalance, formatTokenAmount } from '../../core/erc20';
import { readTokens, sanitizeToken, upsertToken, removeToken, networkByChainId, type CustomToken } from '../../core/customTokens';
import { fetchTokenPrices } from '../../core/tokenPrice';
import { ONE_TIME_CODE, codeMatchesKey, isWellFormedKey } from '../../core/qrSync';
import { setNetworkState, getNetworkState, customNetwork, customNetworks } from '../../core/networkRegistry';
import { validateNetwork, checkNetwork, isBuiltinChain, normalizeUrl, BUILTIN_EVM } from '../../core/networks';
import { verifyPasskeySecret } from '../../core/passkeyService';
import { estimateSend, buildTransfer, validRecipient, resolveSendChain, customChainInfo } from '../../core/sendService';
import { nativeSymbol } from '../../core/balanceService';
import { readEntries, sanitizeEntry, upsertEntry, removeEntry, type AddressBookCoin } from '../../core/addressBook';
import { ensureAccounts, activeEntry, nextSeedLabel, type Acct } from '../walletState';
import { canCreateWallet, WALLET_LIMIT_ERROR } from '../../core/importKey';
import type { HandlerMap } from '../handlers/types';
import { defaultHiddenAssets, saveNetworks } from './shared';
import { dispatchEvent } from '../kernel/events';

export const handlers: HandlerMap = {
  getSettings: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try {
        const settings = await loadSettings();
        return { ok: true, settings, rate: await cachedRate(settings.baseCurrency), sidePanelSupported: sidePanelSupported() };
      } catch (e: any) { return { ok: false, error: e?.message || 'Settings unavailable' }; }
    }
  },
  notifyTest: async () => { await showNotification('Harbour notifications are on', 'You will see incoming transfers and announcements here.'); return { ok: true }; },
  notifyStatus: async () => ({ ok: true, ...(await notifyStatus()) }),
  setSettings: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try {
        const r = await saveSettings(msg.patch);
        // notification choices drive the activity alarm and the gateway push registration
        if (r.ok && msg.patch && typeof msg.patch === 'object' && 'pushNotifications' in msg.patch) {
          void applyNotifySchedule().then(() => syncRemotePush(async () => vault.getState()));
        }
        return r;
      }
      catch (e: any) { return { ok: false, error: e?.message || 'Could not save settings' }; }
    }
  },
  addressBookList: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { const st: any = await vault.getState(); return { ok: true, items: readEntries(st.addressBook) }; }
      catch (e: any) { return { ok: false, error: e?.message === 'LOCKED' ? 'Wallet is locked' : 'Address book unavailable', items: [] }; }
    }
  },
  addressBookSave: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try {
        const isValid = (coin: AddressBookCoin, addr: string) => { try { return core.AnyAddress.isValid(addr, core.CoinType[coin]); } catch { return false; } };
        const clean = sanitizeEntry({ name: msg.name, addresses: msg.addresses }, isValid);
        if (!clean.ok) return clean;
        const st: any = await vault.getState();
        const res = upsertEntry(readEntries(st.addressBook), { id: typeof msg.id === 'string' ? msg.id : undefined, name: clean.name, addresses: clean.addresses }, () => crypto.randomUUID());
        if (!res.ok) return res;
        st.addressBook = res.list; await vault.persist(st);
        return { ok: true, items: res.list, entry: res.entry };
      } catch (e: any) { return { ok: false, error: e?.message === 'LOCKED' ? 'Wallet is locked' : 'Could not save contact' }; }
    }
  },
  addressBookRemove: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try {
        const st: any = await vault.getState();
        st.addressBook = removeEntry(readEntries(st.addressBook), String(msg.id ?? ''));
        await vault.persist(st);
        return { ok: true, items: st.addressBook };
      } catch (e: any) { return { ok: false, error: e?.message === 'LOCKED' ? 'Wallet is locked' : 'Could not remove contact' }; }
    }
  },
  getUiPrefs: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      // Home-screen UI prefs (hidden assets + active network filter). No unlock required.
      try { const ui = (await local.get<any>(KEYS.UI)) ?? {}; return { ok: true, hiddenAssets: ui.hiddenAssets ?? defaultHiddenAssets(), networkFilter: ui.networkFilter ?? null }; }
      catch (e: any) { return { ok: false, error: e?.message || 'prefs failed', hiddenAssets: [], networkFilter: null }; }
    }
  },
  setAssetHidden: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      // Mirrors TW SET_HOME_OVERRIDE show/hide: toggle an asset's home-screen visibility.
      try {
        const id = String(msg.assetId ?? ''); const hidden = !!msg.hidden;
        const ui = (await local.get<any>(KEYS.UI)) ?? {};
        const set = new Set<string>(ui.hiddenAssets ?? defaultHiddenAssets());
        if (hidden) set.add(id); else set.delete(id);
        ui.hiddenAssets = [...set];
        await local.set(KEYS.UI, ui);
        return { ok: true, hiddenAssets: ui.hiddenAssets };
      } catch (e: any) { return { ok: false, error: e?.message || 'Update failed' }; }
    }
  },
  setNetworkFilter: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try {
        const ui = (await local.get<any>(KEYS.UI)) ?? {};
        ui.networkFilter = msg.networkId ?? null;
        await local.set(KEYS.UI, ui);
        return { ok: true, networkFilter: ui.networkFilter };
      } catch (e: any) { return { ok: false, error: e?.message || 'Update failed' }; }
    }
  },
};
