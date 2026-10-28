// Feature message handlers: onboardingExtra. Every message here is UI-only (the router enforces isInternalWalletSender before dispatch).
//
// Import flow (mirrors TW's two-phase INITIATE_IMPORT_* / COMPLETE_IMPORT_*): `importInitiate` validates the secret, derives the
// addresses and keeps the secret in service-worker memory only (10 minutes, never persisted, never sent back to the UI);
// `importComplete` writes the encrypted keystore. A service-worker restart drops the pending secret and the UI asks for it again.
import type { HandlerMap, HandlerCtx, Msg } from './types';
import { local, session, KEYS } from '../../core/storage';
import { validatePassword } from '../../core/passwordPolicy';
import { removePasskey } from '../../core/passkeyService';
import { armLockTimer } from '../settingsService';
import { ALL_CHAINS, chainById } from '../../core/chains/index';
import { fetchNativeBalance } from '../../core/chains/adapters';
import { solanaRpcUrl } from '../../core/rpc';
import { MAX_WALLETS, WALLET_LIMIT_ERROR, canCreateWallet, classifySecret, normalizeMnemonic, validatePrivateKey, hasDuplicateAddress, pickSolanaVariants, solanaHasHistory, evmFamily, validateWalletName, defaultWalletName, IMPORT_ERRORS, type SolanaVariant } from '../../core/importKey';
import { onboardingMode } from '../../core/onboardingRules';
import { decryptStoredKeys } from '../../core/qrImport';

const PENDING_TTL_MS = 10 * 60_000;
type PendingMnemonic = { kind: 'mnemonic'; mnemonic: string; at: number };
type PendingKey = { kind: 'privateKey'; bytes: Uint8Array; ct: string; group: boolean; at: number };
const pending = new Map<string, PendingMnemonic | PendingKey>();
const sweep = () => { const now = Date.now(); for (const [id, p] of pending) if (now - p.at > PENDING_TTL_MS) { if (p.kind === 'privateKey') p.bytes.fill(0); pending.delete(id); } };
const forget = (id: string) => { const p = pending.get(id); if (p?.kind === 'privateKey') p.bytes.fill(0); pending.delete(id); };
export const _pendingCount = () => pending.size; // test hook

let busy = false;

async function readState(ctx: HandlerCtx): Promise<{ hasVault: boolean; unlocked: boolean; state: any | null }> {
  const hasVault = await ctx.vault.exists(); const unlocked = hasVault && (await ctx.vault.isUnlocked());
  let state: any = null; if (unlocked) { try { state = await ctx.vault.getState(); } catch { state = null; } }
  return { hasVault, unlocked, state };
}
const walletNames = (state: any): string[] => Object.values(state?.wallets ?? {}).map((w: any) => String(w?.label ?? w?.name ?? ''));

async function dropVaultKeys() {
  for (const k of [KEYS.VAULT, KEYS.VAULT_ID, KEYS.PBKDF2, KEYS.THROTTLE]) await local.remove(k);
  await session.remove(KEYS.PASSWORD); await session.remove(KEYS.UNLOCK); await session.remove(KEYS.REVEAL);
  await removePasskey().catch(() => {});
}

/** Derive an address for every EVM chain from one secp256k1 key (TW: importing on any EVM chain adds all EVM chains). */
function pkAddresses(core: any, bytes: Uint8Array, ct: string, group: boolean): Record<string, string> {
  const pk = core.PrivateKey.createWithData(bytes); const out: Record<string, string> = {};
  try {
    const cts = new Set<string>([ct]); if (group) for (const c of evmFamily(ALL_CHAINS)) cts.add(c.ct);
    for (const name of cts) { const coin = core.CoinType[name]; if (coin) out[name] = core.CoinTypeExt.deriveAddress(coin, pk); }
  } finally { pk.delete(); }
  return out;
}

export interface CreateSpec { kind: 'mnemonic'; mnemonic: string; phantom: boolean } 
export interface CreateKeySpec { kind: 'privateKey'; bytes: Uint8Array; ct: string; group: boolean }
/** Writes one wallet (keystore + vault entry). The vault must be unlocked. Returns the new wallet id. */
export async function persistImportedWallet(ctx: HandlerCtx, spec: CreateSpec | CreateKeySpec, name: string): Promise<{ walletId: string; addresses: Record<string, string> }> {
  const passwordKey = await session.get<string>(KEYS.PASSWORD); if (!passwordKey) throw new Error('LOCKED');
  const state: any = await ctx.vault.getState();
  state.wallets = state.wallets ?? {};
  if (!canCreateWallet(Object.keys(state.wallets).length)) throw new Error(WALLET_LIMIT_ERROR);
  const { core, wallet } = ctx;
  let keystore: any; let walletId: string; let addresses: Record<string, string>; let type: 'mnemonic' | 'privateKey'; let blockchain: string | undefined;
  if (spec.kind === 'mnemonic') {
    addresses = wallet.deriveAddresses(spec.mnemonic, spec.phantom);
    if (hasDuplicateAddress(state.wallets, 'ethereum', addresses.ethereum)) throw new Error('MNEMONIC_ALREADY_EXISTS');
    const sk = await wallet.buildStoredKey(spec.mnemonic, name, spec.phantom);
    try { walletId = sk.identifier(); keystore = JSON.parse(new TextDecoder().decode(sk.exportJSON())); } finally { sk.delete(); }
    type = 'mnemonic';
  } else {
    addresses = pkAddresses(core, spec.bytes, spec.ct, spec.group);
    if (Object.entries(addresses).some(([ct, a]) => hasDuplicateAddress(state.wallets, ct, a))) throw new Error('PRIVATE_KEY_DUPLICATED');
    const coin = core.CoinType[spec.ct];
    const sk = core.StoredKey.importPrivateKeyWithEncryption(spec.bytes, name, new TextEncoder().encode(passwordKey), coin, core.StoredKeyEncryption.aes128Ctr);
    try { walletId = sk.identifier(); keystore = JSON.parse(new TextDecoder().decode(sk.exportJSON())); } finally { sk.delete(); }
    type = 'privateKey'; blockchain = spec.group ? 'evm' : spec.ct;
  }
  const vaultId = state.vaultId ?? (await local.get<{ vaultId: string }>(KEYS.VAULT_ID))!.vaultId;
  await local.set(walletId, keystore);
  const list = (await local.get<string[]>(KEYS.wallets(vaultId))) ?? Object.keys(state.wallets);
  if (!list.includes(walletId)) list.push(walletId);
  await local.set(KEYS.wallets(vaultId), list);
  state.wallets[walletId] = { name, label: name, type, ...(blockchain ? { blockchain } : {}), addresses, accounts: [{ derivationIndex: 0, name: 'Account 1', addresses }], activeAccount: 0, seedPhraseBackupRequired: false, importedAt: Date.now() };
  state.activeWalletId = walletId;
  await ctx.vault.persist(state);
  return { walletId, addresses };
}

/** First wallet: create the vault with the chosen password (TW SavePassword). Returns true when this call created it. */
async function ensureVault(ctx: HandlerCtx, password: unknown): Promise<{ created: boolean; error?: string }> {
  const { hasVault, unlocked } = await readState(ctx);
  if (hasVault) return unlocked ? { created: false } : { created: false, error: 'LOCKED' };
  if (typeof password !== 'string' || !validatePassword(password).valid) return { created: false, error: 'INVALID_WALLET_INPUT' };
  await removePasskey().catch(() => {}); // a brand-new vault must never inherit an old biometric seal
  await ctx.vault.create(password, { wallets: {}, createdAt: Date.now() });
  return { created: true };
}

function sanitizeName(raw: unknown, state: any): { ok: true; name: string } | { ok: false; error: string } {
  const names = walletNames(state);
  const name = typeof raw === 'string' && raw.trim() ? raw.trim() : defaultWalletName(names);
  const v = validateWalletName(name, names);
  return v.isValid ? { ok: true, name } : { ok: false, error: v.error! };
}

export const handlers: HandlerMap = {
  // Which onboarding mode applies, and what the UI needs to render it.
  async onboardingStatus(_m: Msg, ctx) {
    const s = await readState(ctx);
    const walletCount = Object.keys(s.state?.wallets ?? {}).length;
    const mode = onboardingMode({ hasVault: s.hasVault, unlocked: s.unlocked, walletCount });
    return { ok: true, hasVault: s.hasVault, unlocked: s.unlocked, walletCount, maxWallets: MAX_WALLETS, canCreateWallet: canCreateWallet(walletCount), mode, defaultName: defaultWalletName(walletNames(s.state)), names: walletNames(s.state) };
  },

  // Interrupted setup: the vault exists (password chosen) but holds no wallet. Starting over removes that empty vault.
  async resetEmptyVault(_m, ctx) {
    const s = await readState(ctx);
    if (!s.hasVault) return { ok: true };
    if (!s.unlocked || !s.state || Object.keys(s.state.wallets ?? {}).length > 0) return { ok: false, error: 'FORBIDDEN_REQUEST' };
    await dropVaultKeys(); pending.clear();
    return { ok: true };
  },

  // Per-key validation for the live "Invalid private key" hint. No secret is stored.
  async validatePrivateKey(m, ctx) {
    const chain = m.group ? chainById('ethereum') : chainById(String(m.chainId ?? ''));
    if (!chain) return { ok: false, valid: false, error: 'Select a network' };
    const v = validatePrivateKey(ctx.core, String(m.privateKey ?? ''), chain.ct); v.bytes.fill(0);
    return { ok: true, valid: v.isValid };
  },

  async importInitiate(m, ctx) {
    sweep();
    const s = await readState(ctx);
    if (s.hasVault && !s.unlocked) return { ok: false, error: 'LOCKED' };
    if (s.state && !canCreateWallet(Object.keys(s.state.wallets ?? {}).length)) return { ok: false, error: WALLET_LIMIT_ERROR };
    const secret = String(m.secret ?? '');
    const kind = classifySecret(secret);
    const id = crypto.randomUUID();
    try {
      if (kind === 'mnemonic') {
        const mnemonic = normalizeMnemonic(secret);
        if (!ctx.wallet.isValidMnemonic(mnemonic)) return { ok: false, error: IMPORT_ERRORS.invalidMnemonic };
        const def = ctx.wallet.deriveAddresses(mnemonic, false); const phantom = ctx.wallet.deriveAddresses(mnemonic, true);
        if (hasDuplicateAddress(s.state?.wallets, 'ethereum', def.ethereum)) return { ok: false, error: 'MNEMONIC_ALREADY_EXISTS' };
        const sol = chainById('solana')!;
        let history: [boolean, boolean] | null = null;
        if (def.solana !== phantom.solana) {
          try { const h = await solanaHasHistory([def.solana, phantom.solana], [solanaRpcUrl(), ...(sol.endpoints ?? [])].filter((u, i, a) => u && a.indexOf(u) === i)); history = [h[0], h[1]]; } catch { history = null; }
        } else history = [true, false];
        const types = pickSolanaVariants(history);
        const addrOf = (t: SolanaVariant) => (t === 'default' ? def.solana : phantom.solana);
        const accounts = await Promise.all(types.map(async (t) => {
          const b = types.length > 1 ? await fetchNativeBalance(sol, addrOf(t)) : null;
          return { type: t, address: addrOf(t), balance: b?.ok ? b.formatted : null, symbol: sol.symbol, hasTransactions: history ? (t === 'default' ? history[0] : history[1]) : false };
        }));
        pending.set(id, { kind: 'mnemonic', mnemonic, at: Date.now() });
        return { ok: true, pendingId: id, kind, wordCount: mnemonic.split(' ').length, solanaChoice: types.length > 1, solanaVariant: types[0], accounts };
      }
      if (kind === 'privateKey') {
        const group = m.group === true; const chain = group ? chainById('ethereum') : chainById(String(m.chainId ?? ''));
        if (!chain) return { ok: false, error: 'Select a network' };
        const v = validatePrivateKey(ctx.core, secret, chain.ct);
        if (!v.isValid) return { ok: false, error: IMPORT_ERRORS.invalidKey };
        const addrs = pkAddresses(ctx.core, v.bytes, chain.ct, group);
        if (Object.entries(addrs).some(([ct, a]) => hasDuplicateAddress(s.state?.wallets, ct, a))) { v.bytes.fill(0); return { ok: false, error: 'PRIVATE_KEY_DUPLICATED' }; }
        pending.set(id, { kind: 'privateKey', bytes: v.bytes, ct: chain.ct, group, at: Date.now() });
        return { ok: true, pendingId: id, kind, solanaChoice: false, address: addrs[chain.ct] };
      }
      return { ok: false, error: IMPORT_ERRORS.invalidMnemonic };
    } catch (e: any) { forget(id); return { ok: false, error: e?.message || 'Import failed' }; }
  },

  async importCancel(m) { forget(String(m.pendingId ?? '')); return { ok: true }; },

  async importComplete(m, ctx) {
    sweep();
    if (busy) return { ok: false, error: 'WALLET_CREATION_IN_PROGRESS' };
    const id = String(m.pendingId ?? ''); const p = pending.get(id);
    if (!p) return { ok: false, error: 'IMPORT_EXPIRED' };
    busy = true; let createdVault = false;
    try {
      const v = await ensureVault(ctx, m.password); if (v.error) return { ok: false, error: v.error }; createdVault = v.created;
      const s = await readState(ctx);
      const nm = sanitizeName(m.name, s.state); if (!nm.ok) { if (createdVault) await dropVaultKeys(); return { ok: false, error: nm.error }; }
      const spec = p.kind === 'mnemonic' ? { kind: 'mnemonic' as const, mnemonic: p.mnemonic, phantom: m.solanaVariant === 'phantom' } : { kind: 'privateKey' as const, bytes: p.bytes, ct: p.ct, group: p.group };
      const r = await persistImportedWallet(ctx, spec, nm.name);
      forget(id);
      await armLockTimer().catch(() => {});
      return { ok: true, walletId: r.walletId, addresses: r.addresses, type: p.kind };
    } catch (e: any) {
      if (createdVault) await dropVaultKeys(); // never leave a half-created vault behind
      return { ok: false, error: e?.message || 'Import failed' };
    } finally { busy = false; }
  },

  // ---- QR import (mobile export): verify the one-time code, then import every key (TW VERIFY_STORED_KEYS / IMPORT_STORED_KEYS).
  async qrVerify(m, ctx) {
    const keys = Array.isArray(m.storedKeys) ? m.storedKeys : [];
    if (!keys.length || keys.length > 100) return { ok: false, error: 'Unexpected QR contents' };
    const r = await decryptStoredKeys(ctx.core, keys, String(m.code ?? ''));
    for (const s of r.secrets) if (s.kind === 'privateKey') s.bytes.fill(0);
    if (!r.secrets.length) return { ok: false, error: r.wrong ? 'INCORRECT_CODE' : 'No importable wallets in this QR code', skipped: r.skipped };
    return { ok: true, count: r.secrets.length, skipped: r.skipped };
  },
  async qrImportAll(m, ctx) {
    if (busy) return { ok: false, error: 'WALLET_CREATION_IN_PROGRESS' };
    const keys = Array.isArray(m.storedKeys) ? m.storedKeys : [];
    if (!keys.length || keys.length > 100) return { ok: false, error: 'Unexpected QR contents' };
    busy = true; let createdVault = false;
    try {
      const dec = await decryptStoredKeys(ctx.core, keys, String(m.code ?? ''));
      if (!dec.secrets.length) return { ok: false, error: dec.wrong ? 'INCORRECT_CODE' : 'No importable wallets in this QR code' };
      const v = await ensureVault(ctx, m.password); if (v.error) return { ok: false, error: v.error }; createdVault = v.created;
      let imported = 0, duplicates = 0, lastErr = '';
      for (const sec of dec.secrets) {
        const s = await readState(ctx);
        const names = walletNames(s.state);
        const base = sec.name && !names.includes(sec.name) ? sec.name : defaultWalletName(names);
        try {
          if (sec.kind === 'mnemonic') await persistImportedWallet(ctx, { kind: 'mnemonic', mnemonic: sec.mnemonic, phantom: false }, base);
          else { const ch = ALL_CHAINS.find((c) => c.ct === sec.coin); await persistImportedWallet(ctx, { kind: 'privateKey', bytes: sec.bytes, ct: sec.coin, group: ch?.blockchain === 'Ethereum' }, base); }
          imported++;
        } catch (e: any) {
          if (e?.message === 'MNEMONIC_ALREADY_EXISTS' || e?.message === 'PRIVATE_KEY_DUPLICATED') duplicates++; else { lastErr = e?.message || 'Import failed'; if (lastErr === WALLET_LIMIT_ERROR) break; }
        } finally { if (sec.kind === 'privateKey') sec.bytes.fill(0); }
      }
      if (!imported && !duplicates) { if (createdVault) await dropVaultKeys(); return { ok: false, error: lastErr || 'Import failed' }; }
      if (!imported && createdVault) { await dropVaultKeys(); return { ok: false, error: 'MNEMONIC_ALREADY_EXISTS' }; }
      await armLockTimer().catch(() => {});
      return { ok: true, imported, duplicates, skipped: dec.skipped };
    } catch (e: any) { if (createdVault) await dropVaultKeys(); return { ok: false, error: e?.message || 'Import failed' }; }
    finally { busy = false; }
  },
};
