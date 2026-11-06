// One-shot re-authentication grants (password or biometrics, whichever the user set up). A grant is written by `revealAuth` after the
// worker has verified the credential itself (or by an operation that has just received the password), lives in session storage
// (trusted contexts only) and is consumed by the operation it unlocks. Industry practice (OWASP ASVS V2 "sensitive operations",
// NIST SP 800-63B §6.1: binding a new authenticator needs an existing one; MetaMask: password at the moment of reveal).
//   reveal    - show a recovery phrase / private key, or back one up                                 (2 minutes)
//   addWallet - create, import or QR-import another seed or key into an existing wallet               (10 minutes: typing a phrase takes a while)
//   manage    - change the authenticator set (biometrics on/off), remove a wallet, or weaken a security setting (2 minutes)
// A grant may be bound to one wallet (`walletId`) and records how it was obtained (`method`): turning biometrics on needs a grant
// obtained with the PASSWORD, so an attacker's authenticator can never vouch for itself.
import { session, KEYS } from '../core/storage';

export type ReauthPurpose = 'reveal' | 'addWallet' | 'manage';
export type ReauthMethod = 'password' | 'passkey' | 'created';
export interface ReauthGrant { exp: number; method: ReauthMethod; walletId?: string }
const KEY: Record<ReauthPurpose, string> = { reveal: KEYS.REVEAL, addWallet: KEYS.ADD_WALLET, manage: KEYS.MANAGE };
const TTL_MS: Record<ReauthPurpose, number> = { reveal: 2 * 60_000, addWallet: 10 * 60_000, manage: 2 * 60_000 };
export const ALL_GRANT_KEYS = Object.values(KEY);

export const purposeOf = (v: unknown): ReauthPurpose => (v === 'addWallet' ? 'addWallet' : v === 'manage' ? 'manage' : 'reveal');
export async function grantReauth(p: ReauthPurpose, o: { method: ReauthMethod; walletId?: string; ttlMs?: number }): Promise<void> {
  const g: ReauthGrant = { exp: Date.now() + Math.min(o.ttlMs ?? TTL_MS[p], 15 * 60_000), method: o.method, ...(o.walletId ? { walletId: o.walletId } : {}) };
  await session.set(KEY[p], g);
}
const valid = (g: unknown, need: { walletId?: string; method?: ReauthMethod }): boolean => {
  if (!g || typeof g !== 'object') return false;
  const r = g as ReauthGrant;
  if (typeof r.exp !== 'number' || r.exp < Date.now()) return false;
  if (r.walletId && r.walletId !== need.walletId) return false; // bound to another wallet
  if (need.method && r.method !== need.method) return false;
  return true;
};
/** True once per grant: the grant is removed whether or not it was still valid. */
export async function consumeReauth(p: ReauthPurpose, need: { walletId?: string; method?: ReauthMethod } = {}): Promise<boolean> {
  const g = await session.get<unknown>(KEY[p]); await session.remove(KEY[p]);
  return valid(g, need);
}
/** Non-consuming check (lets the UI ask for the password BEFORE a biometric ceremony instead of after it). */
export async function hasReauth(p: ReauthPurpose, need: { walletId?: string; method?: ReauthMethod } = {}): Promise<boolean> {
  return valid(await session.get<unknown>(KEY[p]), need);
}
export async function clearReauth(): Promise<void> { for (const k of ALL_GRANT_KEYS) await session.remove(k); }
