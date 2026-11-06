import React, { useState } from 'react';
import { T } from '../theme';
import { RevealGate } from './revealGate';
import { BackupFlow } from '../onboarding/BackupFlow';

// Full-tab entry used when the popup cannot show the OS biometric sheet: verify (password or biometrics), then either create a new wallet
// (and back it up on the spot) or continue to the import flow. The worker holds the one-shot grant; nothing secret reaches this page.
export const AddWalletReauth: React.FC<{ bg: (m: any) => Promise<any>; then: 'create' | 'import' }> = ({ bg, then }) => {
  const [walletId, setWalletId] = useState<string | null>(null); const [err, setErr] = useState('');
  const granted = async () => {
    if (then === 'import') { window.location.assign(`${window.location.pathname}#/onboarding`); return; }
    const r = await bg({ type: 'addWallet' }).catch(() => null);
    if (r?.ok && r.backupGranted) setWalletId(r.walletId); else setErr(r?.error || 'Could not create the wallet');
  };
  if (walletId) return <BackupFlow bg={bg} walletId={walletId} granted onDone={() => window.close()} onCancel={() => window.close()}/>;
  return <div><RevealGate bg={bg} purpose="addWallet" then={then} message="add a wallet" autoBiometric onGranted={granted} onCancel={() => window.close()}/>{err && <div role="alert" style={{ color: T.error, fontSize: 13, marginTop: 12 }}>{err}</div>}</div>;
};
