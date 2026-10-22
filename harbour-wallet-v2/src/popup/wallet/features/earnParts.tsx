// Shared bits for the Earn screens: amount formatting, validator avatar/picker, "changed" event bus.
import { userText } from '../../../core/errors';
import React, { useState } from 'react';
import { T } from '../../theme';
import { Sheet, Ic, ICON, Empty } from '../ui';
import { formatUnits } from '../../../core/chains/adapters/types';
import { stakingAsset } from '../../../core/staking/registry';
import { fmtNumber } from '../../settingsStore';

/** Raw smallest-unit amount -> display string, truncated (never rounded up) to `maxFrac` digits. */
export function fmtRaw(raw: string | bigint | undefined, decimals: number, maxFrac = 6): string {
  let v: bigint; try { v = BigInt(raw ?? '0'); } catch { return '—'; }
  const s = formatUnits(v, decimals); const [w, f = ''] = s.split('.');
  const whole = fmtNumber(Number(w), { maximumFractionDigits: 0 });
  const wholeStr = Number.isSafeInteger(Number(w)) ? whole : w;
  const frac = f.slice(0, maxFrac).replace(/0+$/, '');
  if (v > 0n && wholeStr === '0' && !frac) return '<' + (maxFrac > 0 ? '0.' + '0'.repeat(maxFrac - 1) + '1' : '1');
  return frac ? `${wholeStr}.${frac}` : wholeStr;
}
export const pctText = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(2)}%`);
export function remaining(ms: number | undefined, now = Date.now()): string {
  if (!ms) return ''; const d = ms - now; if (d <= 0) return 'now';
  const m = Math.floor(d / 60000), h = Math.floor(m / 60), days = Math.floor(h / 24);
  return days >= 1 ? `${days}d ${h % 24}h` : h >= 1 ? `${h}h ${m % 60}m` : `${Math.max(1, m)}m`;
}
const EVENT = 'hb-earn-changed';
export const notifyEarnChanged = () => { try { window.dispatchEvent(new Event(EVENT)); } catch { /* no window */ } };
export function onEarnChanged(fn: () => void): () => void { window.addEventListener(EVENT, fn); return () => window.removeEventListener(EVENT, fn); }

export const ValidatorAvatar: React.FC<{ chainId: string; id: string; name: string; size?: number }> = ({ chainId, id, name, size = 40 }) => {
  const [broken, setBroken] = useState(false);
  const list = stakingAsset(chainId)?.validatorsList;
  const url = list && !broken && /^[\w.-]+$/.test(id) ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${list}/validators/assets/${id}/logo.png` : '';
  const box: React.CSSProperties = { width: size, height: size, borderRadius: '50%', flexShrink: 0, background: T.bgAlt, color: T.sub, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.4, overflow: 'hidden', border: `1px solid ${T.border}` };
  return url
    ? <span style={box}><img src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ width: size, height: size, objectFit: 'cover' }} /></span>
    : <span style={box} aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</span>;
};

export interface ValidatorView { id: string; name: string; apr: number | null; active: boolean; commission: number | null; staked?: string }
/** TW "Validators" modal: Active / Inactive sections, APR per row, checkmark on the current choice. */
export const ValidatorSheet: React.FC<{ chainId: string; symbol: string; decimals: number; validators: ValidatorView[]; selected?: string; onPick: (id: string) => void; onClose: () => void; showStaked?: boolean; exclude?: string }> = ({ chainId, symbol, decimals, validators, selected, onPick, onClose, showStaked, exclude }) => {
  const [q, setQ] = useState('');
  const list = validators.filter((v) => v.id !== exclude && (!q.trim() || v.name.toLowerCase().includes(q.trim().toLowerCase())));
  const active = list.filter((v) => v.active); const inactive = list.filter((v) => !v.active);
  const row = (v: ValidatorView) => (
    <div key={v.id} role="button" tabIndex={0} className="hb-tap" onClick={() => onPick(v.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(v.id); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }}>
      <ValidatorAvatar chainId={chainId} id={v.id} name={v.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
        <div style={{ fontSize: 12, color: T.sub }}>APR {pctText(v.apr)}{v.commission != null ? ` · Commission ${v.commission.toFixed(v.commission % 1 ? 2 : 0)}%` : ''}</div>
      </div>
      {showStaked && v.staked && v.staked !== '0' && <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtRaw(v.staked, decimals)} {symbol}</div>}
      {selected === v.id && <span style={{ color: T.accent }}><Ic d={ICON.check} size={18} /></span>}
    </div>
  );
  return (
    <Sheet title="Validators" onClose={onClose}>
      {validators.length > 8 && <input aria-label="Search validators" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgAlt, color: T.text, fontSize: 14, marginBottom: 6 }} />}
      {!list.length && <Empty title="No validators found" icon="search" />}
      {active.length > 0 && <div style={{ fontSize: 13, color: T.sub, fontWeight: 600, margin: '6px 0 0' }}>Active</div>}
      {active.map(row)}
      {inactive.length > 0 && <div style={{ fontSize: 13, color: T.sub, fontWeight: 600, margin: '10px 0 0' }}>Inactive</div>}
      {inactive.map(row)}
    </Sheet>
  );
};
export const Notice: React.FC<{ tone?: 'warn' | 'error'; children: React.ReactNode; action?: { label: string; onClick: () => void } }> = ({ tone = 'warn', children, action }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, margin: '8px 0', background: T.bgAlt, border: `1px solid ${tone === 'error' ? T.error : T.border}`, color: tone === 'error' ? T.error : T.text, fontSize: 13 }}>
    <div style={{ flex: 1 }}>{tone === 'error' && typeof children === 'string' ? userText(children) : children}</div>
    {action && <button className="hb-tap" onClick={action.onClick} style={{ background: 'none', border: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{action.label}</button>}
  </div>
);
