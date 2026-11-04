import { local, session, KEYS } from '../../core/storage';
import { validatePassword } from '../../core/passwordPolicy';
import { armLockTimer, clearLockTimer } from '../settingsService';
import { passkeyMeta, enrollPasskey, removePasskey, unlockWithPasskey, dropLegacyPasskey } from '../../core/passkeyService';
// Dumb-UI rule: no handler here returns a recovery phrase, private key or password (see handlers/secrets.ts, core/uiSafe.ts).
import { ONE_TIME_CODE, codeMatchesKey, isWellFormedKey } from '../../core/qrSync';
import { readQrStage, clearQrStage, qrWrongCode } from '../qrStage';
import { verifyPasskeySecret } from '../../core/passkeyService';
import { ensureAccounts, activeEntry, nextSeedLabel, type Acct } from '../walletState';
import { canCreateWallet, WALLET_LIMIT_ERROR } from '../../core/importKey';
import type { HandlerMap } from '../handlers/types';
import { grantReauth, consumeReauth, hasReauth, clearReauth, purposeOf } from '../reauth';

/** Security-relevant change notice (shown by the OS even if the popup is closed), e.g. biometrics turned on. Best effort. */
function securityNotice(title: string, message: string): void {
  try { void chrome.notifications?.create(`harbour-security-${Date.now()}`, { type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title, message, priority: 2 }); } catch { /* notifications unavailable */ }
}
import { dropVaultKeys } from '../handlers/onboardingExtra';

let creatingWallet = false;
/** Marks an addWallet call made inside the worker after the batch was authorised once (a JSON message from a page cannot carry a Symbol). */
const AUTHORIZED = Symbol('addWalletAuthorized');
export const handlers: HandlerMap = {
  status: async (msg, ctx) => {
    const { vault } = ctx as any;
      return { hasVault: await vault.exists(), unlocked: await vault.isUnlocked() };
  },
  validateMnemonic: async (msg, ctx) => {
    const { wallet } = ctx as any;
      return { valid: wallet.isValidMnemonic(msg.mnemonic) };
  },
  createWallet: async (msg, ctx) => {
    const { vault, wallet } = ctx as any;
 {
      const newlyGenerated = msg.newlyGenerated === true;
      if (msg.generatedPassword === true) return { ok: false, error: 'INVALID_WALLET_INPUT' }; // a wallet always has a password the user chose; biometrics are added on top
      const passkey = msg.passkey && typeof msg.passkey === 'object' ? { secret: String(msg.passkey.secret ?? ''), credentialId: String(msg.passkey.credentialId ?? '') } : null;
      const password: unknown = msg.password;
      if (typeof password !== 'string' || !validatePassword(password).valid ||
          (!newlyGenerated && (typeof msg.mnemonic !== 'string' || !wallet.isValidMnemonic(msg.mnemonic)))) {
        return { ok: false, error: 'INVALID_WALLET_INPUT' };
      }
      if (creatingWallet) return { ok: false, error: 'WALLET_CREATION_IN_PROGRESS' };
      creatingWallet = true;
      try {
        // Target order: SavePassword → GenerateHDWallet (create only) → import.
        // PT-05: refuse BEFORE touching the biometric seal: a call against an existing vault must change nothing.
        if (await vault.exists()) return { ok: false, error: 'FORBIDDEN_REQUEST' };
        await vault.create(password, { wallets: {}, createdAt: Date.now() });
        await removePasskey(); // a brand-new vault must never inherit an old biometric seal
        if (passkey) {
          try { await enrollPasskey(passkey.secret, passkey.credentialId, false); }
          catch (e) { await dropVaultKeys(); throw e; } // never leave a vault behind that nobody can unlock
        }
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
        // The password was typed seconds ago: let onboarding offer biometrics without asking for it again (one-shot, 10 min).
        await grantReauth('manage', { method: 'password', ttlMs: 10 * 60_000 });
        return { ok: true, addresses };
      } catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'WALLET_CREATION_FAILED' };
      } finally { creatingWallet = false; }
    }
  },
  unlock: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      try { const state = await vault.unlock(msg.password); await dropLegacyPasskey().catch(() => {}); await armLockTimer().catch(() => {}); return { ok: true, state }; }
      catch (e: any) { return { ok: false, error: e.message }; }
    }
  },
  passkeyStatus: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      const m = await passkeyMeta();
      return { ok: true, enabled: !!m, credentialId: m?.credentialId ?? null, isPasswordGenerated: !!m?.isPasswordGenerated, legacy: !!m?.legacy };
    }
  },
  passkeyEnroll: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      // Wallet must be unlocked: the unlock material being sealed is the live session's.
      try {
        if (!(await vault.isUnlocked())) return { ok: false, error: 'LOCKED' };
        // PT-01: adding (or replacing) an authenticator needs the PASSWORD just now (NIST 800-63B §6.1). Without this, anyone at an
        // unlocked wallet could enrol their own authenticator and then use it to pass every biometric re-auth (reveal phrase, etc.).
        const prev = await passkeyMeta();
        if (prev?.isPasswordGenerated) return { ok: false, error: 'Add a password to this wallet first.' };
        if (!(await consumeReauth('manage', { method: 'password' }))) return { ok: false, error: 'AUTH_REQUIRED' };
        await enrollPasskey(String(msg.secret ?? ''), String(msg.credentialId ?? ''), false);
        securityNotice('Biometric unlock turned on', prev ? 'Harbour now unlocks with a new biometric credential. If this was not you, turn it off in Settings › Security.' : 'Harbour can now be unlocked with biometrics. If this was not you, turn it off in Settings › Security.');
        return { ok: true };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }
  },
  passkeyUnlock: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      try {
        if (!(await passkeyMeta())) return { ok: false, error: 'BIOMETRICS_NOT_SET_UP' };
        await unlockWithPasskey(String(msg.secret ?? ''), (k) => vault.verifyUnlockKey(k));
        await armLockTimer().catch(() => {});
        return { ok: true };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }
  },
  // Biometrics-only wallet -> wallet with a password too (industry standard: biometrics unlock, the password is always the fallback).
  // The biometric prompt (run by the UI in a tab) supplies `secret`, which both proves the user and re-seals the biometric blob.
  passkeyAddPassword: async (msg, ctx) => {
    const { vault } = ctx as any;
    try {
      if (!(await vault.isUnlocked())) return { ok: false, error: 'LOCKED' };
      const m = await passkeyMeta();
      if (!m) return { ok: false, error: 'BIOMETRICS_NOT_SET_UP' };
      if (!m.isPasswordGenerated) return { ok: false, error: 'This wallet already has a password.' };
      const password: unknown = msg.password;
      if (typeof password !== 'string' || !validatePassword(password).valid) return { ok: false, error: 'INVALID_WALLET_INPUT' };
      const secret = String(msg.secret ?? '');
      await verifyPasskeySecret(secret, { allowLegacy: true });
      await vault.setPassword(password, secret);
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e?.message || 'Could not add a password' }; }
  },
  passkeyDisable: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      // Turning biometrics off needs an unlocked wallet; a generated-password wallet cannot (its password is unknown).
      if (!(await vault.isUnlocked())) return { ok: false, error: 'LOCKED' };
      const m = await passkeyMeta();
      if (m?.isPasswordGenerated) return { ok: false, error: 'This wallet has no password; biometrics are its only way to unlock.' };
      if (!(await consumeReauth('manage'))) return { ok: false, error: 'AUTH_REQUIRED' }; // PT-04
      await removePasskey(); securityNotice('Biometric unlock turned off', 'Harbour now unlocks with your password only.'); return { ok: true };
    }
  },
  lock: async (msg, ctx) => {
    const { vault } = ctx as any;
 await vault.lock(); await clearReauth(); await clearLockTimer().catch(() => {}); return { ok: true };
  },
  activity: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      // UI activity ping (TW: react-idle-timer onAction -> RESET_TIMER). Only counts while unlocked.
      if (await vault.isUnlocked()) await armLockTimer().catch(() => {});
      return { ok: true };
    }
  },
  getAccounts: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
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
  },
  addAccount: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
 {
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
  },
  switchAccount: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
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
  },
  qrSyncImport: async (msg, ctx) => {
    const { core, vault } = ctx as any;
 {
      // Decrypt wallets exported by the mobile app with the 6-character one-time code, then add each seed phrase like `addWallet`.
      // msg.dryRun only verifies the code. Only mnemonic wallets are imported; others are counted as skipped.
      try {
        if (!(await vault.isUnlocked())) return { ok: false, error: 'Wallet is locked' };
        const code = String(msg.code ?? ''); const keys = (await readQrStage(msg.stageId)) ?? [];
        if (!ONE_TIME_CODE.test(code)) return { ok: false, error: 'INCORRECT_CODE' };
        if (!keys.length || keys.length > 100) return { ok: false, error: 'QR_EXPIRED' };
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
        if (!mnemonics.length) return { ok: false, error: wrong ? await qrWrongCode(msg.stageId) : 'No seed-phrase wallets in this QR code', skipped };
        if (msg.dryRun) return { ok: true, count: mnemonics.length, skipped };
        if (!(await consumeReauth('addWallet'))) return { ok: false, error: 'AUTH_REQUIRED' }; // adding seeds needs the unlock credential
        let imported = 0, duplicates = 0; let lastErr = '';
        for (const m of mnemonics) {
          const r: any = await handlers.addWallet({ type: 'addWallet', mnemonic: m, [AUTHORIZED]: true } as any, ctx);
          if (r?.ok) imported++; else if (r?.error === 'This wallet already exists') duplicates++; else lastErr = r?.error || 'Import failed';
        }
        if (!imported && !duplicates) return { ok: false, error: lastErr || 'Import failed' };
        await clearQrStage();
        return { ok: true, imported, duplicates, skipped };
      } catch (e: any) { return { ok: false, error: e?.message || 'Import failed' }; }
    }
  },
  addWallet: async (msg, ctx) => {
    const { vault, wallet } = ctx as any;
 {
      // Create (generate) or import an ADDITIONAL seed-phrase wallet. Vault already unlocked.
      if (creatingWallet) return { ok: false, error: 'WALLET_CREATION_IN_PROGRESS' };
      creatingWallet = true;
      try {
        const passwordKey = await session.get<string>(KEYS.PASSWORD);
        if (!passwordKey) return { ok: false, error: 'Wallet is locked' };
        { const cur: any = await vault.getState(); if (!canCreateWallet(Object.keys(cur.wallets ?? {}).length)) return { ok: false, error: WALLET_LIMIT_ERROR }; }
        const importing = typeof msg.mnemonic === 'string' && msg.mnemonic.trim().length > 0;
        if (importing && !wallet.isValidMnemonic(msg.mnemonic.trim())) return { ok: false, error: 'Invalid secret phrase' };
        // Adding another seed to a wallet that already holds funds needs the unlock credential (password or biometrics), once per add.
        if (Object.keys((await vault.getState()).wallets ?? {}).length > 0 && (msg as any)[AUTHORIZED] !== true && !(await consumeReauth('addWallet'))) return { ok: false, error: 'AUTH_REQUIRED' };
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
        if (newlyGenerated) await grantReauth('reveal', { method: 'created', walletId }); // PT-08: the backup screen may show THIS wallet's new phrase once, without re-auth
        return { ok: true, walletId, label, addresses, newlyGenerated, backupGranted: newlyGenerated };
      } catch (e: any) { return { ok: false, error: e?.message || 'Add wallet failed' }; }
      finally { creatingWallet = false; }
    }
  },
  switchWallet: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
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
  },
  listWallets: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
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
  },
  /** Does a still-valid grant exist? Lets the UI ask for the password before a biometric ceremony (biometrics enrolment). */
  reauthStatus: async (msg) => ({ ok: true, valid: await hasReauth(purposeOf(msg.purpose), msg.method === 'password' ? { method: 'password' } : {}) }),
  revealAuth: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      // Re-authenticate before the secret phrase can be shown. Grants a one-shot, 2-minute permission held in session storage.
      try {
        if (!(await vault.isUnlocked())) return { ok: false, error: 'Wallet is locked' };
        const method = msg.method === 'passkey' ? 'passkey' as const : 'password' as const;
        if (method === 'passkey') await verifyPasskeySecret(String(msg.secret ?? ''));
        else await vault.checkPassword(String(msg.password ?? ''));
        await grantReauth(purposeOf(msg.purpose), { method, ...(typeof msg.walletId === 'string' && msg.walletId ? { walletId: msg.walletId } : {}) });
        return { ok: true };
      } catch (e: any) { return { ok: false, error: e?.message || 'Verification failed' }; }
    }
  },
  renameWallet: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
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
  },
  removeWallet: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      // Delete keystore + drop from vault; re-point active wallet (TW removeWallet). Vault unlocked.
      try {
        const id = String(msg.walletId ?? '');
        const state: any = await vault.getState();
        if (!state.wallets?.[id]) return { ok: false, error: 'Wallet not found' };
        if (Object.keys(state.wallets).length <= 1) return { ok: false, error: 'Cannot remove your only wallet' };
        // PT-04: deleting a keystore is irreversible. A wallet whose phrase was never backed up would be lost with its funds, so the
        // backup comes first; every removal needs the password or biometrics just now.
        if (state.wallets[id].seedPhraseBackupRequired) return { ok: false, code: 'BACKUP_REQUIRED', error: 'Back up this wallet’s secret phrase before removing it. Without it the wallet and its funds cannot be recovered.' };
        if (!(await consumeReauth('manage'))) return { ok: false, error: 'AUTH_REQUIRED' };
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
  },
  renameAccount: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
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
  },
  // markBackedUp was removed (PT-04): clearing the backup flag without the phrase check let anyone skip the backup. Use backupFinish.
};
