import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import { T } from './theme';
import { Biometrics, biometricAvailability, isUserCancel } from '../core/passkey';

type Bg = (m: any) => Promise<any>;

// A browser popup / side panel closes the moment the OS biometric sheet takes focus, which kills the WebAuthn call.
// TW therefore runs every biometric step in a full tab (unlock.js: `isPopup ? open(UNLOCK+"?biometrics=true")`).
export async function isPopupContext(): Promise<boolean> {
  try { return !(await browser.tabs.getCurrent()); } catch { return true; }
}
export async function openInTab(query: string): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('src/popup/index.html') + query });
}

export function useBiometricAvailability(): { available: boolean; name: string } {
  const [s, setS] = useState({ available: false, name: 'Biometrics' });
  useEffect(() => { let dead = false; void biometricAvailability().then((r) => { if (!dead) setS(r); }); return () => { dead = true; }; }, []);
  return s;
}

export interface PasskeyStatus { enabled: boolean; credentialId: string | null; isPasswordGenerated: boolean }
export async function loadPasskeyStatus(bg: Bg): Promise<PasskeyStatus> {
  try { const r = await bg({ type: 'passkeyStatus' }); if (r?.ok) return { enabled: !!r.enabled, credentialId: r.credentialId ?? null, isPasswordGenerated: !!r.isPasswordGenerated }; } catch { /* fall through */ }
  return { enabled: false, credentialId: null, isPasswordGenerated: false };
}

// Authenticator -> secret -> background unlock. Resolves { ok:false, cancelled:true } when the user dismisses the prompt.
export async function biometricUnlock(bg: Bg, credentialId: string): Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }> {
  try {
    const { secret } = await new Biometrics().login(credentialId);
    const r = await bg({ type: 'passkeyUnlock', secret });
    return r?.ok ? { ok: true } : { ok: false, error: r?.error || 'Biometric unlock failed' };
  } catch (e: any) {
    if (isUserCancel(e)) return { ok: false, error: '', cancelled: true };
    return { ok: false, error: e?.message || 'Biometrics failed' };
  }
}

export type EnrollStage = 'idle' | 'register' | 'verify' | 'save' | 'done';
// Register + verify a new credential (TW: SetBiometrics). The caller seals it with `passkeyEnroll` once the wallet exists.
export async function registerBiometrics(onStage: (s: EnrollStage) => void): Promise<{ secret: string; credentialId: string }> {
  const b = new Biometrics();
  onStage('register');
  const made = await b.create();
  onStage('verify');
  await b.verify({ credential: made.credential, secret: made.secret });
  return { secret: made.secret, credentialId: made.credentialId };
}

export const BiometricEnroll: React.FC<{ bg: Bg; name: string; onDone: () => void; onBack?: () => void }> = ({ bg, name, onDone, onBack }) => {
  const [stage, setStage] = useState<EnrollStage>('idle'); const [err, setErr] = useState('');
  const busy = stage !== 'idle' && stage !== 'done';
  const label = { idle: `Set up ${name}`, register: 'Registering…', verify: 'Verifying…', save: 'Saving…', done: 'Done' }[stage];
  const run = async () => {
    setErr('');
    try {
      const { secret, credentialId } = await registerBiometrics(setStage);
      setStage('save');
      const r = await bg({ type: 'passkeyEnroll', secret, credentialId });
      if (!r?.ok) throw new Error(r?.error === 'LOCKED' ? 'Unlock Harbour first.' : r?.error || 'Could not save biometrics');
      setStage('done'); setTimeout(onDone, 900);
    } catch (e: any) { setStage('idle'); if (!isUserCancel(e)) setErr(e?.message || 'Biometrics failed'); }
  };
  const step = (n: number, text: string) => { const idx = { idle: 0, register: 0, verify: 1, save: 2, done: 3 }[stage]; const on = idx > n; return <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: on ? T.accent : T.sub, fontWeight: 600, marginTop: 8 }}><span style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${on ? T.accent : T.border}`, background: on ? T.accent : 'transparent' }} />{text}</div>; };
  return (
    <div style={{ padding: 20, maxWidth: 420, margin: '0 auto' }} data-testid="biometric-enroll">
      {onBack && <button type="button" onClick={onBack} style={{ border: 'none', background: 'none', color: T.sub, cursor: 'pointer', padding: 0, marginBottom: 12 }}>‹ Back</button>}
      <h2 style={{ margin: '8px 0 4px' }}>Biometric authentication</h2>
      <div style={{ color: T.sub, marginBottom: 18 }}>A secure and simple way to unlock your wallet with {name}. Your password stays required as a fallback.</div>
      {busy && <div>{step(0, 'Register biometrics')}{step(1, 'Verify biometrics')}{step(2, 'Save')}</div>}
      {err && <div role="alert" style={{ color: T.error, fontSize: 13, margin: '12px 0' }}>{err}</div>}
      <button type="button" data-testid="biometric-enroll-btn" disabled={busy || stage === 'done'} onClick={run}
        style={{ width: '100%', padding: '14px 16px', borderRadius: 999, border: 'none', background: busy ? T.bgAlt : T.accent, color: busy ? T.sub : '#fff', fontWeight: 700, fontSize: 15, cursor: busy ? 'not-allowed' : 'pointer', marginTop: 16 }}>{label}</button>
    </div>
  );
};
