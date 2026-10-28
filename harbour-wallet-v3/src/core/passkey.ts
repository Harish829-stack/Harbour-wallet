// Biometric (passkey) support, mirroring the Trust Wallet extension 26.41.0 (REA: chunks/biometrics-CO4_TFG1.js,
// useAvailableBiometricName-lo1nd3PA.js, useAuthenticateWithBiometrics-BLIwCDAo.js).
//
// Design recovered from the bundle [certain]:
//  * WebAuthn resident credential. rp.id = this page's hostname (the extension id), user.id = 32 random bytes,
//    pubKeyCredParams ES256/RS256/EdDSA, resident key required, userVerification "preferred" on create, "required" on get.
//  * The 32 random bytes ARE the secret: the authenticator hands them back as `userHandle` after a successful
//    Touch ID / Windows Hello / device-PIN check. The background stores the wallet's unlock material encrypted under it.
//  * Challenge is a fresh random 32 bytes; the assertion's clientDataJSON.challenge must equal it (base64url).
//  * Create is followed by an immediate verify (get) that must return the same secret before biometrics are turned on.
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

export class Biometrics {
  static abortController: AbortController | null = null;
  constructor(private credentials: CredentialsLike = navigator.credentials as unknown as CredentialsLike, private rpId: string = typeof location !== 'undefined' ? location.hostname : '') {}

  private challengeMatches(challenge: Uint8Array, cred: any): boolean {
    try { return b64url(challenge) === JSON.parse(new TextDecoder().decode(cred.response.clientDataJSON)).challenge; } catch { return false; }
  }

  async create(): Promise<{ secret: string; credentialId: string; credential: any }> {
    const userId = random32();
    const credential = await this.credentials.create({ publicKey: {
      challenge: random32(),
      rp: { name: 'Harbour-Wallet-Extension', id: this.rpId },
      user: { id: userId, name: 'Harbour-Wallet-Extension', displayName: 'Harbour Wallet' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }, { type: 'public-key', alg: -8 }],
      authenticatorSelection: { requireResidentKey: true, residentKey: 'required', userVerification: 'preferred' },
      timeout: 60_000,
    } });
    if (!credential) throw new BiometricsError('Failed to create credential', 'create_failed');
    return { secret: toHex(userId), credentialId: toHex(credential.rawId), credential };
  }

  // Confirms the freshly created credential really returns the secret (TW: Biometrics.verify).
  async verify({ credential, secret }: { credential: any; secret: string }): Promise<true> {
    const transports = credential.response?.getTransports?.();
    const challenge = random32();
    const res = await this.credentials.get({ publicKey: { challenge, allowCredentials: [{ id: credential.rawId, type: 'public-key', transports }], userVerification: 'required', timeout: 60_000 } });
    const handle = res?.response?.userHandle;
    if (!handle) throw new BiometricsError('Missing userHandle', 'no_user_handle');
    if (toHex(handle) !== secret) throw new BiometricsError('Biometric secret mismatch', 'secret_mismatch');
    if (!this.challengeMatches(challenge, res)) throw new BiometricsError('Invalid challenge', 'bad_challenge');
    return true;
  }

  async login(credentialIdHex: string): Promise<{ secret: string }> {
    Biometrics.abortController?.abort();
    const ac = new AbortController(); Biometrics.abortController = ac;
    const challenge = random32();
    const res = await this.credentials.get({ publicKey: { challenge, allowCredentials: [{ id: fromHex(credentialIdHex), type: 'public-key' }], userVerification: 'required', timeout: 60_000 }, signal: ac.signal });
    if (!res) throw new BiometricsError('Auth error.', 'no_result');
    const handle = res.response?.userHandle;
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
