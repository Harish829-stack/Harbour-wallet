import { DappIllustration, SidePanelIllustration, ToolbarIllustration } from './illustrations';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { bg } from '../api';
import { validatePassword } from '../../core/passwordPolicy';
import { Animation } from './Animation';
import { Brand, PasswordField } from '../design/components';
import { ChevronRight, ChevronLeft, ArrowLeft, Eye, LockKeyhole, Wallet, QrCode, Smartphone, CircleHelp, ArrowUpRight, Usb } from 'lucide-react';
import { registerBiometrics, useBiometricAvailability, BiometricEnroll, type EnrollStage } from '../biometricsUi';
import { isUserCancel, toHex } from '../../core/passkey';
import { classifySecret, validateWalletName, MAX_WALLETS, type PkNetworkOption } from '../../core/importKey';
import { createIdleGuard, restoreStep, serializeStep, STEP_KEY, type OnboardingFlow, type OnboardingMode, type OnboardingStep } from '../../core/onboardingRules';
import { ImportInstructions, SecretForm, ChainIcon, type SecretCheck } from './ImportSecret';
import { QrScanner, type StoredKeys } from './qrScanner';
import { BackupFlow } from './BackupFlow';
import { FEATURE_SCREENS } from '../wallet/features';
import './onboarding.css';

type Flow = OnboardingFlow;
type Step = OnboardingStep;
type Source = 'trust' | 'other';
interface SolanaAccount { type: 'default' | 'phantom'; address: string; balance: string | null; symbol: string; hasTransactions: boolean }
interface Status { ok: boolean; hasVault: boolean; unlocked: boolean; walletCount: number; maxWallets: number; canCreateWallet: boolean; mode: OnboardingMode; defaultName: string; names: string[] }

const hashQuery = () => new URLSearchParams((window.location.hash.split('?')[1] ?? ''));
const readSaved = () => { try { return sessionStorage.getItem(STEP_KEY); } catch { return null; } };
const writeSaved = (v: string | null) => { try { if (v == null) sessionStorage.removeItem(STEP_KEY); else sessionStorage.setItem(STEP_KEY, v); } catch { /* storage may be blocked */ } };
const errorText = (code: string): string => ({
  MNEMONIC_ALREADY_EXISTS: 'This secret phrase has already been imported.',
  PRIVATE_KEY_DUPLICATED: 'This private key has already been imported.',
  MAX_WALLETS: `You can have up to ${MAX_WALLETS} wallets. Remove one to add another.`,
  IMPORT_EXPIRED: 'The import session expired. Enter your secret again.',
  WALLET_CREATION_IN_PROGRESS: 'A wallet is already being created. Wait a moment and try again.',
  INCORRECT_CODE: 'Incorrect encryption code. Check the code shown in your mobile app.',
  LOCKED: 'The wallet is locked. Unlock it and try again.',
}[code] ?? code);

function Icon({ type }: { type: 'arrow' | 'eye' | 'lock' | 'wallet' | 'qr' | 'phone' | 'usb' }) { const Glyph = { arrow: ChevronRight, eye: Eye, lock: LockKeyhole, wallet: Wallet, qr: QrCode, phone: Smartphone, usb: Usb }[type]; return <Glyph size={24} strokeWidth={1.8} aria-hidden="true"/>; }
function Choice({ children, icon = 'wallet', recommended, onClick, testid, disabled }: { children: React.ReactNode; icon?: 'lock' | 'wallet' | 'qr' | 'usb'; recommended?: boolean; onClick: () => void; testid?: string; disabled?: boolean }) {
  return <button type="button" className="ob-choice" onClick={onClick} data-testid={testid} disabled={disabled}><span className="ob-choice-label"><Icon type={icon}/><span>{children}</span>{recommended && <small>Recommended</small>}</span><Icon type="arrow"/></button>;
}
function QRLink() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) void QRCode.toCanvas(canvas.current, 'https://link.trustwallet.com/extension_sync', { width: 240, margin: 2 }); }, []);
  return <canvas ref={canvas} aria-label="Trust Wallet mobile extension sync link" className="ob-qr"/>;
}
/** Closes the onboarding tab after 10 minutes without input (TW target-page guard). Paused while `paused`. */
function useIdleClose(paused: boolean) {
  useEffect(() => {
    if (paused) return;
    const guard = createIdleGuard({ onIdle: () => window.close() });
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
    guard.start(); const act = () => guard.activity(); events.forEach((e) => window.addEventListener(e, act, { passive: true }));
    return () => { guard.pause(); events.forEach((e) => window.removeEventListener(e, act)); };
  }, [paused]);
}

const Shell: React.FC<{ heading: React.ReactNode; title?: React.ReactNode; step?: string; onBack?: () => void; busy?: boolean; animation?: string; sidebar?: React.ReactNode; children: React.ReactNode }> = ({ heading, title, step, onBack, busy, animation = 'security', sidebar, children }) => (
  <main className="ob hb-design ob-layout">
    <aside className="ob-sidebar"><div className="ob-sidebar-inner"><Brand/><div className="ob-step">{step}</div><h1 data-testid="onboarding-step-title">{heading}</h1>
      {sidebar ?? <div className={`ob-illustration ${animation === 'security' ? 'ob-security' : ''}`}><Animation name={animation}/></div>}
      <a className="ob-help" href="/legal.html#help" target="_blank" rel="noreferrer"><CircleHelp size={16}/> Help</a>
    </div></aside>
    <section className="ob-main"><div className="ob-topline">{onBack && <button className="ob-back" onClick={onBack} disabled={busy}><ArrowLeft size={16}/> Back</button>}</div>{title && <h2>{title}</h2>}{children}</section>
  </main>
);

/** Unlock gate used when onboarding is opened while a vault exists but is locked (additional wallet, backup, passkey flows). */
function UnlockGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !pw) return; setBusy(true); setErr('');
    try { const r = await bg({ type: 'unlock', password: pw }); if (!r?.ok) throw new Error(r?.error || 'Incorrect password'); setPw(''); onUnlocked(); }
    catch (x: any) { setErr(x?.message || 'Incorrect password'); } finally { setBusy(false); }
  };
  return <Shell heading="Welcome back" title="Unlock your wallet to continue">
    <form className="ob-password-form" onSubmit={submit}><PasswordField label="Password" value={pw} onChange={setPw} autoFocus disabled={busy} error={err || undefined} autoComplete="current-password"/>
      <button className="ob-primary ob-half" disabled={!pw || busy}>{busy ? 'Unlocking...' : 'Unlock'}</button></form>
  </Shell>;
}

export function Onboarding() {
  const query = useMemo(hashQuery, []);
  const special = query.get('flow'); // SET_PASSKEY | BACKUP_SEEDPHRASE (TW query-driven flows)
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('welcome');
  const [flow, setFlow] = useState<Flow>('create');
  const [source, setSource] = useState<Source>('other');
  const [terms, setTerms] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const importPassword = useRef('');
  const pendingPasskey = useRef<{ secret: string; credentialId: string } | null>(null);
  const [bioStage, setBioStage] = useState<EnrollStage>('idle');
  const bio = useBiometricAvailability();
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [network, setNetwork] = useState<PkNetworkOption | null>(null);
  const [check, setCheck] = useState<SecretCheck>({ state: 'idle' });
  const [pendingId, setPendingId] = useState('');
  const [solana, setSolana] = useState<SolanaAccount[]>([]);
  const [solanaPick, setSolanaPick] = useState<'default' | 'phantom'>('default');
  const [qrKeys, setQrKeys] = useState<NonNullable<StoredKeys> | null>(null);
  const [code, setCode] = useState('');
  const [qrSummary, setQrSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [slide, setSlide] = useState(0);
  const [pinGuide, setPinGuide] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [resumeChoice, setResumeChoice] = useState(false);
  const policy = validatePassword(password);
  const confirmationError = confirmation && password !== confirmation ? 'Passwords do not match' : undefined;
  const mode: OnboardingMode = status?.mode ?? 'first-wallet';
  const additional = mode === 'additional-wallet' || mode === 'interrupted';

  useIdleClose(step === 'completed');

  const loadStatus = useCallback(async () => {
    setLoadError('');
    try {
      const s: Status = await bg({ type: 'onboardingStatus' });
      if (!s?.ok) throw new Error('Could not read wallet status');
      setStatus(s); setName((n) => n || s.defaultName);
      const restored = restoreStep(readSaved(), s.mode);
      if (s.mode === 'interrupted') setResumeChoice(true);
      if (restored) { setStep(restored.step); setFlow(restored.flow); setSource(restored.source); }
      else if (s.mode === 'additional-wallet') setStep('welcome');
    } catch (e: any) { setLoadError(e?.message || 'Could not read wallet status'); }
  }, []);
  useEffect(() => { void loadStatus(); }, [loadStatus]);
  // Persist the step so a reload resumes the same screen; secrets and passwords are never stored.
  useEffect(() => { if (!status) return; if (step === 'completed') writeSaved(null); else writeSaved(serializeStep({ step, flow, source })); }, [status, step, flow, source]);
  useEffect(() => () => { importPassword.current = ''; }, []);
  useEffect(() => {
    if (step !== 'completed') return;
    const timer = setInterval(() => setSlide((i) => (i + 1) % 3), 7000);
    void chrome.action?.getUserSettings?.().then((s) => setPinned(s.isOnToolbar ?? false)).catch(() => {});
    return () => clearInterval(timer);
  }, [step]);

  const kind = classifySecret(secret);
  const nameError = status ? validateWalletName(name, status.names).error : undefined;
  // Live validation: phrases through the wallet-core checker, keys per the selected network's curve. Nothing is stored.
  useEffect(() => {
    setCheck({ state: 'idle' });
    if (kind === 'empty') return;
    let live = true; setCheck({ state: 'checking' });
    const t = setTimeout(() => {
      const req = kind === 'mnemonic' ? bg({ type: 'validateMnemonic', mnemonic: secret.trim().replace(/\s+/g, ' ').toLowerCase() }) : network ? bg({ type: 'validatePrivateKey', privateKey: secret.trim(), chainId: network.chainId, group: network.kind === 'evm-group' }) : null;
      if (!req) { if (live) setCheck({ state: 'idle' }); return; }
      req.then((r) => { if (live) setCheck(r?.valid === true ? { state: 'valid' } : { state: 'invalid', error: kind === 'mnemonic' ? 'Invalid Secret Phrase' : 'Invalid Private Key' }); }).catch(() => { if (live) setCheck({ state: 'idle' }); });
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [secret, network, kind]);

  const go = (next: Step) => { setError(''); setStep(next); };
  const start = (next: Flow) => {
    setFlow(next); setPassword(''); setConfirmation('');
    if (additional) { go(next === 'create' ? 'welcome' : next === 'qr' ? 'qr-mobile' : 'sources'); if (next === 'create') void createAdditional(); return; }
    go('authentication');
  };
  const generatedPassword = () => toHex(crypto.getRandomValues(new Uint8Array(24)));
  const nextAfterAuth = (f: Flow) => go(f === 'qr' ? 'qr-mobile' : 'sources');
  async function runBiometricSetup() {
    if (busy || bioStage !== 'idle') return; setError('');
    try {
      pendingPasskey.current = await registerBiometrics(setBioStage);
      const pw = generatedPassword(); setBioStage('idle');
      if (flow === 'create') { await createWithPassword(pw); return; }
      importPassword.current = pw; nextAfterAuth(flow);
    } catch (cause) { pendingPasskey.current = null; setBioStage('idle'); if (!isUserCancel(cause)) setError(cause instanceof Error ? cause.message : 'Biometrics failed'); }
  }
  async function sealPendingPasskey() {
    const p = pendingPasskey.current; if (!p) return;
    const r = await bg({ type: 'passkeyEnroll', secret: p.secret, credentialId: p.credentialId, isPasswordGenerated: true });
    pendingPasskey.current = null;
    if (!r?.ok) throw new Error(r?.error || 'Could not save biometrics');
  }
  const complete = () => { setPassword(''); setConfirmation(''); importPassword.current = ''; setSecret(''); setCode(''); setQrKeys(null); setSolana([]); setPendingId(''); setStep('completed'); };
  async function createWithPassword(pw: string) {
    setBusy(true); setError('');
    try {
      const result = await bg({ type: 'createWallet', password: pw, name: name || 'Main wallet 1', newlyGenerated: true });
      if (!result.ok) throw new Error(errorText(result.error || 'Unable to create wallet'));
      await sealPendingPasskey(); complete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create wallet'); }
    finally { setBusy(false); }
  }
  async function createAdditional() {
    setBusy(true); setError('');
    try { const r = await bg({ type: 'addWallet' }); if (!r?.ok) throw new Error(errorText(r?.error || 'Unable to create wallet')); complete(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create wallet'); setStep('welcome'); }
    finally { setBusy(false); }
  }
  async function submitPassword(event: React.FormEvent) {
    event.preventDefault(); if (busy || !policy.valid || password !== confirmation) return;
    if (flow !== 'create') { importPassword.current = password; setPassword(''); setConfirmation(''); nextAfterAuth(flow); return; }
    await createWithPassword(password);
  }
  async function finishImport(id: string, variant: 'default' | 'phantom') {
    const r = await bg({ type: 'importComplete', pendingId: id, name: name.trim(), password: importPassword.current || undefined, solanaVariant: variant });
    if (!r?.ok) throw new Error(errorText(r?.error || 'Unable to import wallet'));
    await sealPendingPasskey(); complete();
  }
  const canSubmit = kind !== 'empty' && !nameError && check.state === 'valid' && (kind === 'mnemonic' || !!network);
  async function submitSecret(event: React.FormEvent) {
    event.preventDefault(); if (busy || !canSubmit) return;
    setBusy(true); setError('');
    try {
      const r = await bg({ type: 'importInitiate', secret, name: name.trim(), chainId: network?.chainId, group: network?.kind === 'evm-group' });
      if (!r?.ok) throw new Error(errorText(r?.error || 'Unable to import wallet'));
      setPendingId(r.pendingId);
      if (r.solanaChoice) { setSolana(r.accounts ?? []); setSolanaPick(r.solanaVariant ?? 'default'); go('solana'); return; }
      await finishImport(r.pendingId, r.solanaVariant ?? 'default');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to import wallet'); }
    finally { setBusy(false); }
  }
  async function submitSolana() {
    if (busy) return; setBusy(true); setError('');
    try { await finishImport(pendingId, solanaPick); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to import wallet'); } finally { setBusy(false); }
  }
  async function submitCode(value: string) {
    if (busy || !qrKeys || value.length !== 6) return; setBusy(true); setError('');
    try {
      const v = await bg({ type: 'qrVerify', storedKeys: qrKeys, code: value });
      if (!v?.ok) throw new Error(errorText(v?.error || 'Could not read the QR code'));
      const r = await bg({ type: 'qrImportAll', storedKeys: qrKeys, code: value, password: importPassword.current || undefined });
      if (!r?.ok) throw new Error(errorText(r?.error || 'Unable to import wallets'));
      await sealPendingPasskey();
      setQrSummary(`${r.imported ?? 0} wallet${r.imported === 1 ? '' : 's'} imported${r.duplicates ? `, ${r.duplicates} already existed` : ''}.`); complete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to import wallets'); setCode(''); }
    finally { setBusy(false); }
  }
  function openSidePanel() {
    chrome.windows.getCurrent({ populate: true }, (win) => {
      if (win.id === undefined) return;
      void chrome.sidePanel.open({ windowId: win.id }).catch(() => setError('Unable to open the side panel. Open Harbour from the extension toolbar.'));
    });
  }
  const back = () => {
    if (busy) return;
    if (step === 'password' || step === 'biometrics') { setPassword(''); setConfirmation(''); pendingPasskey.current = null; go('authentication'); }
    else if (step === 'secret') { setSecret(''); setNetwork(null); go(source === 'trust' ? 'trust-method' : 'sources'); }
    else if (step === 'solana') { if (pendingId) void bg({ type: 'importCancel', pendingId }); setPendingId(''); go('secret'); }
    else if (step === 'qr-scan') go('qr-mobile');
    else if (step === 'qr-code') { setQrKeys(null); setCode(''); go('qr-scan'); }
    else if (step === 'trust-method' || step === 'ledger') go('sources');
    else if (step === 'qr-mobile') go(additional ? 'welcome' : 'authentication');
    else if (step === 'sources') go(additional ? 'welcome' : 'authentication');
    else { importPassword.current = ''; setTerms(false); go('welcome'); }
  };

  // ---------- special and pre-flow screens ----------
  if (loadError) return <Shell heading="Something went wrong"><div className="ob-notice warn" role="alert">{loadError}</div><button className="ob-primary ob-half" onClick={() => void loadStatus()}>Try again</button></Shell>;
  if (!status) return <main className="ob hb-design ob-centered" aria-busy="true"><Brand/><p className="ob-muted" role="status">Loading...</p></main>;
  if (special === 'BACKUP_SEEDPHRASE' || special === 'SET_PASSKEY') {
    if (!status.hasVault) return <Shell heading="No wallet found"><p className="ob-muted">Create or import a wallet first.</p></Shell>;
    if (!status.unlocked) return <UnlockGate onUnlocked={() => void loadStatus()}/>;
    const done = () => { window.location.hash = '/'; window.close(); };
    return special === 'BACKUP_SEEDPHRASE'
      ? <Shell heading="Back up your wallet" title="Back up your Secret Phrase"><BackupFlow bg={bg} walletId={query.get('wallet') ?? undefined} onDone={done} onCancel={done}/></Shell>
      : <Shell heading="Secure your wallet" title="Set up biometrics" animation="security"><BiometricEnroll bg={bg} name={bio.name} onDone={done} onBack={done}/></Shell>;
  }
  if (mode === 'locked') return <UnlockGate onUnlocked={() => { writeSaved(null); void loadStatus(); }}/>;
  if (mode === 'blocked') return <Shell heading="Wallet limit reached" title={`You have ${status.maxWallets} wallets`}><div className="ob-notice warn" role="status" data-testid="wallet-limit">You can have up to {status.maxWallets} wallets. Remove a wallet you no longer use from Settings, then add another.</div><button className="ob-primary ob-half" onClick={() => window.close()}>Close</button></Shell>;
  if (mode === 'interrupted' && resumeChoice && step === 'welcome') return <Shell heading="Finish setting up" title="Your last setup was interrupted">
    <p className="ob-muted">A password was saved but no wallet was added. Continue importing a wallet, or start again.</p>
    {error && <p className="ob-error" role="alert">{error}</p>}
    <div className="ob-choices"><Choice onClick={() => { setResumeChoice(false); }}>Continue setup</Choice>
      <Choice onClick={async () => { setBusy(true); const r = await bg({ type: 'resetEmptyVault' }); setBusy(false); if (r?.ok) { writeSaved(null); setResumeChoice(false); await loadStatus(); } else setError(r?.error || 'Could not reset'); }} disabled={busy}>Start over</Choice></div>
  </Shell>;

  if (step === 'welcome') return <main className="ob hb-design ob-welcome">
    <div className="ob-globe"><Brand/><div><p className="hb-eyebrow">A CLEARER VIEW OF YOUR CRYPTO</p><h1>Your assets.<br/>Your horizon.</h1><p className="ob-muted">A self-custody wallet, with you at the helm.</p></div><Animation name="globe" className="ob-globe-animation"/></div>
    <div className="ob-welcome-right"><div className="ob-welcome-content"><Brand/>
      <p className="hb-eyebrow">{additional ? 'ADD A WALLET' : 'GET STARTED'}</p>
      <h1 data-testid="onboarding-step-title">{additional ? 'Add wallets and take charge of your journey' : 'Make yourself at home.'}</h1>
      <p className="ob-intro">{additional ? <>You have {status.walletCount} of {status.maxWallets} wallets.<br/>Your keys stay on this device.</> : <>Bring your existing wallet or create a new one.<br/>Your keys stay on this device.</>}</p>
      {!additional && <label className="ob-terms"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}/><span>I have read and agree to the <a href="/legal.html#terms" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="/legal.html#privacy" target="_blank" rel="noreferrer">Privacy Policy</a></span></label>}
      {error && <p className="ob-error" role="alert">{error}</p>}
      <div className="ob-welcome-actions"><button className="ob-primary" disabled={(!additional && !terms) || busy} onClick={() => start('import')}>I already have a wallet</button><button className="ob-secondary" disabled={(!additional && !terms) || busy} onClick={() => start('create')}>{busy ? 'Creating...' : 'Create new wallet'}</button></div>
      <div className="ob-mobile"><span/><p>Have the Trust Wallet mobile app? <Icon type="phone"/></p><span/></div>
      <button className="ob-link ob-sync" disabled={!additional && !terms} onClick={() => start('qr')}><Icon type="qr"/>Scan QR to sync</button>
    </div></div>
  </main>;

  const heading = step === 'completed' ? <>Brilliant,<br/>your wallet is ready!</> : step === 'authentication' || step === 'password' || step === 'biometrics' ? 'Secure your wallet' : step === 'qr-mobile' || step === 'qr-scan' || step === 'qr-code' ? 'Connect to mobile' : step === 'ledger' ? 'Connect your Ledger' : additional ? 'Add a wallet' : 'Import a wallet';
  const title = step === 'authentication' ? 'Select an option' : step === 'password' ? 'Create password' : step === 'biometrics' ? 'Biometric authentication' : step === 'sources' ? 'Select your existing wallet' : step === 'trust-method' ? 'Select a method' : step === 'secret' ? 'Import with Secret Phrase or Private Key' : step === 'solana' ? 'Choose your Solana wallet' : step === 'qr-mobile' ? 'Scan this QR code with your mobile phone camera' : step === 'qr-scan' ? 'Scan the QR code shown in your mobile app' : step === 'qr-code' ? 'Enter the encryption code' : step === 'ledger' ? 'Import from a hardware wallet' : step === 'completed' ? 'Start exploring' : 'Integration requires further verification';
  const total = additional ? 2 : flow === 'create' ? 2 : flow === 'qr' ? 4 : 3;
  const base = additional ? 0 : 1;
  const active = step === 'authentication' ? (flow === 'create' ? 0 : 1) : step === 'password' || step === 'biometrics' ? 1 : step === 'sources' || step === 'trust-method' || step === 'qr-mobile' ? base + 1 : step === 'secret' || step === 'solana' || step === 'qr-scan' || step === 'qr-code' || step === 'ledger' ? base + 2 : 0;
  const animation = step === 'completed' ? flow === 'create' ? 'empty-wallet' : 'wallet-created' : step === 'sources' || step === 'trust-method' || step === 'secret' || step === 'solana' || step === 'ledger' ? 'import' : step.startsWith('qr') ? 'qr-mobile' : 'security';
  const sidebar = step === 'secret' ? <ImportInstructions product={source === 'trust' ? 'trust-wallet' : 'other'}/> : undefined;
  const codeSlots = Array.from({ length: 6 }, (_, i) => code[i] ?? '');
  const LedgerScreen = FEATURE_SCREENS['importLedger'];
  return <main className="ob hb-design ob-layout">
    <aside className="ob-sidebar"><div className="ob-sidebar-inner"><Brand/><div className="ob-step">{active > 0 && `Step ${active} of ${total}`}</div><h1 data-testid="onboarding-step-title">{heading}</h1>
      {sidebar ?? <div className={`ob-illustration ${animation === 'security' ? 'ob-security' : ''}`}><Animation name={animation}/></div>}
      <a className="ob-help" href="/legal.html#help" target="_blank" rel="noreferrer"><CircleHelp size={16}/> Help</a>
    </div></aside>
    <section className="ob-main"><div className="ob-topline">{step !== 'completed' && <button className="ob-back" onClick={back} disabled={busy}><ArrowLeft size={16}/> Back</button>}</div><h2>{title}</h2>
      {step === 'authentication' && <div className="ob-choices">
        {bio.available && <Choice icon="lock" recommended testid="onboarding-biometrics" onClick={() => { pendingPasskey.current = null; go('biometrics'); }}>{bio.name}</Choice>}
        <Choice icon="lock" onClick={() => { pendingPasskey.current = null; go('password'); }}>Password</Choice>
      </div>}
      {step === 'biometrics' && <div className="ob-password-form">
        <p className="ob-muted">A secure and simple way to unlock your wallet with {bio.name}.</p>
        {bioStage !== 'idle' && <p className="ob-muted" data-testid="biometric-stage" role="status">{bioStage === 'register' ? 'Registering biometrics...' : 'Verifying biometrics...'}</p>}
        {error && <div className="ob-error" role="alert">{error}</div>}
        <button className="ob-primary ob-half" data-testid="onboarding-set-biometrics" disabled={busy || bioStage !== 'idle'} onClick={runBiometricSetup}>{busy ? 'Creating wallet...' : `Set up ${bio.name}`}</button>
      </div>}
      {step === 'password' && <form className="ob-password-form" onSubmit={submitPassword}>
        <PasswordField label="Password" value={password} onChange={setPassword} placeholder="Min 8 characters" error={policy.error} autoFocus disabled={busy}/>
        <PasswordField label="Confirm password" value={confirmation} onChange={setConfirmation} placeholder="Password" error={confirmationError} disabled={busy}/>
        {error && <div className="ob-error" role="alert">{error}</div>}
        <button className="ob-primary ob-half" disabled={!policy.valid || password !== confirmation || busy}>{busy ? 'Creating wallet...' : 'Continue'}</button>
      </form>}
      {step === 'sources' && <div className="ob-choices"><Choice testid="onboarding-select-import-method-trust-wallet" onClick={() => { setSource('trust'); go('trust-method'); }}>Trust Wallet Mobile</Choice><Choice onClick={() => { setSource('other'); go('secret'); }}>Other mobile wallet or extension</Choice><p className="ob-muted ob-hardware">Hardware wallets</p><Choice icon="usb" testid="onboarding-import-ledger" onClick={() => { setFlow('ledger'); go('ledger'); }}>Connect your Ledger</Choice></div>}
      {step === 'trust-method' && <div className="ob-choices"><Choice icon="qr" recommended onClick={() => { setFlow('qr'); go('qr-mobile'); }}>Import with QR Code from mobile</Choice><Choice onClick={() => { setFlow('import'); go('secret'); }}>Import with Secret Phrase or Private Key</Choice></div>}
      {step === 'secret' && <SecretForm name={name} onName={(v) => { setName(v); setError(''); }} nameError={nameError} product={source === 'trust' ? 'trust-wallet' : 'other'}
        secret={secret} onSecret={(v) => { setSecret(v); setError(''); }} kind={kind} check={check} network={network} onNetwork={setNetwork} error={error} busy={busy} canSubmit={canSubmit} onSubmit={submitSecret}/>}
      {step === 'solana' && <div className="ob-import-form" data-testid="solana-derivation">
        <p className="ob-muted">We found two ways your phrase can derive a Solana wallet. Choose the one that holds your funds; you can import the other later.</p>
        <div role="radiogroup" aria-label="Solana derivation" className="ob-choices">
          {solana.map((a) => <button key={a.type} type="button" role="radio" aria-checked={solanaPick === a.type} className="ob-radio-card" onClick={() => setSolanaPick(a.type)} data-testid={`solana-${a.type}`}>
            <ChainIcon id="solana"/><span className="ob-grow"><strong>{a.type === 'default' ? 'Trust Wallet' : 'Phantom'}</strong><small>{a.address.slice(0, 6)}...{a.address.slice(-6)}</small></span>
            <span>{a.balance != null ? `${a.balance} ${a.symbol}` : a.hasTransactions ? 'Has activity' : 'Balance unavailable'}</span></button>)}
        </div>
        {error && <p className="ob-error" role="alert">{error}</p>}
        <button className="ob-primary ob-half" disabled={busy} onClick={submitSolana}>{busy ? 'Importing...' : 'Import'}</button>
      </div>}
      {step === 'qr-mobile' && <div className="ob-qr-instructions"><button className="ob-link ob-qr-manual" onClick={() => { setFlow('import'); setSource('trust'); go('secret'); }}>Import with Secret Phrase or Private Key</button><p>After the scan, continue in your Trust Wallet mobile app</p><QRLink/><button className="ob-primary ob-qr-continue" onClick={() => go('qr-scan')}>I completed the scan</button></div>}
      {step === 'qr-scan' && <div className="ob-qr-instructions"><QrScanner onKeys={(keys) => { setQrKeys(keys); go('qr-code'); }}/></div>}
      {step === 'qr-code' && <div className="ob-import-form" data-testid="qr-code-step">
        <p className="ob-muted">Enter the 6-character code shown in your mobile app to decrypt your wallets.</p>
        <div className={`ob-code ${error ? 'bad' : ''}`} role="group" aria-label="Encryption code">{codeSlots.map((c, i) => <input key={i} aria-label={`Character ${i + 1}`} value={c} maxLength={1} disabled={busy} autoFocus={i === code.length || (i === 5 && code.length === 6)} autoComplete="off"
          onChange={(e) => { const v = e.target.value.replace(/[^a-z0-9]/gi, '').slice(-1).toUpperCase(); if (!v) return; const next = (code + v).slice(0, 6); setCode(next); setError(''); if (next.length === 6) void submitCode(next); }}
          onKeyDown={(e) => { if (e.key === 'Backspace') { setCode(code.slice(0, -1)); setError(''); } }}
          onPaste={(e) => { const v = e.clipboardData.getData('text').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase(); if (v) { e.preventDefault(); setCode(v); if (v.length === 6) void submitCode(v); } }}/>)}</div>
        {busy && <p className="ob-muted" role="status">Importing...</p>}
        {error && <p className="ob-error" role="alert">{error}</p>}
      </div>}
      {step === 'ledger' && (LedgerScreen
        ? <LedgerScreen addrs={{}} balances={{}} bg={bg} params={{ onboarding: true }} nav={{ push: () => {}, pop: () => go('sources'), home: complete }} refresh={() => {}}/>
        : <div className="ob-notice warn" role="status" data-testid="ledger-unavailable">Ledger import is not available in this build yet. Use a secret phrase or private key instead.</div>)}
      {step === 'boundary' && <div className="ob-error" role="status">This step is not available.</div>}
      {step === 'completed' && <>
        {qrSummary && <p className="ob-muted" role="status">{qrSummary}</p>}
        <div className="ob-explore"><div className="ob-explore-image">{slide === 0 ? <DappIllustration /> : slide === 1 ? <SidePanelIllustration /> : <ToolbarIllustration />}</div><div className="ob-explore-copy"><small>{['TOP APP RIGHT NOW','DID YOU KNOW','KEEP IT HANDY'][slide]}</small><h3>{[<>PancakeSwap</>,<>Extension<br/>- in a Side Panel</>,<>Pin us to<br/>your Toolbar</>][slide]}</h3><p>{['Trade, earn, and farm across chains','Interact without losing context','Access it instantly in one click'][slide]}</p><button className="ob-link" onClick={() => {if (slide === 0) window.open('https://pancakeswap.finance/','_blank','noopener,noreferrer'); else if (slide === 1) openSidePanel(); else setPinGuide(true);}}>{slide === 0 ? 'Go to app' : slide === 1 ? 'Open Side Panel' : pinned ? "It's pinned" : 'Guide me'} <ArrowUpRight size={16}/></button></div></div>
        <div className="ob-carousel"><button aria-label="Previous slide" onClick={() => setSlide(i => (i + 2) % 3)}><ChevronLeft size={18}/></button>{[0,1,2].map(i => <button key={i} aria-label={`Slide ${i + 1}`} aria-current={slide === i} onClick={() => setSlide(i)} className={`ob-dot ${i === slide ? 'active' : ''}`}/>)}<button aria-label="Next slide" onClick={() => setSlide(i => (i + 1) % 3)}><ChevronRight size={18}/></button></div>
        {pinGuide && <div className="ob-pin-hint" role="dialog" aria-label="Pin Harbour"><button className="ob-link" onClick={() => setPinGuide(false)}>Close</button><p>Open your browser's Extensions menu and pin Harbour Wallet.</p></div>}
        {error && <p className="ob-error" role="alert">{error}</p>}
        <button className="ob-primary ob-open" onClick={openSidePanel}>Open my wallet</button>
      </>}
    </section>
  </main>;
}
