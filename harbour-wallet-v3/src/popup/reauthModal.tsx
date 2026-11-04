// In-place re-authentication for "manage" operations (PT-04): removing a wallet, turning biometrics or biometric approval off, weakening
// a security setting. The worker answers AUTH_REQUIRED; popup/api.ts then shows this sheet over whatever screen made the call and
// retries the call once after the password (or biometrics, outside a popup) was verified. No screen has to know about it.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { T } from './theme';
import { RevealGate } from './wallet/revealGate';

let open: Promise<boolean> | null = null;
export function promptReauth(bg: (m: any) => Promise<any>, message: string): Promise<boolean> {
  if (open) return open; // one sheet at a time
  open = new Promise<boolean>((resolve) => {
    const host = document.createElement('div'); host.setAttribute('data-testid', 'reauth-modal');
    document.body.appendChild(host); const root = createRoot(host);
    const done = (ok: boolean) => { root.unmount(); host.remove(); open = null; resolve(ok); };
    root.render(
      <div role="dialog" aria-modal="true" aria-label="Verify it’s you" style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 440, background: T.bg, color: T.text, borderRadius: '18px 18px 0 0', padding: '18px 20px 24px', boxSizing: 'border-box' }}>
          <RevealGate bg={bg} purpose="manage" message={message} onGranted={() => done(true)} onCancel={() => done(false)}/>
        </div>
      </div>,
    );
  });
  return open;
}
