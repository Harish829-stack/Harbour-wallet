import { PasswordService, DEFAULT_ITERATIONS } from './passwordService';
import * as passworder from './passworder';
import { local, session, KEYS } from './storage';
import { ARGON2_DEFAULT, deriveV2, isV2, v2Record, type Argon2Params, type KdfRecord } from './keySchedule';
import { rekeyBlob, rekeyKeystore } from './keyMigration';
const FREE_ATTEMPTS = 5, BASE_DELAY_MS = 5000, MAX_DELAY_MS = 300000;
type Throttle = { failedAttempts: number; lockedUntil: number };

export class VaultService {
  private pw: PasswordService;
  /** `argon2` is overridable for tests only; production always uses ARGON2_DEFAULT. */
  constructor(private core: any, private argon2: Argon2Params = ARGON2_DEFAULT) { this.pw = new PasswordService(core); }

  /** Password -> the two session keys, for whichever key schedule the stored record uses (v1 PBKDF2 or v2 Argon2id). */
  private derive(password: string, rec: KdfRecord): { unlockKey: string; passwordKey: string } {
    const salt = this.core.HexCoding.decode(rec.salt);
    if (isV2(rec)) return deriveV2(password, salt, rec);
    return { unlockKey: this.pw.deriveKeyHex(password, salt, rec.iterations), passwordKey: this.pw.deriveKeyHex(password, salt, DEFAULT_ITERATIONS) };
  }

  async exists(): Promise<boolean> { return Boolean(await local.get(KEYS.VAULT)); }

  async create(password: string, initialState: Record<string, unknown> = {}): Promise<string> {
    if (await this.exists()) throw new Error('FORBIDDEN_REQUEST');
    const salt = this.pw.generateSalt(32);
    const { unlockKey, passwordKey } = deriveV2(password, salt, this.argon2);
    await local.set(KEYS.PBKDF2, v2Record(this.core.HexCoding.encode(salt), this.argon2));
    await session.set(KEYS.PASSWORD, passwordKey);
    await session.set(KEYS.UNLOCK, unlockKey);
    const vaultId = crypto.randomUUID();
    await local.set(KEYS.VAULT_ID, { vaultId });
    await this.persist({ vaultId, ...initialState });
    return vaultId;
  }
  async persist(state: Record<string, unknown>): Promise<void> {
    const unlockKey = await session.get<string>(KEYS.UNLOCK);
    if (!unlockKey) throw new Error('LOCKED');
    await local.set(KEYS.VAULT, await passworder.encrypt(unlockKey, state));
  }
  // Password attempts are serialized (TW UnlockThrottleService.guard): without this, parallel guesses would all read the same
  // failed-attempt counter before any of them arms the lockout, and the throttle could be bypassed.
  private chain: Promise<unknown> = Promise.resolve();
  private serial<R>(fn: () => Promise<R>): Promise<R> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }
  unlock<T=any>(password: string): Promise<T> { return this.serial(() => this.unlockInner<T>(password)); }
  checkPassword(password: string): Promise<void> { return this.serial(() => this.checkPasswordInner(password)); }

  private async unlockInner<T=any>(password: string): Promise<T> {
    const t = await this.throttle();
    if (t.lockedUntil > Date.now()) throw new Error('TOO_MANY_ATTEMPTS');
    const pb = await local.get<KdfRecord>(KEYS.PBKDF2);
    if (!pb) throw new Error('VAULT_IS_EMPTY');
    let keys = this.derive(password, pb);
    const blob = await local.get<string>(KEYS.VAULT);
    let state: T;
    try { state = await passworder.decrypt<T>(keys.unlockKey, blob!); }
    catch { await this.arm(t); throw new Error('Incorrect password'); }
    await this.reset();
    // Wallets created before the Argon2id key schedule are upgraded the first time the right password is typed. The upgrade is
    // all-or-nothing; if anything goes wrong the old data is untouched and the wallet simply unlocks as before.
    if (!isV2(pb)) { try { keys = await this.migrateToV2(password, state, keys); } catch { /* nothing was written; the upgrade is attempted again on the next unlock */ } }
    await session.set(KEYS.PASSWORD, keys.passwordKey);
    await session.set(KEYS.UNLOCK, keys.unlockKey);
    return state;
  }

  // Re-encrypts every blob that depends on the password (vault, keystores, perps agent keys, prediction credentials) under the `neu` keys and
  // checks each result. Nothing is written here: the caller commits the returned updates in a single storage write, so a failure at any
  // point leaves the old, working data untouched.
  private async rekeyAll(state: any, old: { unlockKey: string; passwordKey: string }, neu: { unlockKey: string; passwordKey: string }): Promise<Record<string, unknown>> {
    const updates: Record<string, unknown> = {};
    const vaultId = (await local.get<{ vaultId: string }>(KEYS.VAULT_ID))?.vaultId;
    const ids = new Set<string>([...Object.keys(state?.wallets ?? {}), ...(vaultId ? ((await local.get<string[]>(KEYS.wallets(vaultId))) ?? []) : [])]);
    for (const id of ids) {
      const ks = await local.get<any>(id);
      if (ks && typeof ks === 'object') updates[id] = rekeyKeystore(this.core, ks, old.passwordKey, neu.passwordKey); // throws -> abort, nothing written
    }
    const agents = await local.get<Record<string, any>>(KEYS.PERPS_AGENTS);
    if (agents) {
      const next: Record<string, any> = {};
      for (const [scope, rec] of Object.entries(agents)) { const enc = await rekeyBlob(rec?.enc, old.passwordKey, neu.passwordKey); if (enc) next[scope] = { ...rec, enc }; } // unreadable agent keys are dropped: perps asks to enable again
      updates[KEYS.PERPS_AGENTS] = next;
    }
    const creds = await local.get<Record<string, string>>(KEYS.PREDICTIONS_CREDS);
    if (creds) {
      const next: Record<string, string> = {};
      for (const [scope, blob] of Object.entries(creds)) { const enc = await rekeyBlob(blob, old.passwordKey, neu.passwordKey); if (enc) next[scope] = enc; } // unreadable ones are re-derived on demand
      updates[KEYS.PREDICTIONS_CREDS] = next;
    }
    const vaultBlob = await passworder.encrypt(neu.unlockKey, state);
    if (JSON.stringify(await passworder.decrypt(neu.unlockKey, vaultBlob)) !== JSON.stringify(state)) throw new Error('VAULT_REKEY_MISMATCH');
    updates[KEYS.VAULT] = vaultBlob;
    return updates;
  }

  // v1 -> v2: everything is re-keyed under the Argon2id-derived keys.
  private async migrateToV2(password: string, state: any, old: { unlockKey: string; passwordKey: string }): Promise<{ unlockKey: string; passwordKey: string }> {
    const salt = this.pw.generateSalt(32);
    const neu = deriveV2(password, salt, this.argon2);
    const updates = await this.rekeyAll(state, old, neu);
    updates[KEYS.PBKDF2] = v2Record(this.core.HexCoding.encode(salt), this.argon2);
    await local.setMany(updates);
    // The biometric blob holds the OLD keys; it cannot be re-sealed without the authenticator, so it is cleared and the user
    // sets biometrics up again from Settings.
    await local.remove(KEYS.PASSKEY); await local.remove(KEYS.PASSKEY_VAULT);
    return neu;
  }

  /**
   * Gives a biometrics-only wallet (its password was generated and thrown away) a password the user chose, so that biometrics are a
   * convenience and not the only way in. The wallet must be unlocked; `passkeySecret` (already verified by the caller against the live
   * session) re-seals the biometric blob under the new keys in the SAME storage write, so biometrics keep working and a failure
   * anywhere leaves the old password-less wallet exactly as it was.
   */
  setPassword(newPassword: string, passkeySecret: string): Promise<void> { return this.serial(async () => {
    const unlockKey = await session.get<string>(KEYS.UNLOCK); const passwordKey = await session.get<string>(KEYS.PASSWORD);
    if (!unlockKey || !passwordKey) throw new Error('LOCKED');
    const meta = await local.get<Record<string, unknown>>(KEYS.PASSKEY);
    if (!meta) throw new Error('BIOMETRICS_NOT_SET_UP');
    const state = await this.getState();
    const salt = this.pw.generateSalt(32);
    const neu = deriveV2(newPassword, salt, this.argon2);
    const updates = await this.rekeyAll(state, { unlockKey, passwordKey }, neu);
    updates[KEYS.PBKDF2] = v2Record(this.core.HexCoding.encode(salt), this.argon2);
    updates[KEYS.PASSKEY_VAULT] = await passworder.encrypt(passkeySecret, { passwordKey: neu.passwordKey, unlockKey: neu.unlockKey });
    updates[KEYS.PASSKEY] = { ...meta, isPasswordGenerated: false };
    await local.setMany(updates);
    await session.set(KEYS.PASSWORD, neu.passwordKey);
    await session.set(KEYS.UNLOCK, neu.unlockKey);
    await this.reset();
  }); }
  // Re-authentication for sensitive actions (reveal phrase): verifies the password against the stored vault WITHOUT touching the
  // session, with the same throttling as the lock screen.
  private async checkPasswordInner(password: string): Promise<void> {
    const t = await this.throttle();
    if (t.lockedUntil > Date.now()) throw new Error('TOO_MANY_ATTEMPTS');
    const pb = await local.get<KdfRecord>(KEYS.PBKDF2);
    const blob = await local.get<string>(KEYS.VAULT);
    if (!pb || !blob) throw new Error('VAULT_IS_EMPTY');
    const key = this.derive(String(password ?? ''), pb).unlockKey;
    try { await passworder.decrypt(key, blob); } catch { await this.arm(t); throw new Error('Incorrect password'); }
    await this.reset();
  }
  // Proves a derived unlock key really opens the stored vault (used by biometric unlock before it becomes the session).
  async verifyUnlockKey(unlockKey: string): Promise<void> {
    const blob = await local.get<string>(KEYS.VAULT);
    if (!blob) throw new Error('VAULT_IS_EMPTY');
    await passworder.decrypt(unlockKey, blob);
  }
  async lock(): Promise<void> { await session.remove(KEYS.PASSWORD); await session.remove(KEYS.UNLOCK); }
  async isUnlocked(): Promise<boolean> { return Boolean(await session.get(KEYS.UNLOCK)); }

  // Read the decrypted vault state using the live session unlock key (no password re-prompt).
  async getState<T = any>(): Promise<T> {
    const unlockKey = await session.get<string>(KEYS.UNLOCK);
    if (!unlockKey) throw new Error('LOCKED');
    const blob = await local.get<string>(KEYS.VAULT);
    if (!blob) throw new Error('VAULT_IS_EMPTY');
    return passworder.decrypt<T>(unlockKey, blob);
  }

  private async throttle(): Promise<Throttle> { return (await local.get<Throttle>(KEYS.THROTTLE)) ?? { failedAttempts: 0, lockedUntil: 0 }; }
  private async reset() { await local.set(KEYS.THROTTLE, { failedAttempts: 0, lockedUntil: 0 }); }
  private async arm(prev: Throttle) {
    const failedAttempts = prev.failedAttempts + 1;
    const excess = failedAttempts - FREE_ATTEMPTS;
    const lockedUntil = excess > 0 ? Date.now() + Math.min(BASE_DELAY_MS * 2 ** (excess - 1), MAX_DELAY_MS) : 0;
    await local.set(KEYS.THROTTLE, { failedAttempts, lockedUntil });
  }
}
