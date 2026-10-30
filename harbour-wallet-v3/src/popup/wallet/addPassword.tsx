import React, { useState } from 'react';
import { T } from '../theme';
import { Btn } from './ui';
import { PasswordField } from '../design/components';
import { PasswordMeter, passwordStrength, EMPTY_STRENGTH, type PasswordStrength } from '../onboarding/FlowFrame';
import { validatePassword } from '../../core/passwordPolicy';
import { Biometrics, isUserCancel } from '../../core/passkey';
import { useSecretField } from '../secureField';
import { loadPasskeyStatus } from '../biometricsUi';

// Biometrics-only wallets (created before a password was mandatory) get a password the user chooses, so biometrics are a convenience and
// never the only way in. The biometric prompt both proves the user and lets the worker re-seal the biometric blob under the new password.
// The password is read once from an uncontrolled field and handed straight to the worker.
const EMPTY = { policy: { valid: false } as { valid: boolean; error?: string }, strength: EMPTY_STRENGTH as PasswordStrength, confirmFilled: false, match: false };
export const AddPassword: React.FC<{ bg: (m: any) => Promise<any>; name: string; onDone: () => void; onBack?: () => void }> = ({ bg, name, onDone, onBack }) => {
  const pw = useSecretField(); const confirm = useSecretField();
  const [meta, setMeta] = useState(EMPTY); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState(false);
  const onInput = () => { const a = pw.peek(); const b = confirm.peek(); setMeta({ policy: validatePassword(a), strength: passwordStrength(a), confirmFilled: b.length > 0, match: a.length > 0 && a === b }); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !meta.policy.valid || !meta.match) return; setBusy(true); setErr('');
    try {
      const st = await loadPasskeyStatus(bg);
      if (!st.enabled || !st.credentialId) throw new Error('Biometrics are not set up on this wallet.');
      const { secret } = await new Biometrics().login(st.credentialId);
      const password = pw.take(); confirm.clear(); setMeta(EMPTY);
      const r = await bg({ type: 'passkeyAddPassword', password, secret });
      if (!r?.ok) throw new Error(r?.error === 'LOCKED' ? 'Unlock Harbour first.' : r?.error === 'INVALID_WALLET_INPUT' ? 'Choose a valid password and try again.' : r?.error || 'Could not add a password.');
      setDone(true); setTimeout(onDone, 900);
    } catch (x: any) { if (!isUserCancel(x)) setErr(x?.message || 'Could not add a password.'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} style={{ padding: 20, maxWidth: 420, margin: '0 auto' }} data-testid="add-password">
    {onBack && <button type="button" onClick={onBack} style={{ border: 'none', background: 'none', color: T.sub, cursor: 'pointer', padding: 0, marginBottom: 12 }}>‹ Back</button>}
    <h2 style={{ margin: '8px 0 4px' }}>Add a password</h2>
    <div style={{ color: T.sub, marginBottom: 16 }}>Your wallet currently unlocks only with {name}. Add a password so you can always unlock it, for example when {name} is unavailable. {name} keeps working too. Harbour cannot recover this password, so keep it somewhere safe.</div>
    <PasswordField label="New password" inputRef={pw.ref} onInput={onInput} placeholder="Min 8 characters" error={meta.policy.error} autoFocus disabled={busy || done}/>
    <PasswordMeter strength={meta.strength}/>
    <PasswordField label="Confirm password" inputRef={confirm.ref} onInput={onInput} placeholder="Password" error={meta.confirmFilled && !meta.match ? 'Passwords do not match' : undefined} disabled={busy || done}/>
    {err && <div role="alert" style={{ color: T.error, fontSize: 13, margin: '12px 0' }}>{err}</div>}
    <div style={{ marginTop: 16 }}><Btn disabled={!meta.policy.valid || !meta.match || busy || done}>{done ? 'Password added' : busy ? `Confirm with ${name}…` : `Add password (confirm with ${name})`}</Btn></div>
  </form>;
};
