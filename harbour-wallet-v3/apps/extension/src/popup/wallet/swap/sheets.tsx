import React, { useState } from 'react';
import { T } from '../../theme';
import { bg } from '../../api';
import { Sheet, Ic, ICON } from '../ui';
import type { SwapAsset, SwapRoute, SwapSettings, SwapSortBy } from '../../../core/swap/types';
import { SLIPPAGE_PRESETS, stepSlippage, normalizeSlippage, acceptSlippageInput, isHighSlippage, SLIPPAGE_STEP } from '../../../core/swap/rules';
import { fromAtomic, fmtToken } from '../../../core/swap/amount';
import { setSwap, useSwapStore } from './swapStore';
import { Toggle, AssetLogo } from './parts';
import { domainById } from '../../../core/swap/domains';

async function save(patch: Partial<SwapSettings>) {
  const r = await bg({ type: 'swapSetSettings', patch }).catch(() => null);
  if (r?.ok) setSwap({ settings: r.settings });
}

const Row: React.FC<{ title: string; desc: string; on: boolean; onChange: (v: boolean) => void; testid: string; warn?: string }> = ({ title, desc, on, onChange, testid, warn }) => (
  <div style={{ padding: '12px 0', borderTop: `1px solid ${T.border}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div><div style={{ fontSize: 12, color: T.sub, marginTop: 2, lineHeight: 1.4 }}>{desc}</div></div>
      <Toggle on={on} onChange={onChange} label={title} testid={testid} />
    </div>
    {warn && on && <div style={{ color: 'var(--hb-warn-ink)', background: 'var(--hb-warn-bg)', borderRadius: 10, padding: '8px 10px', fontSize: 12, marginTop: 8 }}>{warn}</div>}
  </div>
);

// TW SettingsModal: slippage stepper (±0.1, ≤30), presets 0.1/0.5/1.0/2.5, >5% warning, plus the
// swap settings flags (mev, solanaTurboSwaps, unlimitedAllowance).
export const SwapSettingsSheet: React.FC<{ onClose: () => void; fromDomainId?: string }> = ({ onClose, fromDomainId }) => {
  const { settings, gaslessAvailable } = useSwapStore();
  const [draft, setDraft] = useState(settings.slippage);
  const commit = (v: string) => { const n = normalizeSlippage(v); setDraft(n); if (n !== settings.slippage) void save({ slippage: n }); };
  return (
    <Sheet title="Swap settings" onClose={onClose}>
      <div style={{ paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Slippage tolerance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" data-testid="slippage-decrement" aria-label="Decrease slippage" onClick={() => commit(stepSlippage(draft, -SLIPPAGE_STEP))} style={stepBtn}>−</button>
            <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              <input data-testid="slippage-input" aria-label="Slippage tolerance" value={draft} inputMode="decimal" size={Math.max(draft.length, 1)}
                onChange={(e) => setDraft((p) => acceptSlippageInput(p, e.target.value))} onBlur={() => commit(draft)} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                style={{ border: 0, background: 'transparent', textAlign: 'right', fontWeight: 700, fontSize: 15, outline: 'none', minWidth: '1ch', color: T.text }} />
              <span style={{ fontWeight: 700, fontSize: 15 }}>%</span>
            </span>
            <button type="button" data-testid="slippage-increment" aria-label="Increase slippage" onClick={() => commit(stepSlippage(draft, SLIPPAGE_STEP))} style={stepBtn}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {SLIPPAGE_PRESETS.map((p) => {
            const active = Number(settings.slippage) === Number(p);
            return <button key={p} type="button" data-testid={`slippage-preset-${p}`} onClick={() => commit(p)} style={{ flex: 1, padding: '8px 0', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: active ? T.accent : T.bgAlt, color: active ? 'var(--hb-on-brand)' : T.text }}>{p}%</button>;
          })}
        </div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 8, lineHeight: 1.4 }}>A higher slippage tolerance can help transactions succeed, but it might lower the minimum received amount.</div>
        {isHighSlippage(draft) && <div style={{ color: 'var(--hb-warn-ink)', background: 'var(--hb-warn-bg)', borderRadius: 10, padding: '8px 10px', fontSize: 12, marginTop: 8 }}>High slippage tolerance — your transaction may be front-run and you could receive significantly less.</div>}
      </div>
      <Row testid="setting-mev" title="Best price execution" on={settings.mev} onChange={(v) => save({ mev: v })}
        desc="Get fair swap prices by shielding your transactions from MEV. Applies to Ethereum and BNB Smart Chain, where a protected broadcast endpoint is available." />
      <Row testid="setting-solana-turbo" title="Solana turbo swaps" on={settings.solanaTurbo} onChange={(v) => save({ solanaTurbo: v })}
        desc="Control how fast your transactions will land. Turbo costs more SOL, but will also be faster." />
      <Row testid="setting-unlimited-allowance" title="Unlimited allowance" on={settings.unlimitedAllowance} onChange={(v) => save({ unlimitedAllowance: v })}
        desc="Approve a token once and swap any amount later. Off is safer: each swap approves only the amount it spends."
        warn="Unlimited approval is not safe unless you fully trust the contract" />
      {gaslessAvailable && <Row testid="setting-gasless" title="Gasless swaps (beta)" on={settings.gasless} onChange={(v) => save({ gasless: v })}
        desc="Network fees are sponsored on Ethereum, BNB Chain, Polygon, Arbitrum and Base. The first gasless swap upgrades your account with EIP-7702 to the audited Simple7702Account; you can keep using it as a normal account."
        warn="Gasless swaps are in beta. If sponsorship is unavailable, the swap is sent as a normal transaction and you pay the fee." />}
      <DustPanel domainId={fromDomainId && domainById(fromDomainId)?.kind !== 'utxo' ? fromDomainId : 'ethereum'} />
    </Sheet>
  );
};
// Dust cleaner: small token balances on the current network, converted into its native coin one swap at a time.
type Dust = { asset: SwapAsset; balance: string; usd: number };
const DustPanel: React.FC<{ domainId: string }> = ({ domainId }) => {
  const [items, setItems] = useState<Dust[] | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<'scan' | 'convert' | null>(null);
  const [note, setNote] = useState('');
  const d = domainById(domainId);
  const scan = async () => {
    setBusy('scan'); setNote('');
    const r = await bg({ type: 'swapDustScan', domainId }).catch(() => null);
    setBusy(null);
    if (!r?.ok) { setNote(r?.error ?? 'Couldn’t check balances'); return; }
    setItems(r.items); setSel(Object.fromEntries(r.items.map((i: Dust) => [i.asset.assetId, true])));
    if (!r.items.length) setNote('No small balances found on this network.');
  };
  const convert = async () => {
    const assets = (items ?? []).filter((i) => sel[i.asset.assetId]).map((i) => i.asset);
    if (!assets.length) return;
    setBusy('convert'); setNote('');
    const r = await bg({ type: 'swapDustConvert', assets }).catch(() => null);
    setBusy(null);
    const ok = (r?.results ?? []).filter((x: any) => x.ok).length; const failed = (r?.results ?? []).filter((x: any) => !x.ok);
    setNote(`${ok} of ${assets.length} converted to ${d?.nativeSymbol ?? 'native'}.${failed.length ? ` Failed: ${failed.map((x: any) => x.error).join('; ')}` : ''}`);
    if (ok) setItems((prev) => (prev ?? []).filter((i) => !(r.results as any[]).some((x) => x.ok && x.assetId === i.asset.assetId)));
  };
  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${T.border}` }} data-testid="dust-panel">
      <div style={{ fontWeight: 700, fontSize: 14 }}>Clean up small balances</div>
      <div style={{ fontSize: 12, color: T.sub, marginTop: 2, lineHeight: 1.4 }}>Convert tokens worth under $5 on {d?.name ?? 'this network'} into {d?.nativeSymbol ?? 'the native coin'}. Each conversion is a separate swap with its own network fee.</div>
      {items && items.map((i) => (
        <label key={i.asset.assetId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!sel[i.asset.assetId]} onChange={(e) => setSel((p) => ({ ...p, [i.asset.assetId]: e.target.checked }))} data-testid="dust-item" />
          <AssetLogo asset={i.asset} />
          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{i.asset.symbol}</span>
          <span style={{ fontSize: 12.5, color: T.sub }}>{fmtToken(fromAtomic(i.balance, i.asset.decimals), 6)} · ${i.usd.toFixed(2)}</span>
        </label>
      ))}
      {note && <div style={{ fontSize: 12, color: T.sub, marginTop: 8 }} data-testid="dust-note">{note}</div>}
      <button type="button" data-testid={items?.length ? 'dust-convert' : 'dust-scan'} disabled={!!busy || (!!items?.length && !Object.values(sel).some(Boolean))}
        onClick={() => (items?.length ? convert() : scan())}
        style={{ marginTop: 10, width: '100%', padding: '10px 0', borderRadius: 999, border: 'none', cursor: busy ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, background: T.accentSoft, color: T.accent, opacity: busy ? 0.6 : 1 }}>
        {busy === 'scan' ? 'Checking…' : busy === 'convert' ? 'Converting…' : items?.length ? `Convert to ${d?.nativeSymbol ?? 'native'}` : 'Find small balances'}
      </button>
    </div>
  );
};

const stepBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 999, border: 'none', background: T.bgAlt, color: T.text, fontSize: 18, fontWeight: 600, cursor: 'pointer', lineHeight: 1 };

const SORTS: Array<[SwapSortBy, string]> = [['quantity', 'Best price'], ['latency', 'Fastest'], ['security', 'Most secure'], ['outcome', 'Recommended']];
export const ProvidersSheet: React.FC<{ routes: SwapRoute[]; selectedId?: string; onSelect: (id: string) => void; onClose: () => void }> = ({ routes, selectedId, onSelect, onClose }) => {
  const { settings } = useSwapStore();
  return (
    <Sheet title="Providers" onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {SORTS.map(([k, label]) => <button key={k} type="button" onClick={() => save({ sortBy: k })} style={{ border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600, background: settings.sortBy === k ? T.accent : T.bgAlt, color: settings.sortBy === k ? 'var(--hb-on-brand)' : T.text }}>{label}</button>)}
      </div>
      {routes.slice(0, 8).map((r) => {
        const st = r.steps[0]; const sel = r.id === selectedId;
        return (
          <button key={r.id} type="button" data-testid="provider-option" onClick={() => onSelect(r.id)} className="hb-tap"
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '12px', marginBottom: 8, borderRadius: 14, cursor: 'pointer', border: `1.5px solid ${sel ? T.accent : T.border}`, background: T.bg, color: T.text }}>
            {st.provider.logoUrl ? <img src={st.provider.logoUrl} width={30} height={30} alt="" style={{ borderRadius: 8 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} /> : <AssetLogo asset={st.to.asset} size={30} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>{st.provider.name}{r.tags.includes('BEST_RETURN') && <span data-testid="provider-best" style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, background: T.accentSoft, borderRadius: 6, padding: '1px 6px' }}>Best</span>}</div>
              <div style={{ fontSize: 11.5, color: T.sub }}>{[domainById(st.fromDomainId) !== domainById(st.toDomainId) ? 'Cross-chain' : 'Same chain', r.totalSeconds ? `~${r.totalSeconds < 60 ? r.totalSeconds + 's' : Math.round(r.totalSeconds / 60) + ' min'}` : '', ...r.tags.filter((t) => t !== 'BEST_RETURN').slice(0, 2).map((t) => t[0] + t.slice(1).toLowerCase())].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtToken(fromAtomic(st.to.amount, st.to.asset.decimals), 6)}</div>
              <div style={{ fontSize: 11.5, color: T.sub }}>{st.to.asset.symbol}</div>
            </div>
            {sel && <span style={{ color: T.accent }}><Ic d={ICON.check} size={18} /></span>}
          </button>
        );
      })}
    </Sheet>
  );
};
