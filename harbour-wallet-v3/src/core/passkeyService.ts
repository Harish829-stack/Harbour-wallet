// Background half of biometric unlock (TW: PasskeyService, storage key "passkey:vault").
// TW encrypts the wallet's derived password under a key derived from the passkey secret; Harbour does the same with the
// derived vault keys, so the user's password is never stored. Only someone holding the authenticator (and passing its
// user verification) can recover the 32-byte secret and therefore these keys.
import * as passworder from './passworder';
import { local, session, KEYS } from './storage';
import { SECRET_HEX } from './passkey';

export interface PasskeyMeta { credentialId: string; isPasswordGenerated: boolean; createdAt: number }
interface Sealed { passwordKey: string; unlockKey: string }

export async function passkeyMeta(): Promise<PasskeyMeta | null> {
  const m = await local.get<PasskeyMeta>(KEYS.PASSKEY); const v = await local.get<string>(KEYS.PASSKEY_VAULT);
  return m && typeof m.credentialId === 'string' && v ? m : null;
}

// Seal the CURRENT session's unlock material (wallet must be unlocked) under the passkey secret.
export async function enrollPasskey(secret: string, credentialId: string, isPasswordGenerated = false): Promise<void> {
  if (!SECRET_HEX.test(secret)) throw new Error('INVALID_PASSKEY_SECRET');
  if (!/^[0-9a-f]+$/i.test(credentialId) || credentialId.length > 2048) throw new Error('INVALID_PASSKEY_ID');
  const passwordKey = await session.get<string>(KEYS.PASSWORD); const unlockKey = await session.get<string>(KEYS.UNLOCK);
  if (!passwordKey || !unlockKey) throw new Error('FORBIDDEN_REQUEST');
  const sealed: Sealed = { passwordKey, unlockKey };
  await local.set(KEYS.PASSKEY_VAULT, await passworder.encrypt(secret, sealed));
  await local.set(KEYS.PASSKEY, { credentialId, isPasswordGenerated, createdAt: Date.now() } satisfies PasskeyMeta);
}

export async function removePasskey(): Promise<void> { await local.remove(KEYS.PASSKEY); await local.remove(KEYS.PASSKEY_VAULT); }

// Recover the unlock material. `checkVault` must prove the keys really open the vault before they become the session.
export async function unlockWithPasskey(secret: string, checkVault: (unlockKey: string) => Promise<void>): Promise<void> {
  if (!SECRET_HEX.test(secret)) throw new Error('INVALID_PASSKEY_SECRET');
  const blob = await local.get<string>(KEYS.PASSKEY_VAULT);
  if (!blob) throw new Error('BIOMETRICS_NOT_SET_UP');
  let sealed: Sealed;
  try { sealed = await passworder.decrypt<Sealed>(secret, blob); } catch { throw new Error('Biometric verification failed'); }
  if (!sealed?.passwordKey || !sealed?.unlockKey) throw new Error('Biometric verification failed');
  try { await checkVault(sealed.unlockKey); } catch { throw new Error('Biometric unlock is out of date. Unlock with your password and set it up again.'); }
  await session.set(KEYS.PASSWORD, sealed.passwordKey);
  await session.set(KEYS.UNLOCK, sealed.unlockKey);
}

// Re-authentication (no session change): the secret must open the sealed blob AND the unlock key inside must match the live
// session, i.e. it is the same wallet the user is looking at.
export async function verifyPasskeySecret(secret: string): Promise<void> {
  if (!SECRET_HEX.test(secret)) throw new Error('INVALID_PASSKEY_SECRET');
  const blob = await local.get<string>(KEYS.PASSKEY_VAULT);
  if (!blob) throw new Error('BIOMETRICS_NOT_SET_UP');
  let sealed: Sealed;
  try { sealed = await passworder.decrypt<Sealed>(secret, blob); } catch { throw new Error('Biometric verification failed'); }
  const live = await session.get<string>(KEYS.UNLOCK);
  if (!live || sealed?.unlockKey !== live) throw new Error('Biometric verification failed');
}
