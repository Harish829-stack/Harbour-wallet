// One-shot re-authentication grants (password or biometrics, whichever the user set up). A grant is written by `revealAuth` after the
// worker has verified the credential itself, lives in session storage (trusted contexts only) and is consumed by the operation it unlocks.
//   reveal    - show a recovery phrase / private key, or back one up                      (2 minutes)
//   addWallet - create, import or QR-import another seed or key into an existing wallet    (10 minutes: typing a phrase takes a while)
import { session, KEYS } from '../core/storage';

export type ReauthPurpose = 'reveal' | 'addWallet';
const KEY: Record<ReauthPurpose, string> = { reveal: KEYS.REVEAL, addWallet: KEYS.ADD_WALLET };
const TTL_MS: Record<ReauthPurpose, number> = { reveal: 2 * 60_000, addWallet: 10 * 60_000 };

export const purposeOf = (v: unknown): ReauthPurpose => (v === 'addWallet' ? 'addWallet' : 'reveal');
export async function grantReauth(p: ReauthPurpose): Promise<void> { await session.set(KEY[p], Date.now() + TTL_MS[p]); }
/** True once per grant: the grant is removed whether or not it was still valid. */
export async function consumeReauth(p: ReauthPurpose): Promise<boolean> {
  const g = await session.get<number>(KEY[p]); await session.remove(KEY[p]);
  return typeof g === 'number' && g >= Date.now();
}
