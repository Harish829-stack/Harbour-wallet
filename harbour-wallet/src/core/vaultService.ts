import { PasswordService, DEFAULT_ITERATIONS, UNLOCK_ITERATIONS } from './passwordService';
import * as passworder from './passworder';
import { local, session, KEYS } from './storage';
const FREE_ATTEMPTS = 5, BASE_DELAY_MS = 5000, MAX_DELAY_MS = 300000;
type Throttle = { failedAttempts: number; lockedUntil: number };

export class VaultService {
  private pw: PasswordService;
  constructor(private core: any) { this.pw = new PasswordService(core); }

  async exists(): Promise<boolean> { return Boolean(await local.get(KEYS.VAULT)); }

  async create(password: string, initialState: Record<string, unknown> = {}): Promise<string> {
    if (await this.exists()) throw new Error('FORBIDDEN_REQUEST');
    const salt = this.pw.generateSalt(32);
    const passwordKey = this.pw.deriveKeyHex(password, salt, DEFAULT_ITERATIONS);
    const unlockKey = this.pw.deriveKeyHex(password, salt, UNLOCK_ITERATIONS);
    await local.set(KEYS.PBKDF2, { salt: this.core.HexCoding.encode(salt), iterations: UNLOCK_ITERATIONS });
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
  async unlock<T=any>(password: string): Promise<T> {
    const t = await this.throttle();
    if (t.lockedUntil > Date.now()) throw new Error('TOO_MANY_ATTEMPTS');
    const pb = await local.get<{ salt: string; iterations: number }>(KEYS.PBKDF2);
    if (!pb) throw new Error('VAULT_IS_EMPTY');
    const saltBytes = this.core.HexCoding.decode(pb.salt);
    const unlockKey = this.pw.deriveKeyHex(password, saltBytes, pb.iterations);
    const blob = await local.get<string>(KEYS.VAULT);
    let state: T;
    try { state = await passworder.decrypt<T>(unlockKey, blob!); }
    catch { await this.arm(t); throw new Error('Incorrect password'); }
    await this.reset();
    await session.set(KEYS.PASSWORD, this.pw.deriveKeyHex(password, saltBytes, DEFAULT_ITERATIONS));
    await session.set(KEYS.UNLOCK, unlockKey);
    return state;
  }
  async lock(): Promise<void> { await session.remove(KEYS.PASSWORD); await session.remove(KEYS.UNLOCK); }
  async isUnlocked(): Promise<boolean> { return Boolean(await session.get(KEYS.UNLOCK)); }

  private async throttle(): Promise<Throttle> { return (await local.get<Throttle>(KEYS.THROTTLE)) ?? { failedAttempts: 0, lockedUntil: 0 }; }
  private async reset() { await local.set(KEYS.THROTTLE, { failedAttempts: 0, lockedUntil: 0 }); }
  private async arm(prev: Throttle) {
    const failedAttempts = prev.failedAttempts + 1;
    const excess = failedAttempts - FREE_ATTEMPTS;
    const lockedUntil = excess > 0 ? Date.now() + Math.min(BASE_DELAY_MS * 2 ** (excess - 1), MAX_DELAY_MS) : 0;
    await local.set(KEYS.THROTTLE, { failedAttempts, lockedUntil });
  }
}
