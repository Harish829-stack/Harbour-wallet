import { useEffect, useRef, useState } from 'react';
import browser from 'webextension-polyfill';
import QRCode from 'qrcode';
import { bg } from '../api';
import { validatePassword } from '../../core/passwordPolicy';
import { Animation } from './Animation';
import './onboarding.css';

type Flow = 'create' | 'import' | 'qr';
type Step = 'welcome' | 'authentication' | 'password' | 'sources' | 'trust-method' | 'secret' | 'qr-mobile' | 'boundary' | 'completed';
type Source = 'trust' | 'other';
const Brand = () => <div className="ob-brand" aria-label="Harbour Wallet"><span className="ob-brand-mark">H</span><b>HARBOUR</b><span>WALLET</span></div>;
function Icon({ type }: { type: 'arrow' | 'eye' | 'lock' | 'wallet' | 'qr' | 'phone' }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    {type === 'arrow' ? <path d="m9 5 7 7-7 7" /> : type === 'eye' ? <><path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></> : type === 'lock' ? <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></> : type === 'wallet' ? <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z"/></> : type === 'phone' ? <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></> : <><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v6h-6v-2"/></>}
  </svg>;
}
function PasswordField({ label, value, onChange, error, placeholder, autoFocus = false, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder: string; autoFocus?: boolean; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <label className={`ob-field ${error ? 'has-error' : ''}`}><span>{label}</span><div className="ob-input-wrap">
    <input data-testid="password-field" type={visible ? 'text' : 'password'} value={value} placeholder={placeholder} autoFocus={autoFocus}
      disabled={disabled} onChange={e => onChange(e.target.value)} autoComplete="new-password" spellCheck={false} />
    <button type="button" className="ob-reveal" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setVisible(!visible)} disabled={disabled}><Icon type="eye"/></button>
  </div>{error && <small role="alert">{error}</small>}</label>;
}
function Choice({ children, icon = 'wallet', recommended, onClick, testid }: { children: React.ReactNode; icon?: 'lock' | 'wallet' | 'qr'; recommended?: boolean; onClick: () => void; testid?: string }) {
  return <button type="button" className="ob-choice" onClick={onClick} data-testid={testid}><span className="ob-choice-label"><Icon type={icon}/><span>{children}</span>{recommended && <small>Recommended</small>}</span><Icon type="arrow"/></button>;
}
function QRLink() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) void QRCode.toCanvas(canvas.current, 'https://link.trustwallet.com/extension_sync', { width: 240, margin: 2 }); }, []);
  return <canvas ref={canvas} aria-label="Trust Wallet mobile extension sync link" className="ob-qr"/>;
}

export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [flow, setFlow] = useState<Flow>('create');
  const [terms, setTerms] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const importPassword = useRef('');
  const [source, setSource] = useState<Source>('other');
  const [name, setName] = useState('Main wallet');
  const [secret, setSecret] = useState('');
  const [secretVisible, setSecretVisible] = useState(false);
  const [secretValid, setSecretValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [boundary, setBoundary] = useState('');
  const [slide, setSlide] = useState(0);
  const [pinGuide, setPinGuide] = useState(false);
  const [pinned, setPinned] = useState(false);
  const policy = validatePassword(password);
  const confirmationError = confirmation && password !== confirmation ? 'Passwords do not match' : undefined;

  // Target Page guard: 600000ms idle, paused at Completed. Kept separate from vault auto-lock.
  useEffect(() => {
    if (step === 'completed') return;
    let timer: ReturnType<typeof setTimeout>; let last = 0;
    const activity = () => { const now = Date.now(); if (now - last < 500) return; last = now; clearTimeout(timer); timer = setTimeout(() => window.close(), 600000); };
    const events = ['mousemove','mousedown','keydown','touchstart','wheel'];
    activity(); events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    return () => { clearTimeout(timer); events.forEach(event => window.removeEventListener(event, activity)); };
  }, [step === 'completed']);
  useEffect(() => () => { importPassword.current = ''; }, []);
  useEffect(() => {
    if (step !== 'completed') return;
    const timer = setInterval(() => setSlide(i => (i + 1) % 3), 7000);
    void chrome.action.getUserSettings?.().then(s => setPinned(s.isOnToolbar ?? false));
    return () => clearInterval(timer);
  }, [step]);
  useEffect(() => {
    setSecretValid(false);
    if (!secret.trim()) return;
    let current = true;
    void bg({ type: 'validateMnemonic', mnemonic: secret.trim().toLowerCase() }).then(result => { if (current) setSecretValid(result.valid === true); }).catch(() => {});
    return () => { current = false; };
  }, [secret]);

  const go = (next: Step) => { setError(''); setStep(next); };
  const start = (nextFlow: Flow) => { setFlow(nextFlow); setPassword(''); setConfirmation(''); go('authentication'); };
  const showBoundary = (text: string) => { setBoundary(text); go('boundary'); };
  const complete = () => { setPassword(''); setConfirmation(''); importPassword.current = ''; setSecret(''); setStep('completed'); };
  async function submitPassword(event: React.FormEvent) {
    event.preventDefault(); if (busy || !policy.valid || password !== confirmation) return;
    if (flow !== 'create') {
      importPassword.current = password; setPassword(''); setConfirmation(''); go(flow === 'qr' ? 'qr-mobile' : 'sources'); return;
    }
    setBusy(true); setError('');
    try {
      const result = await bg({ type: 'createWallet', password, name: 'Main wallet', newlyGenerated: true });
      if (!result.ok) throw new Error(result.error || 'Unable to create wallet');
      complete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create wallet'); }
    finally { setBusy(false); }
  }
  async function importMnemonic(event: React.FormEvent) {
    event.preventDefault(); if (busy || !secretValid) return;
    setBusy(true); setError('');
    try {
      const result = await bg({ type: 'createWallet', password: importPassword.current, name, mnemonic: secret.trim().replace(/\s+/g,' ').toLowerCase(), newlyGenerated: false });
      if (!result.ok) throw new Error(result.error || 'Unable to import wallet');
      complete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to import wallet'); }
    finally { setBusy(false); }
  }
  function openSidePanel() {
    chrome.windows.getCurrent({ populate: true }, win => {
      if (win.id === undefined) return;
      void chrome.sidePanel.open({ windowId: win.id }).catch(() => setError('Unable to open the side panel. Open Harbour from the extension toolbar.'));
    });
  }
  const back = () => {
    if (busy) return;
    if (step === 'password') { setPassword(''); setConfirmation(''); go('authentication'); }
    else if (step === 'secret') { setSecret(''); go(source === 'trust' ? 'trust-method' : 'sources'); }
    else if (step === 'trust-method' || step === 'boundary') go('sources');
    else { importPassword.current = ''; setTerms(false); go('welcome'); }
  };

  if (step === 'welcome') return <main className="ob ob-welcome">
    <div className="ob-globe"><Animation name="globe" className="ob-globe-animation"/></div>
    <div className="ob-welcome-right"><div className="ob-welcome-content"><Brand/>
      <h1 data-testid="onboarding-step-title">Join 200M users in<br/>securing their financial future</h1>
      <label className="ob-terms"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)}/><span>I have read and agree to the <a href="https://trustwallet.com/terms-of-service" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="https://trustwallet.com/privacy-notice" target="_blank" rel="noreferrer">Privacy Policy</a></span></label>
      <div className="ob-welcome-actions"><button className="ob-primary" disabled={!terms} onClick={() => start('import')}>I already have a wallet</button><button className="ob-secondary" disabled={!terms} onClick={() => start('create')}>Create new wallet</button></div>
      <div className="ob-mobile"><span/><p>Have the Trust Wallet mobile app? <Icon type="phone"/></p><span/></div>
      <button className="ob-link ob-sync" onClick={() => start('qr')}><Icon type="qr"/>Scan QR to sync</button>
    </div></div>
  </main>;

  const heading = step === 'completed' ? <>Brilliant,<br/>your wallet is ready!</> : step === 'authentication' || step === 'password' ? 'Secure your wallet' : step === 'qr-mobile' ? 'Connect to mobile' : 'Import a wallet';
  const title = step === 'authentication' ? 'Select an option' : step === 'password' ? 'Create password' : step === 'sources' ? 'Select your existing wallet' : step === 'trust-method' ? 'Select a method' : step === 'secret' ? 'Import with Secret Phrase or Private Key' : step === 'qr-mobile' ? 'Scan this QR code with your mobile phone camera' : step === 'completed' ? 'Start exploring' : 'Integration requires further verification';
  const total = flow === 'create' ? 2 : flow === 'qr' ? 4 : 3;
  const active = step === 'authentication' ? flow === 'create' ? 0 : 1 : step === 'password' ? 1 : step === 'sources' || step === 'trust-method' || step === 'qr-mobile' ? 2 : step === 'secret' ? 3 : 0;
  const animation = step === 'completed' ? flow === 'create' ? 'empty-wallet' : 'wallet-created' : step === 'sources' || step === 'trust-method' || step === 'secret' ? 'import' : step === 'qr-mobile' ? 'qr-mobile' : 'security';
  return <main className="ob ob-layout">
    <aside className="ob-sidebar"><div className="ob-sidebar-inner"><Brand/><div className="ob-step">{active > 0 && `Step ${active} of ${total}`}</div><h1 data-testid="onboarding-step-title">{heading}</h1>
      <div className={`ob-illustration ${animation === 'security' ? 'ob-security' : ''}`}><Animation name={animation}/></div>
      <a className="ob-help" href="https://support.trustwallet.com/en/support/home" target="_blank" rel="noreferrer">ⓘ Help</a>
    </div></aside>
    <section className="ob-main"><div className="ob-topline">{step !== 'completed' && <button className="ob-back" onClick={back} disabled={busy}><span>‹</span> Back</button>}</div><h2>{title}</h2>
      {step === 'authentication' && <Choice icon="lock" onClick={() => go('password')}>Password</Choice>}
      {step === 'password' && <form className="ob-password-form" onSubmit={submitPassword}>
        <PasswordField label="Password" value={password} onChange={setPassword} placeholder="Min 8 characters" error={policy.error} autoFocus disabled={busy}/>
        <PasswordField label="Confirm password" value={confirmation} onChange={setConfirmation} placeholder="Password" error={confirmationError} disabled={busy}/>
        {error && <div className="ob-error" role="alert">{error}</div>}
        <button className="ob-primary ob-half" disabled={!policy.valid || password !== confirmation || busy}>{busy ? 'Creating wallet...' : 'Continue'}</button>
      </form>}
      {step === 'sources' && <div className="ob-choices"><Choice testid="onboarding-select-import-method-trust-wallet" onClick={() => { setSource('trust'); go('trust-method'); }}>Trust Wallet Mobile</Choice><Choice onClick={() => { setSource('other'); go('secret'); }}>Other mobile wallet or extension</Choice><p className="ob-muted ob-hardware">Hardware wallets</p><Choice onClick={() => showBoundary('The Ledger connection and signing path has not yet passed the evidence gate. No device connection or wallet import has been simulated.')}>Ledger</Choice></div>}
      {step === 'trust-method' && <div className="ob-choices"><Choice icon="qr" recommended onClick={() => { setFlow('qr'); go('qr-mobile'); }}>Import with QR Code from mobile</Choice><Choice onClick={() => go('secret')}>Import with Secret Phrase or Private Key</Choice></div>}
      {step === 'secret' && <form className="ob-import-form" onSubmit={importMnemonic}>
        <label className="ob-field"><span>Wallet Name</span><input data-testid="wallet-name-input" value={name} onChange={e => setName(e.target.value)} disabled={busy}/><small className="ob-muted">You can edit this later</small></label>
        <label className="ob-field"><span>Enter Secret Phrase or Private Key</span><textarea autoFocus value={secret} onChange={e => {setSecret(e.target.value); setError('');}} disabled={busy} spellCheck={false} autoComplete="off" className={secretVisible ? '' : 'ob-secret-masked'}/><button className="ob-link ob-secret-toggle" type="button" onClick={() => setSecretVisible(!secretVisible)}>{secretVisible ? 'Hide' : 'Show'}</button><small className="ob-muted">Secret Recovery Phrase is typically 12 (sometimes 18, 24) words separated by single spaces<br/>Private Key is a long alphanumeric code</small></label>
        {secret.trim() && !secretValid && <p className="ob-error" role="alert">{secret.trim().split(/\s+/).length === 1 && secret.length > 8 ? 'Private-key import is awaiting its per-network implementation evidence.' : 'Invalid Secret Phrase'}</p>}
        {error && <p className="ob-error" role="alert">{error}</p>}
        <button className="ob-primary ob-half" data-testid="import-wallet-submit" disabled={!secretValid || busy}>{busy ? 'Importing wallet...' : 'Import'}</button>
      </form>}
      {step === 'qr-mobile' && <div className="ob-qr-instructions"><button className="ob-link ob-qr-manual" onClick={() => {setFlow('import');setSource('trust');go('secret');}}>Import with Secret Phrase or Private Key</button><p>After the scan, continue in your Trust Wallet mobile app</p><QRLink/><button className="ob-primary ob-qr-continue" onClick={() => showBoundary('The next target step scans the mobile payload with the desktop camera. Payload parsing and decryption remain unverified, so this build does not accept or imitate a sync payload.')}>I completed the scan</button></div>}
      {step === 'boundary' && <div className="ob-error" role="status">{boundary}</div>}
      {step === 'completed' && <>
        <div className="ob-explore"><div className="ob-explore-image">{slide === 0 ? <img src="/reference/pancakeswap-banner-DZpaafr7.png" alt="PancakeSwap"/> : <div className="ob-browser-illustration"><div className={slide === 1 ? 'ob-sidepanel-illustration' : 'ob-toolbar-illustration'}>Harbour</div></div>}</div><div className="ob-explore-copy"><small>{['TOP APP RIGHT NOW','DID YOU KNOW','KEEP IT HANDY'][slide]}</small><h3>{[<>PancakeSwap</>,<>Extension<br/>- in a Side Panel</>,<>Pin us to<br/>your Toolbar</>][slide]}</h3><p>{['Trade, earn, and farm across chains','Interact without losing context','Access it instantly in one click'][slide]}</p><button className="ob-link" onClick={() => {if (slide === 0) window.open('https://pancakeswap.finance/','_blank','noopener,noreferrer'); else if (slide === 1) openSidePanel(); else setPinGuide(true);}}>{slide === 0 ? 'Go to app' : slide === 1 ? 'Open Side Panel' : pinned ? "It's pinned 🎉" : 'Guide me'} →</button></div></div>
        <div className="ob-carousel"><button aria-label="Previous slide" onClick={() => setSlide(i => (i + 2) % 3)}>‹</button>{[0,1,2].map(i => <button key={i} aria-label={`Slide ${i + 1}`} aria-current={slide === i} onClick={() => setSlide(i)} className={`ob-dot ${i === slide ? 'active' : ''}`}/>)}<button aria-label="Next slide" onClick={() => setSlide(i => (i + 1) % 3)}>›</button></div>
        {pinGuide && <div className="ob-pin-hint" role="dialog" aria-label="Pin Harbour"><button className="ob-link" onClick={() => setPinGuide(false)}>Close</button><p>Open your browser's Extensions menu and pin Harbour Wallet.</p></div>}
        {error && <p className="ob-error" role="alert">{error}</p>}
        <button className="ob-primary ob-open" onClick={openSidePanel}>Open my wallet</button>
      </>}
    </section>
  </main>;
}
