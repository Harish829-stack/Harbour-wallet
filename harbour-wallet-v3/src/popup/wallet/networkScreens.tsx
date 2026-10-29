import React, { useEffect, useState } from 'react';
import { T } from '../theme';
import { Screen, Sheet, Btn, Ic, ICON, Coin, Spinner, inputStyle } from './ui';
import { syncNetworks } from './networkStore';
import { networkOptions } from './data';
import { NETWORK_CATEGORIES, NETWORK_CATEGORY_LABEL } from '../../core/chains/index';
import type { Ctx } from './screens';

// Settings > Custom Networks, after Trust Wallet 26.41.0 [certain: layout from screenshots]: empty state "No custom networks added /
// Tap "Add Custom Network" to get started!", "Built-in network RPCs" list with a pencil per row, bottom "Add custom network" button.
// Add form: Network name, RPC URL, Chain ID, Token symbol, Block explorer URL (Optional), orange "Double check the network info" alert.
// Harbour additions: the RPC is probed and its chain id must match; built-in networks only allow changing the RPC.
const input = inputStyle;
const Field: React.FC<{ id: string; label: string; value: string; onChange?: (v: string) => void; readOnly?: boolean; error?: boolean; inputMode?: 'numeric' | 'url'; autoFocus?: boolean; testid: string }> = ({ id, label, value, onChange, readOnly, error, inputMode, autoFocus, testid }) => (
  <div style={{ marginTop: 14 }}>
    <label htmlFor={id} style={{ fontSize: 12, fontWeight: 700 }}>{label}</label>
    <input id={id} data-testid={testid} value={value} readOnly={readOnly} disabled={readOnly} inputMode={inputMode} autoFocus={autoFocus} spellCheck={false} autoComplete="off" onChange={(e) => onChange?.(e.target.value)}
      style={{ ...input, opacity: readOnly ? 0.6 : 1, borderColor: error ? T.error : T.border }} />
  </div>
);
const Warn: React.FC = () => (
  <div style={{ marginTop: 18, padding: '10px 12px', borderRadius: 12, background: 'color-mix(in srgb, #f59e0b 14%, transparent)', color: T.text, fontSize: 13, lineHeight: 1.5 }}>
    <b style={{ fontWeight: 600 }}>Double check the network info.</b> A malicious network provider can lie about the state of the blockchain and record your network activity. Only add custom networks you trust.
  </div>
);
// Same icon source as Home > Select network (networkOptions: registry chain logo, else symbol logo / initials), so both lists look identical.
const NetRow: React.FC<{ name: string; chainId: number; symbol?: string; sub?: string; onEdit: () => void; testid?: string }> = ({ name, chainId, symbol, sub, onEdit, testid }) => {
  const o = networkOptions().find((x) => x.chainId === chainId);
  return (
  <div className="hb-tap" role="button" tabIndex={0} data-testid={testid} onClick={onEdit} onKeyDown={(e) => { if (e.key === 'Enter') onEdit(); }}
    style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.bgAlt, borderRadius: 14, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}>
    <Coin sym={o?.sym ?? symbol ?? name.slice(0, 3)} assetId={o?.id} size={40} color={o?.color} />
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{name}</div>{sub && <div style={{ fontSize: 12, color: T.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}</div>
    <Ic d={ICON.edit} size={18} />
  </div>
  );
};

export const CustomNetworksScreen: React.FC<Ctx> = (c) => {
  const [data, setData] = useState<any>(null);
  useEffect(() => { void syncNetworks(c.bg).then(setData); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen title="Manage networks" onBack={c.nav.pop}>
      <div style={{ paddingBottom: 80 }}>
        {!data ? <div style={{ textAlign: 'center', paddingTop: 40 }}><Spinner size={28} /></div> : <>
          {/* Same groups, labels and order as Home > Select network: Default, Custom, Testnets. */}
          {NETWORK_CATEGORIES.map((cat) => {
            const list: any[] = cat === 'custom' ? data.custom : data.builtin.filter((n: any) => !!n.testnet === (cat === 'testnet'));
            if (!list.length && cat !== 'custom') return null;
            return <div key={cat} data-testid={`networks-${cat}`}>
              <div style={{ fontWeight: 700, margin: '18px 0 10px' }}>{NETWORK_CATEGORY_LABEL[cat]}</div>
              {list.length === 0 ? (
                <div data-testid="networks-empty" style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>No custom networks added</div>
                  <div style={{ color: T.sub, fontSize: 13, marginTop: 6 }}>Tap “Add custom network” to get started!</div>
                </div>
              ) : list.map((n: any) => cat === 'custom'
                ? <NetRow key={n.chainId} testid={`network-${n.chainId}`} name={n.name} chainId={n.chainId} symbol={n.symbol} sub={`Chain ID ${n.chainId} · ${n.symbol}`} onEdit={() => c.nav.push('editNetwork', { chainId: n.chainId })} />
                : <NetRow key={n.chainId} testid={`network-${n.chainId}`} name={n.name} chainId={n.chainId} sub={n.overridden ? 'Custom RPC' : undefined} onEdit={() => c.nav.push('editNetwork', { chainId: n.chainId })} />)}
            </div>;
          })}
        </>}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px', background: T.bg }}>
        <Btn onClick={() => c.nav.push('addNetwork')}>Add custom network</Btn>
      </div>
    </Screen>
  );
};

// One form for add + edit. `chainId` param => edit.
export const NetworkFormScreen: React.FC<Ctx> = (c) => {
  const editingId: number | undefined = c.params?.chainId != null ? Number(c.params.chainId) : undefined;
  const [loaded, setLoaded] = useState(editingId == null);
  const [builtin, setBuiltin] = useState<any>(null); const [overridden, setOverridden] = useState(false);
  const [name, setName] = useState(''); const [rpc, setRpc] = useState(''); const [chainId, setChainId] = useState(''); const [symbol, setSymbol] = useState(''); const [explorer, setExplorer] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<{ error: string; field?: string } | null>(null); const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (editingId == null) return;
    void syncNetworks(c.bg).then((d) => {
      const cu = d?.custom.find((n: any) => n.chainId === editingId); const bi = d?.builtin.find((n: any) => n.chainId === editingId);
      if (cu) { setName(cu.name); setRpc(cu.rpcUrl); setChainId(String(cu.chainId)); setSymbol(cu.symbol); setExplorer(cu.explorerUrl ?? ''); }
      else if (bi) { setBuiltin(bi); setName(bi.name); setRpc(bi.rpcUrl); setChainId(String(bi.chainId)); setOverridden(bi.overridden); }
      setLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const isEdit = editingId != null;
  const complete = builtin ? !!rpc.trim() : !!(name.trim() && rpc.trim() && chainId.trim() && symbol.trim());
  const save = async () => {
    if (!complete || busy) return; setBusy(true); setErr(null);
    const r = await c.bg({ type: 'networkSave', name, rpcUrl: rpc, chainId, symbol, explorerUrl: explorer, editing: isEdit && !builtin ? editingId : undefined, rpcOnly: !!builtin }).catch(() => null);
    setBusy(false);
    if (r?.ok) { await syncNetworks(c.bg); c.refresh?.(); c.nav.pop(); } else setErr({ error: r?.error || 'Could not save the network', field: r?.field });
  };
  const remove = async () => { setBusy(true); await c.bg({ type: 'networkRemove', chainId: editingId }); await syncNetworks(c.bg); c.refresh?.(); setBusy(false); c.nav.pop(); };
  if (!loaded) return <Screen title="Custom network" onBack={c.nav.pop}><div style={{ textAlign: 'center', paddingTop: 40 }}><Spinner size={28} /></div></Screen>;
  const f = err?.field;
  return (
    <Screen title={isEdit ? (builtin ? `${name} RPC` : 'Edit network') : 'Add custom network'} onBack={c.nav.pop}>
      <div style={{ color: T.sub, fontSize: 13, textAlign: 'center', marginTop: 4 }}>We only support EVM networks currently.</div>
      <Field id="net-name" testid="network-name-input" label="Network name" value={name} onChange={setName} readOnly={!!builtin} error={f === 'name'} autoFocus={!isEdit} />
      <Field id="net-rpc" testid="network-rpc-input" label="RPC URL" value={rpc} onChange={setRpc} inputMode="url" error={f === 'rpcUrl'} autoFocus={!!builtin} />
      <Field id="net-chain" testid="network-chainid-input" label="Chain ID" value={chainId} onChange={(v) => setChainId(v.replace(/[^0-9]/g, ''))} inputMode="numeric" readOnly={isEdit} error={f === 'chainId'} />
      <Field id="net-symbol" testid="network-symbol-input" label="Token symbol" value={symbol} onChange={setSymbol} readOnly={!!builtin} error={f === 'symbol'} />
      {!builtin && <Field id="net-explorer" testid="network-explorer-input" label="Block explorer URL (Optional)" value={explorer} onChange={setExplorer} inputMode="url" error={f === 'explorerUrl'} />}
      {err && <div role="alert" data-testid="network-error" style={{ color: T.error, fontSize: 13, marginTop: 12 }}>{err.error}</div>}
      <Warn />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '18px 0 24px' }}>
        <Btn disabled={!complete || busy} onClick={save}>{busy ? 'Checking RPC…' : isEdit ? 'Save' : 'Add custom network'}</Btn>
        {isEdit && !builtin && <Btn variant="ghost" onClick={() => setConfirm(true)}>Delete network</Btn>}
        {builtin && overridden && <Btn variant="ghost" disabled={busy} onClick={remove}>Reset to default RPC</Btn>}
      </div>
      {confirm && <Sheet title="Delete network?" onClose={() => setConfirm(false)}>
        <div style={{ color: T.sub, marginBottom: 14 }}>{name} will be removed. Tokens you added on it are kept but hidden until you add the network again.</div>
        <Btn onClick={remove} disabled={busy} style={{ background: T.error }}>Delete</Btn><div style={{ height: 10 }} /><Btn variant="ghost" onClick={() => setConfirm(false)}>Cancel</Btn>
      </Sheet>}
    </Screen>
  );
};

export const NETWORK_SCREENS: Record<string, React.FC<Ctx>> = { customNetworks: CustomNetworksScreen, addNetwork: NetworkFormScreen, editNetwork: NetworkFormScreen };
