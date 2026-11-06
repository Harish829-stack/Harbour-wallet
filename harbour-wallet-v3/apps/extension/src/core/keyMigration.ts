// v1 -> v2 key-schedule migration helpers (audit "weak key derivation"). Everything here is pure: it returns the re-encrypted
// blobs and the caller commits them all in ONE storage write, so a failure at any point leaves the old, working data untouched.
import * as passworder from './passworder';

const te = new TextEncoder(), td = new TextDecoder();

/**
 * Re-encrypts a wallet-core keystore (secret phrase or imported private key) under a new passphrase WITHOUT changing its
 * identity: id, name and accounts are kept, only the `crypto` section (cipher text, salt, KDF, MAC) is replaced. The result is
 * decrypted again with the new passphrase and compared with the original secret before it is returned.
 */
export function rekeyKeystore(core: any, ks: any, oldPassphrase: string, newPassphrase: string): any {
  const oldPw = te.encode(oldPassphrase), newPw = te.encode(newPassphrase);
  const aes = core.StoredKeyEncryption.aes128Ctr;
  const sk = core.StoredKey.importJSON(te.encode(JSON.stringify(ks)));
  let fresh: any, check: any;
  try {
    const coin = sk.accountCount() > 0 ? sk.account(0).coin() : core.CoinType.ethereum;
    const isMnemonic: boolean = sk.isMnemonic();
    let secret: string | Uint8Array;
    if (isMnemonic) {
      secret = sk.decryptMnemonic(oldPw);
      fresh = core.StoredKey.importHDWalletWithEncryption(secret, sk.name(), newPw, coin, aes);
    } else {
      secret = sk.decryptPrivateKey(oldPw);
      fresh = core.StoredKey.importPrivateKeyWithEncryption(secret, sk.name(), newPw, coin, aes);
    }
    const next = { ...ks, crypto: JSON.parse(td.decode(fresh.exportJSON())).crypto };
    check = core.StoredKey.importJSON(te.encode(JSON.stringify(next)));
    const back = isMnemonic ? check.decryptMnemonic(newPw) : check.decryptPrivateKey(newPw);
    const same = typeof secret === 'string' ? back === secret : back.length === secret.length && back.every((b: number, i: number) => b === (secret as Uint8Array)[i]);
    if (typeof secret !== 'string') { secret.fill(0); back.fill?.(0); }
    if (!same) throw new Error('KEYSTORE_REKEY_MISMATCH');
    return next;
  } finally { fresh?.delete?.(); check?.delete?.(); sk.delete(); }
}

/** Re-encrypts one passworder blob (perps agent key, prediction credentials) under the new passphrase; null if it cannot be read. */
export async function rekeyBlob(blob: unknown, oldPassphrase: string, newPassphrase: string): Promise<string | null> {
  if (typeof blob !== 'string') return null;
  try { return await passworder.encrypt(newPassphrase, await passworder.decrypt(oldPassphrase, blob)); } catch { return null; }
}
