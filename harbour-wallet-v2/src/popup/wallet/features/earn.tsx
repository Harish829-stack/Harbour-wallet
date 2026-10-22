// Earn / native staking screens. Flow follows Trust Wallet v26.41.0 (evidences/re-evidence/34-staking/SPEC.md): Staking list -> asset staking
// details (staked, APR, delegations, actions) -> Stake / Unstake / Redelegate / Compound / Claim -> confirm -> result.
// Data: public validators lists + chain RPC via the background `earn*` messages. No static / sample values.
import React, { useCallback, useEffect, useState } from 'react';
import { T } from '../../theme';
import { bg } from '../../api';
import { Screen, Row, Btn, Coin, Empty, Skeleton, Sheet, Ic, ICON, SuccessCheck, Spinner } from '../ui';
import type { Ctx, Nav } from '../screens';
import type { StakeListItem, Position, StakeAction } from '../../../core/staking/types';
import { fmtRaw, pctText, remaining, notifyEarnChanged, onEarnChanged, ValidatorAvatar, ValidatorSheet, Notice, type ValidatorView } from './earnParts';

const short = (a?: string) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a ?? '');
const ACTION_TITLE: Record<StakeAction, string> = { stake: 'Stake', unstake: 'Unstake', redelegate: 'Redelegate', compound: 'Compound', claim: 'Claim', withdraw: 'Withdraw' };
const ACTION_CTA: Record<StakeAction, string> = { stake: 'Stake now', unstake: 'Unstake now', redelegate: 'Redelegate now', compound: 'Compound now', claim: 'Claim now', withdraw: 'Withdraw now' };
const subtle: React.CSSProperties = { fontSize: 12, color: T.sub };

// ---------------------------------------------------------------- list (Home "Earn" tab + `staking` screen)
function useStakingList() {
  const [state, setState] = useState<{ items: StakeListItem[] | null; error?: string; stale?: boolean; unavailable?: string; loading: boolean }>({ items: null, loading: true });
  const load = useCallback((refresh = false) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    bg({ type: 'earnList', refresh }).then((r) => {
      if (r?.ok) setState({ items: r.items, stale: !!r.stale, loading: false, error: r.stale ? r.error : undefined });
      else if (r?.code === 'hardware' || r?.code === 'unsupported_wallet' || r?.code === 'no_wallet') setState({ items: [], unavailable: r.error, loading: false });
      else setState((s) => ({ ...s, loading: false, error: r?.error ?? 'Request failed' }));
    }).catch((e) => setState((s) => ({ ...s, loading: false, error: String(e?.message ?? e) })));
  }, []);
  useEffect(() => { load(false); return onEarnChanged(() => load(true)); }, [load]);
  return { ...state, load };
}

const StakingListBody: React.FC<{ nav: Nav }> = ({ nav }) => {
  const { items, error, stale, unavailable, loading, load } = useStakingList();
  const open = (chainId: string) => nav.push('stakingDetails', { chainId });
  if (unavailable) return <Empty title="Earn is not available" sub={unavailable} icon="shield" />;
  if (items === null && !error) return (
    <div role="status" aria-label="Loading staking options" data-testid="earn-staking-list-loading">
      {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}><Skeleton w={40} h={40} r={999} /><div style={{ flex: 1 }}><Skeleton w={110} h={13} /><div style={{ height: 6 }} /><Skeleton w={70} h={11} /></div><Skeleton w={50} h={14} /></div>)}
    </div>
  );
  if (items === null) return (
    <div data-testid="earn-staking-list-error" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ marginBottom: 14 }}>We couldn’t load staking options. Please try again.</div>
      <div style={{ maxWidth: 200, margin: '0 auto' }}><Btn onClick={() => load(true)}>Retry</Btn></div>
      <div style={{ ...subtle, marginTop: 10 }}>{error}</div>
    </div>
  );
  if (!items.length) return <Empty title="No staking available for the current wallet" icon="leaf" />;
  const anyOk = items.some((i) => !i.error);
  return (
    <div data-testid="earn-staking-list-content">
      {(stale || (error && anyOk)) && <Notice action={{ label: 'Retry', onClick: () => load(true) }}>Couldn’t refresh rates. Showing recent data.</Notice>}
      <div style={{ ...subtle, margin: '4px 0 8px' }}>APRs shown are variable, derived from public network data, and are not guaranteed. Staked funds may be locked while unbonding.</div>
      {items.map((it) => (
        <Row key={it.chainId} onClick={() => open(it.chainId)}
          left={<Coin sym={it.symbol} assetId={it.chainId} size={40} />}
          title={it.name}
          sub={it.error ? <span style={{ color: T.error }}>Couldn’t load · tap to retry</span> : BigInt(it.staked || '0') > 0n ? `Staked ${fmtRaw(it.staked, it.decimals)} ${it.symbol}` : it.symbol}
          right={<span style={{ color: it.apr != null ? T.accent : T.sub, fontWeight: 700 }}>{pctText(it.apr)}</span>} rightSub={BigInt(it.rewards || '0') > 0n ? `+${fmtRaw(it.rewards, it.decimals, 4)} ${it.symbol}` : 'APR'} />
      ))}
      {loading && <div style={{ textAlign: 'center', padding: 10 }}><Spinner size={18} /></div>}
    </div>
  );
};
/** Home bottom-tab body (replaces the old static "Native Staking" card). */
export const EarnTab: React.FC<{ nav: Nav }> = ({ nav }) => (
  <>
    <h2 style={{ fontSize: 22, margin: '8px 0 12px', textAlign: 'center' }}>Native Staking</h2>
    <StakingListBody nav={nav} />
  </>
);
const StakingListScreen: React.FC<Ctx> = (c) => <Screen title="Native Staking" onBack={c.nav.pop}><StakingListBody nav={c.nav} /></Screen>;

// ---------------------------------------------------------------- details
interface Details { def: any; overview: any; validators: ValidatorView[]; validatorsSource: string; balance: string; reserve: string; address: string }
function useDetails(chainId: string, skip = false) {
  const [d, setD] = useState<Details | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    if (skip) return;
    setErr(null); setD(null);
    bg({ type: 'earnDetails', chainId }).then((r) => (r?.ok ? setD(r as Details) : setErr(r?.error ?? 'Request failed'))).catch((e) => setErr(String(e?.message ?? e)));
  }, [chainId, skip]);
  useEffect(() => { load(); return onEarnChanged(load); }, [load]);
  return { d, err, load };
}
const StatRow: React.FC<{ label: string; value: React.ReactNode; warn?: boolean }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}><span style={{ color: T.sub, fontWeight: 600 }}>{label}</span><span style={{ fontWeight: 600, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span></div>
);
const ActionRow: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <div role="button" tabIndex={0} className="hb-tap" onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', color: T.accent, fontWeight: 700 }}>{label}<Ic d={ICON.chevron} size={18} /></div>
);
const statusText = (p: Position): string => ({ active: 'Active', activating: 'Activating', deactivating: 'Deactivating', inactive: 'Ready to withdraw', unbonding: 'Unbonding', claimable: 'Ready to claim' } as const)[p.status];

const StakingDetailsScreen: React.FC<Ctx> = (c) => {
  const chainId: string = c.params?.chainId; const { d, err, load } = useDetails(chainId);
  const [sheet, setSheet] = useState<Position | null>(null);
  const go = (action: StakeAction, extra: Record<string, unknown> = {}) => { setSheet(null); c.nav.push('stakeAction', { chainId, action, details: d, ...extra }); };
  const title = d ? `${d.overview.symbol}` : 'Staking';
  if (err) return <Screen title="Staking" onBack={c.nav.pop}><div data-testid="earn-staking-details-error" style={{ textAlign: 'center', padding: '40px 20px' }}><div style={{ marginBottom: 14 }}>We couldn’t load staking details. Please try again.</div><div style={{ maxWidth: 200, margin: '0 auto' }}><Btn onClick={load}>Retry</Btn></div><div style={{ ...subtle, marginTop: 10 }}>{err}</div></div></Screen>;
  if (!d) return <Screen title={title} onBack={c.nav.pop}><div role="status" aria-label="Loading"><div style={{ background: T.bgAlt, borderRadius: 16, padding: 16 }}>{[0, 1, 2, 3].map((i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><Skeleton w={90} h={14} /><Skeleton w={80} h={14} /></div>)}</div><div style={{ height: 14 }} /><Skeleton w={120} h={16} /><div style={{ height: 10 }} /><Skeleton w="100%" h={44} /></div></Screen>;
  const o = d.overview; const sym: string = o.symbol; const dec: number = o.decimals; const positions: Position[] = o.positions;
  const has = (v: string) => BigInt(v || '0') > 0n;
  const stakedPositions = positions.filter((p) => p.status === 'active' || p.status === 'activating');
  const withdrawables = positions.filter((p) => p.status === 'inactive' || p.status === 'claimable');
  const rowActions = (p: Position): Array<[StakeAction, string]> => {
    const f = d.def.family; const out: Array<[StakeAction, string]> = [];
    if (p.status === 'active' || p.status === 'activating') {
      if (f === 'solana') out.push(['unstake', 'Unstake']); else { out.push(['unstake', 'Unstake']); if (d.def.supportsRedelegate && p.status === 'active') out.push(['redelegate', 'Redelegate']); }
      if (d.def.claimableRewards && has(p.rewards ?? '0')) { out.push(['claim', 'Claim rewards']); if (COMPOUNDS.includes(f)) out.push(['compound', 'Compound']); }
    } else if (p.status === 'inactive') out.push(['withdraw', 'Withdraw']);
    else if (p.status === 'claimable') out.push(['claim', 'Claim']);
    return out;
  };
  return (
    <Screen title={`${o.symbol} Staking`} onBack={c.nav.pop} right={<button className="hb-tap" aria-label="Refresh" title="Refresh" onClick={load} style={{ background: 'none', border: 'none', color: T.sub, cursor: 'pointer' }}><Ic d={ICON.refresh} size={20} /></button>}>
      <div className="hb-rise" style={{ background: T.bgAlt, borderRadius: 16, padding: '10px 16px', margin: '4px 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 8px' }}><Coin sym={sym} assetId={chainId} size={36} /><div><div style={{ fontWeight: 800 }}>{c.params?.name ?? d.def.protocol}</div><div style={subtle}>{d.def.protocol}</div></div></div>
        <StatRow label="Staked" value={`${fmtRaw(o.staked, dec)} ${sym}`} />
        {has(o.rewards) && <StatRow label="Rewards" value={`${fmtRaw(o.rewards, dec, 6)} ${sym}`} />}
        {has(o.unbonding) && <StatRow label="Unbonding" value={`${fmtRaw(o.unbonding, dec)} ${sym}`} />}
        {has(o.claimable) && <StatRow label="Available to withdraw" value={`${fmtRaw(o.claimable, dec)} ${sym}`} />}
        <StatRow label="Available" value={`${fmtRaw(d.balance, dec)} ${sym}`} />
        <StatRow label="Minimum Amount" value={`${fmtRaw(d.def.minStake, dec)} ${sym}`} />
        <StatRow label="APR" value={pctText(o.apr)} />
        <StatRow label="Unstaking period" value={d.def.lockDays ? `${d.def.lockDays} days` : 'Varies'} />
      </div>
      {d.validatorsSource === 'snapshot' && <Notice>Validator list is from an offline snapshot (couldn’t reach the latest list).</Notice>}
      <div>
        <ActionRow label="Stake" onClick={() => go('stake')} />
        {stakedPositions.length > 0 && <ActionRow label="Unstake" onClick={() => go('unstake')} />}
        {d.def.supportsRedelegate && stakedPositions.length > 0 && <ActionRow label="Redelegate" onClick={() => go('redelegate')} />}
        {COMPOUNDS.includes(d.def.family) && has(o.rewards) && <ActionRow label="Compound" onClick={() => go('compound')} />}
        {d.def.claimableRewards && has(o.rewards) && <ActionRow label="Claim" onClick={() => go('claim')} />}
        {withdrawables.length > 0 && <ActionRow label={d.def.family === 'solana' ? 'Withdraw' : 'Claim'} onClick={() => setSheet(withdrawables[0])} />}
      </div>
      <div style={{ fontWeight: 800, margin: '18px 0 4px' }}>Delegations</div>
      {positions.length === 0 ? <Empty title="You have no active stake" sub={`Stake ${sym} to start earning rewards.`} icon="leaf" /> : positions.map((p) => {
        const acts = rowActions(p);
        return (
          <div key={p.id} role={acts.length ? 'button' : undefined} tabIndex={acts.length ? 0 : undefined} className={acts.length ? 'hb-tap' : ''} onClick={() => acts.length && setSheet(p)} onKeyDown={(e) => { if (acts.length && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSheet(p); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${T.border}`, cursor: acts.length ? 'pointer' : 'default' }}>
            <ValidatorAvatar chainId={chainId} id={p.validatorId} name={p.validatorName ?? '?'} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.validatorName ?? short(p.validatorId) ?? 'Validator'}</div>
              <div style={subtle}>{statusText(p)}{p.availableAt ? ` · Remaining: ${remaining(p.availableAt)}` : ''}{d.def.family === 'solana' ? ` · ${short(p.id)}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600 }}>{fmtRaw(p.amount, dec)} {sym}</div>
              {has(p.rewards ?? '0') && <div style={subtle}>+{fmtRaw(p.rewards, dec, 6)}</div>}
              {p.apr != null && p.status === 'active' && <div style={subtle}>APR {pctText(p.apr)}</div>}
            </div>
          </div>
        );
      })}
      {sheet && (
        <Sheet title={sheet.validatorName ?? 'Stake'} onClose={() => setSheet(null)}>
          <div style={{ ...subtle, marginBottom: 8 }}>{fmtRaw(sheet.amount, dec)} {sym} · {statusText(sheet)}</div>
          {rowActions(sheet).map(([a, label]) => <ActionRow key={a} label={label} onClick={() => go(a, { validator: sheet.validatorId, positionId: sheet.id })} />)}
        </Sheet>
      )}
    </Screen>
  );
};

// ---------------------------------------------------------------- action form
// Families whose rewards can be restaked in one transaction.
const COMPOUNDS = ['cosmos', 'polkadot'];
// Delegation-style families (Tezos bakers, Cardano pools) move the whole balance: no amount. TRON redelegation moves all votes.
const WHOLE_BALANCE = ['tezos', 'cardano'];
const NEEDS_AMOUNT = (family: string, a: StakeAction) => a === 'stake' ? !WHOLE_BALANCE.includes(family)
  : (a === 'unstake' || a === 'redelegate') && family !== 'solana' && !WHOLE_BALANCE.includes(family) && !(family === 'tron' && a === 'redelegate');
const StakeActionScreen: React.FC<Ctx> = (c) => {
  const { chainId, action, validator: v0, positionId } = c.params as { chainId: string; action: StakeAction; validator?: string; positionId?: string }; const depth: number = c.params?.depth ?? 2;
  const fetched = useDetails(chainId, !!c.params?.details); const d: Details | null = (c.params?.details as Details | undefined) ?? fetched.d;
  const [amount, setAmount] = useState(''); const [max, setMax] = useState(false);
  const [validator, setValidator] = useState<string | undefined>(v0); const [toValidator, setTo] = useState<string | undefined>();
  const [picker, setPicker] = useState<null | 'from' | 'to'>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const family: string = d?.def.family ?? ''; const sym: string = d?.def.symbol ?? ''; const dec: number = d?.def.decimals ?? 18;
  const positions: Position[] = d?.overview.positions ?? [];
  const vmap = new Map((d?.validators ?? []).map((v) => [v.id, v]));
  // Validator choice defaults
  useEffect(() => {
    if (!d) return;
    if (action === 'stake' && !validator) { const f = d.validators.find((v) => v.active); if (f) setValidator(f.id); }
    if ((action === 'unstake' || action === 'redelegate') && !validator && family !== 'solana') { const p = positions.find((x) => x.status === 'active'); if (p) setValidator(p.validatorId); }
    if (action === 'redelegate' && !toValidator) { const f = d.validators.find((v) => v.active && v.id !== validator); if (f) setTo(f.id); }
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Screen title={ACTION_TITLE[action]} onBack={c.nav.pop}>{fetched.err ? <Notice tone="error" action={{ label: 'Retry', onClick: fetched.load }}>{fetched.err}</Notice> : <div role="status"><Skeleton w="100%" h={56} /></div>}</Screen>;

  const position = positions.find((p) => p.id === positionId);
  const owned = positions.filter((p) => p.status === 'active');
  const sourceViews: ValidatorView[] = owned.map((p) => ({ id: p.validatorId, name: p.validatorName ?? short(p.validatorId), apr: p.apr ?? null, active: true, commission: vmap.get(p.validatorId)?.commission ?? null, staked: p.amount }));
  const allViews: ValidatorView[] = d.validators.map((v: any) => ({ id: v.id, name: v.name, apr: v.apr, active: v.active, commission: v.commission, staked: owned.find((p) => p.validatorId === v.id)?.amount }));
  const needAmount = NEEDS_AMOUNT(family, action);
  const ownedAmt = (id?: string) => owned.find((p) => p.validatorId === id)?.amount ?? '0';
  const maxRaw = (): bigint => {
    if (action === 'stake') { const b = BigInt(d.balance || '0') - BigInt(d.reserve || '0'); return b > 0n ? b : 0n; }
    return BigInt(ownedAmt(validator));
  };
  const setMaxAmount = () => {
    const m = maxRaw(); setMax(action !== 'stake'); setErr(null);
    const s = m.toString().padStart(dec + 1, '0'); const w = s.slice(0, -dec) || '0'; const f = s.slice(-dec).replace(/0+$/, ''); setAmount(f ? `${w}.${f}` : w);
  };
  const onAmount = (v: string) => {
    const clean = v.replace(',', '.').replace(/[^0-9.]/g, ''); const parts = clean.split('.');
    if (parts.length > 2 || (parts[1]?.length ?? 0) > dec) return; setMax(false); setErr(null); setAmount(clean);
  };
  const rewardsTotal = BigInt(d.overview.rewards || '0');
  const needsValidator = action === 'stake' || ((action === 'unstake' || action === 'redelegate') && family !== 'solana' && !(family === 'tron' && action === 'unstake'));
  const ready = (!needAmount || (Number(amount) > 0)) && (!needsValidator || !!validator) && (action !== 'redelegate' || !!toValidator) && (!(family === 'solana' && (action === 'unstake' || action === 'withdraw')) || !!position);
  const next = async () => {
    setBusy(true); setErr(null);
    const req = { chainId, action, amount: needAmount ? amount : undefined, max, validator: action === 'claim' || action === 'compound' ? undefined : validator, toValidator, positionId };
    const r = await bg({ type: 'earnPrepare', ...req }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    if (r?.ok) c.nav.push('stakeConfirm', { req, summary: r.summary, depth }); else setErr(r?.error ?? 'Could not prepare the transaction');
  };
  const field: React.CSSProperties = { background: T.bgAlt, borderRadius: 16, padding: '12px 14px', margin: '10px 0' };
  const vRow = (label: string, id: string | undefined, which: 'from' | 'to') => {
    const v = id ? vmap.get(id) : undefined; const name = v?.name ?? owned.find((p) => p.validatorId === id)?.validatorName ?? (id ? short(id) : 'Select validators');
    return (
      <div style={{ margin: '10px 0' }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
        <div role="button" tabIndex={0} className="hb-tap" data-testid={`stake-validator-${which}`} onClick={() => setPicker(which)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicker(which); } }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bgAlt, borderRadius: 16, padding: '10px 14px', cursor: 'pointer' }}>
          {id && <ValidatorAvatar chainId={chainId} id={id} name={name} size={32} />}
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>{v && <div style={subtle}>APR {pctText(v.apr)}</div>}</div>
          <Ic d={ICON.chevron} size={18} />
        </div>
      </div>
    );
  };
  return (
    <Screen title={action === 'claim' ? `Claim ${sym}` : `${ACTION_TITLE[action]}${action === 'stake' || action === 'unstake' ? ' ' + sym : ''}`} onBack={c.nav.pop}>
      {needAmount && (
        <div style={field}>
          <div style={{ ...subtle, marginBottom: 2 }}>Amount</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input data-testid="stake-amount" aria-label="Amount" value={amount} onChange={(e) => onAmount(e.target.value)} placeholder="0" inputMode="decimal" autoFocus style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 24, fontWeight: 700, color: T.text }} />
            <span style={{ fontWeight: 700, color: T.sub }}>{sym}</span>
            <button className="hb-tap" onClick={setMaxAmount} style={{ background: T.accentSoft, color: T.accent, border: 'none', borderRadius: 999, padding: '6px 12px', fontWeight: 800, cursor: 'pointer' }}>MAX</button>
          </div>
          <div style={{ ...subtle, marginTop: 4 }}>{action === 'stake' ? `Available ${fmtRaw(d.balance, dec)} ${sym}` : `Staked with this validator ${fmtRaw(ownedAmt(validator), dec)} ${sym}`}{action === 'stake' ? ` · Minimum ${fmtRaw(d.def.minStake, dec)} ${sym}` : ''}</div>
        </div>
      )}
      {(action === 'claim' || action === 'compound') && (
        <div style={field}><div style={subtle}>Rewards to {action}</div><div style={{ fontSize: 24, fontWeight: 800 }}>{fmtRaw(rewardsTotal, dec, 6)} {sym}</div></div>
      )}
      {family === 'solana' && position && (
        <div style={field}><div style={subtle}>{action === 'withdraw' ? 'Withdraw stake account' : 'Deactivate stake account'} · {short(position.id)}</div><div style={{ fontSize: 24, fontWeight: 800 }}>{fmtRaw(position.amount, dec)} {sym}</div><div style={subtle}>{position.validatorName ?? short(position.validatorId)}</div></div>
      )}
      {family === 'solana' && !position && (action === 'unstake' || action === 'withdraw') && (
        <>
          <div style={{ fontWeight: 600, margin: '10px 0 4px' }}>Choose a stake account</div>
          {positions.filter((p) => (action === 'unstake' ? p.status === 'active' || p.status === 'activating' : p.status === 'inactive')).map((p) => (
            <Row key={p.id} onClick={() => c.nav.push('stakeAction', { chainId, action, details: d, positionId: p.id, validator: p.validatorId, depth: depth + 1 })} left={<ValidatorAvatar chainId={chainId} id={p.validatorId} name={p.validatorName ?? '?'} />} title={p.validatorName ?? short(p.validatorId)} sub={short(p.id)} right={`${fmtRaw(p.amount, dec)} ${sym}`} />
          ))}
          {!positions.some((p) => (action === 'unstake' ? p.status === 'active' || p.status === 'activating' : p.status === 'inactive')) && <Empty title={action === 'unstake' ? 'No active stake' : 'Nothing to withdraw yet'} icon="leaf" />}
        </>
      )}
      {needsValidator && (action === 'unstake' || action === 'redelegate') && owned.length === 0 && <Empty title="You have no active stake" icon="leaf" />}
      {needsValidator && vRow(action === 'redelegate' ? 'From validator' : 'Validators', validator, 'from')}
      {action === 'redelegate' && vRow('To validator', toValidator, 'to')}
      {err && <Notice tone="error">{err}</Notice>}
      <div style={{ marginTop: 14 }}><Btn disabled={!ready || busy} onClick={next}>{busy ? 'Checking…' : ACTION_CTA[action]}</Btn></div>
      {picker && (
        <ValidatorSheet chainId={chainId} symbol={sym} decimals={dec} onClose={() => setPicker(null)}
          validators={picker === 'from' && (action === 'unstake' || action === 'redelegate') ? sourceViews : allViews}
          selected={picker === 'from' ? validator : toValidator} showStaked={action === 'unstake' || action === 'redelegate'}
          exclude={picker === 'to' ? validator : undefined}
          onPick={(id) => { if (picker === 'from') { setValidator(id); if (id === toValidator) setTo(undefined); } else setTo(id); setPicker(null); setErr(null); setMax(false); }} />
      )}
    </Screen>
  );
};

// ---------------------------------------------------------------- confirm / result
const StakeConfirmScreen: React.FC<Ctx> = (c) => {
  const { req, summary } = c.params as { req: any; summary: any }; const s = summary; const depth: number = c.params?.depth ?? 2;
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ hash: string; explorerUrl?: string } | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    const r = await bg({ type: 'earnSubmit', ...req }).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    if (r?.ok) { setDone({ hash: r.hash, explorerUrl: r.explorerUrl }); notifyEarnChanged(); } else setErr(r?.error ?? 'Transaction failed');
  };
  const leave = () => { for (let i = 0; i < depth + 1 - 1; i++) c.nav.pop(); }; // confirm + the action screen(s) -> back on the details screen
  if (done) return (
    <Screen title={ACTION_TITLE[s.action as StakeAction]} onBack={leave}>
      <div className="hb-rise" style={{ textAlign: 'center', paddingTop: 30 }}>
        <SuccessCheck />
        <div style={{ fontSize: 20, fontWeight: 800, margin: '14px 0 4px' }}>Transaction submitted</div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 12 }}>It may take a moment to be confirmed on the network. Balances update shortly.</div>
        <div style={{ ...subtle, wordBreak: 'break-all', marginBottom: 14 }}>{done.hash}</div>
        {done.explorerUrl && <a href={done.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>View on explorer <Ic d={ICON.external} size={16} /></a>}
        <Btn onClick={leave}>Done</Btn>
      </div>
    </Screen>
  );
  const amt = BigInt(s.amount || '0');
  return (
    <Screen title="Confirm" onBack={c.nav.pop}>
      <div className="hb-rise" style={{ textAlign: 'center', margin: '6px 0 14px' }}>
        <Coin sym={s.symbol} assetId={s.chainId} size={48} />
        <div style={{ fontSize: 13, color: T.sub, marginTop: 6 }}>{ACTION_TITLE[s.action as StakeAction]}</div>
        {amt > 0n && <div style={{ fontSize: 26, fontWeight: 800 }} data-testid="stake-confirm-amount">{fmtRaw(s.amount, s.decimals, 8)} {s.symbol}</div>}
      </div>
      <div style={{ background: T.bgAlt, borderRadius: 16, padding: '8px 16px' }}>
        <StatRow label="Network" value={s.chainId} />
        <StatRow label="From" value={short(s.address)} />
        {s.validatorName && <StatRow label={s.toValidatorId ? 'From validator' : 'Validator'} value={s.validatorName} />}
        {s.toValidatorName && <StatRow label="To validator" value={s.toValidatorName} />}
        {s.steps > 1 && <StatRow label="Transactions" value={`${s.steps} (approval, then request)`} />}
        <StatRow label={s.feeExact ? 'Network fee' : 'Network fee (estimate)'} value={`${fmtRaw(s.fee, s.feeDecimals, 8)} ${s.feeSymbol}`} />
      </div>
      {s.notes.map((n: string, i: number) => <div key={i} style={{ ...subtle, margin: '8px 4px 0' }}>{n}</div>)}
      {err && <Notice tone="error">{err}</Notice>}
      <div style={{ marginTop: 16 }}><Btn disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Confirm'}</Btn></div>
    </Screen>
  );
};

export const SCREENS_earn: Record<string, React.FC<Ctx>> = { staking: StakingListScreen, stakingDetails: StakingDetailsScreen, stakeAction: StakeActionScreen, stakeConfirm: StakeConfirmScreen };
