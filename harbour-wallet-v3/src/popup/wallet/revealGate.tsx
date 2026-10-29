import React, { useEffect, useRef, useState } from 'react';
import { T } from '../theme';
import { Btn } from './ui';
import { Biometrics, isUserCancel } from '../../core/passkey';
import { isPopupContext, loadPasskeyStatus, openInTab, useBiometricAvailability, type PasskeyStatus } from '../biometricsUi';
import { useSecretField } from '../secureField';

// Re-authentication before the secret phrase is shown (TW: password or biometrics). The background only reveals after a
// successful `revealAuth` (one-shot, 2 minutes), so this gate is not just cosmetic.
export const RevealGate: React.FC<{ bg: (m: any) => Promise<any>; walletId?: string; purpose?: 'reveal' | 'addWallet'; then?: 'create' | 'import'; message?: string; autoBiometric?: boolean; onGranted: () => void; onCancel?: () => void }> = ({ bg, walletId, purpose = 'reveal', then = 'import', message = 'view your secret phrase', autoBiometric, onGranted, onCancel }) => {
  const pw = useSecretField(); const [filled, setFilled] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [pk, setPk] = useState<PasskeyStatus | null>(null); const bio = useBiometricAvailability(); const auto = useRef(false);
  useEffect(() => { void loadPasskeyStatus(bg).then(setPk); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    if (!filled || busy) return; setBusy(true); setErr('');
    const password = pw.take(); setFilled(false); // read once and cleared (uncontrolled field, never React state)
    const r = await bg({ type: 'revealAuth', method: 'password', password, purpose }).catch(() => null);
    setBusy(false);
    if (r?.ok) onGranted(); else setErr(r?.error === 'TOO_MANY_ATTEMPTS' ? 'Too many attempts. Try again later.' : r?.error || 'Verification failed');
  };
  const biometric = async () => {
    if (!pk?.credentialId) return;
    if (await isPopupContext()) { await openInTab(purpose === 'addWallet' ? `?reauth=add&then=${then}` : `?reveal=1${walletId ? `&wallet=${encodeURIComponent(walletId)}` : ''}`); window.close(); return; }
    setBusy(true); setErr('');
    try {
      const { secret } = await new Biometrics().login(pk.credentialId);
      const r = await bg({ type: 'revealAuth', method: 'passkey', secret, purpose });
      if (r?.ok) onGranted(); else setErr(r?.error || 'Verification failed');
    } catch (e: any) { if (!isUserCancel(e)) setErr(e?.message || 'Biometrics failed'); }
    setBusy(false);
  };
  useEffect(() => { if (autoBiometric && pk?.enabled && !auto.current) { auto.current = true; void biometric(); } }, [pk, autoBiometric]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-testid="reveal-gate" style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Verify it’s you</div>
      <div style={{ color: T.sub, fontSize: 13, margin: '4px 0 14px' }}>Enter your password{pk?.enabled ? ` or use ${bio.name}` : ''} to {message}.</div>
      <input data-testid="reveal-password" type="password" autoFocus ref={pw.ref} onInput={(e) => setFilled(!!e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Password" autoComplete="current-password" spellCheck={false}
        style={{ width: '100%', padding: 14, borderRadius: 14, border: `1px solid ${err ? T.error : T.border}`, background: T.surface, color: T.text, fontSize: 15, boxSizing: 'border-box' }} />
      {err && <div role="alert" data-testid="reveal-error" style={{ color: T.error, fontSize: 13, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        <Btn disabled={!filled || busy} onClick={submit}>{busy ? 'Verifying…' : 'Continue'}</Btn>
        {pk?.enabled && <Btn variant="ghost" disabled={busy} onClick={biometric}><span data-testid="reveal-biometrics">Use {bio.name}</span></Btn>}
        {onCancel && <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>}
      </div>
    </div>
  );
};
