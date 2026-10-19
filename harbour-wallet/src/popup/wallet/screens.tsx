import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { T } from '../theme';
import { Screen, Sheet, Btn, IconBtn, Ic, ICON, Coin, Row, Spinner, Skeleton, SuccessCheck, Empty, useDebouncedLoading } from './ui';
import { ASSETS, assetOf, TRENDING, DAPPS, DAPP_CATS, ACTIVITY, STAKING, BUY_PROVIDERS, NFTS, SPARK, usd, pct, short } from './data';

export type Nav = { push: (name: string, params?: any) => void; pop: () => void; home: () => void; lock?: () => void; backup?: () => void };
export interface Ctx { addrs: Record<string, string>; balances: Record<string, any>; bg: (m: any) => Promise<any>; params: any; nav: Nav }

const evmAddr = (c: Ctx) => c.addrs.ethereum ?? Object.values(c.addrs)[0] ?? '';

// ---------- Sparkline ----------
const Spark: React.FC<{ data: number[]; up: boolean; w?: number; h?: number }> = ({ data, up, w = 320, h = 90 }) => {
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - v * (h - 8) - 4}`).join(' ');
  const col = up ? T.success : T.error;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={col} opacity="0.08" />
    </svg>
  );
};

// ---------- Receive ----------
export const ReceiveScreen: React.FC<Ctx> = (c) => {
  const a = assetOf(c.params?.assetId) ?? assetOf('ethereum')!;
  const addr = a.evm ? evmAddr(c) : (c.addrs[a.id] ?? evmAddr(c));
  const [qr, setQr] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => { if (addr) QRCode.toDataURL(addr, { margin: 1, width: 220 }).then(setQr).catch(() => {}); }, [addr]);
  return (
    <Screen title="Receive" onBack={c.nav.pop}>
      <div style={{ textAlign: 'center', paddingTop: 8 }} className="hb-rise">
        <Coin sym={a.sym} size={44} color={a.color} />
        <div style={{ fontWeight: 700, marginTop: 8 }}>{a.name}</div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 16 }}>{a.evm ? 'EVM address' : a.name}</div>
        <div style={{ display: 'inline-block', padding: 12, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 16 }}>
          {qr ? <img src={qr} width={200} height={200} alt="QR" /> : <Skeleton w={200} h={200} r={12} />}
        </div>
        <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13, margin: '16px 8px 0' }}>{addr}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Btn variant="ghost" onClick={() => navigator.share?.({ text: addr }).catch(() => {})}>Share</Btn>
          <Btn onClick={() => { navigator.clipboard?.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? 'Copied!' : 'Copy'}</Btn>
        </div>
      </div>
    </Screen>
  );
};

// ---------- Send (multi-step, real on Sepolia) ----------
export const SendScreen: React.FC<Ctx> = (c) => {
  const [assetId, setAssetId] = useState<string>(c.params?.assetId ?? 'sepolia');
  const a = assetOf(assetId)!;
  const [step, setStep] = useState<'form' | 'review' | 'sending' | 'done' | 'error'>('form');
  const [to, setTo] = useState(''); const [amount, setAmount] = useState('');
  const [pick, setPick] = useState(false);
  const [hash, setHash] = useState(''); const [err, setErr] = useState('');
  const bal = c.balances[assetId];
  const validTo = /^0x[0-9a-fA-F]{40}$/.test(to.trim());
  const validAmt = Number(amount) > 0;

  const confirm = async () => {
    setStep('sending'); setErr('');
    const res = await c.bg({ type: 'sendTx', chainId: a.chainId, to: to.trim(), amount });
    if (res?.ok) { setHash(res.hash); setStep('done'); } else { setErr(res?.error || 'Transaction failed'); setStep('error'); }
  };

  if (step === 'sending') return <Screen title="Sending" onBack={() => {}}><div style={{ textAlign: 'center', paddingTop: 100 }}><Spinner size={40} /><div style={{ marginTop: 18, color: T.sub }}>Broadcasting transaction…</div></div></Screen>;
  if (step === 'done') return (
    <Screen title="" onBack={c.nav.home}>
      <div style={{ textAlign: 'center', paddingTop: 56 }} className="hb-rise">
        <SuccessCheck /><h2 style={{ margin: '18px 0 6px' }}>Sent</h2>
        <div style={{ color: T.sub }}>{amount} {a.sym} to {short(to)}</div>
        {hash && <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 14, color: T.accent, fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}>View on explorer ↗</a>}
        <div style={{ marginTop: 28 }}><Btn onClick={c.nav.home}>Done</Btn></div>
      </div>
    </Screen>
  );
  if (step === 'error') return (
    <Screen title="" onBack={c.nav.pop}>
      <div style={{ textAlign: 'center', paddingTop: 70 }} className="hb-rise">
        <div style={{ width: 84, height: 84, margin: '0 auto', borderRadius: 999, background: '#FEE2E2', color: T.error, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON.close} size={40} /></div>
        <h2 style={{ margin: '18px 0 6px' }}>Couldn’t send</h2>
        <div style={{ color: T.sub, fontSize: 13, padding: '0 12px', wordBreak: 'break-word' }}>{err}</div>
        <div style={{ marginTop: 28 }}><Btn onClick={() => setStep('form')}>Try again</Btn></div>
      </div>
    </Screen>
  );
  if (step === 'review') return (
    <Screen title="Review" onBack={() => setStep('form')}>
      <div className="hb-rise" style={{ background: T.bgAlt, borderRadius: 16, padding: 16, textAlign: 'center', margin: '6px 0 14px' }}>
        <div style={{ color: T.sub, fontSize: 13 }}>You’re sending</div>
        <div style={{ fontSize: 30, fontWeight: 800, margin: '6px 0' }}>{amount} {a.sym}</div>
      </div>
      {[['Asset', `${a.name}`], ['Network', a.id === 'sepolia' ? 'Sepolia testnet' : a.name], ['To', short(to)], ['Network fee', '≈ 0.0001 ETH']].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${T.border}` }}><span style={{ color: T.sub }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
      ))}
      <div style={{ marginTop: 22 }}><Btn onClick={confirm}>Confirm &amp; send</Btn></div>
    </Screen>
  );
  // form
  return (
    <Screen title="Send" onBack={c.nav.pop}>
      <div style={{ marginTop: 6 }}>
        <label style={{ fontSize: 12, color: T.sub }}>Asset</label>
        <div className="hb-tap" onClick={() => setPick(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bgAlt, borderRadius: 14, padding: '12px 14px', marginTop: 6, cursor: 'pointer' }}>
          <Coin sym={a.sym} size={32} color={a.color} />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{a.name}</div><div style={{ fontSize: 12, color: T.sub }}>{bal ? `${Number(bal.formatted).toFixed(5)} ${a.sym}` : `0 ${a.sym}`} available</div></div>
          <Ic d={ICON.chevron} size={18} />
        </div>
      </div>
      <label style={{ fontSize: 12, color: T.sub, display: 'block', marginTop: 16 }}>Recipient</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x address" style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${validTo || !to ? T.border : T.error}`, fontSize: 14, boxSizing: 'border-box' }} />
        <IconBtn icon="scan" />
      </div>
      <label style={{ fontSize: 12, color: T.sub, display: 'block', marginTop: 16 }}>Amount</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgAlt, borderRadius: 14, padding: '6px 14px', marginTop: 6 }}>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" inputMode="decimal" style={{ flex: 1, padding: '10px 0', border: 'none', background: 'transparent', fontSize: 22, fontWeight: 700, outline: 'none' }} />
        <span style={{ fontWeight: 700, color: T.sub }}>{a.sym}</span>
        <button className="hb-tap" onClick={() => bal && setAmount(String(bal.formatted))} style={{ border: 'none', background: '#fff', color: T.accent, fontWeight: 700, borderRadius: 999, padding: '6px 10px', cursor: 'pointer' }}>Max</button>
      </div>
      {a.id === 'sepolia' && <div style={{ fontSize: 12, color: T.sub, marginTop: 10 }}>Sepolia is a testnet — real on-chain send using your Sepolia RPC.</div>}
      <div style={{ marginTop: 22 }}><Btn disabled={!validTo || !validAmt} onClick={() => setStep('review')}>Next</Btn></div>
      {pick && <Sheet title="Select asset" onClose={() => setPick(false)}>
        {ASSETS.filter((x) => x.evm).map((x) => (
          <Row key={x.id} onClick={() => { setAssetId(x.id); setPick(false); }} left={<Coin sym={x.sym} color={x.color} />} title={x.name} sub={x.id === 'sepolia' ? 'Testnet' : x.sym}
            right={c.balances[x.id] ? Number(c.balances[x.id].formatted).toFixed(4) : '0'} />
        ))}
      </Sheet>}
    </Screen>
  );
};

// ---------- Token detail ----------
export const TokenDetailScreen: React.FC<Ctx> = (c) => {
  const a = assetOf(c.params?.assetId) ?? ASSETS[0];
  const b = c.balances[a.id];
  const loading = useDebouncedLoading(true, 600);
  const acts = ACTIVITY.filter((x) => x.sym === a.sym).slice(0, 3);
  return (
    <Screen title={a.name} onBack={c.nav.pop} right={<IconBtn icon="star" />}>
      <div style={{ textAlign: 'center', paddingTop: 8 }} className="hb-rise">
        <Coin sym={a.sym} size={48} color={a.color} />
        <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }}>{usd(a.price)}</div>
        <div style={{ color: a.change >= 0 ? T.success : T.error, fontWeight: 600, fontSize: 14 }}>{pct(a.change)} today</div>
      </div>
      <div style={{ margin: '14px 0' }}>{loading ? <Skeleton h={90} /> : <Spark data={SPARK} up={a.change >= 0} />}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, margin: '4px 0 18px' }}>
        {[['Send', 'send'], ['Receive', 'receive'], ['Swap', 'swap']].map(([label, ic]) => (
          <button key={label} className="hb-tap" onClick={() => c.nav.push(label === 'Receive' ? 'receive' : label === 'Swap' ? 'swap' : 'send', { assetId: a.id })}
            style={{ flex: 1, border: 'none', background: T.accentSoft, color: T.accent, borderRadius: 14, padding: '12px 0', fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Ic d={ICON[ic]} size={20} /><span style={{ fontSize: 12 }}>{label}</span>
          </button>
        ))}
      </div>
      <div style={{ background: T.bgAlt, borderRadius: 16, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: T.sub }}>Your balance</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>{b ? `${Number(b.formatted).toFixed(6)} ${a.sym}` : `0 ${a.sym}`}</div>
        <div style={{ color: T.sub, fontSize: 13 }}>{b?.usd != null ? usd(b.usd) : usd(0)}</div>
      </div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Activity</div>
      {acts.length ? acts.map((x) => <ActRow key={x.id} x={x} />) : <Empty title="No activity yet" sub="Transactions for this asset will show here." icon="history" />}
    </Screen>
  );
};

const ActRow: React.FC<{ x: typeof ACTIVITY[number] }> = ({ x }) => (
  <Row left={<div style={{ position: 'relative' }}><Coin sym={x.sym} color={x.color} /><span style={{ position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.sub }}><Ic d={ICON[x.type]} size={12} /></span></div>}
    title={x.type[0].toUpperCase() + x.type.slice(1)} sub={x.sub} right={x.amount.startsWith('-') ? x.amount : <span style={{ color: T.success }}>{x.amount}</span>} rightSub={x.time} />
);

// ---------- Activity ----------
export const ActivityScreen: React.FC<Ctx> = (c) => {
  const loading = useDebouncedLoading(true, 500);
  return <Screen title="Activity" onBack={c.nav.pop} right={<IconBtn icon="filter" />}>
    {loading ? [0, 1, 2, 3].map((i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'center' }}><Skeleton w={40} h={40} r={999} /><div style={{ flex: 1 }}><Skeleton w={120} h={12} /><div style={{ height: 6 }} /><Skeleton w={80} h={10} /></div></div>)
      : ACTIVITY.map((x) => <ActRow key={x.id} x={x} />)}
  </Screen>;
};

// ---------- Buy ----------
export const BuyScreen: React.FC<Ctx> = (c) => (
  <Screen title="Buy crypto" onBack={c.nav.pop}>
    <div style={{ background: T.bgAlt, borderRadius: 16, padding: 16, textAlign: 'center', margin: '6px 0 16px' }}>
      <div style={{ color: T.sub, fontSize: 13 }}>You buy</div>
      <div style={{ fontSize: 30, fontWeight: 800, margin: '4px 0' }}>$100.00</div>
      <div style={{ color: T.sub, fontSize: 13 }}>≈ 0.0314 ETH</div>
    </div>
    <div style={{ fontWeight: 700, marginBottom: 6 }}>Providers</div>
    {BUY_PROVIDERS.map((p) => (
      <Row key={p.name} onClick={() => {}} left={<div style={{ width: 40, height: 40, borderRadius: 12, background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON.card} size={20} /></div>}
        title={p.name} sub={p.methods} right={<span style={{ fontSize: 13, color: T.sub }}>Fee {p.fee}</span>} />
    ))}
    <div style={{ fontSize: 12, color: T.sub, marginTop: 14 }}>Providers and quotes are sample data in this build.</div>
  </Screen>
);

// ---------- Discover (dApp browser) ----------
export const DiscoverScreen: React.FC<Ctx> = (c) => {
  const [cat, setCat] = useState('Popular');
  return <Screen title="Discover" onBack={c.nav.pop} right={<IconBtn icon="search" onClick={() => c.nav.push('search')} />}>
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 12px' }}>
      {DAPP_CATS.map((x) => <span key={x} onClick={() => setCat(x)} className="hb-tap" style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: cat === x ? T.accent : T.bgAlt, color: cat === x ? '#fff' : T.sub }}>{x}</span>)}
    </div>
    {DAPPS.map((d) => <Row key={d.name} onClick={() => {}} left={<Coin sym={d.name} color={d.color} />} title={d.name} sub={d.cat} right={<Ic d={ICON.chevron} size={18} />} />)}
  </Screen>;
};

// ---------- Search ----------
export const SearchScreen: React.FC<Ctx> = (c) => {
  const [q, setQ] = useState('');
  const res = ASSETS.filter((a) => (a.name + a.sym).toLowerCase().includes(q.toLowerCase()));
  return <Screen title="" onBack={c.nav.pop} pad={false}>
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgAlt, borderRadius: 14, padding: '10px 14px' }}>
        <Ic d={ICON.search} size={18} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tokens & dApps" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15 }} />
      </div>
    </div>
    <div style={{ padding: '0 16px' }}>
      {res.map((a) => <Row key={a.id} onClick={() => c.nav.push('tokenDetail', { assetId: a.id })} left={<Coin sym={a.sym} color={a.color} />} title={a.name} sub={a.sym} right={usd(a.price)} rightSub={<span style={{ color: a.change >= 0 ? T.success : T.error }}>{pct(a.change)}</span>} />)}
      {!res.length && <Empty title="No results" sub="Try a different token or dApp name." icon="search" />}
    </div>
  </Screen>;
};

// ---------- Staking ----------
export const StakingScreen: React.FC<Ctx> = (c) => (
  <Screen title="Staking" onBack={c.nav.pop}>
    <div style={{ background: `linear-gradient(135deg, ${T.accent}, #60A5FA)`, color: '#fff', borderRadius: 18, padding: 18, margin: '6px 0 18px' }}>
      <div style={{ opacity: 0.85, fontSize: 13 }}>Staked balance</div><div style={{ fontSize: 26, fontWeight: 800 }}>$0.00</div>
      <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>Earn rewards by staking your assets</div>
    </div>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>Available to stake</div>
    {STAKING.map((s) => <Row key={s.sym} onClick={() => {}} left={<Coin sym={s.sym} color={s.color} />} title={s.name} sub={`APR ${s.apr}`} right={<span style={{ color: T.success, fontWeight: 700 }}>{s.apr}</span>} rightSub="est. APR" />)}
    <div style={{ fontSize: 12, color: T.sub, marginTop: 14 }}>APRs are sample data in this build.</div>
  </Screen>
);

// ---------- NFTs ----------
export const NftsScreen: React.FC<Ctx> = (c) => (
  <Screen title="Collectibles" onBack={c.nav.pop}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
      {NFTS.map((n) => (
        <div key={n.id} className="hb-tap" style={{ cursor: 'pointer' }}>
          <div style={{ aspectRatio: '1', borderRadius: 14, background: `linear-gradient(135deg, ${n.color}, #ffffff55)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 28 }}>{n.collection[0]}</div>
          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{n.name}</div>
          <div style={{ fontSize: 12, color: T.sub }}>{n.collection}</div>
        </div>
      ))}
    </div>
  </Screen>
);

// ---------- Wallet selector ----------
export const WalletSelectorScreen: React.FC<Ctx> = (c) => (
  <Screen title="Wallets" onBack={c.nav.pop} right={<IconBtn icon="plus" />}>
    <div style={{ background: T.bgAlt, borderRadius: 14, padding: 4, marginTop: 6 }}>
      <Row left={<div style={{ width: 40, height: 40, borderRadius: 999, background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>1</div>}
        title="Seed Phrase 1" sub={short(evmAddr(c))} right={<Ic d={ICON.check} size={18} />} />
    </div>
    <div style={{ marginTop: 16 }}>
      {[['Create new wallet', 'plus'], ['Add existing wallet', 'wallet'], ['Back up wallet', 'shield']].map(([label, ic]) => (
        <Row key={label} onClick={() => { if (label === 'Back up wallet') { c.nav.pop(); c.nav.backup?.(); } }} left={<div style={{ width: 40, height: 40, borderRadius: 12, background: T.bgAlt, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON[ic]} size={20} /></div>} title={label} right={<Ic d={ICON.chevron} size={18} />} />
      ))}
    </div>
  </Screen>
);

// ---------- Settings + subpages ----------
export const SettingsScreen: React.FC<Ctx> = (c) => {
  const items: Array<[string, string, string]> = [
    ['Wallets', 'wallet', 'walletSelector'], ['Security & privacy', 'shield', 'settingsSecurity'],
    ['Preferences', 'gear', 'settingsPrefs'], ['Networks', 'globe', 'settingsNetworks'],
    ['Notifications', 'bell', ''], ['Help center', 'help', ''], ['About Harbour', 'grid', 'about'],
  ];
  return <Screen title="Settings" onBack={c.nav.pop}>
    <div style={{ marginTop: 4 }}>
      {items.map(([label, ic, to]) => <Row key={label} onClick={() => to && c.nav.push(to)} left={<div style={{ width: 40, height: 40, borderRadius: 12, background: T.bgAlt, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON[ic]} size={20} /></div>} title={label} right={<Ic d={ICON.chevron} size={18} />} />)}
    </div>
    <div style={{ marginTop: 20 }}><Btn variant="ghost" onClick={() => c.nav.lock?.()}>Lock wallet</Btn></div>
    <div style={{ textAlign: 'center', color: T.sub, fontSize: 12, marginTop: 16 }}>Harbour Wallet · v0.1.0</div>
  </Screen>;
};

const Toggle: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button onClick={onClick} style={{ width: 46, height: 28, borderRadius: 999, border: 'none', background: on ? T.accent : T.border, position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
    <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: '#fff', transition: 'left .2s' }} />
  </button>
);

export const SecurityScreen: React.FC<Ctx> = (c) => {
  const [bio, setBio] = useState(true); const [autolock, setAutolock] = useState(true);
  return <Screen title="Security & privacy" onBack={c.nav.pop}>
    {[['Biometric unlock', bio, () => setBio(!bio)], ['Auto-lock after 5 min', autolock, () => setAutolock(!autolock)]].map(([label, on, fn]) => (
      <div key={label as string} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${T.border}` }}><span style={{ flex: 1, fontWeight: 600 }}>{label as string}</span><Toggle on={on as boolean} onClick={fn as () => void} /></div>
    ))}
    {['Show secret phrase', 'Change password', 'Connected sites'].map((s) => <Row key={s} onClick={() => {}} left={<div style={{ width: 40, height: 40, borderRadius: 12, background: T.bgAlt, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic d={ICON.lock} size={18} /></div>} title={s} right={<Ic d={ICON.chevron} size={18} />} />)}
  </Screen>;
};

export const PreferencesScreen: React.FC<Ctx> = (c) => {
  const [hide, setHide] = useState(false);
  return <Screen title="Preferences" onBack={c.nav.pop}>
    {[['Currency', 'USD'], ['Language', 'English'], ['Theme', 'Light']].map(([k, v]) => (
      <Row key={k} onClick={() => {}} left={<></>} title={k} right={<span style={{ color: T.sub }}>{v}</span>} />
    ))}
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderTop: `1px solid ${T.border}` }}><span style={{ flex: 1, fontWeight: 600 }}>Hide small balances</span><Toggle on={hide} onClick={() => setHide(!hide)} /></div>
  </Screen>;
};

export const NetworksScreen: React.FC<Ctx> = (c) => (
  <Screen title="Networks" onBack={c.nav.pop} right={<IconBtn icon="plus" />}>
    {ASSETS.filter((a) => a.evm).map((a) => <Row key={a.id} onClick={() => {}} left={<Coin sym={a.sym} color={a.color} />} title={a.name} sub={a.id === 'sepolia' ? 'Testnet · chainId 11155111' : `chainId ${a.chainId}`} right={<Toggle on onClick={() => {}} />} />)}
  </Screen>
);

export const AboutScreen: React.FC<Ctx> = (c) => (
  <Screen title="About" onBack={c.nav.pop}>
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ width: 72, height: 72, margin: '0 auto', borderRadius: 20, background: `linear-gradient(135deg, ${T.accent}, #60A5FA)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 36 }}>H</div>
      <h2 style={{ margin: '14px 0 2px' }}>Harbour Wallet</h2>
      <div style={{ color: T.sub }}>Version 0.1.0</div>
    </div>
    {['Terms of Service', 'Privacy Policy', 'Open-source licenses'].map((s) => <Row key={s} onClick={() => {}} left={<></>} title={s} right={<Ic d={ICON.chevron} size={18} />} />)}
    <div style={{ textAlign: 'center', color: T.sub, fontSize: 12, marginTop: 20, lineHeight: 1.5 }}>A self-custody wallet. Keys are stored encrypted on this device and never leave it.</div>
  </Screen>
);

// ---------- Swap confirm ----------
export const SwapConfirmScreen: React.FC<Ctx> = (c) => {
  const [step, setStep] = useState<'review' | 'done'>('review');
  if (step === 'done') return <Screen title="" onBack={c.nav.home}><div style={{ textAlign: 'center', paddingTop: 60 }} className="hb-rise"><SuccessCheck /><h2 style={{ margin: '16px 0 4px' }}>Swap submitted</h2><div style={{ color: T.sub }}>0.1 ETH → 318 USDC</div><div style={{ marginTop: 26 }}><Btn onClick={c.nav.home}>Done</Btn></div></div></Screen>;
  return <Screen title="Confirm swap" onBack={c.nav.pop}>
    <div style={{ background: T.bgAlt, borderRadius: 16, padding: 16, margin: '6px 0 14px' }}>
      <Row left={<Coin sym="ETH" color="#6372f0" />} title="0.1 ETH" sub="Ethereum" />
      <div style={{ textAlign: 'center', color: T.sub, margin: '4px 0' }}><Ic d={ICON.arrowdown} size={18} /></div>
      <Row left={<Coin sym="USDC" color="#2775ca" />} title="318 USDC" sub="Ethereum" />
    </div>
    {[['Rate', '1 ETH ≈ 3,180 USDC'], ['Network fee', '≈ 0.0007 ETH'], ['Slippage', '0.5%']].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}><span style={{ color: T.sub }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>)}
    <div style={{ marginTop: 20 }}><Btn onClick={() => setStep('done')}>Confirm swap</Btn></div>
    <div style={{ fontSize: 12, color: T.sub, marginTop: 12, textAlign: 'center' }}>Swap quote is sample data in this build.</div>
  </Screen>;
};

export const SCREENS: Record<string, React.FC<Ctx>> = {
  send: SendScreen, receive: ReceiveScreen, tokenDetail: TokenDetailScreen, activity: ActivityScreen,
  buy: BuyScreen, discover: DiscoverScreen, search: SearchScreen, staking: StakingScreen, nfts: NftsScreen,
  walletSelector: WalletSelectorScreen, settings: SettingsScreen, settingsSecurity: SecurityScreen,
  settingsPrefs: PreferencesScreen, settingsNetworks: NetworksScreen, about: AboutScreen, swapConfirm: SwapConfirmScreen,
};
