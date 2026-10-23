// "Connect your Ledger": pick the device over WebHID, read the Ethereum / Bitcoin / Solana addresses from whichever apps are open
// (the user can switch apps between steps), then add a hardware wallet holding only those public addresses.
import React, { useState } from 'react';
import { T } from '../theme';
import { Screen, Btn, Row } from '../wallet/ui';
import type { Ctx } from '../wallet/types';

const PATHS = { ethereum: "44'/60'/0'/0/0", bitcoin: "84'/0'/0'/0/0", solana: "44'/501'/0'" } as const;
type Ct = keyof typeof PATHS;
const NAMES: Record<Ct, string> = { ethereum: 'Ethereum (all EVM networks)', bitcoin: 'Bitcoin', solana: 'Solana' };

export const ImportLedgerScreen: React.FC<Ctx> = (c) => {
  const [found, setFound] = useState<Partial<Record<Ct, string>>>({}); const [busy, setBusy] = useState<Ct | 'add' | null>(null); const [err, setErr] = useState('');
  const read = async (ct: Ct) => {
    setBusy(ct); setErr('');
    const L = await import('./device');
    let t: any = null;
    try {
      t = await L.open(!Object.keys(found).length);
      const address = ct === 'ethereum' ? await L.ethAddress(t, PATHS.ethereum) : ct === 'bitcoin' ? await L.btcAddress(t, PATHS.bitcoin) : await L.solAddress(t, PATHS.solana);
      setFound((f) => ({ ...f, [ct]: address }));
    } catch (e: any) { setErr(L.ledgerError(e)); } finally { await L.close(t); setBusy(null); }
  };
  const add = async () => {
    setBusy('add'); setErr('');
    const accounts = Object.fromEntries((Object.keys(found) as Ct[]).map((ct) => [ct, { address: found[ct], path: PATHS[ct] }]));
    const r = await c.bg({ type: 'ledgerAddWallet', accounts }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(null);
    if (r?.ok) { c.refresh?.(); c.nav.home(); } else setErr(r?.error === 'MAX_WALLETS' ? 'You have reached the wallet limit.' : r?.error ?? 'Could not add the Ledger');
  };
  return (
    <Screen title="Connect your Ledger" onBack={c.nav.pop}>
      <div style={{ color: T.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>Connect your Ledger with a USB cable and unlock it. For each network, open its app on the device, then tap Read. Harbour stores only the public addresses; every transaction is confirmed on the Ledger.</div>
      {(Object.keys(PATHS) as Ct[]).map((ct) => (
        <Row key={ct} title={NAMES[ct]} sub={found[ct] ? `${found[ct]!.slice(0, 10)}…${found[ct]!.slice(-6)}` : `Open the ${ct === 'ethereum' ? 'Ethereum' : ct === 'bitcoin' ? 'Bitcoin' : 'Solana'} app · ${PATHS[ct]}`}
          right={<button type="button" data-testid={`ledger-read-${ct}`} disabled={!!busy} onClick={() => void read(ct)} style={{ background: 'none', border: 'none', color: T.accent, fontWeight: 800, cursor: 'pointer' }}>{busy === ct ? 'Reading…' : found[ct] ? 'Read again' : 'Read'}</button>} left={<div style={{ width: 6 }} />} />
      ))}
      {err && <div role="alert" style={{ color: T.error, fontSize: 13, margin: '10px 0' }}>{err}</div>}
      <Btn disabled={!!busy || !(found.ethereum || found.bitcoin)} onClick={add} style={{ marginTop: 14 }}>{busy === 'add' ? 'Adding…' : 'Add Ledger wallet'}</Btn>
      <div style={{ color: T.sub, fontSize: 12, marginTop: 12 }}>Sending works on EVM networks and Bitcoin. Solana is receive-only from a Ledger for now. If Chrome's device picker does not open in the popup, use Expand view and try again.</div>
    </Screen>
  );
};
