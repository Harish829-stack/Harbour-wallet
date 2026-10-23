// Wallet management screens: selector, manage list, wallet detail, accounts list, account detail, hardware placeholder,
// and the security-migration flow (select source -> select destination -> select assets).
// These override the same-named screens in screens.tsx (FEATURE_SCREENS spreads last) so private-key and hardware wallets get
// the right rows: no "Add account" / secret-phrase backup for a private-key wallet, a reveal-private-key row instead.
import React, { useCallback, useEffect, useState } from 'react';
import { T } from '../theme';
import { Screen, Sheet, Btn, Ic, ICON, Row, Skeleton, Empty } from './ui';
import { RevealGate } from './revealGate';
import { Group, NavRow, SectionLabel, ErrorLine, Note, SelectionRow } from './settingsScreens';
import { validateWalletName } from '../../core/importKey';
import { chainById } from '../../core/chains/index';
import {
  WALLET_KIND_LABEL, walletKind, groupWallets, canAddAccount, canBackupPhrase, canRevealPrivateKey, shortAddress, pickSource, pickDestination, destinationOptions, toggleAsset, selectAllAssets, migratableAssets, migrationQueue,
  canContinueFromSource, canContinueFromDestination, canMigrate, type MigrationAsset, type MigrationState,
} from '../../core/settingsExtra';
import type { Ctx } from './types';

interface DAccount { index: number; derivationIndex: number; name: string; addresses: Record<string, string> }
interface DWallet { id: string; label: string; type: string; kind: string; blockchain: string | null; activeAccount: number; backupRequired: boolean; accounts: DAccount[] }
const primaryAddress = (a?: DAccount) => a?.addresses?.ethereum ?? Object.values(a?.addresses ?? {})[0] ?? '';

function useWallets(c: Ctx) {
  const [wallets, setWallets] = useState<DWallet[] | null>(null); const [active, setActive] = useState<string | null>(null); const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { const r = await c.bg({ type: 'walletsDetailed' }); if (!r?.ok) throw new Error(r?.error === 'LOCKED' ? 'The wallet is locked.' : r?.error || 'Could not load wallets'); setWallets(r.wallets); setActive(r.activeWalletId); }
    catch (e: any) { setError(e?.message || 'Could not load wallets'); setWallets([]); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  return { wallets, active, error, load };
}
const Avatar: React.FC<{ kind: string }> = ({ kind }) => (
  <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 999, background: T.bgAlt, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <Ic d={kind === 'privateKey' ? 'lock' : kind === 'hardware' ? 'shield' : 'wallet'} size={18}/></div>
);
const Radio: React.FC<{ on: boolean }> = ({ on }) => <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${on ? T.accent : T.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{on && <span style={{ width: 10, height: 10, borderRadius: 999, background: T.accent }}/>}</span>;
const ListSkeleton = () => <div aria-busy="true" style={{ display: 'grid', gap: 10, marginTop: 8 }}><Skeleton h={56}/><Skeleton h={56}/><Skeleton h={56}/></div>;

// ---------- Wallet selector (home header -> wallets) ----------
export const WalletSelector: React.FC<Ctx> = (c) => {
  const { wallets, active, error, load } = useWallets(c); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const addAccount = async (id: string) => {
    if (busy) return; setBusy(true); setErr('');
    try { await c.bg({ type: 'switchWallet', walletId: id }); const r = await c.bg({ type: 'addAccount' }); if (r?.ok) { c.refresh?.(); await load(); } else setErr(r?.error || 'Could not add account'); } finally { setBusy(false); }
  };
  const select = async (id: string, index: number) => {
    if (busy) return; setBusy(true); setErr('');
    try { const a = await c.bg({ type: 'switchWallet', walletId: id }); if (a?.ok === false) throw new Error(a.error); const b = await c.bg({ type: 'switchAccount', index }); if (b?.ok === false) throw new Error(b.error); c.refresh?.(); c.nav.pop(); }
    catch (e: any) { setErr(e?.message || 'Could not switch'); } finally { setBusy(false); }
  };
  return (
    <Screen title="Wallets" onBack={c.nav.pop} right={<button className="hb-tap" aria-label="Settings" onClick={() => c.nav.push('settings')} style={{ background: 'none', border: 0, color: T.text, cursor: 'pointer' }}><Ic d="gear" size={20}/></button>}>
      {wallets === null ? <ListSkeleton/> : <>
        <ErrorLine msg={error || err}/>
        {groupWallets(wallets).map((g) => <div key={g.kind}>
          <SectionLabel>{g.title}</SectionLabel>
          {g.wallets.map((w) => <div key={w.id} style={{ background: T.bgAlt, borderRadius: 14, padding: '2px 12px', margin: '6px 0 12px' }} data-testid={`wallet-${w.id}`}>
            <div style={{ fontWeight: 800, fontSize: 15, padding: '10px 2px 0' }}>{w.label}</div>
            {w.accounts.map((a) => <Row key={a.index} onClick={() => select(w.id, a.index)} left={<Avatar kind={w.kind}/>} title={a.name} sub={shortAddress(primaryAddress(a))} right={<Radio on={w.id === active && a.index === w.activeAccount}/>}/>)}
            {canAddAccount(w) && <div className="hb-tap" role="button" tabIndex={0} onClick={() => addAccount(w.id)} onKeyDown={(e) => { if (e.key === 'Enter') void addAccount(w.id); }} style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12, fontWeight: 700, cursor: 'pointer' }}>Add account <Ic d="plus" size={18}/></div>}
          </div>)}
        </div>)}
        {wallets.length === 0 && !error && <Empty title="No wallets yet" sub="Add a wallet to get started." icon="wallet"/>}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Btn variant="ghost" onClick={() => c.nav.push('addWallet')} style={{ flex: 1 }}>Add new wallet</Btn>
          <Btn variant="ghost" onClick={() => c.nav.push('manageWallets')} style={{ flex: 1 }}>Manage wallets</Btn>
        </div>
      </>}
    </Screen>
  );
};

// ---------- Manage wallets ----------
export const ManageWallets: React.FC<Ctx> = (c) => {
  const { wallets, error } = useWallets(c);
  return (
    <Screen title="Manage wallets" onBack={c.nav.pop}>
      {wallets === null ? <ListSkeleton/> : <>
        <ErrorLine msg={error}/>
        {groupWallets(wallets).map((g) => <div key={g.kind}><SectionLabel>{g.title}</SectionLabel>
          {g.wallets.map((w) => <div key={w.id} style={{ background: T.bgAlt, borderRadius: 14, padding: '2px 14px', margin: '8px 0 12px' }}>
            <Row onClick={() => c.nav.push(w.kind === 'hardware' ? 'settingsHardwareWallet' : 'editWallet', { walletId: w.id, label: w.label })} left={<Avatar kind={w.kind}/>} title={w.label} sub={`${w.accounts.length} account${w.accounts.length === 1 ? '' : 's'}`} right={<Ic d={ICON.chevron} size={18}/>}/>
            {canBackupPhrase(w) && <div className="hb-tap" role="button" tabIndex={0} onClick={() => c.nav.push('backup', { walletId: w.id, label: w.label })} onKeyDown={(e) => { if (e.key === 'Enter') c.nav.push('backup', { walletId: w.id, label: w.label }); }} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', color: T.accent, fontWeight: 600, cursor: 'pointer', borderTop: `1px solid ${T.border}` }}><span>{w.backupRequired ? 'Back up your Secret Phrase now' : 'Back up your Secret Phrase'}</span><Ic d={ICON.chevron} size={18}/></div>}
          </div>)}</div>)}
        {wallets.length === 0 && !error && <Empty title="No wallets yet" icon="wallet"/>}
        <Btn onClick={() => c.nav.push('addWallet')} style={{ marginTop: 6 }}>Add new wallet</Btn>
      </>}
    </Screen>
  );
};

// ---------- Wallet detail (settings/wallet/:id) ----------
export const WalletDetail: React.FC<Ctx> = (c) => {
  const walletId: string = c.params?.walletId;
  const { wallets, error, load } = useWallets(c);
  const w = wallets?.find((x) => x.id === walletId);
  const [draft, setDraft] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false); const [gate, setGate] = useState(false); const [key, setKey] = useState<{ key: string; network: string } | null>(null); const [copied, setCopied] = useState(false);
  useEffect(() => () => setKey(null), []);
  useEffect(() => { if (!key) return; const t = setTimeout(() => setKey(null), 60_000); return () => clearTimeout(t); }, [key]);
  if (wallets === null) return <Screen title="Wallet" onBack={c.nav.pop}><ListSkeleton/></Screen>;
  if (!w) return <Screen title="Wallet" onBack={c.nav.pop}><Empty title="Wallet not found" sub={error || 'It may have been removed.'} icon="wallet"/></Screen>;
  const nameError = draft != null ? validateWalletName(draft, wallets.filter((x) => x.id !== w.id).map((x) => x.label)).error : undefined;
  const save = async () => {
    if (draft == null || nameError || busy) return; setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'renameWallet', walletId: w.id, name: draft.trim() }); if (!r?.ok) throw new Error(r?.error || 'Rename failed'); setDraft(null); c.refresh?.(); await load(); }
    catch (e: any) { setErr(e?.message || 'Rename failed'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy) return; setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'removeWallet', walletId: w.id }); if (!r?.ok) throw new Error(r?.error || 'Remove failed'); c.refresh?.(); c.nav.pop(); }
    catch (e: any) { setErr(e?.message || 'Remove failed'); setConfirmRemove(false); } finally { setBusy(false); }
  };
  const reveal = async () => {
    setGate(false); setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'revealPrivateKey', walletId: w.id }); if (!r?.ok) throw new Error(r?.error === 'AUTH_REQUIRED' ? 'Verification expired. Try again.' : r?.error || 'Could not show the key'); setKey({ key: r.key, network: r.network }); }
    catch (e: any) { setErr(e?.message || 'Could not show the key'); } finally { setBusy(false); }
  };
  const kind = walletKind(w);
  return (
    <Screen title={w.label} onBack={c.nav.pop}>
      <div style={{ color: T.sub, fontSize: 12, margin: '4px 2px 8px' }}>{WALLET_KIND_LABEL[kind]}</div>
      <Group>
        {draft == null
          ? <NavRow first icon="edit" label="Wallet name" value={w.label} onClick={() => setDraft(w.label)} testid="wallet-rename"/>
          : <div style={{ padding: 14 }}>
              <label style={{ fontSize: 12, color: T.sub }} htmlFor="wallet-name">Wallet name</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input id="wallet-name" autoFocus value={draft} maxLength={40} aria-invalid={!!nameError} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setDraft(null); }} style={{ flex: 1, border: `1px solid ${nameError ? T.error : T.border}`, background: T.surface, color: T.text, borderRadius: 10, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit' }}/>
                <Btn onClick={save} disabled={busy || !!nameError || !draft.trim()} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Save</Btn>
              </div>
              {nameError && <div role="alert" style={{ color: T.error, fontSize: 12, marginTop: 6 }}>{nameError}</div>}
            </div>}
        <NavRow icon="wallet" label="Accounts" value={String(w.accounts.length)} onClick={() => c.nav.push('settingsWalletAccounts', { walletId: w.id })} testid="wallet-accounts"/>
      </Group>
      {canBackupPhrase(w) && <Group><NavRow first icon="shield" label={w.backupRequired ? 'Back up your Secret Phrase (required)' : 'Secret Phrase'} onClick={() => c.nav.push('backup', { walletId: w.id, label: w.label })} testid="wallet-backup"/></Group>}
      {canRevealPrivateKey(w) && <Group><NavRow first icon="lock" label="Show private key" onClick={() => { setErr(''); setGate(true); }} testid="wallet-reveal-key"/></Group>}
      {kind === 'privateKey' && <Note>This wallet was imported with a private key. It has one account and no secret phrase.</Note>}
      {key && <div data-testid="private-key-panel" style={{ background: T.bgAlt, borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Private key ({key.network}). Never share it. Hidden again in 60 seconds.</div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{key.key}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Btn variant="ghost" onClick={() => { void navigator.clipboard?.writeText(key.key).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} style={{ flex: 1 }}>{copied ? 'Copied' : 'Copy'}</Btn>
          <Btn variant="ghost" onClick={() => setKey(null)} style={{ flex: 1 }}>Hide</Btn>
        </div>
      </div>}
      <ErrorLine msg={err || error}/>
      <Btn variant="ghost" onClick={() => setConfirmRemove(true)} disabled={busy} style={{ color: T.error }}>Remove wallet</Btn>
      {gate && <Sheet title="Verify it is you" onClose={() => setGate(false)}><RevealGate bg={c.bg} walletId={w.id} onGranted={reveal} onCancel={() => setGate(false)}/></Sheet>}
      {confirmRemove && <Sheet title="Remove wallet?" onClose={() => setConfirmRemove(false)}>
        <div style={{ color: T.sub, fontSize: 14, marginBottom: 14 }}>{kind === 'mnemonic' ? `This removes ${w.label} from this device. Without its secret phrase it cannot be recovered.` : kind === 'privateKey' ? `This removes ${w.label} from this device. Without its private key it cannot be recovered.` : `This removes ${w.label} from this device. Your hardware wallet is not affected.`}</div>
        <Btn onClick={remove} disabled={busy} style={{ background: T.error }}>{busy ? 'Removing…' : 'Remove wallet'}</Btn>
        <Btn variant="ghost" onClick={() => setConfirmRemove(false)} style={{ marginTop: 8 }}>Cancel</Btn>
      </Sheet>}
    </Screen>
  );
};

// ---------- Wallet accounts (/settings/wallet/accounts/:id) ----------
export const WalletAccounts: React.FC<Ctx> = (c) => {
  const walletId: string = c.params?.walletId; const { wallets, active, error, load } = useWallets(c);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const w = wallets?.find((x) => x.id === walletId);
  if (wallets === null) return <Screen title="Accounts" onBack={c.nav.pop}><ListSkeleton/></Screen>;
  if (!w) return <Screen title="Accounts" onBack={c.nav.pop}><Empty title="Wallet not found" sub={error} icon="wallet"/></Screen>;
  const add = async () => {
    if (busy) return; setBusy(true); setErr('');
    try { await c.bg({ type: 'switchWallet', walletId: w.id }); const r = await c.bg({ type: 'addAccount' }); if (!r?.ok) throw new Error(r?.error || 'Could not add account'); c.refresh?.(); await load(); }
    catch (e: any) { setErr(e?.message || 'Could not add account'); } finally { setBusy(false); }
  };
  return (
    <Screen title={`${w.label} accounts`} onBack={c.nav.pop}>
      {w.accounts.map((a) => <Row key={a.index} onClick={() => c.nav.push('accountDetail', { walletId: w.id, index: a.index, name: a.name, address: primaryAddress(a) })} left={<Avatar kind={w.kind}/>}
        title={a.name} sub={shortAddress(primaryAddress(a))} right={w.id === active && a.index === w.activeAccount ? <span style={{ color: T.accent, fontSize: 12 }}>Active</span> : <Ic d={ICON.chevron} size={18}/>}/>)}
      <ErrorLine msg={err}/>
      {canAddAccount(w) ? <Btn onClick={add} disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Adding…' : 'Add account'}</Btn> : <Note>{w.kind === 'privateKey' ? 'An imported private-key wallet has a single account.' : 'Accounts of this wallet are managed on the hardware device.'}</Note>}
    </Screen>
  );
};

// ---------- Account detail (rename + every network address) ----------
export const AccountDetail: React.FC<Ctx> = (c) => {
  const { walletId, index } = c.params ?? {}; const { wallets } = useWallets(c);
  const w = wallets?.find((x) => x.id === walletId); const acct = w?.accounts.find((a) => a.index === Number(index));
  const [name, setName] = useState<string>(c.params?.name ?? 'Account'); const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [copied, setCopied] = useState('');
  useEffect(() => { if (acct) setName(acct.name); }, [acct?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const n = (draft ?? '').trim(); if (!n || busy) return; setBusy(true); setErr('');
    try { const r = await c.bg({ type: 'renameAccount', walletId, index, name: n }); if (!r?.ok) throw new Error(r?.error || 'Rename failed'); setName(n); setDraft(null); c.refresh?.(); }
    catch (e: any) { setErr(e?.message || 'Rename failed'); } finally { setBusy(false); }
  };
  const addresses = Object.entries(acct?.addresses ?? (c.params?.address ? { ethereum: c.params.address } : {}));
  const copy = (k: string, v: string) => { void navigator.clipboard?.writeText(v).then(() => { setCopied(k); setTimeout(() => setCopied(''), 1500); }); };
  return (
    <Screen title="Edit account" onBack={c.nav.pop}>
      <Group>
        {draft == null ? <NavRow first icon="edit" label="Account name" value={name} onClick={() => setDraft(name)} testid="account-rename"/>
          : <div style={{ padding: 14, display: 'flex', gap: 8 }}>
              <input autoFocus aria-label="Account name" value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setDraft(null); }} style={{ flex: 1, border: `1px solid ${T.border}`, background: T.surface, color: T.text, borderRadius: 10, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit' }}/>
              <Btn onClick={save} disabled={busy || !draft.trim()} style={{ width: 'auto', padding: '8px 14px', marginTop: 0 }}>Save</Btn>
            </div>}
      </Group>
      <ErrorLine msg={err}/>
      {wallets === null && <ListSkeleton/>}
      {addresses.length > 0 && <SectionLabel>Addresses</SectionLabel>}
      {addresses.map(([k, v]) => <div key={k} className="hb-tap" role="button" tabIndex={0} onClick={() => copy(k, v)} onKeyDown={(e) => { if (e.key === 'Enter') copy(k, v); }} style={{ background: T.bgAlt, borderRadius: 14, padding: 12, marginTop: 8, cursor: 'pointer' }}>
        <div style={{ fontSize: 12, color: T.sub, textTransform: 'capitalize' }}>{k} {copied === k && <span style={{ color: T.success }}>Copied</span>}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', marginTop: 2 }}>{v}</div></div>)}
      {wallets !== null && addresses.length === 0 && <Empty title="No addresses" icon="wallet"/>}
    </Screen>
  );
};

// ---------- Hardware wallet placeholder ----------
export const HardwareWallet: React.FC<Ctx> = (c) => (
  <Screen title="Hardware wallet" onBack={c.nav.pop}>
    <Empty title="Hardware wallet" sub="Accounts on a hardware wallet are added and signed on the device. Connect your Ledger from Add wallet to import its accounts." icon="shield"/>
    <Btn onClick={() => c.nav.push('addWallet')}>Connect your Ledger</Btn>
  </Screen>
);

// ---------- Security migration ----------
const MigrationHeader: React.FC<{ step: number; text: string }> = ({ step, text }) => <div style={{ color: T.sub, fontSize: 13, margin: '4px 2px 10px' }}>Step {step} of 3. {text}</div>;
const readMigration = (c: Ctx): MigrationState => ({ source: c.params?.source, destination: c.params?.destination, selected: Array.isArray(c.params?.selected) ? c.params.selected : [] });

export const MigrationSource: React.FC<Ctx> = (c) => {
  const { wallets, error } = useWallets(c); const [s, setS] = useState<MigrationState>(readMigration(c));
  return (
    <Screen title="Select source wallet" onBack={c.nav.pop}>
      <MigrationHeader step={1} text="Choose the wallet to move assets from."/>
      {wallets === null ? <ListSkeleton/> : <>
        <ErrorLine msg={error}/>
        {wallets.filter((w) => walletKind(w) !== 'hardware').map((w) => <SelectionRow key={w.id} label={`${w.label} - ${WALLET_KIND_LABEL[walletKind(w)]}`} selected={s.source === w.id} onClick={() => setS(pickSource(s, w.id))} testid={`migration-source-${w.id}`}/>)}
        {wallets.length < 2 && !error && <Note>You need at least two wallets to move assets between them.</Note>}
        <Btn disabled={!canContinueFromSource(s) || wallets.length < 2} onClick={() => c.nav.push('migrationSelectDestination', { ...s })} style={{ marginTop: 14 }}>Continue</Btn>
      </>}
    </Screen>
  );
};
export const MigrationDestination: React.FC<Ctx> = (c) => {
  const { wallets, error } = useWallets(c); const [s, setS] = useState<MigrationState>(readMigration(c));
  const options = destinationOptions(wallets ?? [], s.source);
  return (
    <Screen title="Select destination wallet" onBack={c.nav.pop}>
      <MigrationHeader step={2} text="Choose the wallet that receives the assets."/>
      {wallets === null ? <ListSkeleton/> : <>
        <ErrorLine msg={error}/>
        {options.map((w) => <SelectionRow key={w.id} label={`${w.label} - ${WALLET_KIND_LABEL[walletKind(w)]}`} selected={s.destination === w.id} onClick={() => setS(pickDestination(s, w.id))} testid={`migration-destination-${w.id}`}/>)}
        {options.length === 0 && <Note>There is no other wallet to move assets to.</Note>}
        <Btn disabled={!canContinueFromDestination(s)} onClick={() => c.nav.push('migrationSelectAssets', { ...s })} style={{ marginTop: 14 }}>Continue</Btn>
      </>}
    </Screen>
  );
};
export const MigrationAssets: React.FC<Ctx> = (c) => {
  const [s, setS] = useState<MigrationState>(readMigration(c)); const [assets, setAssets] = useState<MigrationAsset[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(0);
  const load = useCallback(async () => {
    setAssets(null); setErr('');
    try { const r = await c.bg({ type: 'walletBalances', walletId: s.source }); if (!r?.ok) throw new Error(r?.error || 'Could not load balances'); const all: MigrationAsset[] = r.assets; setFailed(r.assets.filter((a: any) => a.error).length); setAssets(migratableAssets(all)); }
    catch (e: any) { setErr(e?.message || 'Could not load balances'); setAssets([]); }
  }, [s.source]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  const go = async () => {
    if (!assets || !canMigrate(s) || busy) return; setBusy(true); setErr('');
    try {
      const queue = migrationQueue(s, assets);
      // Each asset goes to the destination account's address on the same chain; the transfer is reviewed and signed on Send.
      const walletsRes = await c.bg({ type: 'walletsDetailed' }); const dest = walletsRes?.wallets?.find((w: any) => w.id === s.destination);
      const destAddr = (a: MigrationAsset): string | undefined => { const ch = chainById(a.id); return ch ? dest?.accounts?.[0]?.addresses?.[ch.ct] : undefined; };
      const ready = queue.filter((a) => !!destAddr(a)); const skipped = queue.length - ready.length;
      const first = ready[0]; if (!first) throw new Error('The destination wallet has no address on the selected networks. Choose another wallet or other assets.');
      if (skipped > 0) setErr(`${skipped} asset${skipped === 1 ? '' : 's'} skipped: the destination wallet has no address on ${skipped === 1 ? 'that network' : 'those networks'}.`);
      const a = await c.bg({ type: 'switchWallet', walletId: s.source }); if (a?.ok === false) throw new Error(a.error || 'Could not switch wallet');
      c.refresh?.();
      c.nav.push('send', { assetId: first.id, to: destAddr(first), isMax: true, migration: { destination: s.destination, remaining: ready.slice(1).map((x) => x.id) } });
    } catch (e: any) { setErr(e?.message || 'Could not start the transfer'); } finally { setBusy(false); }
  };
  return (
    <Screen title="Select assets" onBack={c.nav.pop}>
      <MigrationHeader step={3} text="Choose the assets to move. Each transfer is reviewed on the Send screen."/>
      {assets === null ? <ListSkeleton/> : <>
        <ErrorLine msg={err}/>
        {assets.length === 0 && !err && <Empty title="Nothing to move" sub="The source wallet has no balance on the networks Harbour can read." icon="wallet"/>}
        {assets.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 2px' }}><span style={{ color: T.sub, fontSize: 13 }}>{s.selected.length} selected</span><button className="hb-tap" onClick={() => setS(selectAllAssets(s, assets))} style={{ background: 'none', border: 0, color: T.accent, fontWeight: 600, cursor: 'pointer' }}>{s.selected.length === assets.length ? 'Clear' : 'Select all'}</button></div>}
        {assets.map((a) => <SelectionRow key={a.id} label={`${a.name} - ${a.balance} ${a.symbol}`} selected={s.selected.includes(a.id)} onClick={() => setS(toggleAsset(s, a.id))} testid={`migration-asset-${a.id}`}/>)}
        {failed > 0 && <Note>{failed} network{failed === 1 ? '' : 's'} could not be read and {failed === 1 ? 'is' : 'are'} not listed.</Note>}
        {err && <Btn variant="ghost" onClick={() => void load()}>Try again</Btn>}
        <Btn disabled={!canMigrate(s) || busy} onClick={go} style={{ marginTop: 14 }}>{busy ? 'Preparing…' : 'Move selected assets'}</Btn>
      </>}
    </Screen>
  );
};

export const WALLET_SCREENS: Record<string, React.FC<Ctx>> = {
  walletSelector: WalletSelector, manageWallets: ManageWallets, editWallet: WalletDetail, accountDetail: AccountDetail,
  settingsWalletAccounts: WalletAccounts, settingsHardwareWallet: HardwareWallet,
  migrationSelectSource: MigrationSource, migrationSelectDestination: MigrationDestination, migrationSelectAssets: MigrationAssets,
};
