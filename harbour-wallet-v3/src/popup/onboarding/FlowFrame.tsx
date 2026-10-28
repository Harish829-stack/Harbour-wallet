// Shared full-page frame for every tab-sized Harbour page (onboarding steps, add wallet, backup, sync with mobile, biometrics).
// Left: teal "deck" with brand, live stepper, animated art and a reassurance line. Right: the step content, re-entering with a
// slide-up each time `stageKey` changes. Visual language matches the install landing page (Landing.tsx / landing.css).
import { useMemo, type ReactNode } from 'react';
import { ArrowLeft, Check, CircleHelp, ShieldCheck, LockKeyhole, KeyRound, Wallet, QrCode, Smartphone, Sparkles, Fingerprint } from 'lucide-react';
import { Brand } from '../design/components';
import './flow.css';

export type ArtName = 'security' | 'import' | 'qr-mobile' | 'wallet-created' | 'empty-wallet' | 'backup' | 'biometrics' | string;

const COINS = ['btc', 'eth', 'sol', 'usdc', 'bnb', 'matic'];
/** Animated illustration for the side panel. Pure HTML/CSS + local logos so it follows the theme and needs no network. */
export function StepArt({ name }: { name: ArtName }) {
  const kind = name === 'wallet-created' || name === 'empty-wallet' ? 'done' : name === 'import' ? 'import' : name.startsWith('qr') ? 'qr' : name === 'backup' ? 'backup' : name === 'biometrics' ? 'bio' : 'security';
  const Glyph = { done: Sparkles, import: Wallet, qr: Smartphone, backup: KeyRound, bio: Fingerprint, security: ShieldCheck }[kind];
  return <div className={`fx-art fx-art-${kind}`} aria-hidden="true">
    <span className="fx-ring r1"/><span className="fx-ring r2"/><span className="fx-ring r3"/>
    <div className="fx-orbit">{COINS.map((c, i) => <img key={c} src={`/asset-logos/${c}.svg`} alt="" style={{ ['--i' as any]: i }}/>)}</div>
    <div className="fx-core">
      {kind === 'qr' ? <span className="fx-phone"><QrCode size={46} strokeWidth={1.4}/><i className="fx-beam"/></span>
        : kind === 'backup' ? <span className="fx-words">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ ['--i' as any]: i }}/>)}</span>
        : <Glyph size={58} strokeWidth={1.3}/>}
    </div>
    {kind === 'security' && <span className="fx-badge"><LockKeyhole size={14}/> Encrypted</span>}
    {kind === 'import' && <span className="fx-badge"><Check size={14}/> Keys stay here</span>}
    {kind === 'done' && <span className="fx-badge"><Check size={14}/> Ready</span>}
  </div>;
}

/** Vertical progress: completed steps get a check, the current one pulses. */
export function Stepper({ labels, active, done }: { labels: string[]; active: number; done?: boolean }) {
  if (!labels.length) return null;
  return <ol className="fx-steps" aria-label="Progress">
    {labels.map((l, i) => { const n = i + 1; const state = done || n < active ? 'done' : n === active ? 'now' : 'next';
      return <li key={l} className={state} aria-current={state === 'now' ? 'step' : undefined}><span className="fx-dot">{state === 'done' ? <Check size={13} strokeWidth={3}/> : n}</span><span>{l}</span></li>; })}
  </ol>;
}

export function FlowFrame({ heading, title, labels = [], active = 0, done, art = 'security', sidebar, note, onBack, busy, stageKey, wide, children }: {
  heading: ReactNode; title?: ReactNode; labels?: string[]; active?: number; done?: boolean; art?: ArtName; sidebar?: ReactNode; note?: ReactNode;
  onBack?: () => void; busy?: boolean; stageKey?: string; wide?: boolean; children: ReactNode;
}) {
  const progress = useMemo(() => labels.length ? (done ? 1 : Math.max(0, active - 1) / labels.length) : 0, [labels.length, active, done]);
  return <main className="ob hb-design fx">
    <aside className="fx-side">
      <div className="fx-side-inner">
        <Brand/>
        <Stepper labels={labels} active={active} done={done}/>
        <h1 data-testid="onboarding-step-title" key={String(stageKey) + 'h'} className="fx-in">{heading}</h1>
        {sidebar ? <div className="fx-side-extra fx-in" key={String(stageKey) + 's'}>{sidebar}</div> : <StepArt name={art}/>}
        <div className="fx-side-foot">
          <p className="fx-note"><ShieldCheck size={16}/>{note ?? 'Your keys are created and stored on this device only.'}</p>
          <a className="fx-help" href="/legal.html#help" target="_blank" rel="noreferrer"><CircleHelp size={16}/> Help</a>
        </div>
      </div>
    </aside>
    <section className={`fx-main${wide ? ' wide' : ''}`}>
      {labels.length > 0 && <div className="fx-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }}/></div>}
      <div className="fx-body">
        <div className="fx-topline">{onBack && <button className="fx-back" onClick={onBack} disabled={busy}><ArrowLeft size={16}/> Back</button>}</div>
        <div className="fx-stage" key={stageKey}>
          {title && <h2 className="fx-title">{title}</h2>}
          {children}
        </div>
      </div>
    </section>
  </main>;
}

/** One-shot confetti burst (CSS only). */
export function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ x: (Math.random() * 2 - 1) * 46, r: Math.random() * 540 - 270, d: Math.random() * 300, c: i % 4, s: 6 + Math.random() * 6 })), []);
  return <div className="fx-confetti" aria-hidden="true">{bits.map((b, i) => <i key={i} className={`c${b.c}`} style={{ ['--x' as any]: `${b.x}vw`, ['--r' as any]: `${b.r}deg`, ['--d' as any]: `${b.d}ms`, width: b.s, height: b.s * 1.6 }}/>)}</div>;
}

/** Password strength (guidance only; validation stays in core/passwordPolicy). */
export function PasswordMeter({ value }: { value: string }) {
  const checks = [
    { ok: value.length >= 8, label: '8+ characters' },
    { ok: /[a-z]/.test(value) && /[A-Z]/.test(value), label: 'Upper & lower case' },
    { ok: /\d/.test(value), label: 'A number' },
    { ok: /[^A-Za-z0-9]/.test(value), label: 'A symbol' },
  ];
  const score = value ? checks.filter((c) => c.ok).length + (value.length >= 14 ? 1 : 0) : 0;
  const level = score <= 1 ? 'weak' : score <= 3 ? 'fair' : 'strong';
  return <div className={`fx-meter ${value ? level : ''}`} aria-live="polite">
    <div className="fx-bars">{[0, 1, 2, 3].map((i) => <span key={i} className={i < Math.min(4, Math.ceil(score * 0.8)) ? 'on' : ''}/>)}</div>
    <div className="fx-meter-row"><span className="fx-level">{value ? { weak: 'Weak', fair: 'Fair', strong: 'Strong' }[level] : 'Password strength'}</span>
      <ul>{checks.map((c) => <li key={c.label} className={c.ok ? 'ok' : ''}><Check size={12} strokeWidth={3}/>{c.label}</li>)}</ul></div>
  </div>;
}

/** Real Harbour screenshot with light/dark variants; the visible one follows the app theme (data-theme). */
export function ThemedImg({ name, alt }: { name: string; alt: string }) {
  return <span className="fx-img"><img className="th-light" src={`/illustrations/onboarding/${name}-light.webp`} alt={alt} loading="lazy" decoding="async"/><img className="th-dark" src={`/illustrations/onboarding/${name}-dark.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async"/></span>;
}
