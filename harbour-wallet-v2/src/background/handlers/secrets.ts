// UI-facing secret operations ("dumb UI" boundary). No handler here, or anywhere else, returns a recovery phrase, private key
// or password to an extension page (core/uiSafe enforces it on every response). The phrase and keys are decrypted in the
// worker, painted into images (secretRender) or copied by a background-owned offscreen document (clipboard), and dropped.
//   backupBegin/backupCheck/backupFinish/backupCancel - reveal + "tap the words in order" with opaque chip ids (core/backupSession)
//   revealPrivateKey / copyPrivateKey / secretViewClosed - private key of an imported key wallet as an image; copy without the UI
//   importCheck - live "phrase / key detected, valid?" hint for the import form (the UI keeps no copy of what it sent)
//   qrStage - hand the scanned (encrypted) QR keystores to the worker right after scanning
// Reveal and copy require the one-shot re-authentication grant set by `revealAuth` (or by `addWallet` for a just-created wallet).
import type { HandlerMap, HandlerCtx } from './types';
import { local, session, KEYS } from '../../core/storage';
import { ALL_CHAINS, chainById } from '../../core/chains/index';
import { walletKind } from '../../core/settingsExtra';
import { classifySecret, normalizeMnemonic, validatePrivateKey } from '../../core/importKey';
import { planBackup, checkPicks } from '../../core/backupSession';
import { renderPhraseGrid, renderWord, renderSecretBlock, sanitizeTheme } from '../secretRender';
import { copySecretToClipboard } from '../clipboard';
import { stageQrKeys } from '../qrStage';
import { activeEntry } from '../walletState';

const BACKUP_KEY = 'wallet:backupSession';
const COPY_KEY = 'wallet:copyGrant';
const BACKUP_TTL_MS = 15 * 60_000;
const COPY_TTL_MS = 60_000;
const CLIPBOARD_CLEAR_MS = 60_000;
const enc = (s: string) => new TextEncoder().encode(s);
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

interface BackupSessionRecord { id: string; walletId: string; posClass: number[]; chipClass: Record<string, number>; exp: number }

/** One-shot re-authentication grant (2 minutes) set by `revealAuth`; consumed by any reveal. */
export async function consumeRevealGrant(): Promise<boolean> {
  const grant = await session.get<number>(KEYS.REVEAL); await session.remove(KEYS.REVEAL);
  return typeof grant === 'number' && grant >= Date.now();
}

/** Decrypts a seed-phrase wallet's mnemonic inside the worker. Callers must not return it. */
async function withMnemonic<T>(ctx: HandlerCtx, walletId: unknown, fn: (walletId: string, words: string[]) => Promise<T>): Promise<T> {
  const passwordKey = await session.get<string>(KEYS.PASSWORD); if (!passwordKey) throw new Error('LOCKED');
  const st: any = await ctx.vault.getState();
  const id = String(walletId ?? activeEntry(st)?.[0] ?? '');
  const ks = id ? await local.get<any>(id) : undefined;
  if (!ks || !st.wallets?.[id]) throw new Error('Wallet not found');
  if ((st.wallets[id].type ?? 'mnemonic') !== 'mnemonic') throw new Error('This wallet has no secret phrase');
  const sk = ctx.core.StoredKey.importJSON(enc(JSON.stringify(ks)));
  let words: string[] = [];
  try {
    const hd = sk.wallet(enc(passwordKey));
    try { words = String(hd.mnemonic()).split(' '); } finally { hd.delete(); }
    return await fn(id, words);
  } finally { words.fill(''); sk.delete(); }
}

/** Decrypts the single key of an imported private-key wallet inside the worker. Callers must not return it. */
async function withPrivateKey<T>(ctx: HandlerCtx, walletId: unknown, fn: (key: string, meta: { network: string; format: 'hex' | 'base58' }) => Promise<T>): Promise<T> {
  const passwordKey = await session.get<string>(KEYS.PASSWORD); if (!passwordKey) throw new Error('LOCKED');
  const st: any = await ctx.vault.getState(); const id = String(walletId ?? '');
  const w = st.wallets?.[id]; if (!w) throw new Error('Wallet not found');
  if (walletKind(w) !== 'privateKey') throw new Error('This wallet has no private key to show');
  const ks = await local.get<any>(id); if (!ks) throw new Error('Wallet not found');
  const { core } = ctx; const ct = (w.blockchain && w.blockchain !== 'evm' ? w.blockchain : 'ethereum');
  const chain = ALL_CHAINS.find((c) => c.ct === ct) ?? chainById('ethereum')!;
  const sk = core.StoredKey.importJSON(enc(JSON.stringify(ks)));
  try {
    const pk = sk.privateKey(core.CoinType[chain.ct], enc(passwordKey));
    try {
      const data: Uint8Array = pk.data();
      const format = chain.kind === 'solana' ? 'base58' as const : 'hex' as const; // what other wallets import
      const key = format === 'base58' ? core.Base58.encodeNoCheck(data) : core.HexCoding.encode(data).replace(/^0x/, '');
      try { return await fn(key, { network: chain.name, format }); } finally { data.fill(0); }
    } finally { pk.delete(); }
  } finally { sk.delete(); }
}

async function readBackup(sessionId: unknown): Promise<BackupSessionRecord | null> {
  const s = await session.get<BackupSessionRecord>(BACKUP_KEY);
  if (!s || typeof sessionId !== 'string' || s.id !== sessionId) return null;
  if (s.exp < Date.now()) { await session.remove(BACKUP_KEY); return null; }
  return s;
}
const fail = (e: any, fallback: string) => ({ ok: false, error: e?.message || fallback });

export const handlers: HandlerMap = {
  async backupBegin(m, ctx) {
    try {
      if (!(await ctx.vault.isUnlocked())) return { ok: false, error: 'LOCKED' };
      if (!(await consumeRevealGrant())) return { ok: false, error: 'AUTH_REQUIRED' };
      const theme = sanitizeTheme(m.theme);
      return await withMnemonic(ctx, m.walletId, async (walletId, words) => {
        const plan = planBackup(words, randomId, secureRandom);
        const grid = await renderPhraseGrid(words, theme);
        const chips = [];
        for (const c of plan.chips) chips.push({ id: c.id, ...(await renderWord(words[c.index], theme)) });
        const id = randomId();
        await session.set(BACKUP_KEY, { id, walletId, posClass: plan.posClass, chipClass: { ...plan.chipClass }, exp: Date.now() + BACKUP_TTL_MS } satisfies BackupSessionRecord);
        return { ok: true, sessionId: id, walletId, wordCount: words.length, grid, chips };
      });
    } catch (e: any) { return fail(e, 'Could not reveal the phrase'); }
  },

  async backupCheck(m) {
    const s = await readBackup(m.sessionId); if (!s) return { ok: false, error: 'BACKUP_EXPIRED' };
    return { ok: true, ...checkPicks(s, m.picked) };
  },

  async backupFinish(m, ctx) {
    try {
      const s = await readBackup(m.sessionId); if (!s) return { ok: false, error: 'BACKUP_EXPIRED' };
      const r = checkPicks(s, m.picked); if (!r.complete) return { ok: false, error: 'BACKUP_MISMATCH', ...r };
      const state: any = await ctx.vault.getState();
      if (!state.wallets?.[s.walletId]) return { ok: false, error: 'Wallet not found' };
      state.wallets[s.walletId].seedPhraseBackupRequired = false;
      await ctx.vault.persist(state);
      await session.remove(BACKUP_KEY);
      return { ok: true, walletId: s.walletId };
    } catch (e: any) { return fail(e, 'Could not save'); }
  },

  async backupCancel(m) { if (await readBackup(m.sessionId)) await session.remove(BACKUP_KEY); return { ok: true }; },

  async revealPrivateKey(m, ctx) {
    try {
      if (!(await ctx.vault.isUnlocked())) return { ok: false, error: 'Wallet is locked' };
      if (!(await consumeRevealGrant())) return { ok: false, error: 'AUTH_REQUIRED' };
      const theme = sanitizeTheme(m.theme);
      return await withPrivateKey(ctx, m.walletId, async (key, meta) => {
        const view = await renderSecretBlock(key, theme, meta.format === 'hex' ? 32 : 30);
        await session.set(COPY_KEY, { walletId: String(m.walletId), exp: Date.now() + COPY_TTL_MS });
        return { ok: true, ...view, network: meta.network, format: meta.format, length: key.length, visibleForMs: COPY_TTL_MS };
      });
    } catch (e: any) { return fail(e, 'Reveal failed'); }
  },

  // Copy the key that is currently shown (same 60 s window as the view). The UI never receives the key; the clipboard is cleared after 60 s.
  async copyPrivateKey(m, ctx) {
    try {
      const g = await session.get<{ walletId: string; exp: number }>(COPY_KEY);
      if (!g || g.walletId !== String(m.walletId ?? '') || g.exp < Date.now()) return { ok: false, error: 'AUTH_REQUIRED' };
      await withPrivateKey(ctx, m.walletId, (key) => copySecretToClipboard(key, CLIPBOARD_CLEAR_MS));
      return { ok: true, clearsInMs: CLIPBOARD_CLEAR_MS };
    } catch (e: any) { return fail(e, 'Could not copy'); }
  },

  async secretViewClosed() { await session.remove(COPY_KEY); return { ok: true }; },

  // Live validation for the import form. Returns only the kind and validity; nothing is kept.
  async importCheck(m, ctx) {
    const secret = typeof m.secret === 'string' ? m.secret : '';
    const kind = classifySecret(secret);
    if (kind === 'mnemonic') return { ok: true, kind, valid: ctx.wallet.isValidMnemonic(normalizeMnemonic(secret)) };
    if (kind === 'privateKey') {
      const chain = m.group === true ? chainById('ethereum') : chainById(String(m.chainId ?? ''));
      if (!chain) return { ok: true, kind, valid: false, needsNetwork: true };
      const v = validatePrivateKey(ctx.core, secret, chain.ct); v.bytes.fill(0);
      return { ok: true, kind, valid: v.isValid };
    }
    return { ok: true, kind, valid: false };
  },

  async qrStage(m) { return stageQrKeys(m.storedKeys); },
};
