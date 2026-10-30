// Biometric (passkey) support, mirroring the Trust Wallet extension 26.41.0 (REA: chunks/biometrics-CO4_TFG1.js,
// useAvailableBiometricName-lo1nd3PA.js, useAuthenticateWithBiometrics-BLIwCDAo.js).
//
// Design recovered from the bundle [certain]:
//  * WebAuthn resident credential. rp.id = this page's hostname (the extension id), user.id = 32 random bytes,
//    pubKeyCredParams ES256/RS256/EdDSA, resident key required, userVerification "preferred" on create, "required" on get.
//  * TW used the 32 random user.id bytes as the secret (returned as `userHandle`). HW-2026-001: the user handle is NOT a
//    secret (it is stored in clear by the authenticator and returned without proof of key possession), so Harbour instead
//    derives the secret from the WebAuthn PRF extension (CTAP2 hmac-secret): a 32-byte HMAC computed INSIDE the
//    authenticator from a per-credential key, released only after user verification. No PRF support = no biometrics.
//  * Credentials sealed with the old userHandle scheme are "legacy": see passkeyService (they must be re-enrolled).
//  * Challenge is a fresh random 32 bytes; the assertion's clientDataJSON.challenge must equal it (base64url).
//  * Create is followed by an immediate verify (get) that must produce the PRF secret before biometrics are turned on.
export const toHex = (b: ArrayBuffer | Uint8Array): string => Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string): Uint8Array => {
  if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error('Invalid hex');
  return Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
};
export const b64url = (b: ArrayBuffer | Uint8Array): string => btoa(String.fromCharCode(...(b instanceof Uint8Array ? b : new Uint8Array(b)))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
export const SECRET_HEX = /^[0-9a-f]{64}$/;

export class BiometricsError extends Error { constructor(message: string, public code: string) { super(message); this.name = 'BiometricsError'; } }

// User cancelled / timed out / dismissed the OS prompt: not worth a scary error message.
export const isUserCancel = (e: unknown): boolean => {
  const x = e as { name?: string; message?: string } | undefined;
  const name = x?.name ?? ''; const msg = String(x?.message ?? '').toLowerCase();
  return ['AbortError', 'NotAllowedError', 'TimeoutError'].includes(name) || ['cancel', 'abort', 'timeout', 'timed out', 'not allowed'].some((m) => msg.includes(m));
};

export interface CredentialsLike { create(o: any): Promise<any>; get(o: any): Promise<any> }
const random32 = () => crypto.getRandomValues(new Uint8Array(32));

/** PRF input. Not secret: it only domain-separates Harbour's use of the credential's PRF key. */
export const PRF_SALT = new TextEncoder().encode('harbour-wallet/biometric-unlock/prf-v1').slice(0, 32);
export const PRF_SCHEME = 'prf-v1' as const;
const prfOf = (res: any): Uint8Array | null => {
  const first = res?.getClientExtensionResults?.()?.prf?.results?.first;
  if (!first) return null;
  const b = first instanceof Uint8Array ? first : new Uint8Array(first instanceof ArrayBuffer ? first : (first.buffer ?? first));
  return b.length === 32 ? b : null;
};
const prfMissing = () => new BiometricsError('This device cannot protect your wallet with biometrics (no WebAuthn PRF support). Use your password.', 'prf_unsupported');

export class Biometrics {
  static abortController: AbortController | null = null;
  constructor(private credentials: CredentialsLike = navigator.credentials as unknown as CredentialsLike, private rpId: string = typeof location !== 'undefined' ? location.hostname : '') {}

  private challengeMatches(challenge: Uint8Array, cred: any): boolean {
    try { return b64url(challenge) === JSON.parse(new TextDecoder().decode(cred.response.clientDataJSON)).challenge; } catch { return false; }
  }

  async create(): Promise<{ credentialId: string; credential: any }> {
    const credential = await this.credentials.create({ publicKey: {
      challenge: random32(),
      rp: { name: 'Harbour-Wallet-Extension', id: this.rpId },
      user: { id: random32(), name: 'Harbour-Wallet-Extension', displayName: 'Harbour Wallet' }, // random, not a secret
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }, { type: 'public-key', alg: -8 }],
      authenticatorSelection: { requireResidentKey: true, residentKey: 'required', userVerification: 'required' },
      extensions: { prf: {} },
      timeout: 60_000,
    } });
    if (!credential) throw new BiometricsError('Failed to create credential', 'create_failed');
    if (credential.getClientExtensionResults?.()?.prf?.enabled !== true) throw prfMissing();
    return { credentialId: toHex(credential.rawId), credential };
  }

  private async assert(allow: Uint8Array | ArrayBuffer, transports?: string[], signal?: AbortSignal): Promise<string> {
    const challenge = random32();
    const res = await this.credentials.get({ publicKey: { challenge, allowCredentials: [{ id: allow, type: 'public-key', ...(transports ? { transports } : {}) }], userVerification: 'required', timeout: 60_000, extensions: { prf: { eval: { first: PRF_SALT } } } }, ...(signal ? { signal } : {}) });
    if (!res) throw new BiometricsError('Auth error.', 'no_result');
    if (!this.challengeMatches(challenge, res)) throw new BiometricsError('Invalid challenge.', 'bad_challenge');
    const out = prfOf(res); if (!out) throw prfMissing();
    try { return toHex(out); } finally { out.fill(0); }
  }

  /** Confirms the fresh credential evaluates PRF and returns the derived secret (to seal the vault keys under). */
  async verify({ credential }: { credential: any }): Promise<{ secret: string }> {
    return { secret: await this.assert(credential.rawId, credential.response?.getTransports?.()) };
  }

  async login(credentialIdHex: string): Promise<{ secret: string }> {
    Biometrics.abortController?.abort();
    const ac = new AbortController(); Biometrics.abortController = ac;
    return { secret: await this.assert(fromHex(credentialIdHex), undefined, ac.signal) };
  }

  /** Legacy (pre-PRF) credential: returns the user handle. Only used to let a password-less legacy wallet add a password. */
  async legacyLogin(credentialIdHex: string): Promise<{ secret: string }> {
    const challenge = random32();
    const res = await this.credentials.get({ publicKey: { challenge, allowCredentials: [{ id: fromHex(credentialIdHex), type: 'public-key' }], userVerification: 'required', timeout: 60_000 } });
    const handle = res?.response?.userHandle;
    if (!handle) throw new BiometricsError('Lost secret.', 'no_user_handle');
    if (!this.challengeMatches(challenge, res)) throw new BiometricsError('Invalid challenge.', 'bad_challenge');
    return { secret: toHex(handle) };
  }
}

// ---- which biometric does this device offer (TW: detectBiometricCapabilities / getPrimaryBiometricMethod)
export type Platform = 'macos' | 'windows' | 'linux' | 'unknown';
export const detectPlatform = (ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): Platform => {
  const u = ua.toLowerCase();
  return u.includes('mac os') || u.includes('macintosh') ? 'macos' : u.includes('windows') ? 'windows' : u.includes('linux') ? 'linux' : 'unknown';
};
export const BIOMETRIC_NAME: Record<Platform, string> = { macos: 'Touch ID', windows: 'Windows Hello', linux: 'Fingerprint', unknown: 'Passkey' };
export async function biometricAvailability(ua?: string, pk: any = typeof PublicKeyCredential !== 'undefined' ? PublicKeyCredential : undefined): Promise<{ available: boolean; name: string }> {
  const platform = detectPlatform(ua);
  if (!pk || typeof navigator === 'undefined' || !navigator.credentials) return { available: false, name: BIOMETRIC_NAME[platform] };
  let ok = false;
  try { ok = !!(await pk.isUserVerifyingPlatformAuthenticatorAvailable?.()); } catch { ok = false; }
  return { available: ok, name: ok ? BIOMETRIC_NAME[platform] : 'Biometrics' };
}
