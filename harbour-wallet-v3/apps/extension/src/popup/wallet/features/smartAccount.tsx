// Wallet details > Smart account (EIP-7702). Dumb UI: it asks the worker for a decoded summary, shows it, and on Confirm sends only
// the requestId. The worker signs after a fresh password check; nothing secret, no digest and no signature ever reaches this page.
// Shown only when the remote flag `smartAccounts` is on and the active account can use it (the worker decides: `available`).
import React, { useCallback, useEffect, useState } from 'react';
import { T } from '../../theme';
import { Sheet, Btn } from '../ui';
import { RevealGate } from '../revealGate';
import { Group, SectionLabel, ErrorLine, Note } from '../settingsScreens';
import type { Ctx } from '../screens';

const CHAINS = [11155111, 84532];
type Status = { chainId: number; available: boolean; network?: string; state?: 'none' | 'pinned' | 'other'; delegatedTo?: string | null };
type Summary = { requestId: string; kind: 'enable' | 'revoke'; chainId: number; network: string; symbol: string; address: string; delegate: string | null; maxFee: string; expiresInSec: number };
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

export const SmartAccountSection: React.FC<{ c: Ctx; walletId: string }> = ({ c, walletId }) => {
  const [rows, setRows] = useState<Status[]>([]); const [sum, setSum] = useState<Summary | null>(null);
  const [gate, setGate] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  const load = useCallback(async () => {
    const out: Status[] = [];
    for (const chainId of CHAINS) { const r = await c.bg({ type: 'smartAccountStatus', chainId }).catch(() => null); if (r?.ok && r.available) out.push({ chainId, available: true, network: r.network, state: r.state, delegatedTo: r.delegatedTo }); }
    setRows(out);
  }, [c]);
  useEffect(() => { void load(); }, [load]);

  const start = async (chainId: number, kind: 'enable' | 'revoke') => {
    setErr(''); setDone(''); setBusy(true);
    const r = await c.bg({ type: 'smartAccountPrepare', chainId, kind }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    if (r?.ok) setSum(r as Summary); else setErr(r?.error ?? 'Could not prepare this request');
  };
  const cancel = () => { if (sum) void c.bg({ type: 'smartAccountReject', requestId: sum.requestId }).catch(() => {}); setSum(null); setGate(false); };
  const approve = async () => {
    if (!sum) return; setGate(false); setBusy(true); setErr('');
    const r = await c.bg({ type: 'smartAccountApprove', requestId: sum.requestId }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    if (r?.ok) { setDone(`${sum.kind === 'enable' ? 'Smart account is being turned on' : 'Smart account is being turned off'} on ${sum.network}. It updates here once confirmed.`); setSum(null); setTimeout(() => void load(), 15_000); }
    else if (r?.code === 'AUTH_REQUIRED') setGate(true);
    else { setErr(r?.error ?? 'Request failed'); setSum(null); }
  };

  if (rows.length === 0) return null;
  return <>
    <SectionLabel>Smart account</SectionLabel>
    <Group>
      {rows.map((r, i) => (
        <div key={r.chainId} data-testid={`smart-account-${r.chainId}`} style={{ padding: 14, borderTop: i ? `1px solid ${T.border}` : undefined, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{r.network}</div>
            <div style={{ fontSize: 12, color: T.sub }}>{r.state === 'pinned' ? 'On' : r.state === 'other' ? 'Delegated to another contract' : 'Off'}</div>
          </div>
          {r.state === 'none' && <Btn onClick={() => void start(r.chainId, 'enable')} disabled={busy} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Turn on</Btn>}
          {r.state !== 'none' && <Btn variant="ghost" onClick={() => void start(r.chainId, 'revoke')} disabled={busy} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Turn off</Btn>}
        </div>
      ))}
    </Group>
    <Note>A smart account lets this address use batched and sponsored transactions. You can turn it off at any time.</Note>
    {done && <div role="status" style={{ fontSize: 13, color: T.sub, margin: '8px 2px' }}>{done}</div>}
    <ErrorLine msg={err}/>
    {sum && !gate && <Sheet title={sum.kind === 'enable' ? 'Turn on smart account?' : 'Turn off smart account?'} onClose={cancel}>
      <div style={{ color: T.sub, fontSize: 14, lineHeight: 1.45, marginBottom: 12 }}>
        {sum.kind === 'enable'
          ? <>This sends one transaction on {sum.network} that lets <b>{short(sum.address)}</b> run through Harbour&apos;s audited smart account contract <b>{short(sum.delegate ?? '')}</b>. Your address and keys stay the same.</>
          : <>This sends one transaction on {sum.network} that returns <b>{short(sum.address)}</b> to a plain account.</>}
      </div>
      <div style={{ fontSize: 13, marginBottom: 14 }}>Network fee: up to <b>{sum.maxFee} {sum.symbol}</b></div>
      <Btn onClick={() => setGate(true)} disabled={busy}>Confirm</Btn>
      <Btn variant="ghost" onClick={cancel} style={{ marginTop: 8 }}>Cancel</Btn>
    </Sheet>}
    {sum && gate && <Sheet title="Verify it is you" onClose={cancel}><RevealGate bg={c.bg} walletId={walletId} purpose="manage" message="change your smart account" onGranted={() => void approve()} onCancel={cancel}/></Sheet>}
  </>;
};
