// Screens for feature "onboarding": in-wallet entry points of the onboarding flows.
//  - addWallet: wallet-count aware (max 30), create-new in place, import / Ledger in the onboarding tab (no terms, no authentication).
//  - backup: re-authentication, reveal, then the verify-the-words step (TW BACKUP_SEEDPHRASE).
import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import { SCREENS, type Ctx } from '../screens';
import { Screen, Row, Btn, Skeleton, Ic } from '../ui';
import { T } from '../../theme';
import { BackupFlow } from '../../onboarding/BackupFlow';
import { MAX_WALLETS, canCreateWallet } from '../../../core/importKey';

const openOnboarding = async (query = '') => { await browser.tabs.create({ url: browser.runtime.getURL(`src/popup/index.html#/onboarding${query}`) }); window.close(); };

export const AddWalletOnboardingScreen: React.FC<Ctx> = (c) => {
  const [count, setCount] = useState<number | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    c.bg({ type: 'listWallets' }).then((r) => { if (live) setCount(r?.ok ? (r.wallets?.length ?? 0) : 0); }).catch(() => live && setCount(0));
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const allowed = count == null ? false : canCreateWallet(count);
  const createNew = async () => {
    if (busy || !allowed) return; setBusy(true); setErr('');
    try {
      const r = await c.bg({ type: 'addWallet' });
      if (r?.ok) { c.refresh?.(); c.nav.pop(); if (r.mnemonic) c.nav.push('backup', { mnemonic: r.mnemonic, label: r.label, walletId: r.walletId }); }
      else setErr(r?.error === 'MAX_WALLETS' ? `You can have up to ${MAX_WALLETS} wallets.` : r?.error || 'Could not create wallet');
    } finally { setBusy(false); }
  };
  return (
    <Screen title="Add wallet" onBack={c.nav.pop}>
      {count == null ? <div style={{ display: 'grid', gap: 10 }} aria-busy="true"><Skeleton h={56}/><Skeleton h={56}/><Skeleton h={56}/></div> : <>
        {!allowed && <div role="status" data-testid="wallet-limit" style={{ background: 'var(--hb-warn-bg)', color: 'var(--hb-warn-ink)', border: '1px solid var(--hb-warn-line)', borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 12 }}>You have reached the limit of {MAX_WALLETS} wallets. Remove one in Manage wallets to add another.</div>}
        <div style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>{count} of {MAX_WALLETS} wallets</div>
        <Row left={<Ic d="plus" size={20}/>} title="Create new wallet" sub="Generate a new secret phrase" onClick={allowed ? createNew : undefined}/>
        <Row left={<Ic d="receive" size={20}/>} title="I already have a wallet" sub="Secret phrase, private key or QR code" onClick={allowed ? () => void openOnboarding() : undefined}/>
        <Row left={<Ic d="shield" size={20}/>} title="Connect your Ledger" sub="Hardware wallet" onClick={allowed ? () => (SCREENS['importLedger'] ? c.nav.push('importLedger') : void openOnboarding()) : undefined}/>
        {err && <div role="alert" style={{ color: T.error, marginTop: 12, fontSize: 13 }}>{err}</div>}
        {busy && <div role="status" style={{ color: T.sub, marginTop: 12, fontSize: 13 }}>Creating wallet...</div>}
      </>}
    </Screen>
  );
};

export const BackupVerifyScreen: React.FC<Ctx> = (c) => (
  <Screen title="Back up your secret phrase" onBack={c.nav.pop}>
    <div className="hb-design" style={{ paddingTop: 8 }}>
      <BackupFlow bg={c.bg} walletId={c.params?.walletId} presetMnemonic={c.params?.mnemonic} granted={c.params?.granted === true}
        onDone={() => { c.refresh?.(); c.nav.pop(); }} onCancel={c.nav.pop}/>
    </div>
  </Screen>
);

export const SCREENS_onboarding: Record<string, React.FC<Ctx>> = { addWallet: AddWalletOnboardingScreen, backup: BackupVerifyScreen };
