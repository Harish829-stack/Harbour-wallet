// Password -> vault keys (audit V3-01 / "weak key derivation").
//
// v1 (legacy, read-only): PBKDF2-HMAC-SHA512 with 20,000 (keystore passphrase) and 210,000 (vault unlock key) iterations,
//   the numbers Trust Wallet uses.
// v2: ONE memory-hard Argon2id pass over the password (RFC 9106; 46 MiB, 2 passes, 1 lane - above the OWASP minimums), then HKDF-SHA256
//   splits the 512-bit result into two independent 512-bit keys: the vault unlock key and the keystore passphrase.
//   A stolen browser profile therefore costs an attacker one Argon2id evaluation per password guess, whichever blob they attack.
// The parameters are stored next to the salt, so they can be raised later without another migration format.
import { argon2id } from '@noble/hashes/argon2';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

export interface Argon2Params { m: number; t: number; p: number }
/** m is in KiB. Roughly 1.3 s on a modern laptop. */
export const ARGON2_DEFAULT: Argon2Params = { m: 47104, t: 2, p: 1 };
export interface KdfRecordV1 { v?: 1; salt: string; iterations: number }
export interface KdfRecordV2 extends Argon2Params { v: 2; kdf: 'argon2id'; salt: string }
export type KdfRecord = KdfRecordV1 | KdfRecordV2;
export const isV2 = (r: KdfRecord): r is KdfRecordV2 => r.v === 2;

const toHex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');
const INFO_UNLOCK = 'harbour/v2/vault-unlock', INFO_KEYSTORE = 'harbour/v2/keystore';
// Keeps a corrupted or tampered record from asking for gigabytes of memory.
const MAX_M = 262144, MAX_T = 10, MAX_P = 4;

export function v2Record(salt: string, p: Argon2Params = ARGON2_DEFAULT): KdfRecordV2 {
  return { v: 2, kdf: 'argon2id', salt, m: p.m, t: p.t, p: p.p };
}

export function deriveV2(password: string, salt: Uint8Array, p: Argon2Params): { unlockKey: string; passwordKey: string } {
  if (!(p.m >= 8 * p.p && p.m <= MAX_M && p.t >= 1 && p.t <= MAX_T && p.p >= 1 && p.p <= MAX_P)) throw new Error('VAULT_KDF_PARAMS_INVALID');
  const master = argon2id(new TextEncoder().encode(password.normalize('NFKC')), salt, { m: p.m, t: p.t, p: p.p, dkLen: 32 });
  try {
    return {
      unlockKey: toHex(hkdf(sha256, master, undefined, INFO_UNLOCK, 64)),
      passwordKey: toHex(hkdf(sha256, master, undefined, INFO_KEYSTORE, 64)),
    };
  } finally { master.fill(0); }
}
