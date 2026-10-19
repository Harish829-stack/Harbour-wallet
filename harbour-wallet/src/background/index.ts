// Harbour Wallet background service worker. Routes popup requests to the core services.
import browser from 'webextension-polyfill';
import { getCore } from '../core/walletCore';
import { VaultService } from '../core/vaultService';
import { WalletService } from '../core/walletService';
import { local, KEYS } from '../core/storage';
import { isInternalWalletSender } from './accessPolicy';
import { validatePassword } from '../core/passwordPolicy';

const ONBOARDING_URL = 'src/popup/index.html#/onboarding'; // RE §3.0: full-page onboarding

browser.runtime.onInstalled.addListener((d: browser.Runtime.OnInstalledDetailsType) => {
  if (d.reason === 'install') browser.tabs.create({ url: browser.runtime.getURL(ONBOARDING_URL) }).catch(() => {});
});

type Msg = { type: string; [k: string]: any };
let creatingWallet = false;
browser.runtime.onMessage.addListener(async (raw: unknown, sender) => {
  if (!isInternalWalletSender(sender, browser.runtime.id)) {
    return { ok: false, error: 'UNAUTHORIZED' };
  }
  if (!raw || typeof raw !== 'object' || typeof (raw as Msg).type !== 'string') {
    return { ok: false, error: 'INVALID_REQUEST' };
  }
  const msg = raw as Msg;
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
        await vault.persist({ vaultId, wallets: { [walletId]: { name, addresses, seedPhraseBackupRequired: newlyGenerated } }, createdAt: Date.now() });
        return { ok: true, addresses };
      } catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'WALLET_CREATION_FAILED' };
      } finally { creatingWallet = false; }
    }
    case 'unlock': {
      try { const state = await vault.unlock(msg.password); return { ok: true, state }; }
      catch (e: any) { return { ok: false, error: e.message }; }
    }
    case 'lock': await vault.lock(); return { ok: true };
    default: return { error: 'unknown_message' };
  }
});
