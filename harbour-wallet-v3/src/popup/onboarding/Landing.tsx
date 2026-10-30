// First-run landing page (opened in a tab on install). Section rhythm reverse-engineered from metamask.io/en-GB
// (REA capture_browser_scenario, 2026-10-22): sticky nav → display hero + product mock → live price ticker →
// 4 coloured feature cards → dark "power" band with stat row → security cards → full-bleed CTA banner → footer.
// All copy, art and colours are Harbour's own; every claim below is backed by code in this repo.
import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ArrowLeftRight, Plus, ShieldCheck, LockKeyhole, KeyRound, ScanEye, PanelRight, Usb, Fingerprint, Fuel, BookUser, Network, Check, QrCode, CircleHelp, Sprout, TrendingUp, Blocks } from 'lucide-react';
import { Brand } from '../design/components';
import { bg } from '../api';
import { hasBundledAssetLogo } from '../wallet/ui';
import './landing.css';
import { NETWORKS, ROW_A, ROW_B, known, reduced, useReveal, CountUp, NetChip, Marquee, usePage, pageHref } from './landingKit';
import { FeaturesPage, NetworksPage, SecurityPage } from './landingPages';

type Market = { id: string; symbol: string; name: string; price: number; change24h?: number; change?: number };
const DAPPS = ['app.uniswap.org', 'app.aave.com', 'pancakeswap.finance', 'opensea.io', 'curve.fi', 'lido.fi', 'jup.ag', 'app.1inch.io', 'raydium.io', 'gmx.io', 'stargate.finance', 'compound.finance'];
const fmtUsd = (n: number) => n >= 1 ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) : `$${n.toPrecision(3)}`;
const logo = (sym: string) => { const s = sym.toUpperCase(); return s === 'POL' || s === 'MATIC' ? '/asset-logos/matic.svg' : hasBundledAssetLogo(s) ? `/asset-logos/${s.toLowerCase()}.svg` : null; };


function useMarkets() {
  const [list, setList] = useState<Market[] | null>(null);
  useEffect(() => {
    let live = true;
    bg({ type: 'getTrending', categoryId: 'trending' }).then((r) => { if (live) setList(r?.ok ? (r.list ?? []).filter((m: Market) => m.price > 0 && logo(m.symbol)).slice(0, 14) : []); }).catch(() => { if (live) setList([]); });
    return () => { live = false; };
  }, []);
  return list;
}

const Chip: React.FC<{ m: Market }> = ({ m }) => {
  const ch = m.change24h ?? m.change ?? 0;
  return <div className="lp-chip"><img src={logo(m.symbol)!} alt="" width={30} height={30}/><div><b>{m.name}</b><small>{m.symbol.toUpperCase()}</small></div><div className="lp-chip-r"><b>{fmtUsd(m.price)}</b><small className={ch >= 0 ? 'up' : 'down'}>{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</small></div></div>;
};

// Product mock in the hero: the Harbour popup, drawn in HTML so it follows the theme (light/dark).
const WalletMock: React.FC<{ markets: Market[] | null }> = ({ markets }) => {
  // Illustrative holdings. Values use live prices when the market feed answered; otherwise fixed sample values so the mock never shows gaps.
  const live = (sym: string) => markets?.find((m) => m.symbol.toLowerCase() === sym)?.price;
  const base: Array<[string, string, number, number]> = [['BTC', 'Bitcoin', 0.0842, 5420.3], ['ETH', 'Ethereum', 1.92, 4810.65], ['SOL', 'Solana', 24.5, 3486.1], ['USDC', 'USD Coin', 1250, 1250]];
  const allLive = base.every(([s]) => live(s.toLowerCase()));
  const rows = base.map(([s, n, amt, v]) => [s, n, amt, allLive ? amt * live(s.toLowerCase())! : v] as [string, string, number, number]);
  const total = rows.reduce((n, r) => n + r[3], 0);
  return <div className="lp-mock" aria-hidden="true">
    <div className="lp-mock-top"><div><b>Main wallet</b><small>Account 1</small></div><span className="lp-dot"/></div>
    <div className="lp-mock-bal">{fmtUsd(total)}</div>
    <div className="lp-mock-chg">+2.41% today</div>
    <div className="lp-mock-actions">{[[ArrowUpRight, 'Send'], [ArrowDownLeft, 'Receive'], [ArrowLeftRight, 'Swap'], [Plus, 'Fund']].map(([I, l], i) => { const G = I as typeof Plus; return <div key={i}><span className={i === 3 ? 'solid' : ''}><G size={18}/></span><small>{l as string}</small></div>; })}</div>
    <div className="lp-mock-tabs"><b>Crypto</b><span>Approvals</span></div>
    {rows.map(([s, n, amt, v]) => <div className="lp-mock-row" key={s}><img src={logo(s)!} alt="" width={32} height={32}/><div><b>{n}</b><small>{amt} {s}</small></div><b>{fmtUsd(v)}</b></div>)}
  </div>;
};

export function Landing({ terms, setTerms, busy, error, onStart }: { terms: boolean; setTerms: (v: boolean) => void; busy: boolean; error: string; onStart: (f: 'create' | 'import' | 'qr') => void }) {
  const root = useRef<HTMLDivElement>(null);
  const termsRef = useRef<HTMLLabelElement>(null);
  const [nudge, setNudge] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const markets = useMarkets();
  const page = usePage();
  useReveal(root, page);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);
  useEffect(() => { const el = root.current; if (!el) return; const f = () => setScrolled(el.scrollTop > 8 || window.scrollY > 8); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  const go = (f: 'create' | 'import' | 'qr') => {
    if (busy) return;
    if (!terms) { setNudge((n) => n + 1); termsRef.current?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); return; }
    onStart(f);
  };
  const toTop = () => { if (page !== 'home') { window.location.hash = pageHref('home'); return; } window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); };
  const Ctas = ({ light }: { light?: boolean }) => <div className={`lp-ctas${light ? ' light' : ''}`}>
    <button className="lp-btn primary" disabled={busy} onClick={() => go('create')}>{busy ? 'Creating…' : 'Create new wallet'}<ArrowRight size={18}/></button>
    <button className="lp-btn ghost" disabled={busy} onClick={() => go('import')}>I already have a wallet</button>
  </div>;

  return <div className="lp hb-design" ref={root}>
    <header className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
      <a className="lp-brandlink" href={pageHref('home')} aria-label="Harbour home"><Brand/></a>
      <nav aria-label="Sections">{(['features', 'networks', 'security'] as const).map((p) => <a key={p} href={pageHref(p)} aria-current={page === p ? 'page' : undefined}>{p[0].toUpperCase() + p.slice(1)}</a>)}</nav>
      <button className="lp-btn primary sm" onClick={toTop}>Get started</button>
    </header>

    {page !== 'home' ? <main key={page}>{page === 'features' ? <FeaturesPage cta={<Ctas light/>}/> : page === 'networks' ? <NetworksPage cta={<Ctas light/>}/> : <SecurityPage cta={<Ctas light/>}/>}</main> : <main>
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow lp-in" style={{ ['--d' as any]: '0ms' }}>SELF-CUSTODY WALLET FOR YOUR BROWSER</p>
          <h1 data-testid="onboarding-step-title"><span className="lp-in" style={{ ['--d' as any]: '60ms' }}>Your crypto.</span><span className="lp-in" style={{ ['--d' as any]: '140ms' }}>Safely</span><span className="lp-in accent" style={{ ['--d' as any]: '220ms' }}>anchored.</span></h1>
          <p className="lp-lede lp-in" style={{ ['--d' as any]: '300ms' }}>Hold, swap and explore across {NETWORKS.length} networks from one secret phrase. Your keys are created and kept on this device.</p>
          <div className="lp-in" style={{ ['--d' as any]: '380ms' }}><Ctas/></div>
          <label ref={termsRef} key={nudge} className={`lp-terms lp-in${nudge ? ' nudge' : ''}`} style={{ ['--d' as any]: '440ms' }}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}/>
            <span>I have read and agree to the <a href="/legal.html#terms" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="/legal.html#privacy" target="_blank" rel="noreferrer">Privacy Policy</a></span>
          </label>
          {nudge > 0 && !terms && <p className="lp-hint" role="alert">Please accept the Terms of Use to continue.</p>}
          {error && <p className="lp-hint" role="alert">{error}</p>}
          <button className="lp-sync lp-in" style={{ ['--d' as any]: '500ms' }} onClick={() => go('qr')}><QrCode size={18}/>Have the Trust Wallet mobile app? <u>Scan QR to sync</u></button>
        </div>
        <div className="lp-hero-art">
          <div className="lp-slab"/>
          <div className="lp-mock-wrap"><WalletMock markets={markets}/></div>
          <div className="lp-float f1"><span className="lp-float-ic"><ArrowLeftRight size={16}/></span><div><b>Swap ETH → USDC</b><small>Best route found</small></div></div>
          <div className="lp-float f2"><span className="lp-float-ic ok"><ShieldCheck size={16}/></span><div><b>Encrypted on this device</b><small>AES-GCM 256-bit vault</small></div></div>
        </div>
      </section>

      <section className="lp-ticker" aria-label="Market prices">
        {markets === null ? <div className="lp-marquee"><div className="lp-track static">{Array.from({ length: 6 }, (_, i) => <div className="lp-chip skel" key={i}/>)}</div></div>
          : markets.length ? <Marquee>{markets.map((m) => <Chip key={m.id} m={m}/>)}</Marquee>
          : <Marquee slow>{known(ROW_A).map((id) => <NetChip key={id} id={id}/>)}</Marquee>}
      </section>

      <section className="lp-section" id="lp-features">
        <div className="lp-head" data-reveal><h2>One wallet.<br/>Every way to move.</h2><p>Send, receive, swap and explore from a single self-custody wallet, in a popup or docked in your browser's side panel.</p><a className="lp-more" href={pageHref('features')}>Explore all features<ArrowRight size={16}/></a></div>
        <div className="lp-cards">
          <article className="lp-card mint" data-reveal style={{ ['--d' as any]: '0ms' }}>
            <div className="lp-art swap"><img className="c1" src="/asset-logos/eth.svg" alt=""/><span className="lp-swapdot"><ArrowLeftRight size={20}/></span><img className="c2" src="/asset-logos/usdc.svg" alt=""/></div>
            <h3>Swap</h3><p>Trade between tokens and networks, with the route and fees shown before you confirm.</p><span className="lp-tag"><ArrowLeftRight size={14}/> Built in</span>
          </article>
          <article className="lp-card sand" data-reveal style={{ ['--d' as any]: '80ms' }}>
            <div className="lp-art earn">{[38, 54, 46, 70, 86].map((h, i) => <span key={i} style={{ height: `${h}%`, ['--i' as any]: i }}/>)}<img src="/asset-logos/sol.svg" alt=""/></div>
            <h3>Earn</h3><p>Stake supported assets right from your wallet and keep track of what they earn.</p><span className="lp-tag"><Sprout size={14}/> Staking</span>
          </article>
          <article className="lp-card sea" data-reveal style={{ ['--d' as any]: '160ms' }}>
            <div className="lp-art market"><svg viewBox="0 0 200 90" preserveAspectRatio="none"><path className="lp-spark" d="M0 70 L20 62 L40 66 L60 48 L80 54 L100 36 L120 42 L140 24 L160 30 L180 14 L200 18"/></svg><div className="lp-pill-row"><span>1H</span><span className="on">24H</span><span>7D</span><span>1M</span></div></div>
            <h3>Trending</h3><p>Live prices, charts and trending tokens across networks, ready when you are.</p><span className="lp-tag"><TrendingUp size={14}/> Live market data</span>
          </article>
          <article className="lp-card deep" data-reveal style={{ ['--d' as any]: '240ms' }}>
            <div className="lp-art dapps">{DAPPS.map((d, i) => <img key={d} src={`/dapps/${d}.webp`} alt="" style={{ ['--i' as any]: i }}/>)}</div>
            <h3>dApps</h3><p>Connect to decentralised apps through the browser or WalletConnect, and review every request first.</p><span className="lp-tag"><Blocks size={14}/> WalletConnect</span>
          </article>
        </div>
      </section>

      <section className="lp-networks" id="lp-networks">
        <div className="lp-head center" data-reveal><h2><CountUp to={NETWORKS.length}/> networks.<br/>One secret phrase.</h2><p>Bitcoin, Ethereum, Solana and the rest, all derived from the same recovery phrase. Add your own EVM networks any time.</p><a className="lp-more" href={pageHref('networks')}>Browse all networks<ArrowRight size={16}/></a></div>
        <Marquee>{known(ROW_A).map((id) => <NetChip key={id} id={id}/>)}</Marquee>
        <Marquee reverse>{known(ROW_B).map((id) => <NetChip key={id} id={id}/>)}</Marquee>
      </section>

      <section className="lp-dark">
        <div className="lp-dark-inner">
          <div className="lp-head light" data-reveal><h2>Power tools,<br/>built in.</h2><p>The extras you'd normally install separately come with Harbour from day one.</p></div>
          <ul className="lp-tools" data-reveal>
            {([[PanelRight, 'Side panel', 'Keep your wallet docked while you browse'], [Usb, 'Ledger', 'Sign with your hardware wallet'], [Fingerprint, 'Biometric unlock', 'Unlock with your device passkey'], [Fuel, 'Gas station', 'Live network fees before you send'], [BookUser, 'Address book', 'Save the addresses you use most'], [Network, 'Custom networks', 'Add any EVM network by RPC']] as const).map(([I, t, d], i) => <li key={t} style={{ ['--d' as any]: `${i * 60}ms` }}><span><I size={20}/></span><div><b>{t}</b><small>{d}</small></div></li>)}
          </ul>
          <div className="lp-stats" data-reveal>
            <div><b><CountUp to={NETWORKS.length}/></b><small>networks supported</small></div>
            <div><b><CountUp to={256}/>-bit</b><small>AES-GCM vault encryption</small></div>
            <div><b><CountUp to={1}/></b><small>secret phrase for every network</small></div>
            <div><b><CountUp to={0}/></b><small>private keys sent to any server</small></div>
          </div>
        </div>
      </section>

      <section className="lp-section" id="lp-security">
        <div className="lp-head" data-reveal><h2>Security that<br/>stays with you.</h2><p>Harbour is self-custody: nobody else, including us, can move your funds or recover your phrase.</p><a className="lp-more" href={pageHref('security')}>See how Harbour protects you<ArrowRight size={16}/></a></div>
        <div className="lp-sec">
          {([[KeyRound, 'Complete self-custody', 'Your secret phrase is generated on this device and never leaves it.'], [LockKeyhole, 'Encrypted vault', 'Keys are sealed with your password (Argon2id → AES-GCM) and the wallet locks itself when idle.'], [ScanEye, 'Approval control', 'See which apps can spend your tokens, and revoke access in a tap.']] as const).map(([I, t, d], i) =>
            <article key={t} className="lp-sec-card" data-reveal style={{ ['--d' as any]: `${i * 90}ms` }}><span className="lp-sec-ic"><I size={22}/></span><h3>{t}</h3><p>{d}</p></article>)}
        </div>
        <div className="lp-checks" data-reveal>{['Open-source wallet-core cryptography', 'Hardware wallet support', 'Auto-lock timer', 'Back up any time from Settings'].map((t) => <span key={t}><Check size={16}/>{t}</span>)}</div>
      </section>

      <section className="lp-cta" data-reveal>
        <div className="lp-cta-box">
          <div><h2>Make yourself<br/>at home.</h2><p>Create a new wallet in under a minute, or bring the one you already have.</p><Ctas light/></div>
          <img src="/illustrations/harbour.svg" alt="" className="lp-cta-art"/>
        </div>
      </section>
    </main>}

    <footer className="lp-foot">
      <div className="lp-foot-top"><a className="lp-brandlink" href={pageHref('home')} aria-label="Harbour home"><Brand/></a><nav aria-label="Footer"><a href={pageHref('features')}>Features</a><a href={pageHref('networks')}>Networks</a><a href={pageHref('security')}>Security</a><a href="/legal.html#terms" target="_blank" rel="noreferrer">Terms of Use</a><a href="/legal.html#privacy" target="_blank" rel="noreferrer">Privacy Policy</a><a href="/legal.html#help" target="_blank" rel="noreferrer"><CircleHelp size={14}/> Help</a></nav></div>
      <p>© {new Date().getFullYear()} Harbour Wallet. Self-custody means you are responsible for your secret phrase — keep it safe and never share it.</p>
    </footer>
  </div>;
}
