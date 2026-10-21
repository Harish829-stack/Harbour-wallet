import browser from 'webextension-polyfill';
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
  swapState: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, settings: await swapSvc.getSettings(), history: await swapSvc.listHistory(), gaslessAvailable: await swapSvc.gaslessAvailable() }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Swap state failed' }; }
    }
  },
  swapSetSettings: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, settings: await swapSvc.setSettings(msg.patch ?? {}) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Update failed' }; }
    }
  },
  swapSearchTokens: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, assets: await swapSvc.searchTokens(String(msg.query ?? ''), typeof msg.domainId === 'string' ? msg.domainId : undefined) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Search failed', assets: [] }; }
    }
  },
  swapBalances: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, balances: await swapSvc.getBalances({ core, vault, wallet }, Array.isArray(msg.assets) ? msg.assets.slice(0, 80) : []) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Balance fetch failed', balances: {} }; }
    }
  },
  swapMax: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, ...(await swapSvc.maxSpendable({ core, vault, wallet }, msg.asset)) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Max failed' }; }
    }
  },
  swapQuote: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 return swapSvc.quote({ core, vault, wallet }, { from: msg.from, to: msg.to, amount: String(msg.amount ?? ''), slippage: String(msg.slippage ?? '2') });
  },
  swapApprove: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 return swapSvc.approve({ core, vault, wallet }, { route: msg.route, stepIndex: Number(msg.stepIndex ?? 0), unlimited: msg.unlimited === true });
  },
  swapSubmit: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 return swapSvc.submit({ core, vault, wallet }, { route: msg.route, stepIndex: Number(msg.stepIndex ?? 0), id: typeof msg.id === 'string' ? msg.id : undefined });
  },
  swapDustScan: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
    return swapSvc.scanDust({ core, vault, wallet }, String(msg.domainId ?? ''), Number(msg.thresholdUsd) > 0 ? Math.min(Number(msg.thresholdUsd), 100) : undefined);
  },
  swapDustConvert: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
    return swapSvc.convertDust({ core, vault, wallet }, Array.isArray(msg.assets) ? msg.assets : []);
  },
  swapStatus: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 return swapSvc.status(String(msg.id ?? ''));
  },
  swapHistory: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, history: await swapSvc.listHistory() }; }
      catch (e: any) { return { ok: false, error: e?.message || 'History failed', history: [] }; }
    }
  },
};
