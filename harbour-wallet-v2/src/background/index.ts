// Harbour Wallet background service worker. Routes popup requests to the core services.
import browser from 'webextension-polyfill';
import { getCore } from '../core/walletCore';
import { VaultService } from '../core/vaultService';
import { WalletService } from '../core/walletService';
import { local, session, KEYS } from '../core/storage';
import { isInternalWalletSender } from './accessPolicy';
import { validatePassword } from '../core/passwordPolicy';
import { ALL_CHAINS, TESTNET_CHAINS, chainById, chainByEvmId, DEFAULT_HOME_CHAINS } from '../core/chains/index';
import { getRpcUrls } from '../core/chains/rpcUrls';
import { fetchNativeBalances, addressFor } from '../core/chains/adapters';
import { fetchNativePrices, fetchTrending } from '../core/priceService';
import { createWalletClient, http, parseEther, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rpcUrl, solanaRpcUrl } from '../core/rpc';
import { CHART_RANGES, fetchChart, fetchInfo, type ChartRange } from '../core/marketData';
import { fetchHistory } from '../core/txHistory';
import * as swapSvc from './swapService';
import { loadSettings, saveSettings, armLockTimer, clearLockTimer, applySidePanel, sidePanelSupported, cachedRate, rateStore, LOCK_ALARM } from './settingsService';
import { getRate, CURRENCY_CODES } from '../core/fiat';
import { passkeyMeta, enrollPasskey, removePasskey, unlockWithPasskey } from '../core/passkeyService';
import { probeToken, clientFor, tokenBalance, formatTokenAmount } from '../core/erc20';
import { readTokens, sanitizeToken, upsertToken, removeToken, networkByChainId, type CustomToken } from '../core/customTokens';
import { fetchTokenPrices } from '../core/tokenPrice';
import { ONE_TIME_CODE, codeMatchesKey, isWellFormedKey } from '../core/qrSync';
import { setNetworkState, getNetworkState, customNetwork, customNetworks } from '../core/networkRegistry';
import { validateNetwork, checkNetwork, isBuiltinChain, normalizeUrl, BUILTIN_EVM } from '../core/networks';
import { verifyPasskeySecret } from '../core/passkeyService';
import { estimateSend, buildTransfer, validRecipient, resolveSendChain, customChainInfo } from '../core/sendService';
import { nativeSymbol } from '../core/balanceService';
import { readEntries, sanitizeEntry, upsertEntry, removeEntry, type AddressBookCoin } from '../core/addressBook';

// Trust Wallet shows only its default assets on a fresh wallet; everything else is enabled from Manage crypto.
const defaultHiddenAssets = (): string[] => [...ALL_CHAINS, ...TESTNET_CHAINS].map((c) => c.id).filter((id) => !DEFAULT_HOME_CHAINS.includes(id));

const ONBOARDING_URL = 'src/popup/index.html#/onboarding'; // RE §3.0: full-page onboarding

import { ensureAccounts, activeEntry, nextSeedLabel, type Acct } from './walletState';
import { canCreateWallet, WALLET_LIMIT_ERROR } from '../core/importKey';
import { runExtraHandler } from './handlers';
import { initProviderBackground, initWalletConnectBackground } from './provider/index'; // dApp provider (content-script ports, approval window, inpage registration)

browser.runtime.onInstalled.addListener((d: browser.Runtime.OnInstalledDetailsType) => {
  if (d.reason === 'install') browser.tabs.create({ url: browser.runtime.getURL(ONBOARDING_URL) }).catch(() => {});
});

// Auto-lock: the alarm fires `lockTimeInMinutes` after the last activity ping; it drops the session keys.
browser.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== LOCK_ALARM) return;
  try { await new VaultService(await getCore()).lock(); } catch { /* already locked */ }
});
// Re-apply the persisted side-panel preference whenever the service worker starts.
void loadSettings().then((st) => applySidePanel(st.preferSidePanel)).catch(() => {});

// Custom networks live in plain local storage (not secret) and are mirrored into the in-memory registry that rpcUrl() reads.
const networksReady: Promise<void> = local.get<any>(KEYS.NETWORKS).then((n) => setNetworkState(n)).catch(() => {});
const saveNetworks = async () => { await local.set(KEYS.NETWORKS, getNetworkState()); };

type Msg = { type: string; [k: string]: any };
let creatingWallet = false;
const onMessage = async (raw: unknown, sender: any): Promise<any> => {
  if (!isInternalWalletSender(sender, browser.runtime.id)) {
    return { ok: false, error: 'UNAUTHORIZED' };
  }
  if (!raw || typeof raw !== 'object' || typeof (raw as Msg).type !== 'string') {
    return { ok: false, error: 'INVALID_REQUEST' };
  }
  const msg = raw as Msg;
  await networksReady;
  const core = await getCore();
  const vault = new VaultService(core);
  const wallet = new WalletService(core);
  switch (msg.type) {
    case 'status':
      return { hasVault: await vault.exists(), unlocked: await vault.isUnlocked() };
    case 'generateMnemonic':
      return { mnemonic: await wallet.generateMnemonic() };
    case 'validateMnemonic':
      return { valid: wallet.isValidMnemonic(msg.mnemonic) };
    case 'createWallet': {
      const newlyGenerated = msg.newlyGenerated === true;
      if (typeof msg.password !== 'string' || !validatePassword(msg.password).valid ||
          (!newlyGenerated && (typeof msg.mnemonic !== 'string' || !wallet.isValidMnemonic(msg.mnemonic)))) {
        return { ok: false, error: 'INVALID_WALLET_INPUT' };
      }
      if (creatingWallet) return { ok: false, error: 'WALLET_CREATION_IN_PROGRESS' };
      creatingWallet = true;
      try {
        // Target order: SavePassword → GenerateHDWallet (create only) → import.
        await removePasskey(); // a brand-new vault must never inherit an old biometric seal
        await vault.create(msg.password, { wallets: {}, createdAt: Date.now() });
        const mnemonic = newlyGenerated ? await wallet.generateMnemonic() : msg.mnemonic;
        const name = typeof msg.name === 'string' ? msg.name : 'Main wallet';
        const sk = await wallet.buildStoredKey(mnemonic, name, newlyGenerated);
        let keystore: Record<string, unknown>;
        let walletId: string;
        try { walletId = sk.identifier(); keystore = JSON.parse(new TextDecoder().decode(sk.exportJSON())); }
        finally { sk.delete(); }
        const addresses = wallet.deriveAddresses(mnemonic, newlyGenerated);
        const vaultId = (await local.get<{ vaultId: string }>(KEYS.VAULT_ID))!.vaultId;
        await local.set(walletId, keystore);
        await local.set(KEYS.wallets(vaultId), [walletId]);
        await vault.persist({ vaultId, activeWalletId: walletId, wallets: { [walletId]: { name, label: name, type: 'mnemonic', addresses, accounts: [{ derivationIndex: 0, name: 'Account 1', addresses }], activeAccount: 0, seedPhraseBackupRequired: newlyGenerated } }, createdAt: Date.now() });
        await armLockTimer().catch(() => {});
        return { ok: true, addresses };
      } catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'WALLET_CREATION_FAILED' };
      } finally { creatingWallet = false; }
    }
    case 'unlock': {
      try { const state = await vault.unlock(msg.password); await armLockTimer().catch(() => {}); return { ok: true, state }; }
      catch (e: any) { return { ok: false, error: e.message }; }
    }
    case 'passkeyStatus': {
      const m = await passkeyMeta();
      return { ok: true, enabled: !!m, credentialId: m?.credentialId ?? null, isPasswordGenerated: !!m?.isPasswordGenerated };
    }
    case 'passkeyEnroll': {
      // Wallet must be unlocked: the unlock material being sealed is the live session's.
      try {
        if (!(await vault.isUnlocked())) return { ok: false, error: 'LOCKED' };
        await enrollPasskey(String(msg.secret ?? ''), String(msg.credentialId ?? ''), msg.isPasswordGenerated === true);
        return { ok: true };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }
    case 'passkeyUnlock': {
      try {
        if (!(await passkeyMeta())) return { ok: false, error: 'BIOMETRICS_NOT_SET_UP' };
        await unlockWithPasskey(String(msg.secret ?? ''), (k) => vault.verifyUnlockKey(k));
        await armLockTimer().catch(() => {});
        return { ok: true };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }
    case 'passkeyDisable': {
      // Turning biometrics off needs an unlocked wallet; a generated-password wallet cannot (its password is unknown).
      if (!(await vault.isUnlocked())) return { ok: false, error: 'LOCKED' };
      const m = await passkeyMeta();
      if (m?.isPasswordGenerated) return { ok: false, error: 'This wallet has no password; biometrics are its only way to unlock.' };
      await removePasskey(); return { ok: true };
    }
    case 'lock': await vault.lock(); await session.remove(KEYS.REVEAL); await clearLockTimer().catch(() => {}); return { ok: true };
    case 'activity': {
      // UI activity ping (TW: react-idle-timer onAction -> RESET_TIMER). Only counts while unlocked.
      if (await vault.isUnlocked()) await armLockTimer().catch(() => {});
      return { ok: true };
    }
    case 'getAccounts': {
      // Public addresses for the ACTIVE account of the active wallet (requires unlock).
      try {
        const st: any = await vault.getState();
        const entry = activeEntry(st);
        if (!entry) return { ok: true, addresses: {}, accounts: [], activeAccount: 0, backupRequired: false };
        const w = entry[1];
        const accounts = ensureAccounts(w);
        const active = accounts[w.activeAccount] ?? accounts[0];
        return { ok: true, addresses: active?.addresses ?? w.addresses ?? {}, accounts, activeAccount: w.activeAccount ?? 0, backupRequired: !!w?.seedPhraseBackupRequired };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }
    case 'getBalances': {
      // Native balances for the requested chains (default: Trust Wallet's default home set), via the per-family adapters in
      // core/chains/adapters. A chain whose adapter/endpoint fails reports ok:false — never a fake zero.
      try {
        let addresses = msg.addresses;
        if (!addresses) { const st: any = await vault.getState(); addresses = (activeEntry(st)?.[1] as any)?.addresses ?? {}; }
        const ui = (await local.get<any>(KEYS.UI)) ?? {};
        const hidden = new Set<string>(ui.hiddenAssets ?? defaultHiddenAssets());
        // User-added custom EVM networks are first-class home assets (id `custom-<chainId>`); built-ins never include them.
        const custom = customNetworks();
        const wanted: string[] = Array.isArray(msg.chainIds) && msg.chainIds.length ? msg.chainIds.map(String) : [...ALL_CHAINS, ...TESTNET_CHAINS, ...custom.map((n) => customChainInfo(n))].map((c) => c.id).filter((id) => !hidden.has(id));
        const chains = wanted.map((id) => resolveSendChain(id, undefined, custom)).filter((c): c is NonNullable<typeof c> => !!c);
        const results = await fetchNativeBalances(chains.map((chain) => ({ chain, address: addressFor(chain, addresses) })));
        const prices = await fetchNativePrices(chains.map((c) => c.cg ?? ''));
        let totalUsd = 0;
        const byChain: Record<string, any> = {};
        for (const c of chains) {
          const r = results.get(c.id)!; const mk = c.cg ? prices[c.cg] : undefined;
          const price = c.testnet ? 0 : (mk?.price ?? null);
          const usd = price != null && r.ok ? Number(r.formatted) * price : null;
          if (usd != null) totalUsd += usd;
          byChain[c.id] = { chainId: c.evmChainId ?? c.twId, wei: r.raw, formatted: r.formatted, symbol: c.symbol, ok: r.ok, error: r.error, usd, price, change: mk?.change ?? null };
        }
        return { ok: true, balances: byChain, totalUsd, pricesAvailable: Object.keys(prices).length > 0 };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }
    case 'getTrending': {
      try { const list = await fetchTrending({ category: typeof msg.category === 'string' ? msg.category : undefined, order: typeof msg.order === 'string' ? msg.order : undefined, categoryId: typeof msg.categoryId === 'string' ? msg.categoryId : undefined, networkCoinId: typeof msg.networkCoinId === 'number' ? msg.networkCoinId : undefined }); return { ok: true, list }; }
      catch (e: any) { return { ok: false, error: e.message, list: [] }; }
    }
    case 'tokenChart': {
      const range = String(msg.range ?? '1D');
      if (!(CHART_RANGES as string[]).includes(range) || typeof msg.assetId !== 'string') return { ok: false, error: 'Bad request' };
      const r = await fetchChart(msg.assetId, range as ChartRange); return r.ok ? { ok: true, data: r.data } : r;
    }
    case 'tokenInfo': {
      if (typeof msg.assetId !== 'string') return { ok: false, error: 'Bad request' };
      const r = await fetchInfo(msg.assetId); return r.ok ? { ok: true, data: r.data } : r;
    }
    case 'txHistory': {
      // public address + asset id only; validated so it cannot steer the explorer URL
      const id = String(msg.assetId ?? ''); const addr = String(msg.address ?? '');
      if (!/^[a-z0-9_]{3,40}$/.test(id) || !/^[A-Za-z0-9._-]{10,120}$/.test(addr)) return { ok: false, error: 'No address for this network.' };
      const r = await fetchHistory(id, addr, { solanaRpc: solanaRpcUrl() }); return r.ok ? { ok: true, items: r.items } : r;
    }
    case 'swapState': {
      try { return { ok: true, settings: await swapSvc.getSettings(), history: await swapSvc.listHistory() }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Swap state failed' }; }
    }
    case 'swapSetSettings': {
      try { return { ok: true, settings: await swapSvc.setSettings(msg.patch ?? {}) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Update failed' }; }
    }
    case 'swapSearchTokens': {
      try { return { ok: true, assets: await swapSvc.searchTokens(String(msg.query ?? ''), typeof msg.domainId === 'string' ? msg.domainId : undefined) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Search failed', assets: [] }; }
    }
    case 'swapBalances': {
      try { return { ok: true, balances: await swapSvc.getBalances({ core, vault, wallet }, Array.isArray(msg.assets) ? msg.assets.slice(0, 80) : []) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Balance fetch failed', balances: {} }; }
    }
    case 'swapMax': {
      try { return { ok: true, ...(await swapSvc.maxSpendable({ core, vault, wallet }, msg.asset)) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Max failed' }; }
    }
    case 'swapQuote': return swapSvc.quote({ core, vault, wallet }, { from: msg.from, to: msg.to, amount: String(msg.amount ?? ''), slippage: String(msg.slippage ?? '2') });
    case 'swapApprove': return swapSvc.approve({ core, vault, wallet }, { route: msg.route, stepIndex: Number(msg.stepIndex ?? 0), unlimited: msg.unlimited === true });
    case 'swapSubmit': return swapSvc.submit({ core, vault, wallet }, { route: msg.route, stepIndex: Number(msg.stepIndex ?? 0), id: typeof msg.id === 'string' ? msg.id : undefined });
    case 'swapStatus': return swapSvc.status(String(msg.id ?? ''));
    case 'swapHistory': {
      try { return { ok: true, history: await swapSvc.listHistory() }; }
      catch (e: any) { return { ok: false, error: e?.message || 'History failed', history: [] }; }
    }
    case 'tokenProbe': {
      // Public chain read only (no wallet state, no TW gateway): name/symbol/decimals over the chain's RPC.
      const chainId = Number(msg.chainId);
      if (!networkByChainId(chainId)) return { ok: false, code: 'UNSUPPORTED_NETWORK', error: 'This network is not supported.' };
      const r = await probeToken(clientFor(chainId), String(msg.address ?? ''));
      return r.ok ? { ok: true, token: r.token } : { ok: false, code: r.code, error: r.error };
    }
    case 'networkList': {
      const st = getNetworkState();
      return { ok: true, custom: st.custom, builtin: BUILTIN_EVM.map((c) => ({ chainId: c.chainId, name: c.name, testnet: c.testnet, rpcUrl: getRpcUrls(chainByEvmId(c.chainId)!)[0] ?? '', overridden: !!st.rpcOverrides[String(c.chainId)] })), rpcOverrides: st.rpcOverrides };
    }
    case 'networkSave': {
      // Add (msg.editing undefined) or edit a custom network, or change the RPC of a built-in one.
      try {
        const st = getNetworkState();
        const chainId = Number(msg.chainId);
        if (isBuiltinChain(chainId)) {
          if (msg.rpcOnly !== true) return { ok: false, error: 'This chain is already built in. Edit its RPC from the list instead.', field: 'chainId' };
          const u = normalizeUrl(msg.rpcUrl); if (!u.ok) return { ok: false, error: u.error, field: 'rpcUrl' };
          const chk = await checkNetwork({ chainId, rpcUrl: u.url }); if (!chk.ok) return chk;
          const current = getNetworkState();
          setNetworkState({ ...current, rpcOverrides: { ...current.rpcOverrides, [String(chainId)]: u.url } }); await saveNetworks();
          return { ok: true };
        }
        const editing = msg.editing != null ? Number(msg.editing) : undefined;
        const v = validateNetwork(msg as any, st.custom.filter((n) => n.chainId !== editing), editing);
        if (!v.ok) return v;
        if (editing != null && v.network.chainId !== editing) return { ok: false, error: 'The chain ID cannot be changed. Remove the network and add it again.', field: 'chainId' };
        const chk = await checkNetwork(v.network); if (!chk.ok) return chk;
        const current = getNetworkState();
        if (editing == null && current.custom.some((n) => n.chainId === v.network.chainId)) return { ok: false, error: 'A custom network with this chain ID already exists.', field: 'chainId' };
        if (editing != null && !current.custom.some((n) => n.chainId === editing)) return { ok: false, error: 'This network was removed while the RPC was checked.', field: 'chainId' };
        const prev = customNetwork(v.network.chainId);
        const next = { ...v.network, addedAt: prev?.addedAt ?? Date.now() };
        setNetworkState({ ...current, custom: [...current.custom.filter((n) => n.chainId !== next.chainId), next].sort((a, b) => a.addedAt - b.addedAt) }); await saveNetworks();
        return { ok: true, network: next };
      } catch (e: any) { return { ok: false, error: e?.message || 'Could not save the network' }; }
    }
    case 'networkRemove': {
      // Custom network: delete it. Built-in: reset its RPC to the default.
      const st = getNetworkState(); const chainId = Number(msg.chainId);
      if (isBuiltinChain(chainId)) { const { [String(chainId)]: _x, ...rest } = st.rpcOverrides; setNetworkState({ ...st, rpcOverrides: rest }); }
      else setNetworkState({ ...st, custom: st.custom.filter((n) => n.chainId !== chainId) });
      await saveNetworks(); return { ok: true };
    }
    case 'tokenList': {
      try { const st: any = await vault.getState(); const e = activeEntry(st); return { ok: true, tokens: readTokens(e?.[1]?.customTokens) }; }
      catch (e: any) { return { ok: false, error: e.message, tokens: [] }; }
    }
    case 'tokenAdd': {
      try {
        const chainId = Number(msg.chainId); const manual = msg.manual === true;
        let meta: any = { name: msg.name, symbol: msg.symbol, decimals: msg.decimals };
        if (!manual) {
          // Automatic mode trusts only what the chain says, never client-supplied metadata.
          const r = await probeToken(clientFor(chainId), String(msg.address ?? ''));
          if (!r.ok) return { ok: false, code: r.code, error: r.error };
          meta = r.token;
        }
        const clean = sanitizeToken({ chainId, address: msg.address, ...meta, manual });
        if (!clean.ok) return { ok: false, error: clean.error };
        const st: any = await vault.getState(); const entry = activeEntry(st);
        if (!entry) return { ok: false, error: 'No wallet found' };
        const res = upsertToken(readTokens(entry[1].customTokens), clean.token);
        if ('error' in res) return { ok: false, error: res.error };
        entry[1].customTokens = res.list;
        await vault.persist(st);
        return { ok: true, token: clean.token, existed: res.existed };
      } catch (e: any) { return { ok: false, error: e?.message || 'Could not add token' }; }
    }
    case 'tokenRemove': {
      try {
        const st: any = await vault.getState(); const entry = activeEntry(st);
        if (!entry) return { ok: false, error: 'No wallet found' };
        entry[1].customTokens = removeToken(readTokens(entry[1].customTokens), String(msg.id ?? ''));
        await vault.persist(st); return { ok: true };
      } catch (e: any) { return { ok: false, error: e?.message || 'Could not remove token' }; }
    }
    case 'tokenBalances': {
      // Balances + best-effort USD price for every custom token of the active wallet, for the active account's EVM address.
      try {
        const st: any = await vault.getState(); const entry = activeEntry(st);
        const tokens = readTokens(entry?.[1]?.customTokens);
        if (!entry || !tokens.length) return { ok: true, items: [] };
        const w = entry[1]; const accts = ensureAccounts(w);
        const owner: string | undefined = msg.address || accts[w.activeAccount]?.addresses?.ethereum;
        if (!owner) return { ok: true, items: [] };
        const prices = await fetchTokenPrices(tokens);
        const items = await Promise.all(tokens.map(async (t) => {
          const price = prices[t.id] ?? null; const c = clientFor(t.chainId);
          if (!c) return { token: t, ok: false, raw: '0', formatted: '0', price: price?.price ?? null, change: price?.change ?? null, usd: null };
          try {
            const raw = await tokenBalance(c, t.address, owner);
            const formatted = formatTokenAmount(raw, t.decimals);
            return { token: t, ok: true, raw: raw.toString(), formatted, price: price?.price ?? null, change: price?.change ?? null, usd: price ? Number(formatted) * price.price : null };
          } catch { return { token: t, ok: false, raw: '0', formatted: '0', price: price?.price ?? null, change: price?.change ?? null, usd: null }; }
        }));
        return { ok: true, items };
      } catch (e: any) { return { ok: false, error: e?.message || 'Balances unavailable', items: [] }; }
    }
    case 'estimateSend':
    case 'sendTx': {
      // Native or ERC-20 transfer, signed with the active account's wallet-core key via viem. Requires an unlocked session.
      try {
        const chainId = Number(msg.chainId); const url = rpcUrl(chainId);
        if (!url || !networkByChainId(chainId)) return { ok: false, error: 'Unsupported network' };
        const to = String(msg.to ?? ''); const amount = String(msg.amount ?? '');
        if (!validRecipient(to)) return { ok: false, error: 'Invalid recipient address' };
        if (!(Number(amount) > 0)) return { ok: false, error: 'Enter a valid amount' };
        const passwordKey = await session.get<string>(KEYS.PASSWORD);
        if (!passwordKey) return { ok: false, error: 'Wallet is locked' };
        // Resolve the ACTIVE wallet + active account's derivation index (never always wallet[0]/index 0).
        let derivationIndex = 0, walletId: string | undefined, token: CustomToken | undefined, walletType = 'mnemonic', hasEvm = true;
        try {
          const st: any = await vault.getState();
          const e = activeEntry(st);
          if (e) { walletId = e[0]; const w = e[1]; walletType = w.type ?? 'mnemonic'; hasEvm = !!(w.addresses?.ethereum ?? w.accounts?.[0]?.addresses?.ethereum); const accounts = ensureAccounts(w); derivationIndex = accounts[w.activeAccount]?.derivationIndex ?? 0;
            if (msg.tokenId) token = readTokens(w.customTokens).find((t) => t.id === msg.tokenId && t.chainId === chainId); }
        } catch {}
        if (msg.tokenId && !token) return { ok: false, error: 'Token not found in your wallet' };
        const ks = walletId ? await local.get<any>(walletId) : undefined;
        if (!ks) return { ok: false, error: 'No wallet found' };
        const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(ks)));
        let pk: any; let hd: any = null;
        if (walletType === 'privateKey') {
          // Imported private-key wallet: one key, no HD wallet (only usable on EVM chains when imported as an EVM key).
          if (!hasEvm) { sk.delete(); return { ok: false, error: 'This wallet has no EVM account' }; }
          pk = sk.privateKey(core.CoinType.ethereum, new TextEncoder().encode(passwordKey));
        } else {
          hd = sk.wallet(new TextEncoder().encode(passwordKey));
          pk = derivationIndex === 0
            ? hd.getKeyForCoin(core.CoinType.ethereum)
            : hd.getKey(core.CoinType.ethereum, wallet.accountPath(core.CoinType.ethereum, derivationIndex));
        }
        const pkHex = core.HexCoding.encode(pk.data()) as `0x${string}`;
        pk.delete(); hd?.delete(); sk.delete();
        const account = privateKeyToAccount(pkHex);
        const input = { from: account.address, to, amount, token: token ? { address: token.address, decimals: token.decimals } : undefined };
        if (msg.type === 'estimateSend') {
          const est = await estimateSend(clientFor(chainId)!, input);
          return { ok: true, estimate: est, symbol: nativeSymbol(chainId) };
        }
        const sym = nativeSymbol(chainId);
        const chain = defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: sym, symbol: sym, decimals: 18 }, rpcUrls: { default: { http: [url] } } });
        const client = createWalletClient({ account, chain, transport: http(url) });
        const hash = await client.sendTransaction(buildTransfer(input));
        return { ok: true, hash };
      } catch (e: any) { return { ok: false, error: e?.shortMessage || e?.message || 'Transaction failed' }; }
    }
    case 'addAccount': {
      // Derive the next account from the same seed (TW: last path component + 1), persist, activate.
      try {
        const passwordKey = await session.get<string>(KEYS.PASSWORD);
        if (!passwordKey) return { ok: false, error: 'Wallet is locked' };
        const state: any = await vault.getState();
        const entry = activeEntry(state);
        if (!entry) return { ok: false, error: 'No wallet found' };
        const [walletId, w] = entry;
        if ((w.type ?? 'mnemonic') !== 'mnemonic') return { ok: false, error: 'This wallet type has a single account' };
        const accounts = ensureAccounts(w);
        const nextIndex = accounts.reduce((m, a) => Math.max(m, a.derivationIndex), -1) + 1;
        const ks = await local.get<any>(walletId);
        if (!ks) return { ok: false, error: 'No wallet found' };
        const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(ks)));
        const hd = sk.wallet(new TextEncoder().encode(passwordKey));
        let addresses: Record<string, string>;
        try { addresses = wallet.deriveAddressesWithWallet(hd, nextIndex); }
        finally { hd.delete(); sk.delete(); }
        const account: Acct = { derivationIndex: nextIndex, name: `Account ${nextIndex + 1}`, addresses };
        accounts.push(account);
        w.activeAccount = accounts.length - 1;
        w.addresses = addresses; // keep the top-level mirror on the active account
        await vault.persist(state);
        return { ok: true, account, accounts, activeAccount: w.activeAccount, addresses };
      } catch (e: any) { return { ok: false, error: e?.message || 'Add account failed' }; }
    }
    case 'switchAccount': {
      try {
        const idx = Number(msg.index);
        const state: any = await vault.getState();
        const entry = activeEntry(state);
        if (!entry) return { ok: false, error: 'No wallet found' };
        const [, w] = entry;
        const accounts = ensureAccounts(w);
        if (!Number.isInteger(idx) || idx < 0 || idx >= accounts.length) return { ok: false, error: 'Invalid account' };
        w.activeAccount = idx;
        w.addresses = accounts[idx].addresses;
        await vault.persist(state);
        return { ok: true, activeAccount: idx, addresses: accounts[idx].addresses, accounts };
      } catch (e: any) { return { ok: false, error: e?.message || 'Switch failed' }; }
    }
    case 'qrSyncImport': {
      // Decrypt wallets exported by the mobile app with the 6-character one-time code, then add each seed phrase like `addWallet`.
      // msg.dryRun only verifies the code. Only mnemonic wallets are imported; others are counted as skipped.
      try {
        if (!(await vault.isUnlocked())) return { ok: false, error: 'Wallet is locked' };
        const code = String(msg.code ?? ''); const keys = Array.isArray(msg.storedKeys) ? msg.storedKeys : [];
        if (!ONE_TIME_CODE.test(code)) return { ok: false, error: 'INCORRECT_CODE' };
        if (!keys.length || keys.length > 100) return { ok: false, error: 'Unexpected QR contents' };
        const mnemonics: string[] = []; let skipped = 0; let wrong = 0;
        for (const k of keys) {
          if (!isWellFormedKey(k) || k.type !== 'mnemonic') { skipped++; continue; }
          if (!(await codeMatchesKey(k, code))) { wrong++; continue; }
          let sk: any;
          try { sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(k))); } catch { skipped++; continue; }
          try { if (sk.isMnemonic()) mnemonics.push(sk.decryptMnemonic(new TextEncoder().encode(code))); else skipped++; }
          catch { wrong++; }
          finally { sk.delete(); }
        }
        if (!mnemonics.length) return { ok: false, error: wrong ? 'INCORRECT_CODE' : 'No seed-phrase wallets in this QR code', skipped };
        if (msg.dryRun) return { ok: true, count: mnemonics.length, skipped };
        let imported = 0, duplicates = 0; let lastErr = '';
        for (const m of mnemonics) {
          const r: any = await onMessage({ type: 'addWallet', mnemonic: m }, sender);
          if (r?.ok) imported++; else if (r?.error === 'This wallet already exists') duplicates++; else lastErr = r?.error || 'Import failed';
        }
        if (!imported && !duplicates) return { ok: false, error: lastErr || 'Import failed' };
        return { ok: true, imported, duplicates, skipped };
      } catch (e: any) { return { ok: false, error: e?.message || 'Import failed' }; }
    }
    case 'addWallet': {
      // Create (generate) or import an ADDITIONAL seed-phrase wallet. Vault already unlocked.
      if (creatingWallet) return { ok: false, error: 'WALLET_CREATION_IN_PROGRESS' };
      creatingWallet = true;
      try {
        const passwordKey = await session.get<string>(KEYS.PASSWORD);
        if (!passwordKey) return { ok: false, error: 'Wallet is locked' };
        { const cur: any = await vault.getState(); if (!canCreateWallet(Object.keys(cur.wallets ?? {}).length)) return { ok: false, error: WALLET_LIMIT_ERROR }; }
        const importing = typeof msg.mnemonic === 'string' && msg.mnemonic.trim().length > 0;
        if (importing && !wallet.isValidMnemonic(msg.mnemonic.trim())) return { ok: false, error: 'Invalid secret phrase' };
        const mnemonic = importing ? msg.mnemonic.trim() : await wallet.generateMnemonic();
        const newlyGenerated = !importing;
        const state: any = await vault.getState();
        const label = nextSeedLabel(state);
        const addresses = wallet.deriveAddresses(mnemonic, newlyGenerated);
        // Dedupe by the ethereum address (TW: MNEMONIC_ALREADY_EXISTS).
        const dup = Object.values(state.wallets ?? {}).some((w: any) =>
          (Array.isArray(w?.accounts) ? w.accounts : [{ addresses: w?.addresses }])
            .some((a: any) => a?.addresses?.ethereum && a.addresses.ethereum === addresses.ethereum));
        if (dup) return { ok: false, error: 'This wallet already exists' };
        const sk = await wallet.buildStoredKey(mnemonic, label, newlyGenerated);
        let keystore: Record<string, unknown>; let walletId: string;
        try { walletId = sk.identifier(); keystore = JSON.parse(new TextDecoder().decode(sk.exportJSON())); }
        finally { sk.delete(); }
        await local.set(walletId, keystore);
        const vaultId = state.vaultId ?? (await local.get<{ vaultId: string }>(KEYS.VAULT_ID))!.vaultId;
        const list = (await local.get<string[]>(KEYS.wallets(vaultId))) ?? Object.keys(state.wallets ?? {});
        if (!list.includes(walletId)) list.push(walletId);
        await local.set(KEYS.wallets(vaultId), list);
        state.wallets = state.wallets ?? {};
        state.wallets[walletId] = { name: label, label, type: 'mnemonic', addresses, accounts: [{ derivationIndex: 0, name: 'Account 1', addresses }], activeAccount: 0, seedPhraseBackupRequired: newlyGenerated };
        state.activeWalletId = walletId;
        await vault.persist(state);
        return { ok: true, walletId, label, addresses, newlyGenerated, mnemonic: newlyGenerated ? mnemonic : undefined };
      } catch (e: any) { return { ok: false, error: e?.message || 'Add wallet failed' }; }
      finally { creatingWallet = false; }
    }
    case 'switchWallet': {
      try {
        const id = String(msg.walletId ?? '');
        const state: any = await vault.getState();
        if (!state.wallets?.[id]) return { ok: false, error: 'Wallet not found' };
        state.activeWalletId = id;
        const w = state.wallets[id]; const accounts = ensureAccounts(w);
        const active = accounts[w.activeAccount] ?? accounts[0];
        await vault.persist(state);
        return { ok: true, walletId: id, addresses: active?.addresses ?? w.addresses ?? {}, activeAccount: w.activeAccount ?? 0 };
      } catch (e: any) { return { ok: false, error: e?.message || 'Switch failed' }; }
    }
    case 'listWallets': {
      // All seed-phrase wallets with their accounts (for the selector + manage-wallets screen).
      try {
        const st: any = await vault.getState();
        const e = activeEntry(st);
        const wallets = Object.entries(st.wallets ?? {}).map(([id, w]: [string, any], i) => {
          const accounts = ensureAccounts(w);
          return { id, label: w.label ?? `Seed Phrase ${i + 1}`, type: w.type ?? 'mnemonic',
            activeAccount: w.activeAccount ?? 0, backupRequired: !!w.seedPhraseBackupRequired,
            accounts: accounts.map((a: any) => ({ derivationIndex: a.derivationIndex, name: a.name, addresses: a.addresses })) };
        });
        return { ok: true, wallets, activeWalletId: e?.[0] };
      } catch (e: any) { return { ok: false, error: e?.message || 'List failed' }; }
    }
    case 'revealAuth': {
      // Re-authenticate before the secret phrase can be shown. Grants a one-shot, 2-minute permission held in session storage.
      try {
        if (!(await vault.isUnlocked())) return { ok: false, error: 'Wallet is locked' };
        if (msg.method === 'passkey') await verifyPasskeySecret(String(msg.secret ?? ''));
        else await vault.checkPassword(String(msg.password ?? ''));
        await session.set(KEYS.REVEAL, Date.now() + 120_000);
        return { ok: true };
      } catch (e: any) { return { ok: false, error: e?.message || 'Verification failed' }; }
    }
    case 'revealMnemonic': {
      // Return a wallet's secret phrase for the backup flow (requires an unlocked session).
      try {
        const passwordKey = await session.get<string>(KEYS.PASSWORD);
        if (!passwordKey) return { ok: false, error: 'Wallet is locked' };
        const grant = await session.get<number>(KEYS.REVEAL);
        await session.remove(KEYS.REVEAL); // one-shot
        if (!grant || grant < Date.now()) return { ok: false, error: 'AUTH_REQUIRED' };
        const st: any = await vault.getState();
        const id = String(msg.walletId ?? activeEntry(st)?.[0] ?? '');
        const ks = id ? await local.get<any>(id) : undefined;
        if (!ks) return { ok: false, error: 'Wallet not found' };
        if ((st.wallets?.[id]?.type ?? 'mnemonic') !== 'mnemonic') return { ok: false, error: 'This wallet has no secret phrase' };
        const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(ks)));
        try { const hd = sk.wallet(new TextEncoder().encode(passwordKey)); try { return { ok: true, mnemonic: hd.mnemonic() }; } finally { hd.delete(); } }
        finally { sk.delete(); }
      } catch (e: any) { return { ok: false, error: e?.message || 'Reveal failed' }; }
    }
    case 'renameWallet': {
      try {
        const id = String(msg.walletId ?? '');
        const name = String(msg.name ?? '').trim();
        if (!name) return { ok: false, error: 'Name required' };
        const state: any = await vault.getState();
        if (!state.wallets?.[id]) return { ok: false, error: 'Wallet not found' };
        state.wallets[id].label = name;
        await vault.persist(state);
        return { ok: true, walletId: id, label: name };
      } catch (e: any) { return { ok: false, error: e?.message || 'Rename failed' }; }
    }
    case 'removeWallet': {
      // Delete keystore + drop from vault; re-point active wallet (TW removeWallet). Vault unlocked.
      try {
        const id = String(msg.walletId ?? '');
        const state: any = await vault.getState();
        if (!state.wallets?.[id]) return { ok: false, error: 'Wallet not found' };
        if (Object.keys(state.wallets).length <= 1) return { ok: false, error: 'Cannot remove your only wallet' };
        delete state.wallets[id];
        await local.remove(id); // keystore lives at local[walletId]
        const vaultId = state.vaultId ?? (await local.get<{ vaultId: string }>(KEYS.VAULT_ID))?.vaultId;
        if (vaultId) {
          const list = (await local.get<string[]>(KEYS.wallets(vaultId))) ?? [];
          await local.set(KEYS.wallets(vaultId), list.filter((x) => x !== id));
        }
        if (state.activeWalletId === id) state.activeWalletId = Object.keys(state.wallets)[0];
        await vault.persist(state);
        const active = state.wallets[state.activeWalletId];
        return { ok: true, activeWalletId: state.activeWalletId, addresses: active?.addresses ?? {} };
      } catch (e: any) { return { ok: false, error: e?.message || 'Remove failed' }; }
    }
    case 'renameAccount': {
      try {
        const name = String(msg.name ?? '').trim();
        const idx = Number(msg.index);
        if (!name) return { ok: false, error: 'Name required' };
        const state: any = await vault.getState();
        const id = String(msg.walletId ?? activeEntry(state)?.[0] ?? '');
        const w = state.wallets?.[id];
        if (!w) return { ok: false, error: 'Wallet not found' };
        const accounts = ensureAccounts(w);
        if (!Number.isInteger(idx) || idx < 0 || idx >= accounts.length) return { ok: false, error: 'Invalid account' };
        accounts[idx].name = name;
        await vault.persist(state);
        return { ok: true, walletId: id, index: idx, name };
      } catch (e: any) { return { ok: false, error: e?.message || 'Rename failed' }; }
    }
    case 'markBackedUp': {
      try {
        const state: any = await vault.getState();
        const id = String(msg.walletId ?? activeEntry(state)?.[0] ?? '');
        if (!state.wallets?.[id]) return { ok: false, error: 'Wallet not found' };
        state.wallets[id].seedPhraseBackupRequired = false;
        await vault.persist(state);
        return { ok: true, walletId: id };
      } catch (e: any) { return { ok: false, error: e?.message || 'Update failed' }; }
    }
    case 'getSettings': {
      try {
        const settings = await loadSettings();
        return { ok: true, settings, rate: await cachedRate(settings.baseCurrency), sidePanelSupported: sidePanelSupported() };
      } catch (e: any) { return { ok: false, error: e?.message || 'Settings unavailable' }; }
    }
    case 'setSettings': {
      try { return await saveSettings(msg.patch); }
      catch (e: any) { return { ok: false, error: e?.message || 'Could not save settings' }; }
    }
    case 'getFiatRate': {
      const code = String(msg.code ?? '');
      if (!CURRENCY_CODES.has(code)) return { ok: false, error: 'Unsupported currency' };
      const r = await getRate(code, rateStore); return r.ok ? { ok: true, code, usdPer: r.usdPer, stale: r.stale, at: Date.now() } : r;
    }
    case 'addressBookList': {
      try { const st: any = await vault.getState(); return { ok: true, items: readEntries(st.addressBook) }; }
      catch (e: any) { return { ok: false, error: e?.message === 'LOCKED' ? 'Wallet is locked' : 'Address book unavailable', items: [] }; }
    }
    case 'addressBookSave': {
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
    case 'addressBookRemove': {
      try {
        const st: any = await vault.getState();
        st.addressBook = removeEntry(readEntries(st.addressBook), String(msg.id ?? ''));
        await vault.persist(st);
        return { ok: true, items: st.addressBook };
      } catch (e: any) { return { ok: false, error: e?.message === 'LOCKED' ? 'Wallet is locked' : 'Could not remove contact' }; }
    }
    case 'getUiPrefs': {
      // Home-screen UI prefs (hidden assets + active network filter). No unlock required.
      try { const ui = (await local.get<any>(KEYS.UI)) ?? {}; return { ok: true, hiddenAssets: ui.hiddenAssets ?? defaultHiddenAssets(), networkFilter: ui.networkFilter ?? null }; }
      catch (e: any) { return { ok: false, error: e?.message || 'prefs failed', hiddenAssets: [], networkFilter: null }; }
    }
    case 'setAssetHidden': {
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
    case 'setNetworkFilter': {
      try {
        const ui = (await local.get<any>(KEYS.UI)) ?? {};
        ui.networkFilter = msg.networkId ?? null;
        await local.set(KEYS.UI, ui);
        return { ok: true, networkFilter: ui.networkFilter };
      } catch (e: any) { return { ok: false, error: e?.message || 'Update failed' }; }
    }
    default: return runExtraHandler(msg, { core, vault, wallet, sender });
  }
};
browser.runtime.onMessage.addListener(onMessage);
initProviderBackground();
initWalletConnectBackground();
