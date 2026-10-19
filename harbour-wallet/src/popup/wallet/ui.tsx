import React, { useEffect, useState } from 'react';
import { T } from '../theme';

// ---------- shared UI kit + animations (neutral; reconstructed from TW layout) ----------

let injected = false;
export function injectStyles() {
  if (injected || typeof document === 'undefined') return; injected = true;
  const css = `
  @keyframes hb-shimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
  @keyframes hb-slidein { from{transform:translateX(100%)} to{transform:translateX(0)} }
  @keyframes hb-slideup { from{transform:translateY(100%)} to{transform:translateY(0)} }
  @keyframes hb-fade { from{opacity:0} to{opacity:1} }
  @keyframes hb-spin { to{transform:rotate(360deg)} }
  @keyframes hb-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
  @keyframes hb-check { to{stroke-dashoffset:0} }
  @keyframes hb-rise { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
  .hb-screen{animation:hb-slidein .26s cubic-bezier(.3,.7,.4,1)}
  .hb-sheet{animation:hb-slideup .28s cubic-bezier(.3,.7,.4,1)}
  .hb-fade{animation:hb-fade .2s ease}
  .hb-rise{animation:hb-rise .32s ease both}
  .hb-tap{transition:transform .08s ease, background .15s ease} .hb-tap:active{transform:scale(.96)}
  .hb-skel{background:linear-gradient(90deg,#eceef1 25%,#f5f6f8 37%,#eceef1 63%);background-size:400px 100%;animation:hb-shimmer 1.2s infinite linear;border-radius:8px}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

// ---------- icons ----------
export const Ic: React.FC<{ d: string; size?: number; fill?: boolean; stroke?: number }> = ({ d, size = 22, fill, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {d.split('|').map((p, i) => <path key={i} d={p} />)}
  </svg>
);
export const ICON: Record<string, string> = {
  send: 'M7 17 17 7|M8 7h9v9', receive: 'M17 7 7 17|M16 17H7V8', swap: 'M7 10l4-4 4 4|M17 14l-4 4-4-4',
  fund: 'M12 5v14|M5 12h14', globe: 'M12 3a9 9 0 100 18 9 9 0 000-18|M3 12h18|M12 3c2.5 2.5 2.5 15 0 18|M12 3c-2.5 2.5-2.5 15 0 18',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14|M20 20l-3.5-3.5', gear: 'M12 9a3 3 0 100 6 3 3 0 000-6|M4 12l1.5.6M18.5 11.4 20 12M12 4v2M12 18v2',
  refresh: 'M4 12a8 8 0 0114-5l2 2|M20 12a8 8 0 01-14 5l-2-2|M20 5v4h-4|M4 19v-4h4', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z|M12 9a3 3 0 100 6 3 3 0 000-6',
  eyeoff: 'M4 4l16 16|M9.5 9.5a3 3 0 004 4|M6.5 6.6C4 8 2 12 2 12s4 7 10 7a9 9 0 004.5-1.2|M9 5.2A9 9 0 0112 5c6 0 10 7 10 7a17 17 0 01-2.2 3',
  home: 'M4 11l8-7 8 7|M6 10v9h12v-9', trend: 'M4 17l5-5 3 3 8-8|M16 7h4v4', leaf: 'M5 20c0-8 6-13 14-13 0 8-6 13-14 13z|M5 20c3-5 6-8 10-10',
  filter: 'M4 6h16|M7 12h10|M10 18h4', history: 'M12 7v5l3 2|M4 12a8 8 0 108-8 8 8 0 00-7 4|M5 4v4h4', chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6', close: 'M6 6l12 12|M18 6L6 18', copy: 'M9 9h10v10H9z|M5 15V5h10', scan: 'M4 7V4h3|M20 7V4h-3|M4 17v3h3|M20 17v3h-3|M4 12h16',
  check: 'M5 13l4 4 10-10', plus: 'M12 5v14|M5 12h14', card: 'M3 7h18v10H3z|M3 11h18', bank: 'M4 10h16|M6 10v7|M18 10v7|M4 20h16|M12 3l8 5H4z',
  arrowdown: 'M12 5v14|M6 13l6 6 6-6', wallet: 'M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z|M16 12h4', lock: 'M6 11h12v9H6z|M9 11V8a3 3 0 016 0v3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', bell: 'M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6|M10 20a2 2 0 004 0', grid: 'M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z',
  star: 'M12 3l2.6 5.5 6 .8-4.3 4.2 1 6-5.3-2.9L6.7 19.5l1-6L3.4 9.3l6-.8z', dots: 'M5 12h.01|M12 12h.01|M19 12h.01', nft: 'M4 5h16v14H4z|M4 15l5-4 4 3 3-2 4 3', help: 'M9.5 9a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5|M12 17h.01',
};

// ---------- primitives ----------
export const Spinner: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = T.accent }) => (
  <span style={{ display: 'inline-block', width: size, height: size, border: `${Math.max(2, size / 10)}px solid ${T.border}`, borderTopColor: color, borderRadius: '50%', animation: 'hb-spin .7s linear infinite' }} />
);

export const Skeleton: React.FC<{ w?: number | string; h?: number; r?: number; style?: React.CSSProperties }> = ({ w = '100%', h = 14, r = 8, style }) => (
  <div className="hb-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

export const SuccessCheck: React.FC<{ size?: number }> = ({ size = 84 }) => (
  <svg width={size} height={size} viewBox="0 0 52 52" style={{ animation: 'hb-pop .4s ease both' }}>
    <circle cx="26" cy="26" r="24" fill="none" stroke={T.success} strokeWidth="3" opacity="0.25" />
    <circle cx="26" cy="26" r="24" fill={T.success} opacity="0.12" />
    <path d="M16 27l7 7 14-14" fill="none" stroke={T.success} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray="40" strokeDashoffset="40" style={{ animation: 'hb-check .5s .2s ease forwards' }} />
  </svg>
);

export const IconBtn: React.FC<{ icon: string; onClick?: () => void; title?: string; bg?: string; color?: string; size?: number }> = ({ icon, onClick, title, bg = T.bgAlt, color = T.sub, size = 36 }) => (
  <button className="hb-tap" onClick={onClick} title={title} style={{ width: size, height: size, borderRadius: 999, background: bg, color, border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
    <Ic d={ICON[icon] ?? icon} size={size * 0.5} />
  </button>
);

export const Btn: React.FC<{ children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost'; style?: React.CSSProperties }> = ({ children, onClick, disabled, variant = 'primary', style }) => (
  <button className="hb-tap" onClick={onClick} disabled={disabled} style={{
    width: '100%', padding: '15px 16px', borderRadius: 999, fontWeight: 700, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
    border: variant === 'ghost' ? `1px solid ${T.border}` : 'none',
    background: variant === 'ghost' ? '#fff' : (disabled ? T.bgAlt : T.accent), color: variant === 'ghost' ? T.text : (disabled ? T.sub : '#fff'), ...style,
  }}>{children}</button>
);

export const Coin: React.FC<{ sym: string; size?: number; color?: string }> = ({ sym, size = 40, color }) => (
  <div style={{ width: size, height: size, borderRadius: 999, background: color ?? T.bgAlt, color: color ? '#fff' : T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.34, flexShrink: 0 }}>{sym[0]}</div>
);

export const Row: React.FC<{ left: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; rightSub?: React.ReactNode; onClick?: () => void }> = ({ left, title, sub, right, rightSub, onClick }) => (
  <div className={onClick ? 'hb-tap' : ''} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: onClick ? 'pointer' : 'default' }}>
    {left}
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{title}</div>{sub != null && <div style={{ fontSize: 12, color: T.sub }}>{sub}</div>}</div>
    {(right != null || rightSub != null) && <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, fontSize: 14 }}>{right}</div>{rightSub != null && <div style={{ fontSize: 12, color: T.sub }}>{rightSub}</div>}</div>}
  </div>
);

// Full-screen pushed view with slide-in and a header (back + title + optional right).
export const Screen: React.FC<{ title?: string; onBack: () => void; right?: React.ReactNode; children: React.ReactNode; pad?: boolean }> = ({ title, onBack, right, children, pad = true }) => (
  <div className="hb-screen" style={{ position: 'absolute', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', zIndex: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 8 }}>
      <IconBtn icon="back" onClick={onBack} />
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 16 }}>{title}</div>
      <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: pad ? '0 16px 20px' : 0 }}>{children}</div>
  </div>
);

// Bottom sheet.
export const Sheet: React.FC<{ title?: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="hb-fade" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(16,17,20,0.4)', zIndex: 30, display: 'flex', alignItems: 'flex-end' }}>
    <div className="hb-sheet" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '82%', background: '#fff', borderRadius: '20px 20px 0 0', padding: '12px 16px 20px', overflowY: 'auto' }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 10px' }} />
      {title && <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  </div>
);

export const Empty: React.FC<{ title: string; sub?: string; icon?: string }> = ({ title, sub, icon = 'grid' }) => (
  <div style={{ textAlign: 'center', padding: '48px 20px', color: T.sub }}>
    <div style={{ width: 56, height: 56, borderRadius: 16, background: T.bgAlt, color: T.sub, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Ic d={ICON[icon]} size={26} /></div>
    <div style={{ fontWeight: 700, color: T.text, marginBottom: 4 }}>{title}</div>
    {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
  </div>
);

export function useDebouncedLoading(initial = true, ms = 700) {
  const [loading, setLoading] = useState(initial);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}
