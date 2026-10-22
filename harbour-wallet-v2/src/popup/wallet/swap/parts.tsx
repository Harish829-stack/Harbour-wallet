import { userText } from '../../../core/errors';
import React, { useEffect, useState } from 'react';
import { T } from '../../theme';
import { Ic, ICON, Coin, hasBundledAssetLogo } from '../ui';
import type { SwapAsset } from '../../../core/swap/types';
import { domainById } from '../../../core/swap/domains';
import { knownLogoSymbol } from '../../../core/swap/tokens';

export const AssetLogo: React.FC<{ asset: SwapAsset; size?: number }> = ({ asset, size = 32 }) => {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [asset.assetId]);
  const known = knownLogoSymbol(asset);
  if (known && hasBundledAssetLogo(known)) return <Coin sym={known} size={size} />;
  if (!asset.logoUrl || bad) return <Coin sym="?" size={size} />;
  return <img src={asset.logoUrl} width={size} height={size} alt="" onError={() => setBad(true)} style={{ borderRadius: 999, background: T.bgAlt, flexShrink: 0, objectFit: 'cover' }} />;
};
export const networkName = (a: SwapAsset) => domainById(a.domainId)?.name ?? '';

export const Notice: React.FC<{ tone: 'error' | 'warning' | 'info'; children: React.ReactNode }> = ({ tone, children }) => {
  const c = tone === 'error' ? { bg: 'hsl(0 70.9% 58.2% / 0.1)', fg: T.error } : tone === 'warning' ? { bg: 'var(--hb-warn-bg)', fg: 'var(--hb-warn-ink)' } : { bg: T.bgAlt, fg: T.sub };
  return <div role={tone === 'error' ? 'alert' : undefined} style={{ background: c.bg, color: c.fg, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>{tone === 'error' && typeof children === 'string' ? userText(children) : children}</div>;
};

export const DetailRow: React.FC<{ label: React.ReactNode; children: React.ReactNode; loading?: boolean; testid?: string }> = ({ label, children, loading, testid }) => (
  <div data-testid={testid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', gap: 8 }}>
    <span style={{ color: T.sub, fontSize: 13 }}>{label}</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, flexWrap: 'wrap', justifyContent: 'flex-end', textAlign: 'right' }}>
      {loading ? <span className="hb-skel" style={{ width: 90, height: 14, display: 'inline-block' }} /> : children}
    </span>
  </div>
);

export const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; testid?: string }> = ({ on, onChange, label, testid }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} data-testid={testid} onClick={() => onChange(!on)}
    style={{ width: 46, height: 28, borderRadius: 999, border: 'none', padding: 3, cursor: 'pointer', background: on ? T.accent : 'hsl(240 6% 82%)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .15s', flexShrink: 0 }}>
    <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--hb-on-brand)', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
  </button>
);

// Circular countdown (TW QuoteRefreshRing / CircleProgress, w-10 h-10): `progress` 0..1.
export const QuoteRing: React.FC<{ progress: number; size?: number; children: React.ReactNode }> = ({ progress, size = 40, children }) => {
  const r = size / 2 - 2; const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={2} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.accent} strokeWidth={2} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))} style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      {children}
    </div>
  );
};
export const Chevron: React.FC<{ down?: boolean }> = ({ down }) => <span style={{ color: T.sub, display: 'inline-flex', transform: down ? 'rotate(90deg)' : undefined }}><Ic d={ICON.chevron} size={14} /></span>;
