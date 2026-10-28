// Verify + classify wallets exported by the Trust Wallet mobile app (onboarding QR import). The keys arrive already decoded by
// core/qrSync.ts (UR frames -> gzip -> JSON); here the 6-character one-time code decrypts them with wallet-core.
// Evidence: chunks/import-qr `InputQrPassword` (VERIFY_STORED_KEYS then IMPORT_STORED_KEYS; wrong code => "Incorrect one-time code. Try again.").
import { ONE_TIME_CODE, codeMatchesKey, isWellFormedKey } from './qrSync';

export interface QrSecret { kind: 'mnemonic'; mnemonic: string; name: string }
export interface QrKeySecret { kind: 'privateKey'; bytes: Uint8Array; coin: string; name: string }
export interface QrDecrypted { secrets: Array<QrSecret | QrKeySecret>; skipped: number; wrong: number }

export async function decryptStoredKeys(core: any, keys: unknown[], code: string): Promise<QrDecrypted> {
  const out: QrDecrypted = { secrets: [], skipped: 0, wrong: 0 };
  if (!ONE_TIME_CODE.test(code)) { out.wrong = keys.length; return out; }
  const pw = new TextEncoder().encode(code);
  for (const k of keys as any[]) {
    if (!isWellFormedKey(k)) { out.skipped++; continue; }
    // wallet-core ABORTS the wasm runtime on a wrong password, so the MAC is checked first (see qrSync.codeMatchesKey).
    if (!(await codeMatchesKey(k, code))) { out.wrong++; continue; }
    let sk: any;
    try { sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(k))); } catch { out.skipped++; continue; }
    try {
      const name = typeof k.name === 'string' && k.name ? k.name : '';
      if (sk.isMnemonic()) out.secrets.push({ kind: 'mnemonic', mnemonic: sk.decryptMnemonic(pw), name });
      else {
        const acct = sk.accountCount?.() > 0 ? sk.account(0) : null;
        const coin = acct?.coin?.(); const ct = coin != null ? Object.entries(core.CoinType).find(([, v]: any) => v?.value === (coin.value ?? coin))?.[0] : undefined;
        if (!ct) { out.skipped++; continue; }
        out.secrets.push({ kind: 'privateKey', bytes: sk.decryptPrivateKey(pw), coin: ct, name });
      }
    } catch { out.wrong++; } finally { try { sk.delete(); } catch { /* freed */ } }
  }
  return out;
}
