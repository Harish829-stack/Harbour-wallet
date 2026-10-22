// Landing sub-pages: Features, Networks, Security. Structure follows the home page (and metamask.io/en-GB/security for Security):
// display hero → alternating feature sections → grid of details → CTA banner. Copy is Harbour's own and every claim maps to code:
//   swap/earn/ramps/nfts/discover/walletconnect/approvals/gas → popup/wallet/features/*, phishing → core/provider/phishing.ts,
//   transaction preview → core/provider/simulate.ts, vault → core/passworder.ts, auto-lock → core/settings.ts, chains → core/chains.
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ArrowRight, Blocks, BookUser, Check, CreditCard, Eye, EyeOff, Fingerprint, Fuel, Images, KeyRound, Languages, LockKeyhole, Network, PanelRight, Radar, ScanEye, Search, ShieldAlert, ShieldCheck, Sprout, Timer, TrendingUp, Usb, WalletCards, FileSearch, Layers, Server, Plus } from 'lucide-react';
import { TESTNET_CHAINS, DEFAULT_HOME_CHAINS, chainLogo, type ChainInfo } from '../../core/chains/index';
import { AUTO_LOCK_OPTIONS, DEFAULT_LOCK_MINUTES, SUPPORTED_LOCALES } from '../../core/settings';
import { NETWORKS, ROW_A, ROW_B, known, CountUp, NetChip, Marquee, pageHref } from './landingKit';
import './landingPages.css';

const DAPP_SAMPLE = ['app.uniswap.org', 'app.aave.com', 'opensea.io', 'lido.fi', 'jup.ag', 'curve.fi'];

const PageHero: React.FC<{ eyebrow: string; title: ReactNode; lede: string; children?: ReactNode }> = ({ eyebrow, title, lede, children }) => (
  <section className="lp-phero">
    <div className="lp-phero-copy">
      <p className="lp-eyebrow lp-in" style={{ ['--d' as any]: '0ms' }}>{eyebrow}</p>
      <h1 className="lp-in" style={{ ['--d' as any]: '80ms' }}>{title}</h1>
      <p className="lp-lede lp-in" style={{ ['--d' as any]: '180ms' }}>{lede}</p>
    </div>
    {children && <div className="lp-phero-art lp-in" style={{ ['--d' as any]: '260ms' }}>{children}</div>}
  </section>
);

const CtaBanner: React.FC<{ title: ReactNode; text: string; cta: ReactNode }> = ({ title, text, cta }) => (
  <section className="lp-cta" data-reveal>
    <div className="lp-cta-box"><div><h2>{title}</h2><p>{text}</p>{cta}</div><img src="/illustrations/harbour.svg" alt="" className="lp-cta-art"/></div>
  </section>
);

const Other: React.FC<{ to: 'features' | 'networks' | 'security'; label: string }> = ({ to, label }) => <a className="lp-more" href={pageHref(to)}>{label}<ArrowRight size={16}/></a>;

/* ───────────────────────── Features ───────────────────────── */

const FRow: React.FC<{ tone: 'mint' | 'sand' | 'sea' | 'deep'; flip?: boolean; icon: ReactNode; tag: string; title: string; text: string; points: string[]; art: ReactNode }> = ({ tone, flip, icon, tag, title, text, points, art }) => (
  <article className={`lp-frow${flip ? ' flip' : ''}`}>
    <div className="lp-frow-copy" data-reveal>
      <span className="lp-kicker">{icon}{tag}</span>
      <h2>{title}</h2><p>{text}</p>
      <ul>{points.map((t) => <li key={t}><Check size={16}/>{t}</li>)}</ul>
    </div>
    <div className={`lp-frow-art ${tone}`} data-reveal style={{ ['--d' as any]: '120ms' }}>{art}</div>
  </article>
);

const Pane: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => <div className={`lp-pane ${className}`} aria-hidden="true">{children}</div>;

const TOOLS: Array<[typeof Usb, string, string]> = [
  [PanelRight, 'Side panel', 'Dock your wallet next to the page you are on.'],
  [Usb, 'Ledger', 'Sign with your hardware wallet from the browser.'],
  [Fingerprint, 'Biometric unlock', 'Unlock with your device passkey instead of typing.'],
  [Fuel, 'Gas station', 'Live fee tiers read from the network before you send.'],
  [BookUser, 'Address book', 'Save the addresses you use most, per network.'],
  [Network, 'Custom networks', 'Add any EVM network with its RPC URL.'],
  [ScanEye, 'Token approvals', 'See who can spend your tokens and revoke in a tap.'],
  [WalletCards, 'Multiple wallets', 'Keep separate wallets for saving, trading and testing.'],
  [Languages, 'Your language', `Available in ${SUPPORTED_LOCALES.length} languages.`],
];

export function FeaturesPage({ cta }: { cta: ReactNode }) {
  return <>
    <PageHero eyebrow="FEATURES" title={<>Everything you need.<br/><span className="accent">Nothing you don't.</span></>} lede="Send, swap, earn, collect and connect from one self-custody wallet. Every tool below is built in, with no extra installs and no account to create.">
      <div className="lp-hero-stack">
        {[[ArrowLeftRight, 'Swap', 'Route and fees shown first'], [Sprout, 'Earn', 'Stake and track rewards'], [Images, 'Collectibles', 'Spam hidden for you'], [Blocks, 'dApps', 'Review every request']].map(([I, t, d], i) => { const G = I as typeof Plus; return <div key={t as string} className="lp-stack-card" style={{ ['--i' as any]: i }}><span><G size={20}/></span><div><b>{t as string}</b><small>{d as string}</small></div></div>; })}
      </div>
    </PageHero>

    <section className="lp-fwrap">
      <FRow tone="mint" icon={<ArrowLeftRight size={14}/>} tag="Swap" title="Trade without leaving your wallet." text="Pick what you pay with and what you want. Harbour finds a route, then shows the route and fees before anything is signed." points={['Swap between tokens and across networks', 'Route and fees visible before you confirm', 'Clear messages when a swap is not possible']}
        art={<Pane><div className="lp-field"><small>You pay</small><div><b>1.00</b><span><img src="/asset-logos/eth.svg" alt="" width={22} height={22}/>ETH</span></div></div><div className="lp-field-mid"><ArrowLeftRight size={16}/></div><div className="lp-field"><small>You receive</small><div><b>USDC</b><span><img src="/asset-logos/usdc.svg" alt="" width={22} height={22}/>USDC</span></div></div><div className="lp-kv"><span>Route</span><b>Best found</b></div><div className="lp-kv"><span>Fees</span><b>Shown before you confirm</b></div><div className="lp-fake-btn">Review swap</div></Pane>}/>
      <FRow flip tone="sand" icon={<Sprout size={14}/>} tag="Earn" title="Put idle assets to work." text="Stake supported assets with public validators and follow what they earn. Stake, unstake, redelegate, compound and claim live in the same place." points={['Native staking from your own address', 'Validators and rates come from public data, not placeholders', 'Claim and compound rewards in a few taps']}
        art={<Pane><div className="lp-asset"><img src="/asset-logos/sol.svg" alt="" width={36} height={36}/><div><b>Solana</b><small>Native staking</small></div></div><div className="lp-chips">{['Stake', 'Unstake', 'Redelegate', 'Compound', 'Claim'].map((t, i) => <span key={t} className={i === 0 ? 'on' : ''}>{t}</span>)}</div><div className="lp-kv"><span>Staked</span><b>Your delegations</b></div><div className="lp-kv"><span>Rewards</span><b>Tracked per validator</b></div></Pane>}/>
      <FRow tone="sea" icon={<CreditCard size={14}/>} tag="Fund" title="Add crypto your way." text="Buy or sell through providers, trade peer to peer, set up recurring purchases, or deposit from an exchange you already use." points={['Buy, sell, P2P and recurring in one Fund menu', 'Deposit straight from an exchange', 'Your keys stay on this device throughout']}
        art={<Pane><div className="lp-tabs">{['Buy', 'Sell', 'P2P', 'Recurring'].map((t, i) => <span key={t} className={i === 0 ? 'on' : ''}>{t}</span>)}</div><div className="lp-field"><small>Choose crypto</small><div><b>Bitcoin</b><span><img src="/asset-logos/btc.svg" alt="" width={22} height={22}/>BTC</span></div></div><div className="lp-kv"><span>Provider</span><b>Compare before you pay</b></div><div className="lp-fake-btn">Continue</div></Pane>}/>
      <FRow flip tone="deep" icon={<TrendingUp size={14}/>} tag="Discover" title="See what is moving." text="Live prices, charts and trending tokens, a directory of popular dApps, and market sentiment. All of it works before you even create a wallet." points={['Trending tokens across networks', 'dApp directory with one-tap open', 'Market sentiment at a glance']}
        art={<Pane><div className="lp-spark-wrap"><svg viewBox="0 0 200 70" preserveAspectRatio="none"><path className="lp-spark2" d="M0 56 L20 50 L40 54 L60 38 L80 44 L100 28 L120 34 L140 18 L160 24 L180 8 L200 12"/></svg><div className="lp-pill-row"><span>1H</span><span className="on">24H</span><span>7D</span><span>1M</span></div></div><div className="lp-dapps">{DAPP_SAMPLE.map((d) => <img key={d} src={`/dapps/${d}.webp`} alt="" width={44} height={44}/>)}</div></Pane>}/>
      <FRow tone="mint" icon={<Images size={14}/>} tag="Collectibles" title="Your collection, tidied." text="Browse collections and individual NFTs, send them, and let Harbour move obvious airdrop scams into a Hidden collections folder. Nothing is deleted, and you can bring anything back." points={['Collections, items and detail views', 'Scam-looking airdrops hidden, reversibly', 'Images loaded without leaking your referrer']}
        art={<Pane><div className="lp-nftgrid">{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} style={{ ['--h' as any]: `${150 + i * 34}` }}/>)}</div><div className="lp-kv"><span><EyeOff size={14}/> Hidden collections</span><b>Reversible</b></div></Pane>}/>
      <FRow flip tone="sand" icon={<Blocks size={14}/>} tag="dApps" title="Connect, then decide." text="Use dApps from your browser or pair any app with WalletConnect. Every connection and every request opens an approval window first, so nothing is signed without you." points={['Browser connections and WalletConnect sessions', 'Approval window for every request', 'Disconnect any session whenever you like']}
        art={<Pane><div className="lp-asset"><img src="/dapps/app.uniswap.org.webp" alt="" width={40} height={40} style={{ borderRadius: 12 }}/><div><b>app.uniswap.org</b><small>wants to connect</small></div></div><div className="lp-kv"><span>Permissions</span><b>See address and balances</b></div><div className="lp-two"><span>Reject</span><span className="on">Connect</span></div></Pane>}/>
    </section>

    <section className="lp-section lp-tight">
      <div className="lp-head" data-reveal><h2>And the details<br/>that add up.</h2><p>The extras you would normally install separately come with Harbour from day one.</p></div>
      <div className="lp-sec">
        {TOOLS.map(([I, t, d], i) => <article key={t} className="lp-sec-card" data-reveal style={{ ['--d' as any]: `${(i % 3) * 80}ms` }}><span className="lp-sec-ic"><I size={22}/></span><h3>{t}</h3><p>{d}</p></article>)}
      </div>
    </section>

    <section className="lp-dark slim">
      <div className="lp-dark-inner"><div className="lp-stats" data-reveal>
        <div><b><CountUp to={NETWORKS.length}/></b><small>networks supported</small></div>
        <div><b><CountUp to={SUPPORTED_LOCALES.length}/></b><small>languages</small></div>
        <div><b><CountUp to={AUTO_LOCK_OPTIONS.length - 1}/></b><small>auto-lock timers to choose from</small></div>
        <div><b><CountUp to={0}/></b><small>private keys sent to any server</small></div>
      </div><div className="lp-dark-links"><Other to="networks" label="See every network"/><Other to="security" label="How Harbour protects you"/></div></div>
    </section>

    <CtaBanner title={<>Try it<br/>yourself.</>} text="Create a wallet in under a minute, or bring the one you already have." cta={cta}/>
  </>;
}

/* ───────────────────────── Networks ───────────────────────── */

type Fam = 'all' | 'evm' | 'cosmos' | 'other';
const FAMS: Array<[Fam, string]> = [['all', 'All'], ['evm', 'EVM'], ['cosmos', 'Cosmos'], ['other', 'Other chains']];
const famOf = (c: ChainInfo): Fam => (c.kind === 'evm' ? 'evm' : c.kind === 'cosmos' ? 'cosmos' : 'other');
const KIND_LABEL: Record<string, string> = { utxo: 'Bitcoin-style', evm: 'EVM', cosmos: 'Cosmos', solana: 'Solana', ton: 'TON', aptos: 'Aptos', sui: 'Sui', substrate: 'Substrate', ripple: 'XRP Ledger', stellar: 'Stellar', tron: 'TRON', near: 'NEAR', algorand: 'Algorand', tezos: 'Tezos', filecoin: 'Filecoin', icp: 'Internet Computer', multiversx: 'MultiversX', vechain: 'VeChain', cardano: 'Cardano' };
const kindLabel = (c: ChainInfo) => KIND_LABEL[c.kind] ?? c.name;

export function NetworksPage({ cta }: { cta: ReactNode }) {
  const [fam, setFam] = useState<Fam>('all');
  const [q, setQ] = useState('');
  const counts = useMemo(() => ({ all: NETWORKS.length, evm: NETWORKS.filter((c) => famOf(c) === 'evm').length, cosmos: NETWORKS.filter((c) => famOf(c) === 'cosmos').length, other: NETWORKS.filter((c) => famOf(c) === 'other').length }), []);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return NETWORKS.filter((c) => (fam === 'all' || famOf(c) === fam) && (!s || c.name.toLowerCase().includes(s) || c.symbol.toLowerCase().includes(s)));
  }, [fam, q]);
  return <>
    <PageHero eyebrow="NETWORKS" title={<><CountUp to={NETWORKS.length}/> networks.<br/><span className="accent">One secret phrase.</span></>} lede="Bitcoin, Ethereum, Solana and everything in between, all derived from the same recovery phrase. Back it up once and every network comes with you.">
      <div className="lp-net-hero">
        <div className="lp-orbit" aria-hidden="true">{known(['ethereum', 'bitcoin', 'solana', 'smartchain', 'polygon', 'tron', 'ton', 'base']).map((id, i) => <img key={id} src={chainLogo(id)} alt="" width={56} height={56} style={{ ['--a' as any]: `${i * 45}deg`, ['--i' as any]: i }}/>)}<span><Network size={28}/></span></div>
      </div>
    </PageHero>

    <section className="lp-networks lp-tight"><Marquee>{known(ROW_A).map((id) => <NetChip key={id} id={id}/>)}</Marquee><Marquee reverse>{known(ROW_B).map((id) => <NetChip key={id} id={id}/>)}</Marquee></section>

    <section className="lp-section">
      <div className="lp-head" data-reveal><h2>How it works.</h2><p>No accounts and no sign-ups. Your phrase does the work, and public network endpoints do the rest.</p></div>
      <div className="lp-sec">
        {([[KeyRound, 'One phrase, every address', 'Each network gets its own address, derived on this device from your single secret phrase using open-source wallet-core.'], [Server, 'Public endpoints', 'Balances, history and fees are read from public network endpoints, so there is no Harbour account behind them.'], [Layers, 'Start light, add more', `Harbour opens with ${DEFAULT_HOME_CHAINS.length} popular networks. Turn on any of the others from Manage crypto whenever you need them.`]] as const).map(([I, t, d], i) =>
          <article key={t} className="lp-sec-card" data-reveal style={{ ['--d' as any]: `${i * 90}ms` }}><span className="lp-sec-ic"><I size={22}/></span><h3>{t}</h3><p>{d}</p></article>)}
      </div>
    </section>

    <section className="lp-section lp-tight" id="lp-all-networks">
      <div className="lp-head" data-reveal><h2>Every network,<br/>one list.</h2><p>Filter by family or search by name or symbol.</p></div>
      <div className="lp-filter" data-reveal>
        <div className="lp-fams" role="tablist" aria-label="Network family">{FAMS.map(([k, l]) => <button key={k} role="tab" aria-selected={fam === k} className={fam === k ? 'on' : ''} onClick={() => setFam(k)}>{l}<small>{counts[k]}</small></button>)}</div>
        <label className="lp-search"><Search size={16}/><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search networks" aria-label="Search networks"/></label>
      </div>
      {list.length ? <div className="lp-netgrid" aria-live="polite">{list.map((c) => <article className="lp-net" key={c.id}><img src={chainLogo(c.id)} alt="" width={44} height={44} loading="lazy"/><div><b>{c.name}</b><small>{c.symbol}</small></div><span className="lp-badge">{kindLabel(c)}</span></article>)}</div>
        : <p className="lp-empty" role="status">No network matches “{q.trim()}”. Try another name or symbol.</p>}
    </section>

    <section className="lp-section lp-tight">
      <div className="lp-split" data-reveal>
        <div><span className="lp-kicker"><Network size={14}/>Custom networks</span><h2>Not on the list?<br/>Add it yourself.</h2><p>Any EVM network works. Enter its name, RPC URL, chain ID and currency symbol, and Harbour treats it like a built-in one.</p>
          <ul className="lp-points"><li><Check size={16}/>Works with any EVM-compatible chain</li><li><Check size={16}/>{TESTNET_CHAINS.map((c) => c.name).join(', ')} test network available for trying things safely</li><li><Check size={16}/>Remove it again whenever you like</li></ul></div>
        <Pane className="lp-form"><div className="lp-field"><small>Network name</small><div><b>My network</b></div></div><div className="lp-field"><small>RPC URL</small><div><b>https://rpc.example.org</b></div></div><div className="lp-two-f"><div className="lp-field"><small>Chain ID</small><div><b>1234</b></div></div><div className="lp-field"><small>Symbol</small><div><b>ABC</b></div></div></div><div className="lp-fake-btn">Add network</div></Pane>
      </div>
    </section>

    <CtaBanner title={<>One phrase.<br/>Every chain.</>} text="Create a new wallet in under a minute, or bring the one you already have." cta={cta}/>
  </>;
}

/* ───────────────────────── Security ───────────────────────── */

const GUARDS: Array<[typeof Eye, string, string, string]> = [
  [Eye, 'Know what you are signing', 'Before you approve, Harbour decodes the request and, where the network supports it, previews the tokens that would leave or arrive in your wallet.', 'Before you sign'],
  [ShieldAlert, 'Phishing protection', 'Sites are checked against public phishing and scam lists, refreshed daily. If a list cannot be reached, Harbour says the check was unavailable rather than pretending everything is fine.', 'On every site'],
  [ScanEye, 'Token approval control', 'See which apps are allowed to spend your tokens and revoke any of them in one tap.', 'Settings → Token approvals'],
  [FileSearch, 'Scam collectibles hidden', 'Airdropped NFTs that advertise links, claims or rewards are moved into Hidden collections. Nothing is deleted, and you can restore anything.', 'In Collectibles'],
  [Timer, 'Auto-lock', `Your wallet locks itself when idle. It is set to ${DEFAULT_LOCK_MINUTES} minutes by default, and you can choose anything from 1 minute to 1 hour.`, 'Settings → Security'],
];

export function SecurityPage({ cta }: { cta: ReactNode }) {
  return <>
    <PageHero eyebrow="SECURITY" title={<>Security that<br/><span className="accent">stays with you.</span></>} lede="Harbour is self-custody. Your secret phrase is created on this device and never leaves it, so nobody else, including us, can move your funds or recover your phrase.">
      <Pane className="lp-status"><div className="lp-status-top"><span><ShieldCheck size={22}/></span><div><b>Wallet protected</b><small>Checked on this device</small></div></div>{['Vault encrypted with your password', `Auto-lock after ${DEFAULT_LOCK_MINUTES} minutes idle`, 'Site checks active', 'Keys never leave this device'].map((t, i) => <div className="lp-status-row" key={t} style={{ ['--i' as any]: i }}><Check size={16}/>{t}</div>)}</Pane>
    </PageHero>

    <section className="lp-callout" data-reveal>
      <div className="lp-callout-box"><span className="lp-sec-ic"><KeyRound size={22}/></span><div><b>Open-source cryptography, your keys only.</b><p>Key generation and signing use the open-source wallet-core library running on this device. There is no Harbour server that holds, sees or can recover your keys.</p></div></div>
    </section>

    <section className="lp-section lp-tight">
      <div className="lp-split top">
        <div className="lp-head sticky" data-reveal><h2>Advanced security<br/>keeps you safe.</h2><p>Five protections work together, from the moment a site asks for something to the moment your wallet goes idle.</p></div>
        <ol className="lp-guards">
          {GUARDS.map(([I, t, d, w], i) => <li key={t} data-reveal style={{ ['--d' as any]: `${i * 70}ms` }}><span className="lp-guard-ic"><I size={22}/></span><div><h3>{t}</h3><p>{d}</p><small className="lp-where">{w}</small></div></li>)}
        </ol>
      </div>
    </section>

    <section className="lp-section lp-tight">
      <div className="lp-head" data-reveal><h2>How your vault<br/>is sealed.</h2><p>Your password never gets stored. It is stretched into an encryption key that only exists while the wallet is unlocked.</p></div>
      <div className="lp-flow" data-reveal>
        {([[LockKeyhole, 'Your password', 'Typed by you, never saved'], [Radar, 'PBKDF2-SHA256', 'Stretches it into a key'], [ShieldCheck, 'AES-GCM 256-bit', 'Encrypts your keys'], [Server, 'This device', 'The sealed vault stays here']] as const).map(([I, t, d], i, a) => <div key={t} className="lp-flow-wrap"><div className="lp-flow-node"><span><I size={22}/></span><b>{t}</b><small>{d}</small></div>{i < a.length - 1 && <ArrowRight className="lp-flow-arrow" size={22}/>}</div>)}
      </div>
    </section>

    <section className="lp-section lp-tight">
      <div className="lp-head" data-reveal><h2>Security designed<br/>for you.</h2><p>Pick the level of protection that fits how you use your wallet.</p></div>
      <div className="lp-cards four">
        {([['mint', Usb, 'Hardware wallet support', 'Keep keys on a Ledger and approve each transaction on the device itself.'], ['sand', Fingerprint, 'Biometric unlock', 'Unlock with your device passkey, and fall back to your password any time.'], ['sea', EyeOff, 'Privacy first', 'No account, no email and no sign-up. Prices and balances come from public data sources, and collectible images load without sending a referrer.'], ['deep', LockKeyhole, 'Back up any time', 'Reveal and back up your secret phrase from Settings after unlocking, and store it somewhere only you can reach.']] as const).map(([tone, I, t, d], i) =>
          <article key={t} className={`lp-card ${tone} lp-short`} data-reveal style={{ ['--d' as any]: `${i * 80}ms` }}><span className="lp-sec-ic on-card"><I size={22}/></span><h3>{t}</h3><p>{d}</p></article>)}
      </div>
      <div className="lp-checks" data-reveal>{['Self-custody by design', 'Open-source wallet-core cryptography', 'Hardware wallet support', 'Approval window for every dApp request'].map((t) => <span key={t}><Check size={16}/>{t}</span>)}</div>
      <div className="lp-dark-links light"><Other to="features" label="Explore features"/><Other to="networks" label="See every network"/></div>
    </section>

    <CtaBanner title={<>Your keys.<br/>Your call.</>} text="Create a wallet in under a minute. Your secret phrase stays on this device from the very first step." cta={cta}/>
  </>;
}
