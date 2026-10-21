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

// Trust Wallet shows only its default assets on a fresh wallet; everything else is enabled from Manage crypto.
export const defaultHiddenAssets = (): string[] => [...ALL_CHAINS, ...TESTNET_CHAINS].map((c) => c.id).filter((id) => !DEFAULT_HOME_CHAINS.includes(id));

// Custom networks live in plain local storage (not secret) and are mirrored into the in-memory registry that rpcUrl() reads.
export const networksReady: Promise<void> = local.get<any>(KEYS.NETWORKS).then((n) => setNetworkState(n)).catch(() => {});
export const saveNetworks = async () => { await local.set(KEYS.NETWORKS, getNetworkState()); };

/** Per-event context: wallet-core, vault and wallet services (waits for the custom-network mirror first). */
export async function buildCtx(sender: any) {
  await networksReady;
  const core = await getCore();
  return { core, vault: new VaultService(core), wallet: new WalletService(core), sender };
}
export type Msg = { type: string; [k: string]: any };
