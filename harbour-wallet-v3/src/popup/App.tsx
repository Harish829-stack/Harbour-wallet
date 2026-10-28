import { NetworkBanner } from './NetworkBanner';
import { SeedCanvas } from './wallet/SeedCanvas';
import { SyncWithMobile } from './wallet/syncMobile';
// Must stay before ./onboarding/*: wallet/screens and wallet/features import each other, and screens has to initialise first.
import './wallet/screens';
import React, { useEffect, useState } from 'react';
import { T } from './theme';
import { bg, useWorkerState } from './api';
import { Onboarding } from './onboarding/Onboarding';
import { FlowFrame } from './onboarding/FlowFrame';
import { BackupFlow } from './onboarding/BackupFlow';
import { ProviderSurface, TokenApprovalsSurface } from './wallet/features/provider';
import { Wallet } from './wallet/Wallet';
import { injectStyles } from './wallet/ui';
import './design/system.css';
import { Brand } from './design/components';
import { BiometricEnroll, biometricUnlock, isPopupContext, loadPasskeyStatus, openInTab, useBiometricAvailability, type PasskeyStatus } from './biometricsUi';
injectStyles(); // shared motion/keyframe CSS for lock, unlock and setup screens too

// Harbour Wallet — light UI, Trust Wallet-style layout (dummy branding). RE §3, §6.1.
type Screen = 'loading' | 'welcome' | 'password' | 'backup' | 'unlock' | 'home';

const primary = (disabled = false): React.CSSProperties => ({
  width: '100%', padding: '14px 16px', borderRadius: 999, border: 'none',
  background: disabled ? T.bgAlt : T.accent, color: disabled ? T.sub : '#fff',
  fontWeight: 700, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 12,
});
const ghost: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 12 };
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
  const [terms, setTerms] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
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
    setScreen(s.hasVault ? (s.unlocked ? 'home' : 'unlock') : 'welcome');
  }).catch(() => setScreen('welcome')); }, []);

  // Auto-lock fires from a background alarm; notice it while the popup is open and drop to the unlock screen.
  useEffect(() => {
    if (screen !== 'home') return;
    const t = setInterval(() => { bg({ type: 'status' }).then((s) => { if (s && s.hasVault && !s.unlocked) { setPw(''); setScreen('unlock'); } }).catch(() => {}); }, 5000);
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
  if (window.location.hash.startsWith('#/onboarding')) return <Onboarding/>;

  const startCreate = async () => { setBusy(true); try { const { mnemonic } = await bg({ type: 'generateMnemonic' }); setMnemonic(mnemonic); setScreen('password'); } finally { setBusy(false); } };
  const submitPassword = async () => {
    setErr(''); if (pw.length < 8) return setErr('Min 8 characters'); if (pw !== pw2) return setErr('Passwords do not match');
    setBusy(true);
    try { const res = await bg({ type: 'createWallet', password: pw, mnemonic }); if (res.ok) { setAddrs(res.addresses); setScreen('backup'); } else setErr(res.error || 'Failed'); }
    finally { setBusy(false); }
  };
  const doUnlock = async () => { setErr(''); setBusy(true); try { const res = await bg({ type: 'unlock', password: pw }); if (res.ok) setScreen('home'); else setErr(res.error || 'Incorrect password'); } finally { setBusy(false); } };

  if (screen === 'loading') return <Shell k={screen} header={false}><div style={{ color: T.sub, textAlign: 'center', marginTop: 80 }}>Loading…</div></Shell>;

  if (screen === 'welcome') return <Shell k={screen} header={false}>
    <div style={{ textAlign: 'center', paddingTop: 48 }}>
      <Logo size={72} />
      <h1 style={{ fontSize: 26, margin: '28px 0 8px' }}>Welcome to Harbour</h1>
      <p style={{ color: T.sub, margin: 0, lineHeight: 1.5 }}>The simple, self-custody wallet.<br />Your keys, your crypto.</p>
    </div>
    <div style={{ marginTop: 40 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: T.sub, fontSize: 13, margin: '0 0 8px', lineHeight: 1.4 }}>
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ marginTop: 2 }} />
        <span>I have read and agree to the <a style={{ color: T.accent, textDecoration: 'none' }}>Terms of Use</a> and <a style={{ color: T.accent, textDecoration: 'none' }}>Privacy Policy</a></span>
      </label>
      <button style={primary(!terms || busy)} disabled={!terms || busy} onClick={startCreate}>Create a new wallet</button>
      <button style={{ ...ghost, opacity: terms ? 1 : 0.5, pointerEvents: terms ? 'auto' : 'none' }} onClick={() => setScreen('password')}>I already have a wallet</button>
    </div>
  </Shell>;

  if (screen === 'password') return <Shell k={screen}>
    <h2 style={{ fontSize: 22, marginTop: 8 }}>Create password</h2>
    <p style={{ color: T.sub, fontSize: 14, marginTop: 4 }}>This encrypts your wallet on this device.</p>
    <input style={input} type="password" placeholder="New password (min 8 characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
    <input style={input} type="password" placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
    {err && <div style={{ color: T.error, fontSize: 13, marginTop: 10 }}>{err}</div>}
    <button style={primary(!pw || !pw2 || busy)} disabled={!pw || !pw2 || busy} onClick={submitPassword}>{busy ? 'Creating…' : 'Continue'}</button>
  </Shell>;

  if (screen === 'backup') return <Shell k={screen}>
    <h2 style={{ fontSize: 22, marginTop: 8 }}>Your secret phrase</h2>
    <p style={{ color: T.sub, fontSize: 14, marginTop: 4 }}>Write these 12 words down in order and keep them safe. Anyone with them controls your wallet.</p>
    <div style={{ marginTop: 12 }}><SeedCanvas words={mnemonic.split(' ').filter(Boolean)} revealed /></div>
    <div style={{ marginTop: 16, background: T.accentSoft, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Accounts created</div>
      {Object.entries(addrs).slice(0, 4).map(([k, v]) => <div key={k} style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>{k}: {v.slice(0, 8)}…{v.slice(-6)}</div>)}
    </div>
    <button style={primary()} onClick={() => setScreen('home')}>I've saved my phrase</button>
  </Shell>;

  if (screen === 'unlock') {
    const bioPrimary = passkey.enabled && !usePassword;
    return <Shell k={screen} header={false}>
      <div style={{ textAlign: 'center', paddingTop: 64 }}><Logo size={56} /><h2 style={{ fontSize: 22, margin: '20px 0 0' }}>Welcome back</h2></div>
      <div style={{ marginTop: 28 }}>
        {!bioPrimary && <input style={input} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doUnlock()} autoFocus />}
        {err && <div key={err} className="hb-shake" role="alert" style={{ color: T.error, fontSize: 13, marginTop: 10 }}>{err}</div>}
        {!bioPrimary && <button style={primary(!pw || busy)} disabled={!pw || busy} onClick={doUnlock}>Unlock</button>}
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
    onBackup={() => setScreen('backup')}
    onLock={() => bg({ type: 'lock' }).then(() => { setScreen('unlock'); setPw(''); })}
  />;
}
