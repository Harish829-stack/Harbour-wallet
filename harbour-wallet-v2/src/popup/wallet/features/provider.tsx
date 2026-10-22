// Harbour provider approval surfaces. Requests and permissions always come from the background;
// URL parameters select a request, never provide signing data or an origin.
import React, { useEffect, useState } from 'react';
import type { Ctx } from '../screens';
import { T } from '../../theme';
import { bg } from '../../api';
import { Btn, Empty, Ic, injectStyles, Row, Screen, Sheet, Spinner } from '../ui';
import { ErrorLine, Group, NavRow, Note, SectionLabel, SwitchRow } from '../settingsScreens';
import { refreshSettings } from '../../settingsStore';
import { Biometrics, isUserCancel } from '../../../core/passkey';

const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, background: T.surface, color: T.text, margin: '6px 0 12px' };
const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: 12, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', margin: '6px 0' };
const json = (v: unknown) => JSON.stringify(v, null, 2);
const humanize = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const plain = (v: any): string => v == null ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? v.map(plain).join(', ') : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${humanize(k)}: ${plain(x)}`).join('\n') : String(v);
// Objects and lists render as labelled rows, never as raw JSON.
const Detail = ({ label, value }: { label: string; value: any }) => value == null || value === '' ? null : <div style={{ padding: '10px 0', borderBottom: `1px solid ${T.border}` }}><div style={{ color: T.sub, fontSize: 12 }}>{label}</div><div style={{ ...mono, fontFamily: typeof value === 'string' && value.length > 28 ? 'monospace' : 'inherit' }}>{plain(value)}</div></div>;
const gwei = (wei: any): string => { try { const n = Number(BigInt(String(wei))) / 1e9; return `${+n.toFixed(n < 1 ? 4 : 2)} gwei`; } catch { return ''; } };
const fmtUnits = (raw: string, dec = 18): string => { const t = raw.padStart(dec + 1, '0'); const i = t.slice(0, t.length - dec), f = t.slice(t.length - dec).replace(/0+$/, ''); return f ? `${i}.${f}` : i; };
// One sentence for the decoded call; a plain native transfer has nothing to decode, so the row is hidden.
const describeCall = (c: any): string | null => {
  if (!c || c.kind === 'none') return null;
  switch (c.kind) {
    case 'transfer': return `Transfer tokens to ${c.to}`;
    case 'transferFrom': return c.standard === 'erc721' ? `Move NFT #${c.amountOrId} from ${c.from} to ${c.to}` : `Move tokens from ${c.from} to ${c.to}`;
    case 'approve': return c.decrease ? `Lower the token allowance for ${c.spender}` : `Let ${c.spender} spend your tokens`;
    case 'setApprovalForAll': return c.approved ? `Let ${c.operator} manage all of your NFTs in this collection` : `Stop ${c.operator} managing your NFTs in this collection`;
    case 'nftTransfer': return `Send NFT #${c.id}${c.amount != null ? ` (×${c.amount})` : ''} from ${c.from} to ${c.to}`;
    case 'permit': return `Sign off on ${c.spender} spending your tokens (permit)`;
    case 'wrap': return c.fn === 'deposit' ? 'Wrap the native coin into its token form' : 'Unwrap the token back to the native coin';
    default: return `Unknown contract function (${c.selector}, ${c.bytes} bytes of data). Only continue if you trust this site.`;
  }
};
const Warning = ({ children }: { children: React.ReactNode }) => <div role="alert" style={{ background: 'var(--hb-warn-bg)', color: 'var(--hb-warn-ink)', border: '1px solid var(--hb-warn-line)', borderRadius: 12, padding: 12, margin: '10px 0', fontSize: 13, lineHeight: 1.5 }}>{children}</div>;
const titles: Record<string, string> = { connect: 'Connect to site', permissions: 'Update permissions', solConnect: 'Connect to Solana', sign: 'Sign message', typed: 'Sign typed data', tx: 'Confirm transaction', switchChain: 'Switch network', addChain: 'Add Custom Network', wcSession: 'Connect with WalletConnect', watchAsset: 'Add token', solSignMessage: 'Sign message', solSignTx: 'Sign transaction', solSignAll: 'Sign transactions', solSignSend: 'Send transaction', multiConnect: 'Connect to site', multiSign: 'Sign request' };
const warningLabels: Record<string, string> = { maliciousAddress: 'Security warning: this address is flagged as malicious by GoPlus. Do not continue unless you are certain.', maliciousSpender: 'Security warning: the address you are approving is flagged as malicious by GoPlus. It could drain this token.', unlimitedApproval: 'This gives the spender unlimited access to this token.', excessiveApproval: 'This allowance greatly exceeds your current token balance.', setApprovalForAll: 'This gives the operator access to every item in this collection.', simulationFailed: 'Transaction simulation failed. The transaction may revert and still charge a network fee.', insufficientFunds: 'Insufficient funds for the transaction and network fee.', contractCreation: 'This transaction deploys a new contract.', zeroAddress: 'This transaction targets the zero address.', customNonce: 'The site supplied a custom transaction nonce.', dataToEoa: 'Call data is being sent to an address without a contract.', toTokenContract: 'The token recipient is the token contract itself.', approvalNativeValue: 'This token approval also sends native currency.', increaseAllowance: 'This transaction increases an existing allowance.', tokenTransfer: 'This transaction transfers tokens.', revokeApprovalForAll: 'This revokes collection access.' };

export function ProviderSurface() {
  injectStyles();
  const [items, setItems] = useState<any[] | null>(null); const [id, setId] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id') ?? '');
  const [view, setView] = useState<any>(null); const [locked, setLocked] = useState(false); const [hasVault, setHasVault] = useState(true);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [password, setPassword] = useState(''); const [gone, setGone] = useState(false);
  useEffect(() => { void refreshSettings(bg); }, []);
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const [session, queue] = await Promise.all([bg({ type: 'providerSession' }), bg({ type: 'providerPending' })]);
        if (dead) return;
        setHasVault(!!session.hasVault); setLocked(!session.unlocked); setItems(queue.items ?? []);
        if (!id && queue.items?.length) setId(queue.items[0].id);
      } catch (e: any) { if (!dead) setError(e?.message || 'Could not load requests.'); }
    };
    void load(); const timer = setInterval(() => { void load(); }, 1500);
    return () => { dead = true; clearInterval(timer); };
  }, [id]);
  useEffect(() => {
    if (!id) return; let dead = false; setView(null); setGone(false); setError('');
    bg({ type: 'providerView', id }).then((r) => { if (dead) return; if (r.gone) setGone(true); else if (r.locked) setLocked(true); else if (r.ok) setView(r.view); else setError(r.error || 'Could not load request details.'); }).catch((e) => { if (!dead) setError(e.message); });
    return () => { dead = true; };
  }, [id, locked]);
  const resolve = async (decision: any) => {
    if (!id || busy) return; setBusy(true); setError('');
    try {
      const r = await bg({ type: 'providerResolve', id, decision });
      if (r.locked) { setLocked(true); setView(null); return; }
      if (!r.ok) { setError(r.error || 'Request failed.'); setGone(true); return; }
      setView(null); setId(''); setGone(false);
    } catch (e: any) { setError(e.message || 'Could not submit this decision.'); }
    finally { setBusy(false); }
  };
  const unlock = async () => {
    setBusy(true); setError('');
    try { const r = await bg({ type: 'unlock', password }); if (r.ok) { setPassword(''); setLocked(false); } else setError(r.error || 'Could not unlock.'); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="hb-root" style={{ background: T.bg, color: T.text, fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 18, borderBottom: `1px solid ${T.border}` }}><Ic d="shield"/><strong>Harbour</strong><span style={{ marginLeft: 'auto', color: T.sub, fontSize: 12 }}>Site request</span></header>
    <main style={{ padding: '12px 20px 24px', flex: 1 }}>
      {!hasVault ? <><Empty title="Set up your wallet" sub="Create or import a Harbour wallet before connecting a site." icon="wallet"/><Btn onClick={() => { window.location.hash = '/onboarding'; }}>Set up wallet</Btn></> : locked ? <>
        <h2>Unlock to continue</h2><Note>Review the site request after unlocking. Unlocking does not approve it.</Note>
        <div><label htmlFor="provider-password">Wallet password</label><input id="provider-password" autoFocus type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={field}/><Btn disabled={!password || busy} onClick={() => { void unlock(); }}>{busy ? 'Unlocking…' : 'Unlock'}</Btn></div>
        {id && <Btn variant="ghost" disabled={busy || items?.find((x) => x.id === id)?.stage === 'executing'} style={{ marginTop: 10 }} onClick={() => { void resolve({ approve: false }); }}>Reject request</Btn>}
      </> : items === null ? <Spinner/> : !id || (!items.some((x) => x.id === id) && !busy) || gone ? <>
        <Empty title={gone ? 'Request finished' : 'No pending requests'} sub="Requests expire when the site disconnects, you reject them, or their time limit passes." icon="check"/>
        {items.filter((x) => x.id !== id).map((p) => <Row key={p.id} left={<Ic d="globe"/>} title={p.host} sub={titles[p.kind] ?? p.kind} onClick={() => { setGone(false); setId(p.id); }}/>)}</>
      : !view ? <><Spinner/><p style={{ color: T.sub }}>Loading request details…</p></> : <ApprovalReview key={view.id} view={{ ...view, stage: items.find((x) => x.id === id)?.stage }} busy={busy} resolve={resolve}/>} 
      <ErrorLine msg={error}/>
      {items && items.length > 1 && <><SectionLabel>Pending requests</SectionLabel>{items.map((p) => <button key={p.id} disabled={busy} onClick={() => setId(p.id)} style={{ ...field, textAlign: 'left', cursor: 'pointer', borderColor: p.id === id ? T.accent : T.border }}>{p.host} · {titles[p.kind] ?? p.kind}</button>)}</>}
    </main>
  </div>;
}

function ApprovalReview({ view: v, busy, resolve: resolveRaw }: { view: any; busy: boolean; resolve: (decision: any) => Promise<void> }) {
  const [bioErr, setBioErr] = useState('');
  /** Biometric approval (opt-in): the OS prompt unseals a secret that the background verifies and binds to THIS request for 60 s. */
  const bio = async (): Promise<boolean> => {
    setBioErr('');
    try { const { secret } = await new Biometrics().login(v.bio.credentialId); const r = await bg({ type: 'providerBioProof', id: v.id, secret }); if (!r?.ok) throw new Error(r?.error || 'Biometric verification failed'); return true; }
    catch (e: any) { if (!isUserCancel(e)) setBioErr(e?.message || 'Biometric verification failed'); return false; }
  };
  const resolve = async (d: any) => { if (d.approve && v.bio?.required && !(await bio())) return; return resolveRaw(d); };
  const [account, setAccount] = useState(v.lockedIndex ?? v.activeAccount ?? 0); const [chain, setChain] = useState(v.selectedChainId ?? 1);
  const [feeLevel, setFeeLevel] = useState(v.defaultFeeLevel ?? 'average'); const [gas, setGas] = useState(v.gasLimit ?? ''); const [ack, setAck] = useState(false);
  const executing = v.stage === 'executing';
  const connect = ['connect', 'permissions', 'solConnect', 'multiConnect', 'wcSession'].includes(v.kind); const addrOf = (a: any) => (v.ns === 'solana' ? a?.solana : v.ns === 'multi' ? a?.multi?.[v.multiChain ?? v.chain?.id] : a?.evm); const wcs = v.kind === 'wcSession';
  const wcPrev = wcs ? v.wc?.preview?.find((p: any) => p.index === account) : null;
  const warnings: string[] = v.warnings ?? [];
  const risk = v.site?.risk === 'high' || v.site?.risk === 'blocked' || v.site?.risk === 'malicious' || v.site?.risk === 'phishing';
  const dangerous = risk || (wcs && (v.wc?.verify?.isScam || v.wc?.verify?.validation === 'INVALID')) || v.message?.rawHash || v.message?.ethSign || warnings.length > 0 || v.typed?.warnings?.length > 0 || v.siwe?.issues?.length > 0;
  const selected = v.accounts?.find((a: any) => a.index === account);
  const fee = v.fees?.presets?.[feeLevel];
  let maxFeeWei: string | null = null;
  try { if (fee && /^\d+$/.test(gas)) maxFeeWei = (BigInt(gas) * BigInt(fee.maxFeePerGas ?? fee.gasPrice)).toString(); } catch { /* fee unavailable */ }
  const blocked = connect && (!selected || !addrOf(selected)) || wcs && !wcPrev?.ok || v.kind === 'tx' && (!/^\d{1,20}$/.test(gas) || gas === '0' || warnings.includes('insufficientFunds')) || v.kind === 'addChain' && v.rpcCheck?.ok === false;
  return <>
    {executing && <Warning>This request is executing. Its outcome may be uncertain if the worker stops. Do not submit it again.</Warning>}
    <h2 style={{ margin: '8px 0 14px', fontSize: 23 }}>{v.kind === 'addChain' && v.alreadyAdded ? 'Network already added' : titles[v.kind] ?? 'Review request'}</h2>
    <Group><div style={{ padding: 14 }}><strong>{v.title}</strong><div style={{ ...mono, fontWeight: 700 }}>{v.origin}</div>{v.embedded && <Detail label="Embedded in" value={v.topOrigin}/>}</div></Group>
    {risk && <Warning>This site is flagged as dangerous. Approving can expose your assets.</Warning>}
    {v.site?.insecure && <Warning>This site uses an insecure connection.</Warning>}
    {v.site?.lookalike && <Warning>This internationalized domain may resemble another site. Check its full address.</Warning>}
    {v.site?.risk === 'unavailable' && <Note>Site safety check is unavailable. Check the site address carefully.</Note>}
    {connect ? <>
      <Note>This site can view the selected public address and request signatures and transactions. Every signing request needs your approval.</Note>
      <label htmlFor="provider-account">Account · {v.walletName}</label><select id="provider-account" style={field} value={account} disabled={v.lockedIndex != null} onChange={(e) => setAccount(Number(e.target.value))}>{v.accounts.map((a: any) => <option key={a.index} value={a.index}>{a.name} · {addrOf(a) || 'Address unavailable'}</option>)}</select>
      {v.lockedIndex != null && <Note>This site's existing permission is bound to this account. Disconnect it in Settings to choose another account.</Note>}
      <Detail label="Public address" value={addrOf(selected)}/>
      {/* No network picker on connect (Trust Wallet shows none): the site is connected on its current network and may switch it later. */}
    </> : v.kind === 'addChain' ? null : <><Detail label="Account" value={v.account?.name}/><Detail label="Signing address" value={v.signer ?? ((v.ns === 'multi' ? v.account?.multi?.[v.chain?.id] : v.ns === 'solana' ? v.account?.solana : v.account?.evm))}/><Detail label="Network" value={v.ns === 'multi' ? v.chain?.name : v.ns === 'solana' ? 'Solana' : v.chain ? `${v.chain.name} (Chain ID ${v.chain.chainId})` : undefined}/></>}
    {wcs && <>
      {v.wc?.verify?.isScam ? <Warning>WalletConnect flags this site as malicious. Do not connect.</Warning>
        : v.wc?.verify?.validation === 'INVALID' ? <Warning>The site's address does not match the one it claims. It may be impersonating another site.</Warning>
        : v.wc?.verify?.validation === 'VALID' ? <Note>Site address verified by WalletConnect.</Note>
        : <Note>WalletConnect could not verify this site's address. Check it carefully.</Note>}
      {wcPrev && !wcPrev.ok && <Warning>{wcPrev.error} Choose another account or reject.</Warning>}
      {wcPrev?.ok && <><Detail label="Networks granted" value={wcPrev.chains.map((c: string) => v.wc.networkNames?.[c] ?? (c.startsWith('solana:') ? 'Solana' : c)).join(', ')}/><Detail label="Requests allowed" value={wcPrev.methods.join(', ')}/></>}
      <Detail label="Site-declared address" value={v.wc?.declaredUrl}/>
      <Note>This site can see the public address you connect and ask for signatures. Each request still needs your approval.</Note>
    </>}
    {v.message && <><SectionLabel>Message to sign</SectionLabel>{(v.message.ethSign || v.message.rawHash) && <Warning>This is a raw Ethereum signature request. It can authorize transactions or asset transfers.</Warning>}<pre style={mono}>{v.message.utf8 ?? v.message.hex}</pre><Detail label="Message length (bytes)" value={v.message.bytes}/><details><summary>Message bytes</summary><pre style={mono}>{v.message.hex}</pre></details></>}
    {v.siwe && <><SectionLabel>Sign in with Ethereum</SectionLabel><Detail label="Sign-in details" value={v.siwe}/>{v.siwe.issues?.map((x: string, i: number) => <Warning key={i}>{x}</Warning>)}</>}
    {v.typed && <><SectionLabel>{v.typed.primaryType}</SectionLabel><Detail label="Domain" value={v.typed.domain}/>{v.typed.approvals?.map((a: any, i: number) => <Warning key={i}>{a.unlimited ? 'Unlimited token access' : 'Asset authorization'}<div style={mono}>{plain(a)}</div></Warning>)}<Detail label="Structured message" value={v.typed.tree}/>{v.typedData && <details><summary>Complete typed data</summary><pre style={mono}>{json(v.typedData)}</pre></details>}</>}
    {v.kind === 'tx' && <>
      <Detail label="Send" value={`${v.valueFormatted} ${v.symbol}`}/><Detail label="From" value={v.from}/><Detail label="To" value={v.to ?? 'New contract'}/><Detail label="Contract action" value={describeCall(v.call)}/>{v.token && <><Detail label="Token" value={v.token.unknown ? 'Unknown token' : [v.token.symbol, v.token.name && `(${v.token.name})`].filter(Boolean).join(' ')}/><Detail label="Token contract" value={v.token.address}/></>}{v.tokenAmount && <Detail label="Token amount" value={v.tokenAmount.unlimited ? 'Unlimited' : `${v.tokenAmount.formatted ?? v.tokenAmount.raw}${v.token?.symbol ? ` ${v.token.symbol}` : ''}`}/>}<Detail label="Nonce" value={v.nonce}/>
      <Detail label="Estimated network fee" value={v.estimatedFeeFormatted == null ? 'Unavailable' : `${v.estimatedFeeFormatted} ${v.symbol} (maximum estimate)`}/>
      {v.fees && <><label htmlFor="provider-fees">Network fee</label><select id="provider-fees" value={feeLevel} style={field} onChange={(e) => setFeeLevel(e.target.value)}>{Object.keys(v.fees.presets).map((k) => <option key={k} value={k}>{k}</option>)}</select>{fee?.maxFeePerGas ? <><Detail label="Max fee per gas" value={gwei(fee.maxFeePerGas)}/><Detail label="Priority fee per gas" value={fee.maxPriorityFeePerGas != null ? gwei(fee.maxPriorityFeePerGas) : null}/></> : <Detail label="Gas price" value={fee?.gasPrice != null ? gwei(fee.gasPrice) : null}/>}<Detail label="Highest possible fee" value={maxFeeWei ? `${fmtUnits(maxFeeWei, v.network?.decimals ?? 18)} ${v.symbol}` : null}/></>}
      <label htmlFor="provider-gas">Gas limit</label><input id="provider-gas" inputMode="numeric" value={gas} style={field} onChange={(e) => setGas(e.target.value)}/>
      {Array.isArray(v.assetChanges) && v.assetChanges.length > 0 && <div data-testid="asset-changes" style={{ margin: '10px 0' }}><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Estimated balance changes</div>{v.assetChanges.map((ch: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span>{ch.symbol || `${String(ch.token).slice(0, 8)}…`}</span><span style={{ fontWeight: 700, color: ch.direction === 'out' ? 'var(--hb-danger, #d14343)' : 'var(--hb-success, #2ea36d)' }}>{ch.direction === 'out' ? '−' : '+'}{ch.formatted}</span></div>)}</div>}
      {warnings.map((w) => <Warning key={w}>{warningLabels[w] ?? w}</Warning>)}<Detail label="Simulation error" value={v.simulation?.error}/><details><summary>Transaction data ({v.dataBytes} bytes)</summary><pre style={mono}>{v.data}</pre></details>
    </>}
    {v.kind === 'switchChain' && <><Detail label="Current network" value={v.from?.name}/><Detail label="Requested network" value={v.to?.name}/><Detail label="Requested chain ID" value={v.to?.chainId}/></>}
    {v.kind === 'addChain' && <>{v.alreadyAdded ? <Note>This network is already in your wallet. Approving confirms the site’s request; your saved RPC and selected network stay the same.</Note> : <><Note>This will allow this network to be used within Harbour.</Note><Warning>A site supplied this network. Its RPC operator can observe activity and return misleading data.</Warning></>}<Detail label="Network Name" value={v.network?.name}/>{!v.alreadyAdded && <Note>Name chosen by the site</Note>}<Detail label="RPC URL" value={v.network?.rpcUrl ?? v.network?.rpcs?.[0]}/><Detail label="Chain ID" value={v.network?.chainId}/><Detail label="Token Symbol" value={v.network?.symbol}/><Detail label="Block Explorer" value={v.network?.explorerUrl}/>{v.rpcCheck && <Detail label="RPC chain ID verification" value={v.rpcCheck.ok ? 'Confirmed' : v.rpcCheck.error}/>}</>}
    {v.kind === 'watchAsset' && <><Detail label="Token" value={v.token}/>{!v.token?.verified && <Warning>Token metadata could not be verified on chain.</Warning>}</>}
    {v.multi && v.multi.kind !== 'message' && <><Warning>{v.multi.kind === 'rawTx' ? 'This transaction cannot be decoded here. A signature can move assets.' : 'Review what you are signing. A signature can move assets.'}</Warning>{v.multi.types?.length > 0 && <Detail label="Actions" value={v.multi.types.join(', ')}/>}<Detail label="Details" value={v.multi.detail}/>{v.multi.hex && <details><summary>Data</summary><pre style={mono}>{v.multi.hex}</pre></details>}</>}
    {v.solTransactions && <><Warning>Review all instructions before signing. A signature can transfer assets.</Warning><Detail label="Solana transactions" value={v.solTransactions}/></>}
    {v.bio?.required && <Note>You will be asked to confirm with biometrics before this is signed.</Note>}{bioErr && <Warning>{bioErr}</Warning>}
    {dangerous && <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '18px 0', fontSize: 13 }}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)}/>I reviewed the warnings and understand this request.</label>}
    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}><Btn variant="ghost" disabled={busy || executing} onClick={() => { void resolve({ approve: false }); }}>Reject</Btn><Btn disabled={busy || executing || !!blocked || dangerous && !ack} onClick={() => { void resolve({ approve: true, ...(connect ? { accountIndex: account, chainId: chain } : {}), ...(v.kind === 'tx' ? { gasLimit: gas, ...(fee ? { fee } : {}) } : {}) }); }}>{busy ? 'Processing…' : connect ? 'Connect' : ['sign', 'typed', 'solSignMessage', 'solSignTx', 'solSignAll', 'multiSign'].includes(v.kind) ? 'Sign' : v.kind === 'tx' || v.kind === 'solSignSend' ? 'Confirm' : 'Approve'}</Btn></div>
  </>;
}

const useLoad = (c: Ctx, type: string, extra: any = {}) => {
  const [data, setData] = useState<any>(null); const [error, setError] = useState('');
  const load = async () => { try { const r = await c.bg({ type, ...extra }); if (!r?.ok) throw new Error(r?.error || 'Could not load data.'); setData(r); } catch (e: any) { setError(e.message); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [type, extra.id]);
  return { data, error, setError, load };
};
export const ConnectionsScreen: React.FC<Ctx> = (c) => {
  const { data, error, setError, load } = useLoad(c, 'providerConnections'); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false); const [prefs, setPrefs] = useState<any>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { c.bg({ type: 'providerPrefs' }).then((r) => { if (r.ok) setPrefs(r.prefs); }).catch(() => setError('Could not load default-wallet preference.')); }, []);
  const disconnectAll = async () => { setBusy(true); try { const r = await c.bg({ type: 'providerDisconnectAll' }); if (!r.ok) throw new Error(r.error); setConfirm(false); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return <Screen title="Connections" onBack={c.nav.pop}><Note>Sites can see the public addresses you connect. Disconnecting stops future requests; it does not revoke token allowances.</Note><Group><NavRow first icon="scan" label="WalletConnect" onClick={() => c.nav.push('walletConnect')}/></Group>{prefs && <Group><SwitchRow first icon="wallet" label="Use Harbour as default wallet" sub="Offer Harbour as the injected Ethereum provider on new page loads." on={prefs.defaultWallet} onToggle={() => { void c.bg({ type: 'providerPrefs', defaultWallet: !prefs.defaultWallet }).then((r) => { if (r.ok) setPrefs(r.prefs); else setError(r.error || 'Update failed.'); }).catch(() => setError('Update failed.')); }}/><SwitchRow icon="shield" label="Biometric approval for signatures" sub="Ask for biometrics before signing or sending anything a site requests. Needs biometrics set up." on={!!prefs.biometricApproval} onToggle={() => { void c.bg({ type: 'providerPrefs', biometricApproval: !prefs.biometricApproval }).then((r) => { if (r.ok) setPrefs(r.prefs); else setError(r.error || 'Update failed.'); }).catch(() => setError('Update failed.')); }}/></Group>}<Group><NavRow first icon="shield" label="Blocked sites" onClick={() => c.nav.push('connectionsBlacklist')}/></Group>{data === null ? <Spinner/> : data.items.length === 0 ? <Empty title="No connected sites" sub="Connect Harbour from a dApp to see it here." icon="globe"/> : <>{data.items.map((x: any) => <Row key={x.id} left={<Ic d="globe"/>} title={x.host} sub={`${x.walletName} · ${x.accountName} · ${x.chainName}`} right={<Ic d="chevron"/>} onClick={() => c.nav.push('connectionDetail', { id: x.id })}/>)}{confirm ? <><Warning>Disconnect all {data.items.length} sites?</Warning><Btn disabled={busy} onClick={() => { void disconnectAll(); }}>{busy ? 'Disconnecting…' : 'Disconnect all'}</Btn><Btn variant="ghost" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>Cancel</Btn></> : <Btn variant="ghost" style={{ marginTop: 16 }} onClick={() => setConfirm(true)}>Disconnect all</Btn>}</>}<ErrorLine msg={error}/></Screen>;
};
export const BlacklistScreen: React.FC<Ctx> = (c) => {
  const { data, error, setError, load } = useLoad(c, 'providerBlacklist'); const [origin, setOrigin] = useState(''); const [busy, setBusy] = useState(false);
  const mutate = async (m: any) => { setBusy(true); setError(''); try { const r = await c.bg(m); if (!r?.ok) throw new Error(r?.error || 'Update failed.'); setOrigin(''); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return <Screen title="Blocked sites" onBack={c.nav.pop}><Note>Blocked sites cannot connect or request signatures. Adding a site also disconnects it.</Note><div><label htmlFor="blocked-site">Site address</label><input id="blocked-site" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="https://example.com" style={field}/><Btn disabled={busy || !origin.trim()} onClick={() => { void mutate({ type: 'providerBlacklistAdd', origin }); }}>Block site</Btn></div><ErrorLine msg={error}/>{data === null ? <Spinner/> : data.items.length === 0 ? <Empty title="No blocked sites" icon="shield"/> : data.items.map((x: any) => <div key={x.id} style={{ marginTop: 16 }}><Detail label="Blocked origin" value={x.origin}/><Btn variant="ghost" disabled={busy} onClick={() => { void mutate({ type: 'providerBlacklistRemove', id: x.id }); }}>Unblock {x.host}</Btn></div>)}</Screen>;
};
export const ConnectionDetailScreen: React.FC<Ctx> = (c) => {
  const { data, error, setError, load } = useLoad(c, 'providerConnection', { id: c.params?.id }); const [busy, setBusy] = useState(false); const x = data?.item;
  const setChain = async (chainId: number) => { setBusy(true); setError(''); try { const r = await c.bg({ type: 'providerSetChain', id: x.id, chainId }); if (!r?.ok) throw new Error(r?.error || 'Update failed.'); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const action = async (type: string) => { setBusy(true); setError(''); try { const r = await c.bg({ type, id: x.id, origin: x.origin }); if (!r?.ok) throw new Error(r?.error || 'Update failed.'); c.nav.pop(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return <Screen title="Connection details" onBack={c.nav.pop}>{!x ? !error && <Spinner/> : <><Detail label="Site" value={x.title}/><Detail label="Origin" value={x.origin}/><Detail label="Wallet" value={x.walletName}/><Detail label="Account" value={x.accountName}/><Detail label="Ethereum address" value={x.evmAddress}/><Detail label="Solana address" value={x.solanaAddress}/>{x.namespaces?.includes?.('evm') && data?.networks ? <><label htmlFor="conn-chain">Network</label><select id="conn-chain" style={field} value={x.chainId} disabled={busy} onChange={(e) => { void setChain(Number(e.target.value)); }}>{data.networks.map((n: any) => <option key={n.chainId} value={n.chainId}>{n.name}{n.testnet ? ' · Testnet' : ''}</option>)}</select></> : <Detail label="Network" value={x.chainName}/>}<Detail label="Permissions" value={x.namespaces}/><Detail label="Connected" value={new Date(x.connectedAt).toLocaleString()}/><Detail label="Last used" value={new Date(x.lastUsedAt).toLocaleString()}/><Note>Disconnecting does not cancel on-chain token approvals or transactions already submitted.</Note><Btn disabled={busy} onClick={() => { void action('providerDisconnect'); }}>Disconnect</Btn><Btn disabled={busy} variant="ghost" style={{ marginTop: 10 }} onClick={() => { void action('providerBlacklistAdd'); }}>Block site and disconnect</Btn></>}<ErrorLine msg={error}/></Screen>;
};
export const SCREENS_provider: Record<string, React.FC<Ctx>> = { connections: ConnectionsScreen, connectionsBlacklist: BlacklistScreen, connectionDetail: ConnectionDetailScreen };


// Only allowances Harbour has actually tracked are listed; every row is re-read on chain.
export function TokenApprovalsPanel({ send = bg }: { send?: Ctx['bg'] }) {
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState(''); const [selected, setSelected] = useState<any>(null); const [busy, setBusy] = useState(false); const [hash, setHash] = useState('');
  const load = async () => { setError(''); try { const r = await send({ type: 'providerApprovals' }); if (!r?.ok) throw new Error(r?.error || 'Could not load allowances.'); setItems(r.items ?? []); } catch (e: any) { setError(e.message); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  const revoke = async () => {
    if (!selected || busy) return; setBusy(true); setError('');
    try { const r = await send({ type: 'providerRevoke', id: selected.id }); if (!r?.ok) throw new Error(r?.locked ? 'Unlock your wallet before revoking.' : r?.error || 'Revocation failed.'); setHash(r.hash ?? ''); setSelected(null); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <><Note>Token allowances granted through Harbour, checked on chain. Other allowances may exist. Disconnecting a site does not revoke its allowances.</Note><Btn variant="ghost" disabled={busy} onClick={() => { void load(); }}>Refresh allowances</Btn>
    {items === null ? <div style={{ padding: 20 }}><Spinner/></div> : items.length === 0 ? <Empty title="No tracked token approvals" sub="Allowances granted through Harbour appear here after they are confirmed on chain." icon="shield"/> : items.map((a) => <div key={a.id} style={{ borderBottom: `1px solid ${T.border}`, padding: '12px 0' }}><strong>{a.symbol} · {a.chainName}</strong><Detail label="Spender" value={a.spender}/><Detail label="Token contract" value={a.token}/><Detail label="Allowance" value={a.unavailable ? 'On-chain check unavailable' : a.unlimited ? 'Unlimited' : a.formatted}/>{a.host && <Detail label="Site" value={a.host}/>}<Btn variant="ghost" disabled={busy || a.unavailable} onClick={() => setSelected(a)}>Review revocation</Btn></div>)}
    {hash && <Note>Revocation submitted. Transaction hash: <span style={mono}>{hash}</span>. Confirmation is still required on chain.</Note>}<ErrorLine msg={error}/>
    {selected && <Sheet title="Revoke token allowance" onClose={() => { if (!busy) setSelected(null); }}><Detail label="Network" value={selected.chainName}/><Detail label="Token" value={selected.token}/><Detail label="Owner" value={selected.owner}/><Detail label="Spender" value={selected.spender}/><Warning>This submits an on-chain transaction setting this spender’s allowance to zero. A network fee is required. The background estimates the fee before signing; final fee depends on network conditions.</Warning><ErrorLine msg={error}/><Btn disabled={busy} onClick={() => { void revoke(); }}>{busy ? 'Submitting…' : 'Confirm revocation'}</Btn><Btn variant="ghost" disabled={busy} style={{ marginTop: 8 }} onClick={() => setSelected(null)}>Cancel</Btn></Sheet>}
  </>;
}
export function TokenApprovalsSurface() {
  injectStyles(); useEffect(() => { void refreshSettings(bg); }, []);
  return <div className="hb-root" style={{ position: 'relative', minHeight: '100dvh', background: T.bg, color: T.text, fontFamily: 'Inter, system-ui, sans-serif' }}><Screen title="Token approvals" onBack={() => { window.location.hash = '/'; }}><TokenApprovalsPanel/></Screen></div>;
}
