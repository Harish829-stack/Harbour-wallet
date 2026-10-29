import { NetworkBanner } from './NetworkBanner';
import { SyncWithMobile } from './wallet/syncMobile';
// Must stay before ./onboarding/*: wallet/screens and wallet/features import each other, and screens has to initialise first.
import './wallet/screens';
import React, { useEffect, useState } from 'react';
import { T } from './theme';
import { bg, useWorkerState } from './api';
import { Onboarding } from './onboarding/Onboarding';
import { FlowFrame } from './onboarding/FlowFrame';
import { AddWalletReauth } from './wallet/addWalletReauth';
import { BackupFlow } from './onboarding/BackupFlow';
import { ProviderSurface, TokenApprovalsSurface } from './wallet/features/provider';
import { Wallet } from './wallet/Wallet';
import { injectStyles } from './wallet/ui';
import './design/system.css';
import { Brand } from './design/components';
import { BiometricEnroll, biometricUnlock, isPopupContext, loadPasskeyStatus, openInTab, useBiometricAvailability, type PasskeyStatus } from './biometricsUi';
import { useSecretField } from './secureField';
injectStyles(); // shared motion/keyframe CSS for lock, unlock and setup screens too

// Harbour Wallet — light UI, Trust Wallet-style layout (dummy branding). RE §3, §6.1.
type Screen = 'loading' | 'onboarding' | 'unlock' | 'home';

const primary = (disabled = false): React.CSSProperties => ({
  width: '100%', padding: '14px 16px', borderRadius: 999, border: 'none',
  background: disabled ? T.bgAlt : T.accent, color: disabled ? T.sub : '#fff',
  fontWeight: 700, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 12,
});
const ghost: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 12 };
// Wallet creation, import and the phrase backup live in onboarding/* and wallet/features/onboarding.tsx. This file only unlocks:
// the password field is uncontrolled (popup/secureField.tsx) and its value is read once, sent to the worker and cleared.
const input: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, color: T.text, boxSizing: 'border-box', marginTop: 10, fontSize: 15 };

const Logo = ({ size = 28 }: { size?: number }) => <div style={{fontSize:size}}><Brand/></div>;

// Module-level on purpose: a component declared inside App() gets a new identity every render, so React
// remounts its whole subtree on each keystroke and inputs lose focus after one character.
const Shell: React.FC<{ children: React.ReactNode; header?: boolean; k?: string }> = ({ children, header = true, k }) => (
  <div className="hb-root" style={{ background: T.bg, color: T.text, fontFamily: 'Inter, -apple-system, system-ui, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
    {header && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
      <Logo size={26} /><span style={{ fontWeight: 800, fontSize: 17 }}>Harbour</span>
    </div>}
    <div key={k} className="hb-enter" style={{ padding: 20, flex: 1 }}>{children}</div>
  </div>
);


export function App() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => { const change = () => setRoute(window.location.hash); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  const body = /^#\/notification(?:[/?]|$)/.test(route) ? <ProviderSurface/> : /^#\/approval(?:[/?]|$)/.test(route) ? <TokenApprovalsSurface/> : <WalletApp/>;
  return <><NetworkBanner/>{body}</>;
}

function WalletApp() {
  const [screen, setScreen] = useState<Screen>('loading');
  const pw = useSecretField(); const [pwFilled, setPwFilled] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [addrs, setAddrs] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<Record<string, any>>({});
  const [totalUsd, setTotalUsd] = useState<number | null>(null);
  const [balLoading, setBalLoading] = useState(false);
  const [backupRequired, setBackupRequired] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ derivationIndex: number; name: string; addresses: Record<string, string> }>>([]);
  const [activeAccount, setActiveAccount] = useState(0);
  const [hiddenAssets, setHiddenAssets] = useState<string[]>([]);
  const [networkFilter, setNetworkFilter] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // Biometric unlock (TW unlock page): biometrics are the primary action when set up; the password stays as fallback.
  const [passkey, setPasskey] = useState<PasskeyStatus>({ enabled: false, credentialId: null, isPasswordGenerated: false });
  const [usePassword, setUsePassword] = useState(false); const [bioBusy, setBioBusy] = useState(false); const [bioErr, setBioErr] = useState('');
  const [popup, setPopup] = useState(true); const autoBio = React.useRef(false);
  const params = new URLSearchParams(window.location.search);
  const bio = useBiometricAvailability();
  useEffect(() => { void isPopupContext().then(setPopup); }, []);
  useEffect(() => { if (screen === 'unlock') void loadPasskeyStatus(bg).then(setPasskey); }, [screen]);

  useEffect(() => { bg({ type: 'status' }).then((s) => {
    if (!s.hasVault) window.location.hash = '/onboarding';
    setScreen(s.hasVault ? (s.unlocked ? 'home' : 'unlock') : 'onboarding');
  }).catch(() => { window.location.hash = '/onboarding'; setScreen('onboarding'); }); }, []);

  // Auto-lock fires from a background alarm; notice it while the popup is open and drop to the unlock screen.
  useEffect(() => {
    if (screen !== 'home') return;
    const t = setInterval(() => { bg({ type: 'status' }).then((s) => { if (s && s.hasVault && !s.unlocked) setScreen('unlock'); }).catch(() => {}); }, 5000);
    return () => clearInterval(t);
  }, [screen]);

  // Load accounts + live balances whenever we land on home.
  useEffect(() => {
    if (screen !== 'home') return;
    let cancelled = false;
    (async () => {
      setBalLoading(true);
      try {
        const acc = await bg({ type: 'getAccounts' });
        if (!cancelled && acc?.ok) { setAddrs(acc.addresses ?? {}); setBackupRequired(!!acc.backupRequired); setAccounts(acc.accounts ?? []); setActiveAccount(acc.activeAccount ?? 0); }
        const prefs = await bg({ type: 'getUiPrefs' });
        if (!cancelled && prefs?.ok) { setHiddenAssets(prefs.hiddenAssets ?? []); setNetworkFilter(prefs.networkFilter ?? null); }
        const res = await bg({ type: 'getBalances', addresses: acc?.addresses });
        if (!cancelled && res?.ok) { setBalances(res.balances ?? {}); setTotalUsd(res.pricesAvailable ? res.totalUsd : null); }
      } finally { if (!cancelled) setBalLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [screen, refreshTick]);

  // Live updates from the Harbour backend (balance or transaction pushes): refetch quietly, no loading skeleton.
  const liveTick = useWorkerState((s) => (s.live?.balanceTick ?? 0) + (s.live?.txTick ?? 0));
  useEffect(() => {
    if (screen !== 'home' || !liveTick) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await bg({ type: 'getBalances', addresses: addrs }).catch(() => null);
      if (!cancelled && res?.ok) { setBalances(res.balances ?? {}); setTotalUsd(res.pricesAvailable ? res.totalUsd : null); }
    }, 300); // coalesce bursts (a send moves balance and status at once)
    return () => { cancelled = true; clearTimeout(t); };
  }, [liveTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const doBiometric = async () => {
    if (!passkey.credentialId || bioBusy) return;
    if (popup) { await openInTab('?biometrics=1'); window.close(); return; }
    setBioErr(''); setBioBusy(true);
    const r = await biometricUnlock(bg, passkey.credentialId);
    setBioBusy(false);
    if (r.ok) setScreen('home'); else if (!r.cancelled) setBioErr(r.error);
  };
  useEffect(() => {
    if (screen === 'unlock' && passkey.enabled && params.get('biometrics') && !popup && !autoBio.current) { autoBio.current = true; void doBiometric(); }
  });  
  if (screen === 'onboarding' || window.location.hash.startsWith('#/onboarding')) return <Onboarding/>;

  const doUnlock = async () => {
    if (busy || !pwFilled) return; setErr(''); setBusy(true);
    const password = pw.take(); setPwFilled(false);
    try { const res = await bg({ type: 'unlock', password }); if (res.ok) setScreen('home'); else setErr(res.error || 'Incorrect password'); } finally { setBusy(false); }
  };

  if (screen === 'loading') return <Shell k={screen} header={false}><div style={{ color: T.sub, textAlign: 'center', marginTop: 80 }}>Loading…</div></Shell>;

  if (screen === 'unlock') {
    const bioPrimary = passkey.enabled && !usePassword;
    return <Shell k={screen} header={false}>
      <div style={{ textAlign: 'center', paddingTop: 64 }}><Logo size={56} /><h2 style={{ fontSize: 22, margin: '20px 0 0' }}>Welcome back</h2></div>
      <div style={{ marginTop: 28 }}>
        {!bioPrimary && <input style={input} type="password" placeholder="Password" ref={pw.ref} onInput={(e) => setPwFilled(!!e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && doUnlock()} autoFocus spellCheck={false} autoComplete="current-password" />}
        {err && <div key={err} className="hb-shake" role="alert" style={{ color: T.error, fontSize: 13, marginTop: 10 }}>{err}</div>}
        {!bioPrimary && <button style={primary(!pwFilled || busy)} disabled={!pwFilled || busy} onClick={doUnlock}>Unlock</button>}
        {passkey.enabled && <>
          {bioPrimary
            ? <button data-testid="unlock-biometrics" style={primary(bioBusy)} disabled={bioBusy} onClick={doBiometric}>{bioBusy ? 'Waiting for ' + bio.name + '…' : 'Unlock with ' + bio.name}</button>
            : <button data-testid="unlock-biometrics" style={ghost} disabled={bioBusy} onClick={doBiometric}>Unlock with {bio.name}</button>}
          {bioErr && bioPrimary && <div role="alert" style={{ color: T.error, fontSize: 13, marginTop: 10 }}>{bioErr}</div>}
          {bioPrimary && !passkey.isPasswordGenerated && <button style={{ ...ghost, border: 'none' }} onClick={() => { setUsePassword(true); setBioErr(''); }}>Use password instead</button>}
          {!bioPrimary && <button style={{ ...ghost, border: 'none' }} onClick={() => setUsePassword(false)}>Back</button>}
        </>}
      </div>
    </Shell>;
  }

  // Opened in a full tab from Settings so the OS biometric sheet can appear without closing the popup.
  // Opened in a full tab from Settings > Sync with Mobile (needs the webcam, which a popup cannot hold on to).
  if (screen === 'home' && params.get('sync')) return <FlowFrame heading={<>Sync with<br/>mobile</>} art="qr-mobile" note="Only seed-phrase wallets are imported. Your phone keeps its own copy."><SyncWithMobile bg={bg} onClose={() => { window.history.replaceState(null, '', window.location.pathname); window.close(); window.location.reload(); }} /></FlowFrame>;
  // Opened in a full tab from the add-wallet gate so the OS biometric sheet can appear.
  if (screen === 'home' && params.get('reauth') === 'add') return <FlowFrame heading={<>Verify<br/>it’s you</>} title="Add a wallet" art="backup"><AddWalletReauth bg={bg} then={params.get('then') === 'create' ? 'create' : 'import'}/></FlowFrame>;
  // Opened in a full tab from the reveal gate so the OS biometric sheet can appear.
  if (screen === 'home' && params.get('reveal')) return <FlowFrame heading={<>Back up your<br/>secret phrase</>} title="Back up your Secret Phrase" art="backup"><BackupFlow bg={bg} walletId={params.get('wallet') || undefined} autoBiometric onDone={() => window.close()} onCancel={() => window.close()}/></FlowFrame>;
  if (screen === 'home' && params.get('enroll')) return <FlowFrame heading="Secure your wallet" title="Set up biometrics" art="biometrics"><BiometricEnroll bg={bg} name={bio.name} onDone={() => { window.history.replaceState(null, '', window.location.pathname); window.location.reload(); }} /></FlowFrame>;

  // Authenticated 4-tab wallet UI (Home/Trending/Swap/Earn) — parity with live TW capture.
  return <Wallet
    addrs={addrs} balances={balances} totalUsd={totalUsd} loading={balLoading}
    accounts={accounts} activeAccount={activeAccount}
    hiddenAssets={hiddenAssets} networkFilter={networkFilter}
    backupRequired={backupRequired}
    onRefresh={() => setRefreshTick((n) => n + 1)}
    onLock={() => bg({ type: 'lock' }).then(() => setScreen('unlock'))}
  />;
}
