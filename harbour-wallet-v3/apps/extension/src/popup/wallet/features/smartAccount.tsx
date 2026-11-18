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
const LEGACY_DELEGATE = '0xe6cae83bde06e4c305530e199d7217f42808555b'; // Simple7702Account used by the retired gasless path; Switch re-delegates to the current contract in one step
type Status = { chainId: number; available: boolean; network?: string; state?: 'none' | 'pinned' | 'other'; delegatedTo?: string | null };
type Summary = { requestId: string; kind: 'enable' | 'revoke' | 'revokeGrant'; chainId: number; network: string; symbol: string; address: string; delegate: string | null; maxFee: string; expiresInSec: number; origin?: string; allowance?: string; token?: string | null; expiry?: number };
type Grant = { id: string; origin: string; chainId: number; network: string; symbol: string; sessionKey: string; type: string; allowance: string; token: string | null; expiry: number; status: 'active' | 'expired' | 'revoked' };
const amountOf = (g: { allowance: string; token?: string | null; symbol?: string }) => { try { const v = BigInt(g.allowance); if (g.token) return `${v} units of token ${short(g.token)}`; const w = 10n ** 18n; const frac = (v % w).toString().padStart(18, '0').replace(/0+$/, ''); return `${v / w}${frac ? '.' + frac : ''} ${g.symbol ?? ''}`.trim(); } catch { return '?'; } };
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

export const SmartAccountSection: React.FC<{ c: Ctx; walletId: string }> = ({ c, walletId }) => {
  const [rows, setRows] = useState<Status[]>([]); const [grants, setGrants] = useState<Grant[]>([]); const [sum, setSum] = useState<Summary | null>(null);
  const [gate, setGate] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  const load = useCallback(async () => {
    const out: Status[] = [];
    for (const chainId of CHAINS) { const r = await c.bg({ type: 'smartAccountStatus', chainId }).catch(() => null); if (r?.ok && r.available) out.push({ chainId, available: true, network: r.network, state: r.state, delegatedTo: r.delegatedTo }); }
    setRows(out);
    const g = await c.bg({ type: 'smartAccountGrants' }).catch(() => null); setGrants(g?.ok && g.available ? (g.grants as Grant[]) : []);
  }, [c]);
  useEffect(() => { void load(); }, [load]);

  const start = async (chainId: number, kind: 'enable' | 'revoke' | 'revokeGrant', grantId?: string) => {
    setErr(''); setDone(''); setBusy(true);
    const r = await c.bg({ type: 'smartAccountPrepare', chainId, kind, grantId }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    if (r?.ok) setSum(r as Summary); else setErr(r?.error ?? 'Could not prepare this request');
  };
  const cancel = () => { if (sum) void c.bg({ type: 'smartAccountReject', requestId: sum.requestId }).catch(() => {}); setSum(null); setGate(false); };
  const approve = async () => {
    if (!sum) return; setGate(false); setBusy(true); setErr('');
    const r = await c.bg({ type: 'smartAccountApprove', requestId: sum.requestId }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    if (r?.ok) { setDone(`${sum.kind === 'enable' ? 'Smart account is being turned on' : sum.kind === 'revoke' ? 'Smart account is being turned off' : 'The permission is being revoked'} on ${sum.network}. It updates here once confirmed.`); setSum(null); setTimeout(() => void load(), 15_000); }
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
            <div style={{ fontSize: 12, color: T.sub }}>{r.state === 'pinned' ? 'On' : r.state === 'other' ? (r.delegatedTo?.toLowerCase() === LEGACY_DELEGATE ? 'Delegated to an older Harbour contract' : 'Delegated to another contract') : 'Off'}</div>
          </div>
          {r.state === 'none' && <Btn onClick={() => void start(r.chainId, 'enable')} disabled={busy} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Turn on</Btn>}
          {r.state === 'other' && r.delegatedTo?.toLowerCase() === LEGACY_DELEGATE && <Btn onClick={() => void start(r.chainId, 'enable')} disabled={busy} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Switch</Btn>}
          {r.state !== 'none' && <Btn variant="ghost" onClick={() => void start(r.chainId, 'revoke')} disabled={busy} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Turn off</Btn>}
        </div>
      ))}
    </Group>
    <Note>A smart account lets this address use batched and sponsored transactions. You can turn it off at any time.</Note>
    {grants.length > 0 && <>
      <SectionLabel>Permissions you granted</SectionLabel>
      <Group>
        {grants.map((g, i) => (
          <div key={g.id} data-testid={`grant-${g.id}`} style={{ padding: 14, borderTop: i ? `1px solid ${T.border}` : undefined, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{g.origin}</div>
              <div style={{ fontSize: 12, color: T.sub }}>Up to {amountOf(g)} in total · {g.network} · {g.status === 'active' ? `until ${new Date(g.expiry * 1000).toLocaleString()}` : g.status === 'revoked' ? 'revoked' : 'expired'}</div>
              <div style={{ fontSize: 12, color: T.sub }}>Session key {short(g.sessionKey)}</div>
            </div>
            {g.status === 'active' && <Btn variant="ghost" onClick={() => void start(g.chainId, 'revokeGrant', g.id)} disabled={busy} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Revoke</Btn>}
          </div>
        ))}
      </Group>
      <Note>Revoking sends one transaction that disables the permission on-chain. Until then a site holding the session key can still spend up to the limit.</Note>
    </>}
    {done && <div role="status" style={{ fontSize: 13, color: T.sub, margin: '8px 2px' }}>{done}</div>}
    <ErrorLine msg={err}/>
    {sum && !gate && <Sheet title={sum.kind === 'enable' ? 'Turn on smart account?' : sum.kind === 'revoke' ? 'Turn off smart account?' : 'Revoke this permission?'} onClose={cancel}>
      <div style={{ color: T.sub, fontSize: 14, lineHeight: 1.45, marginBottom: 12 }}>
        {sum.kind === 'enable'
          ? <>This sends one transaction on {sum.network} that lets <b>{short(sum.address)}</b> run through Harbour&apos;s audited smart account contract <b>{short(sum.delegate ?? '')}</b>. Your address and keys stay the same.</>
          : sum.kind === 'revoke' ? <>This sends one transaction on {sum.network} that returns <b>{short(sum.address)}</b> to a plain account.</>
          : <>This sends one transaction on {sum.network} that disables the permission you gave <b>{sum.origin}</b> (session key <b>{short(sum.delegate ?? '')}</b>, up to {amountOf({ allowance: sum.allowance ?? '0', token: sum.token, symbol: sum.symbol })}). The site can no longer spend from <b>{short(sum.address)}</b> with it.</>}
      </div>
      <div style={{ fontSize: 13, marginBottom: 14 }}>Network fee: up to <b>{sum.maxFee} {sum.symbol}</b></div>
      <Btn onClick={() => setGate(true)} disabled={busy}>Confirm</Btn>
      <Btn variant="ghost" onClick={cancel} style={{ marginTop: 8 }}>Cancel</Btn>
    </Sheet>}
    {sum && gate && <Sheet title="Verify it is you" onClose={cancel}><RevealGate bg={c.bg} walletId={walletId} purpose="manage" message="change your smart account" onGranted={() => void approve()} onCancel={cancel}/></Sheet>}
  </>;
};
