import React, { useEffect, useState } from 'react';
import { T } from './theme';
import { bg } from './api';
import { Onboarding } from './onboarding/Onboarding';

// Harbour Wallet — light UI, Trust Wallet-style layout (dummy branding). RE §3, §6.1.
type Screen = 'loading' | 'welcome' | 'password' | 'backup' | 'unlock' | 'home';

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, boxShadow: T.shadow };
const primary = (disabled = false): React.CSSProperties => ({
  width: '100%', padding: '14px 16px', borderRadius: 999, border: 'none',
  background: disabled ? T.bgAlt : T.accent, color: disabled ? T.sub : '#fff',
  fontWeight: 700, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 12,
});
const ghost: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: 999, border: `1px solid ${T.border}`, background: '#fff', color: T.text, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 12 };
const input: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${T.border}`, background: '#fff', color: T.text, boxSizing: 'border-box', marginTop: 10, fontSize: 15 };

const Logo = ({ size = 28 }: { size?: number }) => (
  <span style={{ width: size, height: size, borderRadius: size * 0.28, background: `linear-gradient(135deg, ${T.accent}, #60A5FA)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.5 }}>H</span>
);

export function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [terms, setTerms] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [addrs, setAddrs] = useState<Record<string, string>>({});

  useEffect(() => { bg({ type: 'status' }).then((s) => {
    if (!s.hasVault) window.location.hash = '/onboarding';
    setScreen(s.hasVault ? (s.unlocked ? 'home' : 'unlock') : 'welcome');
  }).catch(() => setScreen('welcome')); }, []);

  if (window.location.hash.startsWith('#/onboarding')) return <Onboarding/>;

  const startCreate = async () => { setBusy(true); try { const { mnemonic } = await bg({ type: 'generateMnemonic' }); setMnemonic(mnemonic); setScreen('password'); } finally { setBusy(false); } };
  const submitPassword = async () => {
    setErr(''); if (pw.length < 8) return setErr('Min 8 characters'); if (pw !== pw2) return setErr('Passwords do not match');
    setBusy(true);
    try { const res = await bg({ type: 'createWallet', password: pw, mnemonic }); if (res.ok) { setAddrs(res.addresses); setScreen('backup'); } else setErr(res.error || 'Failed'); }
    finally { setBusy(false); }
  };
  const doUnlock = async () => { setErr(''); setBusy(true); try { const res = await bg({ type: 'unlock', password: pw }); if (res.ok) setScreen('home'); else setErr(res.error || 'Incorrect password'); } finally { setBusy(false); } };

  const Shell: React.FC<{ children: React.ReactNode; header?: boolean }> = ({ children, header = true }) => (
    <div style={{ background: T.bg, color: T.text, minHeight: 600, width: 375, fontFamily: 'Inter, -apple-system, system-ui, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      {header && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
        <Logo size={26} /><span style={{ fontWeight: 800, fontSize: 17 }}>Harbour</span>
      </div>}
      <div style={{ padding: 20, flex: 1 }}>{children}</div>
    </div>
  );

  if (screen === 'loading') return <Shell header={false}><div style={{ color: T.sub, textAlign: 'center', marginTop: 80 }}>Loading…</div></Shell>;

  if (screen === 'welcome') return <Shell header={false}>
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

  if (screen === 'password') return <Shell>
    <h2 style={{ fontSize: 22, marginTop: 8 }}>Create password</h2>
    <p style={{ color: T.sub, fontSize: 14, marginTop: 4 }}>This encrypts your wallet on this device.</p>
    <input style={input} type="password" placeholder="New password (min 8 characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
    <input style={input} type="password" placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
    {err && <div style={{ color: T.error, fontSize: 13, marginTop: 10 }}>{err}</div>}
    <button style={primary(!pw || !pw2 || busy)} disabled={!pw || !pw2 || busy} onClick={submitPassword}>{busy ? 'Creating…' : 'Continue'}</button>
  </Shell>;

  if (screen === 'backup') return <Shell>
    <h2 style={{ fontSize: 22, marginTop: 8 }}>Your secret phrase</h2>
    <p style={{ color: T.sub, fontSize: 14, marginTop: 4 }}>Write these 12 words down in order and keep them safe. Anyone with them controls your wallet.</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
      {mnemonic.split(' ').map((w, i) => (
        <div key={i} style={{ background: T.bgAlt, borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>
          <span style={{ color: T.sub, marginRight: 6 }}>{i + 1}</span>{w}
        </div>
      ))}
    </div>
    <div style={{ marginTop: 16, background: T.accentSoft, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Accounts created</div>
      {Object.entries(addrs).slice(0, 4).map(([k, v]) => <div key={k} style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>{k}: {v.slice(0, 8)}…{v.slice(-6)}</div>)}
    </div>
    <button style={primary()} onClick={() => setScreen('home')}>I've saved my phrase</button>
  </Shell>;

  if (screen === 'unlock') return <Shell header={false}>
    <div style={{ textAlign: 'center', paddingTop: 64 }}><Logo size={56} /><h2 style={{ fontSize: 22, margin: '20px 0 0' }}>Welcome back</h2></div>
    <div style={{ marginTop: 28 }}>
      <input style={input} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doUnlock()} />
      {err && <div style={{ color: T.error, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <button style={primary(!pw || busy)} disabled={!pw || busy} onClick={doUnlock}>Unlock</button>
    </div>
  </Shell>;

  // home (TW-style: balance header + token list placeholder)
  return <Shell>
    <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
      <div style={{ color: T.sub, fontSize: 13 }}>Total balance</div>
      <div style={{ fontSize: 34, fontWeight: 800, marginTop: 4 }}>$0.00</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
        {['Send', 'Receive', 'Buy', 'Swap'].map((a) => (
          <div key={a} style={{ textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{a[0]}</div>
            <div style={{ fontSize: 12, marginTop: 6, color: T.sub }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ ...card, padding: 0 }}>
      {['Ethereum', 'Bitcoin', 'BNB', 'Solana'].map((c, i) => (
        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderTop: i ? `1px solid ${T.border}` : 'none' }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: T.bgAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: T.sub }}>{c[0]}</div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{c}</div><div style={{ fontSize: 12, color: T.sub }}>0.00</div></div>
          <div style={{ color: T.sub, fontSize: 13 }}>$0.00</div>
        </div>
      ))}
    </div>
    <button style={{ ...ghost, marginTop: 20 }} onClick={() => bg({ type: 'lock' }).then(() => setScreen('unlock'))}>Lock wallet</button>
  </Shell>;
}
