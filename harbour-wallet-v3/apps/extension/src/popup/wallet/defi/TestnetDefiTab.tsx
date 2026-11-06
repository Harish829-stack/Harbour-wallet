import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatUnits, isAddress, zeroAddress } from 'viem';
import { bg } from '../../api';
import { T } from '../../theme';
import { Btn, Spinner, Ic, ICON, PageTitle } from '../ui';
import type { Nav } from '../screens';
import { BASE_SEPOLIA, SEPOLIA } from '../../../integrations/testnet-defi/config';
import type { DefiAction, DefiReview, DefiToken, EarnAsset } from '../../../integrations/testnet-defi/types';

interface Catalog { assets?: EarnAsset[]; tokens?: DefiToken[]; nativeBalance?: string; account: string }
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const units = (raw: string, decimals: number) => formatUnits(BigInt(raw), decimals);
const field: React.CSSProperties = { minHeight: 48, marginTop: 8, lineHeight: 1.5, width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgAlt, color: T.text, fontSize: 14 };
const hint: React.CSSProperties = { fontSize: 12, color: T.sub, lineHeight: 1.5, overflowWrap: 'anywhere' };
const card: React.CSSProperties = { background: T.bgAlt, borderRadius: 16, padding: 14, margin: '12px 0' };
const labels: Record<DefiAction, string> = { supply: 'Supply', withdraw: 'Withdraw', swap: 'Swap', wrap: 'Wrap ETH', unwrap: 'Unwrap WETH' };
const Message: React.FC<{ error?: boolean; children: React.ReactNode }> = ({ error, children }) => <div role={error ? 'alert' : 'status'} style={{ ...card, background: error ? T.bgAlt : T.accentSoft, color: error ? T.error : T.accent, fontSize: 13, lineHeight: 1.5 }}>{children}</div>;

// Keep the same selection values and callbacks, with a contained, scrollable picker.
const ChoiceSelect: React.FC<{ label: string; value: string | number; disabled?: boolean; onValueChange: (value: string) => void; children: React.ReactNode }> = ({ label, value, disabled, onValueChange, children }) => {
  // An anchored dropdown (not a bottom sheet): opens in place with a short fade, flips upward near the bottom edge,
  // and closes on outside click, Escape or Tab. Focus returns to the trigger without scrolling the tab.
  const [open, setOpen] = useState(false); const [up, setUp] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null); const trigger = useRef<HTMLButtonElement>(null); const list = useRef<HTMLDivElement>(null);
  const options = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<{ value: string | number; children: React.ReactNode }>[];
  const selected = options.find((option) => String(option.props.value) === String(value));
  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus({ preventScroll: true }); };
  const toggle = () => {
    if (open) return close();
    const r = trigger.current?.getBoundingClientRect(); const box = trigger.current?.closest('.hb-tab-content, .hb-screen-body')?.getBoundingClientRect();
    const below = (box?.bottom ?? window.innerHeight) - (r?.bottom ?? 0); const above = (r?.top ?? 0) - (box?.top ?? 0);
    setUp(below < Math.min(260, options.length * 52 + 12) && above > below); setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    (list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLElement>('[role="option"]'))?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) close(false); };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);
  const onListKey = (e: React.KeyboardEvent) => {
    const items = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []); const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close(false);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1]?.focus(); }
  };
  return <span ref={wrap} className="hb-select">
    <button ref={trigger} type="button" className="hb-choice" aria-label={label} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={toggle}
      onKeyDown={(e) => { if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) { e.preventDefault(); toggle(); } }}>
      <span>{selected?.props.children ?? 'Select'}</span><span className="hb-select-caret" aria-hidden="true"><Ic d={ICON.down} size={18} /></span>
    </button>
    {/* preventDefault stops the surrounding <label> from re-clicking the trigger when the list padding is clicked. */}
    {open && <div ref={list} role="listbox" aria-label={label} className={`hb-select-menu${up ? ' up' : ''}`} onKeyDown={onListKey} onClick={(e) => e.preventDefault()}>
      {options.map((option) => { const on = String(option.props.value) === String(value); return <button type="button" role="option" aria-selected={on} key={option.props.value} className="hb-select-option" onClick={() => { onValueChange(String(option.props.value)); close(); }}>
        <span>{option.props.children}</span>{on && <Ic d={ICON.check} size={16} />}
      </button>; })}
    </div>}
  </span>;
};
const displayUnits = (raw: string, decimals: number) => Number(units(raw, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });

/** Only the wallet host imports this entry point. Protocol-specific UI does not modify legacy screens. */
export const TestnetDefiTab: React.FC<{
  kind: 'swap' | 'earn'; networkId?: string | null; nav: Nav; accountKey: string; backupRequired?: boolean; refresh?: () => void;
}> = ({ kind, networkId, nav, accountKey, backupRequired, refresh }) => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [action, setAction] = useState<DefiAction>(kind === 'earn' ? 'supply' : 'swap');
  const [token, setToken] = useState(''); const [tokenOut, setTokenOut] = useState(''); const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(50); const [search, setSearch] = useState(''); const [extras, setExtras] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [review, setReview] = useState<DefiReview | null>(null);
  const [result, setResult] = useState<{ ok: boolean; hashes: string[]; explorerUrl?: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const supported = kind === 'earn' ? networkId === BASE_SEPOLIA.id : networkId === SEPOLIA.id;
  const networkName = networkId === BASE_SEPOLIA.id ? BASE_SEPOLIA.name : SEPOLIA.name;
  const extraKey = extras.join(',');
  const load = useCallback(async () => {
    const g = ++generation.current;
    if (!supported) return;
    setLoading(true); setError(''); setReview(null);
    try {
      const response = await bg({ type: 'defiCatalog', kind, networkId, tokens: extraKey ? extraKey.split(',') : [] });
      if (!mounted.current || g !== generation.current) return;
      if (!response?.ok) throw new Error(response?.error ?? 'Could not load testnet options.');
      setCatalog(response);
    } catch (e) { if (mounted.current && g === generation.current) { setCatalog(null); setError(e instanceof Error ? e.message : 'Could not load testnet options.'); } }
    finally { if (mounted.current && g === generation.current) setLoading(false); }
  }, [supported, kind, networkId, extraKey]);
  useEffect(() => { void load(); }, [load, accountKey]);
  useEffect(() => { if (!review) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [review]);
  const tokens = kind === 'earn' ? catalog?.assets ?? [] : catalog?.tokens ?? [];
  const selected = tokens.find((t) => t.address.toLowerCase() === token.toLowerCase());
  const earnAsset = kind === 'earn' ? selected as EarnAsset | undefined : undefined;
  const outputs = selected && kind === 'swap' ? tokens.filter((t) => t.address.toLowerCase() !== selected.address.toLowerCase()) : [];
  const change = () => { setReview(null); setError(''); setResult(null); };
  const choose = (value: string) => { change(); setToken(value); setTokenOut(''); setAmount(''); };
  const chooseAction = (value: DefiAction) => { change(); setAction(value); setAmount(''); };
  const canPrepare = !!catalog && !loading && !busy && !review && !!amount && !!selected && (kind === 'earn' ? action === 'supply' ? earnAsset?.canSupply : earnAsset?.canWithdraw : outputs.some((t) => t.address === tokenOut));
  const prepare = async () => {
    if (backupRequired) { nav.backup?.(); return; }
    change(); setBusy(true);
    const g = generation.current;
    try {
      const response = await bg({ type: 'defiPrepare', request: { networkId, action, token, tokenOut, amount, slippageBps: slippage } });
      if (!mounted.current || g !== generation.current) return;
      if (!response?.ok) throw new Error(response?.error ?? 'Could not prepare the transaction.');
      setNow(Date.now()); setReview(response.review);
    } catch (e) { if (mounted.current && g === generation.current) setError(e instanceof Error ? e.message : 'Could not prepare the transaction.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  const submit = async () => {
    if (!review || busy || Date.now() >= review.expiresAt) return;
    setBusy(true); setError('');
    try {
      const response = await bg({ type: 'defiSubmit', id: review.id, networkId, kind });
      if (!mounted.current) return;
      setReview(null);
      setResult({ ok: !!response?.ok, hashes: response?.hashes ?? [], explorerUrl: response?.explorerUrl });
      if (!response?.ok) setError(response?.error ?? 'Transaction failed. Review again before retrying.');
      else { setAmount(''); refresh?.(); void load(); }
    } catch (e) { if (mounted.current) { setReview(null); setError(e instanceof Error ? e.message : 'Transaction failed.'); } }
    finally { if (mounted.current) setBusy(false); }
  };
  const addToken = () => {
    if (!isAddress(search.trim(), { strict: false })) { setError('Enter a Sepolia token contract address.'); return; }
    if (extras.length >= 8) { setError('You can check up to eight additional tokens per session.'); return; }
    change(); setExtras((items) => [...new Set([...items, search.trim().toLowerCase()])]); setSearch('');
  };
  const title = kind === 'earn' ? 'Earn' : 'Swap';
  // The host renders this tab only on its supported testnet (Wallet.tsx shows the switch prompt otherwise).
  if (!supported) return null;
  return <div className="hb-defi" data-testid={`testnet-${kind}`}>
    <PageTitle action={<button type="button" className="hb-link-btn" disabled={busy || loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button>}>{title}</PageTitle>
    <Message>{title} testing is enabled on {networkName} via {kind === 'earn' ? 'Aave V3 (AaveKit)' : 'Uniswap API'}. Test tokens have no monetary value.</Message>
    {loading && <div role="status" style={{ padding: 18, textAlign: 'center' }}><Spinner size={22} /><p style={hint}>Checking live {kind === 'earn' ? 'reserves and balances' : 'token balances'}…</p></div>}
    {error && <Message error>{error}</Message>}
    {!catalog && extras.length > 0 && <Btn variant="ghost" disabled={busy || loading} onClick={() => { setExtras([]); setSearch(''); }}>Clear added token checks</Btn>}
    {!loading && !catalog && <Btn disabled={busy} onClick={() => void load()}>Retry</Btn>}
    {catalog && <>
      <div style={hint}>Account {short(catalog.account)} · {networkName}</div>
      <label className="hb-defi-field">Action
        <ChoiceSelect label="Action" value={action} disabled={busy || !!review} onValueChange={(value) => chooseAction(value as DefiAction)}>
          {(kind === 'earn' ? ['supply', 'withdraw'] as const : ['swap'] as const).map((a) => <option value={a} key={a}>{labels[a]}</option>)}
        </ChoiceSelect>
      </label>
      {<>
        {tokens.length === 0 && <Message>No {kind === 'earn' ? 'available Aave reserves' : 'checked Sepolia tokens'} were found. {kind === 'swap' ? 'Try checking another token contract below.' : 'Refresh to check again.'}</Message>}
        <label className="hb-defi-field">{kind === 'earn' ? 'Asset' : 'You pay'}
          <ChoiceSelect label={kind === 'earn' ? 'Choose asset' : 'You pay'} disabled={busy || !!review || !tokens.length} value={token} onValueChange={choose}>
            <option value="">Select token</option>{tokens.map((t) => <option key={t.address} value={t.address}>{t.address === zeroAddress ? `${t.symbol} · native` : `${t.symbol} · ${short(t.address)}`}</option>)}
          </ChoiceSelect>
        </label>
        {selected && <div className="hb-defi-asset-meta">
          <div><span>Wallet balance</span><strong title={units(selected.balance, selected.decimals)}>{displayUnits(selected.balance, selected.decimals)} {selected.symbol}</strong></div>
          {selected.address === zeroAddress ? <p>Native ETH · supplied through Aave’s WETH gateway</p> : <details><summary>Token contract <span>{short(selected.address)}</span></summary><code>{selected.address}</code></details>}
        </div>}
        {earnAsset && <div className="hb-defi-reserve" style={card}>
          <strong>{earnAsset.apy.toFixed(2)}% variable supply APY</strong>
          <div className="hb-defi-stat"><span>Supplied</span><strong title={units(earnAsset.supplied, earnAsset.decimals)}>{displayUnits(earnAsset.supplied, earnAsset.decimals)} {earnAsset.symbol}</strong></div>
          <div className="hb-defi-stat"><span>Pool liquidity</span><strong title={units(earnAsset.availableLiquidity, earnAsset.decimals)}>{displayUnits(earnAsset.availableLiquidity, earnAsset.decimals)} {earnAsset.symbol}</strong></div>
          <div style={hint}>Deposit: {earnAsset.canSupply ? 'Available' : `Unavailable${earnAsset.reason ? ` · ${earnAsset.reason}` : ''}`}</div>
          <div style={hint}>Withdraw: {earnAsset.canWithdraw ? 'Available' : BigInt(earnAsset.supplied) > 0n ? 'Unavailable · no pool liquidity' : 'Unavailable · no supplied balance'}</div>
          <p style={hint}>Interest comes from borrowing activity. Testnet rates can be zero and are not guaranteed. Withdrawals depend on liquidity and any collateral obligations.</p>
        </div>}
        {kind === 'swap' && <label className="hb-defi-field">You receive
          <ChoiceSelect label="You receive" disabled={busy || !!review || !outputs.length} value={tokenOut} onValueChange={(value) => { change(); setTokenOut(value); }}>
            <option value="">Select token</option>{outputs.map((t) => <option key={t.address} value={t.address}>{t.symbol} · {short(t.address)}</option>)}
          </ChoiceSelect>
        </label>}
      </>}
      <label className="hb-defi-field">Amount
        <input aria-label="Token amount" inputMode="decimal" placeholder="0.00" style={field} disabled={busy || !!review} value={amount} onChange={(e) => { change(); setAmount(e.target.value); }} />
      </label>
      {kind === 'swap' && action === 'swap' && <label className="hb-defi-field">Slippage tolerance
        <ChoiceSelect label="Slippage tolerance" value={slippage} disabled={busy || !!review} onValueChange={(value) => { change(); setSlippage(Number(value)); }}>
          {[10, 50, 100, 300, 500].map((bps) => <option key={bps} value={bps}>{bps / 100}%</option>)}
        </ChoiceSelect>
      </label>}
      {!review && <Btn disabled={!canPrepare} onClick={() => void prepare()}>{busy ? 'Preparing…' : `Review ${labels[action].toLowerCase()}`}</Btn>}
      {review && <section aria-label="Transaction review" style={card}>
        <h3 style={{ marginTop: 0 }}>Review {labels[review.action].toLowerCase()}</h3>
        <p>{units(review.amount, review.decimals)} {review.symbol}</p>
        <p style={hint}>{review.network}<br />From: {review.account}</p>
        {review.expectedOutput && <p>Expected: {units(review.expectedOutput, review.outputDecimals!)} {review.outputSymbol}</p>}
        {review.minimumOutput && <p>Minimum received: {units(review.minimumOutput, review.outputDecimals!)} {review.outputSymbol}</p>}
        {kind === 'swap' && <p>Slippage tolerance: {slippage / 100}%</p>}
        <p style={hint}>Network fee budget (estimate): {units(review.fee, 18)} test ETH. Actual fees are estimated again before each transaction.</p>
        <ol style={{ paddingLeft: 20, fontSize: 13 }}>{review.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
        <p style={hint}>{busy ? 'Confirming transactions on Sepolia. Keep this view open.' : now >= review.expiresAt ? 'Review expired. Go back and review again.' : `Review expires in ${Math.max(0, Math.ceil((review.expiresAt - now) / 1000))} seconds.`}</p>
        <Btn disabled={busy || now >= review.expiresAt} onClick={() => void submit()}>{busy ? 'Confirming…' : 'Confirm transaction'}</Btn>
        <Btn variant="ghost" disabled={busy} onClick={() => setReview(null)} style={{ marginTop: 8 }}>Back</Btn>
      </section>}
      {result && <Message error={!result.ok}>
        {result.ok ? `Transaction confirmed on ${networkName}.` : result.hashes.length ? 'Some transactions were submitted. Check their status before retrying.' : 'No transaction was confirmed.'}
        {result.explorerUrl && <p><a href={result.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>View on Sepolia explorer</a></p>}
      </Message>}
        {kind === 'swap' && <details style={{ marginTop: 18 }}><summary style={{ cursor: 'pointer', color: T.sub, fontSize: 13 }}>Add token by contract</summary>
        <p style={hint}>Uniswap checks route availability for the selected pair when you request a quote. A listed token may not have enough live liquidity for your amount.</p>
        <input aria-label="Token contract address" style={field} placeholder="0x…" value={search} disabled={busy || !!review || loading} onChange={(e) => setSearch(e.target.value)} />
        <Btn variant="ghost" disabled={busy || !!review || loading || !search} onClick={addToken}>Check token</Btn>
      </details>}
    </>}
    {kind === 'swap' && <p style={{ ...hint, marginTop: 16 }}>Ethereum Sepolia test ETH faucets: <a href="https://www.alchemy.com/dapps/sepolia-faucet" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>Alchemy</a> · <a href="https://faucet.triangleplatform.com/ethereum/sepolia" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>Triangle</a>.</p>}
    {kind === 'earn' && <p style={{ ...hint, marginTop: 16 }}>Base Sepolia test ETH faucets: <a href="https://www.alchemy.com/faucets/base-sepolia" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>Alchemy</a> · <a href="https://faucet.eth.sh/base-sepolia" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>ETH.sh</a>. Aave reserve tokens must also be available from a Base Sepolia token faucet.</p>}
  </div>;
};
