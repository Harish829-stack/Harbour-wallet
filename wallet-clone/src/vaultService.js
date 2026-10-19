// Vault lifecycle. RE source: §4.2 (VaultService), §4.9 (lock/throttle), §6.2 (storage schema).
// Storage keys mirror TW's schema with our own namespace prefix.
import { PasswordService, DEFAULT_ITERATIONS, UNLOCK_ITERATIONS } from './passwordService.js';
import * as passworder from './passworder.js';

const NS = 'wallet';                              // our prefix (TW uses "trust")
export const KEYS = {
  STORE:   `${NS}:store`,
  PBKDF2:  `${NS}:pbkdf2`,
  VAULT:   `${NS}:vault`,
  VAULT_ID:`${NS}:vaultId`,
  wallets: (vaultId) => `${NS}:wallets:${vaultId}`,
  PASSWORD:`${NS}:password`,   // session only
  UNLOCK:  `${NS}:unlock`,     // session only
};
// Throttle (§4.9): 5 free attempts, 5s base, 5-min cap, exponential.
const FREE_ATTEMPTS = 5, BASE_DELAY_MS = 5000, MAX_DELAY_MS = 300000;

export class VaultService {
  constructor(core, storageLocal, storageSession) {
    this.core = core; this.pw = new PasswordService(core);
    this.local = storageLocal; this.session = storageSession; // {get,set,remove}
  }
  async exists() { return Boolean((await this.local.get(KEYS.VAULT))[KEYS.VAULT]); }

  async create(password) {
    if (await this.exists()) throw new Error('FORBIDDEN_REQUEST');
    const salt = this.pw.generateSalt(32);
    const passwordKey = this.pw.deriveKeyHex(password, salt, DEFAULT_ITERATIONS);
    const unlockKey   = this.pw.deriveKeyHex(password, salt, UNLOCK_ITERATIONS);
    const saltHex = this.core.HexCoding.encode(salt);
    await this.local.set(KEYS.PBKDF2, { salt: saltHex, iterations: UNLOCK_ITERATIONS });
    await this.session.set(KEYS.PASSWORD, passwordKey);
    await this.session.set(KEYS.UNLOCK, unlockKey);
    const vaultId = crypto.randomUUID();
    await this.local.set(KEYS.VAULT_ID, { vaultId });
    await this.persistVault({ vaultId });               // write initial encrypted blob
    return vaultId;
  }
  // encrypt arbitrary redux-like state under the unlock key (Layer B)
  async persistVault(state) {
    const unlockKey = await this.session.get(KEYS.UNLOCK).then(o => o[KEYS.UNLOCK]);
    if (!unlockKey) throw new Error('LOCKED');
    const blob = await passworder.encrypt(unlockKey, state);
    await this.local.set(KEYS.VAULT, blob);
  }
  async unlock(password) {
    const t = await this.#throttleRead();
    if (t.lockedUntil > Date.now()) throw new Error('TOO_MANY_ATTEMPTS');
    const { salt, iterations } = (await this.local.get(KEYS.PBKDF2))[KEYS.PBKDF2];
    const saltBytes = this.core.HexCoding.decode(salt);
    const unlockKey = this.pw.deriveKeyHex(password, saltBytes, iterations);
    const blob = (await this.local.get(KEYS.VAULT))[KEYS.VAULT];
    let state;
    try { state = await passworder.decrypt(unlockKey, blob); }
    catch (e) { await this.#armNextLockout(t); throw new Error('Incorrect password'); }
    await this.#throttleReset();
    const passwordKey = this.pw.deriveKeyHex(password, saltBytes, DEFAULT_ITERATIONS);
    await this.session.set(KEYS.PASSWORD, passwordKey);
    await this.session.set(KEYS.UNLOCK, unlockKey);
    return state;
  }
  async lock() { await this.session.remove(KEYS.PASSWORD); await this.session.remove(KEYS.UNLOCK); }

  async #throttleRead() { return (await this.local.get('throttle'))['throttle'] || { failedAttempts: 0, lockedUntil: 0 }; }
  async #throttleReset() { await this.local.set('throttle', { failedAttempts: 0, lockedUntil: 0 }); }
  async #armNextLockout(prev) {
    const failedAttempts = prev.failedAttempts + 1;
    const excess = failedAttempts - FREE_ATTEMPTS;
    const lockedUntil = excess > 0 ? Date.now() + Math.min(BASE_DELAY_MS * 2 ** (excess - 1), MAX_DELAY_MS) : 0;
    await this.local.set('throttle', { failedAttempts, lockedUntil });
  }
}
