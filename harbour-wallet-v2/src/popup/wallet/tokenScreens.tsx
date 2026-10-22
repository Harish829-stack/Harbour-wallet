import React, { useEffect, useRef, useState } from 'react';
import { T } from '../theme';
import { Screen, Sheet, Btn, IconBtn, Ic, ICON, Coin, Row, Spinner } from './ui';
import { tokenNetworks, networkByChainId } from '../../core/customTokens';
import { syncNetworks } from './networkStore';
import { explorerAddress, explorerAddressById, assetOf } from './data';
import { chainById, chainByEvmId } from '../../core/chains/index';
import { useChart, PriceChart } from './tokenData';
import type { ChartRange } from '../../core/marketData';
import { validTokenAddress, TOKEN_CHAINS, STANDARD_LABEL, type TokenStandard } from '../../core/chains/adapters/tokens';
import { refreshTokens, tokenItem, useTokenItems } from './tokensStore';
import { money, moneyPrice, fmtNumber } from '../settingsStore';
import type { Ctx } from './screens';

// Custom token import, rebuilt from the Trust Wallet extension's `custom-asset` chunk (REA, evidence/27-custom-token):
//   /select-network  -> list of networks with customTokensEnabled
//   /add-asset/main/<network>  -> address field (trimmed, 200 ms debounced lookup), network badge "on <network>",
//        valid lookup shows an arrow + "confirm" text + preview card (name, type tag, network, symbol, decimals),
//        warning alert, error alert, "Add token manually" link, "Add token" button disabled until valid
//   .../manual -> name, symbol, decimals (0-32, read-only when filled by the lookup) and, where a network has several
//        token standards, a type select. Harbour only supports ERC-20 so the select is omitted.
// TW wording for most strings is served from its CMS and is not in the bundle; the wording here is Harbour's.
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const Alert: React.FC<{ kind: 'warn' | 'error'; children: React.ReactNode }> = ({ kind, children }) => (
  <div role={kind === 'error' ? 'alert' : undefined} style={{ background: kind === 'error' ? 'color-mix(in srgb, var(--hb-error) 12%, transparent)' : T.bgAlt, color: kind === 'error' ? T.error : T.sub, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}>{children}</div>
);
const field: React.CSSProperties = { width: '100%', padding: 14, borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 14, boxSizing: 'border-box', marginTop: 6 };

export const SelectTokenNetworkScreen: React.FC<Ctx> = (c) => {
  const [, bump] = useState(0); useEffect(() => { void syncNetworks(c.bg).then(() => bump((n) => n + 1)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
  <Screen title="Select network" onBack={c.nav.pop}>
    <div style={{ color: T.sub, fontSize: 13, margin: '4px 0 8px' }}>Choose the network the token lives on</div>
    {tokenNetworks().map((n) => (
      <Row key={n.id} onClick={() => c.nav.push('addCustomToken', { chainId: n.chainId, address: c.params?.address })} left={<Coin sym={n.name.slice(0, 3)} assetId={n.id} />} title={n.name} sub={n.testnet ? 'Testnet' : undefined} right={<Ic d={ICON.chevron} size={18} />} />
    ))}
    {Object.entries(TOKEN_CHAINS).map(([id, std]) => { const ch = chainById(id); return ch ? (
      <Row key={id} onClick={() => c.nav.push('addChainToken', { chain: id, address: c.params?.address })} left={<Coin sym={ch.symbol} assetId={id} />} title={ch.name} sub={`${STANDARD_LABEL[std as TokenStandard] ?? 'Custom'} tokens`} right={<Ic d={ICON.chevron} size={18} />} />
    ) : null; })}
  </Screen>
  );
};

type Look = { state: 'idle' } | { state: 'loading' } | { state: 'ok'; name: string; symbol: string; decimals: number; address: string } | { state: 'error'; code: string; error: string };

export const AddCustomTokenScreen: React.FC<Ctx> = (c) => {
  const chainId = Number(c.params?.chainId); const [, bump] = useState(0); useEffect(() => { void syncNetworks(c.bg).then(() => bump((n) => n + 1)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const net = networkByChainId(chainId);
  const [address, setAddress] = useState<string>(String(c.params?.address ?? '').trim());
  const [manual, setManual] = useState(false);
  const [look, setLook] = useState<Look>({ state: 'idle' });
  const [name, setName] = useState(''); const [symbol, setSymbol] = useState(''); const [decimals, setDecimals] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const seq = useRef(0);

  // 200 ms debounce like TW; a response for an older address is ignored.
  useEffect(() => {
    const my = ++seq.current; setErr('');
    if (!address) { setLook({ state: 'idle' }); return; }
    if (!ADDR.test(address)) { setLook({ state: 'error', code: 'INVALID_ADDRESS', error: 'Enter a valid contract address.' }); return; }
    setLook({ state: 'loading' });
    const t = setTimeout(async () => {
      const r = await c.bg({ type: 'tokenProbe', chainId, address }).catch(() => ({ ok: false, code: 'NETWORK_ERROR', error: 'Could not reach the network. Check your connection and try again.' }));
      if (my !== seq.current) return;
      if (r?.ok) { setLook({ state: 'ok', ...r.token }); setName(r.token.name); setSymbol(r.token.symbol); setDecimals(String(r.token.decimals)); setAutoFilled(true); }
      else { setLook({ state: 'error', code: r?.code ?? 'NOT_A_TOKEN', error: r?.error || 'No token found at this address.' }); setAutoFilled(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [address, chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!net) return <Screen title="Add custom token" onBack={c.nav.pop}><Alert kind="error">Unsupported network.</Alert></Screen>;

  const decNum = Number(decimals);
  const manualValid = ADDR.test(address) && name.trim().length > 0 && symbol.trim().length > 0 && decimals !== '' && Number.isInteger(decNum) && decNum >= 0 && decNum <= 32;
  const canAdd = !busy && (manual ? manualValid : look.state === 'ok');
  const add = async () => {
    if (!canAdd) return; setBusy(true); setErr('');
    const r = await c.bg({ type: 'tokenAdd', chainId, address, manual, name, symbol, decimals: decNum }).catch(() => null);
    setBusy(false);
    if (r?.ok) { await refreshTokens(c.bg); c.refresh?.(); c.nav.home(); } else setErr(r?.error || 'Could not add the token. Try again.');
  };
  const showError = look.state === 'error' && address && !(look.code === 'INVALID_ADDRESS' && false);
  return (
    <Screen title="Add custom token" onBack={c.nav.pop}>
      <div style={{ textAlign: 'center', padding: '4px 0 10px' }}>
        <Coin sym={net.name.slice(0, 3)} assetId={net.id} size={44} />
        <div style={{ color: T.sub, marginTop: 6 }}>on {net.name}</div>
      </div>
      <label htmlFor="ct-address" style={{ fontSize: 12, color: T.sub }}>Contract address</label>
      <div style={{ position: 'relative' }}>
        <input id="ct-address" data-testid="custom-asset-address-input" autoFocus value={address} onChange={(e) => setAddress(e.target.value.trim())} placeholder="Contract address" spellCheck={false} autoComplete="off"
          style={{ ...field, fontFamily: 'monospace', paddingRight: 42, borderColor: showError ? T.error : T.border }} />
        {look.state === 'loading' && <span style={{ position: 'absolute', right: 14, top: 22 }}><Spinner size={18} /></span>}
      </div>
      {showError && <div role="alert" data-testid="custom-asset-error" style={{ color: T.error, fontSize: 13, marginTop: 6 }}>{(look as any).error}</div>}

      {manual && <>
        <label htmlFor="ct-name" style={{ fontSize: 12, color: T.sub, display: 'block', marginTop: 16 }}>Token name</label>
        <input id="ct-name" data-testid="custom-asset-name-input" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} style={field} />
        <label htmlFor="ct-symbol" style={{ fontSize: 12, color: T.sub, display: 'block', marginTop: 16 }}>Token symbol</label>
        <input id="ct-symbol" data-testid="custom-asset-symbol-input" value={symbol} maxLength={32} onChange={(e) => setSymbol(e.target.value)} style={field} />
        <label htmlFor="ct-decimals" style={{ fontSize: 12, color: T.sub, display: 'block', marginTop: 16 }}>Token decimals</label>
        <input id="ct-decimals" data-testid="custom-asset-decimals-input" value={decimals} inputMode="numeric" readOnly={autoFilled} disabled={autoFilled} onChange={(e) => setDecimals(e.target.value.replace(/[^0-9]/g, ''))} style={{ ...field, opacity: autoFilled ? 0.6 : 1 }} />
        {decimals !== '' && (decNum < 0 || decNum > 32) && <div role="alert" style={{ color: T.error, fontSize: 13, marginTop: 6 }}>Decimals must be between 0 and 32.</div>}
      </>}

      {!manual && look.state === 'ok' && (
        <div style={{ textAlign: 'center', margin: '14px 0 6px' }} data-testid="custom-asset-preview">
          <div style={{ color: T.sub, fontSize: 13, marginBottom: 8 }}>Is this the token you want to add?</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.bgAlt, borderRadius: 16, padding: 14, textAlign: 'left' }}>
            <Coin sym={look.symbol} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span data-testid="custom-asset-asset-name" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{look.name}</span><span style={{ fontSize: 11, fontWeight: 700, color: T.sub, border: `1px solid ${T.border}`, borderRadius: 6, padding: '1px 6px' }}>ERC20</span></div>
              <div style={{ fontSize: 12, color: T.sub }}>{net.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}><div data-testid="custom-asset-asset-symbol" style={{ fontWeight: 700 }}>{look.symbol}</div><div style={{ fontSize: 12, color: T.sub }}>{look.decimals} decimals</div></div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
        <Alert kind="warn"><b style={{ fontWeight: 600 }}>Be careful.</b> Anyone can create a token, including fake versions of existing ones. Only add tokens you trust, and check the contract address.</Alert>
        {err && <Alert kind="error">{err}</Alert>}
        {!manual && address && (
          <button type="button" data-testid="custom-asset-add-token-manually-button" onClick={() => setManual(true)} style={{ background: 'none', border: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Add token manually</button>
        )}
        <Btn disabled={!canAdd} onClick={add}>{busy ? 'Adding…' : 'Add token'}</Btn>
      </div>
    </Screen>
  );
};

// ---------- detail for a custom token (no market chart: its price history is not available without TW's ticker service) ----------
export const CustomTokenDetailScreen: React.FC<Ctx> = (c) => {
  const a = assetOf(c.params?.assetId)!; const t = a.token!; const tk: any = useTokenItems().items.find((i: any) => i.token.id === a.id)?.token; const nonEvm: string | undefined = tk?.chain; const net = nonEvm ? chainById(nonEvm) : networkByChainId(t.chainId);
  const items = useTokenItems().items; const it = items.find((i: any) => i.token.id === a.id) ?? tokenItem(a.id);
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [copied, setCopied] = useState(false);
  const bal = it ? Number(it.formatted) : 0;
  // DEX price chart (GeckoTerminal top pool) for tokens CoinGecko may not list
  const chainKey = nonEvm ?? chainByEvmId(t.chainId)?.id ?? '';
  const [range, setRange] = useState<ChartRange>('1D');
  const chart = useChart(c.bg, `token:${chainKey}:${t.address}`, range);
  const remove = async () => {
    setBusy(true); const r = await c.bg({ type: nonEvm ? 'chainDataTokenRemove' : 'tokenRemove', id: a.id }).catch(() => null); setBusy(false);
    if (r?.ok) { await refreshTokens(c.bg); c.refresh?.(); c.nav.home(); } else { setConfirm(false); setErr(r?.error || 'Could not remove the token'); }
  };
  const link = nonEvm ? explorerAddressById(nonEvm, t.address) : explorerAddress(t.chainId, t.address);
  return (
    <div className="hb-screen" style={{ position: 'absolute', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', zIndex: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 8 }}>
        <IconBtn icon="back" onClick={c.nav.pop} />
        <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: 16 }}>{a.name}</div><div style={{ fontSize: 12, color: T.sub }}>{net?.name}</div></div>
        <span style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90, padding: '0 16px 90px' }}>
        <div style={{ textAlign: 'center', paddingTop: 10 }}>
          <div style={{ fontSize: 30, fontWeight: 800 }} data-testid="token-balance">{it?.ok === false ? '—' : fmtNumber(bal, { maximumFractionDigits: 6 })} {a.sym}</div>
          <div style={{ color: T.sub, marginTop: 4 }}>{it?.usd != null ? money(it.usd) : it?.price == null ? 'No price available' : money(0)}{it?.price != null && <> · {moneyPrice(it.price)}</>}</div>
        </div>
        <div style={{ background: T.bgAlt, borderRadius: 14, padding: 14, marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          {[['Network', net?.name ?? ''], ['Type', nonEvm ? (STANDARD_LABEL[tk?.standard as TokenStandard] ?? 'Token') : 'ERC20'], ['Decimals', String(t.decimals)]].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.sub }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>)}
          <div><div style={{ color: T.sub, marginBottom: 4 }}>{nonEvm === 'solana' ? 'Mint' : 'Contract'}</div><div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontWeight: 600 }}>{t.address}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <button type="button" onClick={() => navigator.clipboard?.writeText(t.address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} style={{ background: 'none', border: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{copied ? 'Copied' : 'Copy'}</button>
              {link && <a href={link} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 700 }}>View on explorer ↗</a>}
            </div></div>
        </div>
        {chart.data && chart.data.points.length > 1 && <div data-testid="token-chart" style={{ marginTop: 18 }}>
          <PriceChart points={chart.data.points} up={(chart.data.changePct ?? 0) >= 0} range={range} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>{(['1H', '1D', '1W', '1M', '1Y'] as ChartRange[]).map((r) => <button key={r} type="button" onClick={() => setRange(r)} style={{ background: r === range ? T.accentSoft : 'transparent', color: r === range ? T.accent : T.sub, border: 'none', borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{r}</button>)}</div>
        </div>}
        {err && <div role="alert" style={{ color: T.error, fontSize: 13, marginTop: 12 }}>{err}</div>}
        <div style={{ marginTop: 20 }}><Btn variant="ghost" onClick={() => setConfirm(true)}>Remove token</Btn></div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: 10, padding: '12px 16px', borderTop: `1px solid ${T.border}`, background: T.surface }}>
        {[['Send', 'send'], ['Receive', 'receive']].map(([label, to]) => (
          <button key={label} className="hb-tap" onClick={() => c.nav.push(to, { assetId: a.id })} style={{ flex: 1, border: 'none', background: to === 'send' ? T.accent : T.accentSoft, color: to === 'send' ? 'var(--hb-on-brand)' : T.accent, borderRadius: 999, padding: '13px 0', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ic d={ICON[to === 'send' ? 'send' : 'receive']} size={18} />{label}
          </button>
        ))}
      </div>
      {confirm && <Sheet title="Remove token?" onClose={() => setConfirm(false)}>
        <div style={{ color: T.sub, marginBottom: 14 }}>{a.name} will be hidden from this wallet. Your balance on-chain is not affected, and you can add the token again later.</div>
        <Btn onClick={remove} disabled={busy} style={{ background: T.error }}>{busy ? 'Removing…' : 'Remove'}</Btn>
        <div style={{ height: 10 }} /><Btn variant="ghost" onClick={() => setConfirm(false)}>Cancel</Btn>
      </Sheet>}
    </div>
  );
};

// ---------- non-EVM custom token (Solana SPL mint / Tron TRC-20 contract): same flow as the EVM screen, chain-specific probe ----------
export const AddChainTokenScreen: React.FC<Ctx> = (c) => {
  const chainKey = String(c.params?.chain ?? ''); const ch = chainById(chainKey); const std = TOKEN_CHAINS[chainKey];
  const [address, setAddress] = useState<string>(String(c.params?.address ?? '').trim());
  const [look, setLook] = useState<Look & { needsManual?: boolean }>({ state: 'idle' });
  const [name, setName] = useState(''); const [symbol, setSymbol] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current; setErr('');
    if (!address) { setLook({ state: 'idle' }); return; }
    if (!validTokenAddress(chainKey, address)) { setLook({ state: 'error', code: 'INVALID_ADDRESS', error: chainKey === 'solana' ? 'Enter a valid token mint address.' : 'Enter a valid TRC-20 contract address (starts with T).' }); return; }
    setLook({ state: 'loading' });
    const t = setTimeout(async () => {
      const r = await c.bg({ type: 'chainDataTokenProbe', chain: chainKey, address }).catch(() => ({ ok: false, code: 'NETWORK_ERROR', error: 'Could not reach the network. Check your connection and try again.' }));
      if (my !== seq.current) return;
      if (r?.ok) { setLook({ state: 'ok', ...r.token, needsManual: !!r.needsManual }); setName(r.token.name); setSymbol(r.token.symbol); }
      else setLook({ state: 'error', code: r?.code ?? 'NOT_A_TOKEN', error: r?.error || 'No token found at this address.' });
    }, 200);
    return () => clearTimeout(t);
  }, [address, chainKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ch || !std) return <Screen title="Add custom token" onBack={c.nav.pop}><Alert kind="error">Unsupported network.</Alert></Screen>;
  const needsManual = look.state === 'ok' && (look.needsManual || !look.name || !look.symbol);
  const canAdd = !busy && look.state === 'ok' && name.trim().length > 0 && symbol.trim().length > 0;
  const add = async () => {
    if (!canAdd) return; setBusy(true); setErr('');
    const r = await c.bg({ type: 'chainDataTokenAdd', chain: chainKey, address, manual: needsManual, name, symbol }).catch(() => null);
    setBusy(false);
    if (r?.ok) { await refreshTokens(c.bg); c.refresh?.(); c.nav.home(); } else setErr(r?.error || 'Could not add the token. Try again.');
  };
  return (
    <Screen title="Add custom token" onBack={c.nav.pop}>
      <div style={{ textAlign: 'center', padding: '4px 0 10px' }}><Coin sym={ch.symbol} assetId={ch.id} size={44} /><div style={{ color: T.sub, marginTop: 6 }}>on {ch.name}</div></div>
      <label htmlFor="ct-address" style={{ fontSize: 12, color: T.sub }}>{chainKey === 'solana' ? 'Token mint address' : 'Contract address'}</label>
      <div style={{ position: 'relative' }}>
        <input id="ct-address" data-testid="custom-asset-address-input" autoFocus value={address} onChange={(e) => setAddress(e.target.value.trim())} placeholder={chainKey === 'solana' ? 'Token mint address' : 'Contract address'} spellCheck={false} autoComplete="off"
          style={{ ...field, fontFamily: 'monospace', paddingRight: 42, borderColor: look.state === 'error' ? T.error : T.border }} />
        {look.state === 'loading' && <span style={{ position: 'absolute', right: 14, top: 22 }}><Spinner size={18} /></span>}
      </div>
      {look.state === 'error' && <div role="alert" data-testid="custom-asset-error" style={{ color: T.error, fontSize: 13, marginTop: 6 }}>{look.error}</div>}
      {look.state === 'ok' && <div style={{ margin: '14px 0 6px' }} data-testid="custom-asset-preview">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.bgAlt, borderRadius: 16, padding: 14 }}>
          <Coin sym={symbol || '?'} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Unnamed token'}</div><div style={{ fontSize: 12, color: T.sub }}>{ch.name} · {STANDARD_LABEL[std as TokenStandard] ?? 'Token'}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700 }}>{symbol || '—'}</div><div style={{ fontSize: 12, color: T.sub }}>{look.decimals} decimals</div></div>
        </div>
        {needsManual && <>
          <div style={{ color: T.sub, fontSize: 13, margin: '12px 0 0' }}>The network does not publish a name for this token. Enter it yourself; decimals are read from the chain.</div>
          <label htmlFor="ct-name" style={{ fontSize: 12, color: T.sub, display: 'block', marginTop: 12 }}>Token name</label>
          <input id="ct-name" data-testid="custom-asset-name-input" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} style={field} />
          <label htmlFor="ct-symbol" style={{ fontSize: 12, color: T.sub, display: 'block', marginTop: 12 }}>Token symbol</label>
          <input id="ct-symbol" data-testid="custom-asset-symbol-input" value={symbol} maxLength={32} onChange={(e) => setSymbol(e.target.value)} style={field} />
        </>}
      </div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
        <Alert kind="warn"><b style={{ fontWeight: 600 }}>Be careful.</b> Anyone can create a token, including fake versions of existing ones. Only add tokens you trust, and check the address.</Alert>
        {err && <Alert kind="error">{err}</Alert>}
        <Btn disabled={!canAdd} onClick={add}>{busy ? 'Adding…' : 'Add token'}</Btn>
      </div>
    </Screen>
  );
};

export const TOKEN_SCREENS: Record<string, React.FC<Ctx>> = { selectTokenNetwork: SelectTokenNetworkScreen, addCustomToken: AddCustomTokenScreen, addChainToken: AddChainTokenScreen, customTokenDetail: CustomTokenDetailScreen };
