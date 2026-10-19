import { chainById, chainLogo } from '../../core/chains/index';
import React, { useEffect, useRef, useState } from 'react';
import { T } from '../theme';
import { ArrowUpRight, ArrowDownLeft, ArrowDown, ArrowLeftRight, Plus, Globe, Search, Settings2, RefreshCw, Eye, EyeOff, House, TrendingUp, Sprout, ListFilter, History, ChevronRight, ChevronLeft, ChevronDown, X, Copy, ScanLine, Check, CreditCard, Landmark, Wallet, LockKeyhole, ShieldCheck, Bell, LayoutGrid, Star, Ellipsis, Image, CircleHelp, Pencil, Trash2, Maximize2, Languages, SunMoon, PanelRight, Droplets, BookUser, ExternalLink, LifeBuoy, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
const glyphs:Record<string,LucideIcon>={send:ArrowUpRight,receive:ArrowDownLeft,swap:ArrowLeftRight,fund:Plus,globe:Globe,search:Search,gear:Settings2,refresh:RefreshCw,eye:Eye,eyeoff:EyeOff,home:House,trend:TrendingUp,leaf:Sprout,filter:ListFilter,history:History,chevron:ChevronRight,down:ChevronDown,back:ChevronLeft,close:X,copy:Copy,scan:ScanLine,check:Check,plus:Plus,card:CreditCard,bank:Landmark,arrowdown:ArrowDown,wallet:Wallet,lock:LockKeyhole,shield:ShieldCheck,bell:Bell,grid:LayoutGrid,star:Star,dots:Ellipsis,nft:Image,help:CircleHelp,edit:Pencil,trash:Trash2,full:Maximize2,lang:Languages,theme:SunMoon,panel:PanelRight,faucet:Droplets,contacts:BookUser,external:ExternalLink,support:LifeBuoy,info:Info};


// ---------- shared UI kit + animations (neutral; reconstructed from TW layout) ----------

let injected = false;
export function injectStyles() {
  if (injected || typeof document === 'undefined') return; injected = true;
  const css = `
  html,body,#root{height:100%;}
  body{margin:0;min-width:320px;} button:focus-visible,[role=button]:focus-visible{outline:3px solid var(--hb-focus);outline-offset:3px;}
  .hb-root{width:100%;max-width:480px;margin:0 auto;min-height:100vh;min-height:100dvh;}
  .scrollbar-hide::-webkit-scrollbar{display:none} .scrollbar-hide{scrollbar-width:none;-ms-overflow-style:none}
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
  .hb-trow{border-radius:10px;margin:0 -8px;padding:10px 8px !important;transition:background .12s} .hb-trow:hover{background:var(--hb-paper)}
  .hb-skel{background:linear-gradient(90deg,var(--hb-skel-a) 25%,var(--hb-skel-b) 37%,var(--hb-skel-a) 63%);background-size:400px 100%;animation:hb-shimmer 1.2s infinite linear;border-radius:8px}
  .hb-root{font-variant-numeric:tabular-nums}
  .hb-root input,.hb-root textarea,.hb-root select{color:var(--hb-ink);font:inherit}
  .hb-root input::placeholder,.hb-root textarea::placeholder{color:var(--hb-muted);opacity:1}
  .hb-root input:focus-visible,.hb-root textarea:focus-visible,.hb-root select:focus-visible{outline:3px solid var(--hb-focus);outline-offset:2px}
  @media(prefers-reduced-motion:reduce){.hb-screen,.hb-sheet,.hb-fade,.hb-rise,.hb-skel{animation:none!important}.hb-tap{transition:none!important}}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

// ---------- icons ----------
export const Ic:React.FC<{d:string;size?:number;fill?:boolean;stroke?:number}>=({d,size=22,stroke=1.8})=>{const Glyph=glyphs[d]??ChevronDown;return <Glyph size={size} strokeWidth={stroke} aria-hidden="true"/>;};
export const ICON:Record<string,string>=Object.fromEntries(Object.keys(glyphs).map(k=>[k,k]));

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
  <button className="hb-tap" onClick={onClick} title={title} aria-label={title??icon} style={{ width: size, height: size, borderRadius: 999, background: bg, color, border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
    <Ic d={ICON[icon] ?? icon} size={size * 0.5} />
  </button>
);

export const Btn: React.FC<{ children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost'; style?: React.CSSProperties }> = ({ children, onClick, disabled, variant = 'primary', style }) => (
  <button className="hb-tap" onClick={onClick} disabled={disabled} style={{
    width: '100%', padding: '15px 16px', borderRadius: 999, fontWeight: 700, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
    border: variant === 'ghost' ? `1px solid ${T.border}` : 'none',
    background: variant === 'ghost' ? T.surface : (disabled ? T.bgAlt : T.accent), color: variant === 'ghost' ? T.text : (disabled ? T.sub : 'var(--hb-on-brand)'), ...style,
  }}>{children}</button>
);

// Only these exact local, pinned source files can be used as asset images. A symbol is
// a display hint, not proof of contract identity; callers with a known chain pass assetId.
const bundledLogos = new Set(['AAVE','ADA','AVAX','BNB','BTC','DAI','DOGE','ETH','EUR','GBP','LINK','LTC','SOL','TRX','UNI','USD','USDC','USDT','XRP']);
export const hasBundledAssetLogo = (symbol:string) => bundledLogos.has(symbol.toUpperCase()) || symbol.toUpperCase()==='POL';
export const Coin: React.FC<{sym:string;size?:number;color?:string;assetId?:string}>=({sym,size=40,assetId})=>{
  const [broken,setBroken]=React.useState(false);
  React.useEffect(()=>setBroken(false),[assetId]);
  const chain = assetId ? chainById(assetId) : undefined;
  if (chain && !broken) return <span title={`${chain.name} logo`} aria-label={`${sym} asset`} style={{width:size,height:size,display:'inline-grid',placeItems:'center',flexShrink:0}}><img src={chainLogo(chain.id)} alt="" width={size} height={size} onError={()=>setBroken(true)} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover'}} /></span>;
  const normalized = sym.toUpperCase();
  const local = assetId==='polygon' || normalized==='POL' ? 'matic' : bundledLogos.has(normalized) ? normalized.toLowerCase() : null;
  return local
    ? <span title={`${sym} asset logo`} aria-label={`${sym} asset`} style={{width:size,height:size,display:'inline-grid',placeItems:'center',flexShrink:0}}><img src={`/asset-logos/${local}.svg`} alt="" width={size} height={size} style={{width:size,height:size,borderRadius:'50%',objectFit:'contain'}}/></span>
    : <span title={`${sym} — asset logo unavailable`} aria-label={`${sym} asset`} style={{width:size,height:size,borderRadius:'50%',border:`1px solid ${T.border}`,background:T.bgAlt,color:T.sub,display:'inline-grid',placeItems:'center',flexShrink:0}}><span style={{width:size*.28,height:size*.28,border:'1.5px solid currentColor',borderRadius:3,transform:'rotate(45deg)'}}/></span>;
};

export const Row: React.FC<{ left: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; rightSub?: React.ReactNode; onClick?: () => void }> = ({ left, title, sub, right, rightSub, onClick }) => (
  <div className={onClick ? 'hb-tap' : ''} onClick={onClick} role={onClick?'button':undefined} tabIndex={onClick?0:undefined} onKeyDown={onClick?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onClick();}}:undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: onClick ? 'pointer' : 'default' }}>
    {left}
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{title}</div>{sub != null && <div style={{ fontSize: 12, color: T.sub }}>{sub}</div>}</div>
    {(right != null || rightSub != null) && <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, fontSize: 14 }}>{right}</div>{rightSub != null && <div style={{ fontSize: 12, color: T.sub }}>{rightSub}</div>}</div>}
  </div>
);

// Full-screen pushed view with slide-in and a header (back + title + optional right).
export const Screen: React.FC<{ title?: React.ReactNode; onBack: () => void; right?: React.ReactNode; children: React.ReactNode; pad?: boolean }> = ({ title, onBack, right, children, pad = true }) => (
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
export const Sheet: React.FC<{ title?: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.focus(); return () => previous?.focus(); }, []);
  return <div className="hb-fade" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }} style={{ position: 'absolute', inset: 0, background: 'var(--hb-overlay)', zIndex: 30, display: 'flex', alignItems: 'flex-end' }}>
    <div ref={dialog} className="hb-sheet" role="dialog" aria-modal="true" aria-label={title ?? 'Options'} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '82%', background: T.surface, borderRadius: '20px 20px 0 0', padding: '12px 16px 20px', overflowY: 'auto', outline: 'none' }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 10px' }} />
      {title && <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  </div>;
};

export const Empty: React.FC<{ title: string; sub?: string; icon?: string }> = ({ title, sub, icon = 'grid' }) => (
  <div role="status" style={{ textAlign: 'center', padding: '56px 20px 44px', color: T.sub, maxWidth: 340, margin: '0 auto' }}>
    <div style={{ width: 76, height: 76, borderRadius: 24, border: '1px solid var(--hb-glyph-line)', background: 'var(--hb-glyph-bg)', color: T.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, transform: 'rotate(-5deg)' }}><span style={{ transform: 'rotate(5deg)' }}><Ic d={ICON[icon]} size={30} /></span></div>
    <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3, color: T.text, marginBottom: 8 }}>{title}</div>
    {sub && <div style={{ fontSize: 13, lineHeight: 1.55 }}>{sub}</div>}
  </div>
);

export function useDebouncedLoading(initial = true, ms = 700) {
  const [loading, setLoading] = useState(initial);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}
