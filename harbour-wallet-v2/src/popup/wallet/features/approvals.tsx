// Settings > Security > Token approvals: allowances this account granted (GoPlus scan, verified on-chain) with one-tap revoke.
import React, { useCallback, useEffect, useState } from 'react';
import { T } from '../../theme';
import { Screen, Row, Empty, Spinner } from '../ui';
import { Notice } from './earnParts';
import type { Ctx } from '../types';
import { chainById } from '../../../core/chains/index';

const ApprovalsScreen: React.FC<Ctx> = (c) => {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(() => { setErr(''); setD(null); c.bg({ type: 'approvalsScan' }).then((r) => (r?.ok ? setD(r) : setErr(r?.error ?? 'Scan failed'))).catch((e) => setErr(String(e?.message ?? e))); }, [c]);
  useEffect(load, [load]);
  const revoke = async (a: any) => {
    const key = `${a.chainId}:${a.token}:${a.spender}`; setBusy(key); setMsg('');
    const r = await c.bg({ type: 'approvalsRevoke', chainId: a.chainId, token: a.token, spender: a.spender }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(''); setMsg(r?.ok ? `Revoke sent for ${a.symbol}. It disappears from this list once confirmed.` : r?.error ?? 'Revoke failed');
    if (r?.ok) setD((p: any) => ({ ...p, items: p.items.filter((x: any) => `${x.chainId}:${x.token}:${x.spender}` !== key) }));
  };
  return (
    <Screen title="Token approvals" onBack={c.nav.pop}>
      <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginBottom: 10 }}>Contracts you allowed to spend your tokens. Revoke the ones you no longer use, and any flagged as risky. Each revoke is a transaction with a small network fee.</div>
      {err ? <Notice tone="error" action={{ label: 'Retry', onClick: load }}>{err}</Notice> : !d ? <Spinner /> : <>
        {d.errors?.length > 0 && <Notice>Some networks could not be scanned: {d.errors.map((e: any) => chainById(e.chainId)?.name ?? e.chainId).join(', ')}.</Notice>}
        {d.items.length === 0 ? <Empty title="No active approvals found" sub="Scanned Ethereum, BNB Chain, Polygon, Arbitrum, Base, Optimism and Avalanche." icon="shield" /> : d.items.map((a: any) => {
          const key = `${a.chainId}:${a.token}:${a.spender}`;
          return <Row key={key} left={<div style={{ width: 8, height: 36, borderRadius: 4, background: a.risky ? T.error : a.unlimited ? 'var(--hb-warn-ink)' : T.border }} />}
            title={`${a.symbol || a.token.slice(0, 8)} · ${chainById(a.chainId)?.name ?? a.chainId}`}
            sub={`${a.unlimited ? 'Unlimited' : a.formatted} to ${a.spenderName ?? `${a.spender.slice(0, 8)}…${a.spender.slice(-4)}`}${a.risky ? ` · Risky: ${a.riskNotes.slice(0, 2).join(', ')}` : ''}`}
            right={d.canRevoke ? <button type="button" data-testid="approval-revoke" disabled={!!busy} onClick={() => void revoke(a)} style={{ background: 'none', border: 'none', color: a.risky ? T.error : T.accent, fontWeight: 800, cursor: 'pointer' }}>{busy === key ? '…' : 'Revoke'}</button> : undefined} />;
        })}
        {msg && <div role="status" style={{ fontSize: 13, color: T.sub, marginTop: 10 }}>{msg}</div>}
        {!d.canRevoke && d.items.length > 0 && <Notice>Revoking from a hardware wallet is not available here yet.</Notice>}
      </>}
    </Screen>
  );
};
export const SCREENS_approvals: Record<string, React.FC<Ctx>> = { tokenApprovals: ApprovalsScreen };
