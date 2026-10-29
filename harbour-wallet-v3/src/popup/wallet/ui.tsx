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
  .hb-sheet{animation:hb-slideup .34s cubic-bezier(.22,1,.36,1)}
  .hb-fade{animation:hb-fade .2s ease}
  .hb-rise{animation:hb-rise .32s ease both}
  .hb-trow{border-radius:10px;margin:0 -8px;padding:10px 8px !important;transition:background .12s} .hb-trow:hover{background:var(--hb-paper)}
  .hb-skel{background:linear-gradient(90deg,var(--hb-skel-a) 25%,var(--hb-skel-b) 37%,var(--hb-skel-a) 63%);background-size:400px 100%;animation:hb-shimmer 1.2s infinite linear;border-radius:8px}
  .hb-root{font-variant-numeric:tabular-nums}
  .hb-root input,.hb-root textarea,.hb-root select{color:var(--hb-ink);font:inherit}
  .hb-root input::placeholder,.hb-root textarea::placeholder{color:var(--hb-muted);opacity:1}
  .hb-root input:focus-visible,.hb-root textarea:focus-visible,.hb-root select:focus-visible{outline:3px solid var(--hb-focus);outline-offset:2px}

  /* ---- motion system: one easing family so every movement feels related ---- */
  :root{--hb-ease-out:cubic-bezier(.22,1,.36,1);--hb-ease-spring:cubic-bezier(.34,1.56,.64,1);--hb-ease-io:cubic-bezier(.65,0,.35,1);--hb-nav-ms:320ms}
  @keyframes hb-push-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
  @keyframes hb-push-under{from{transform:translateX(0)}to{transform:translateX(-24%)}}
  @keyframes hb-pop-reveal{from{transform:translateX(-24%)}to{transform:translateX(0)}}
  @keyframes hb-pop-out{from{transform:translateX(0)}to{transform:translateX(100%)}}
  @keyframes hb-dim-in{from{opacity:0}to{opacity:1}}
  @keyframes hb-dim-out{from{opacity:1}to{opacity:0}}
  @keyframes hb-slidedown{from{transform:translateY(0)}to{transform:translateY(100%)}}
  @keyframes hb-fadeout{from{opacity:1}to{opacity:0}}
  @keyframes hb-tab-l{from{opacity:0;transform:translateX(-22px)}to{opacity:1;transform:none}}
  @keyframes hb-tab-r{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:none}}
  @keyframes hb-icon-pop{0%{transform:scale(.82)}55%{transform:scale(1.14)}100%{transform:scale(1)}}
  @keyframes hb-menu-in{from{opacity:0;transform:translateY(-6px) scale(.96)}to{opacity:1;transform:none}}
  @keyframes hb-unblur{from{opacity:0;filter:blur(6px)}to{opacity:1;filter:blur(0)}}
  @keyframes hb-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
  @keyframes hb-enter{from{opacity:0;transform:scale(.985) translateY(6px)}to{opacity:1;transform:none}}
  @keyframes hb-dialog-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}

  /* navigation stack: pushed screen slides over, the one beneath drifts left and dims (native-app parallax) */
  .hb-layer{position:absolute;inset:0;overflow:hidden;background:var(--hb-surface);will-change:transform}
  .hb-layer>.hb-screen,.hb-layer>*>.hb-screen{animation:none}
  .hb-layer::after{content:"";position:absolute;inset:0;background:var(--hb-overlay);opacity:0;pointer-events:none;z-index:999}
  .hb-layer.enter{z-index:22;animation:hb-push-in var(--hb-nav-ms) var(--hb-ease-out) both;box-shadow:-12px 0 32px rgba(0,0,0,.10)}
  .hb-layer.idle{z-index:21}
  .hb-layer.under{z-index:20;animation:hb-push-under var(--hb-nav-ms) var(--hb-ease-out) both;pointer-events:none}
  .hb-layer.under::after{animation:hb-dim-in var(--hb-nav-ms) ease both}
  .hb-layer.reveal{z-index:20;animation:hb-pop-reveal var(--hb-nav-ms) var(--hb-ease-out) both}
  .hb-layer.reveal::after{animation:hb-dim-out var(--hb-nav-ms) ease both}
  .hb-layer.leave{z-index:23;animation:hb-pop-out calc(var(--hb-nav-ms) - 40ms) var(--hb-ease-io) both;pointer-events:none;box-shadow:-12px 0 32px rgba(0,0,0,.10)}
  .hb-home{display:flex;flex-direction:column;flex:1;min-height:0;position:relative;transition:transform var(--hb-nav-ms) var(--hb-ease-out)}
  .hb-home::after{content:"";position:absolute;inset:0;background:var(--hb-overlay);opacity:0;pointer-events:none;transition:opacity var(--hb-nav-ms) ease;z-index:50}
  .hb-home.under{transform:translateX(-24%)}
  .hb-home.under::after{opacity:1}

  /* tabs */
  .hb-tab-l{animation:hb-tab-l .3s var(--hb-ease-out) backwards}
  .hb-tab-r{animation:hb-tab-r .3s var(--hb-ease-out) backwards}
  .hb-tab-fade{animation:hb-fade .22s ease backwards}
  .hb-navbar{position:relative}
  .hb-nav-pill{position:absolute;top:6px;left:0;height:30px;display:flex;justify-content:center;pointer-events:none;transition:transform .38s var(--hb-ease-spring)}
  .hb-nav-pill>span{width:52px;height:30px;border-radius:999px;background:var(--hb-brand-soft)}
  .hb-nav-btn{position:relative;z-index:1;transition:color .2s ease}
  .hb-nav-btn .hb-nav-ic{height:30px;display:grid;place-items:center}
  .hb-nav-btn.on .hb-nav-ic{animation:hb-icon-pop .42s var(--hb-ease-out)}
  .hb-ink{position:absolute;bottom:-1px;left:0;height:2px;border-radius:2px;background:var(--hb-brand);transition:transform .32s var(--hb-ease-out),width .32s var(--hb-ease-out)}
  .hb-inktab{transition:color .2s ease}

  /* lists & content */
  .hb-stagger>*{animation:hb-rise .38s var(--hb-ease-out) backwards}
  ${Array.from({ length: 14 }, (_, i) => `.hb-stagger>*:nth-child(${i + 1}){animation-delay:${i * 28}ms}`).join('')}
  .hb-stagger>*:nth-child(n+15){animation-delay:390ms}
  .hb-screen-body>*{animation:hb-rise .34s var(--hb-ease-out) 60ms backwards}
  .hb-unblur{animation:hb-unblur .28s ease backwards}
  .hb-menu{transform-origin:top center;animation:hb-menu-in .18s var(--hb-ease-out) backwards}
  .hb-shake{animation:hb-shake .38s ease}
  .hb-enter{animation:hb-enter .36s var(--hb-ease-out) backwards}
  .hb-spinning svg{animation:hb-spin .8s linear infinite}
  .hb-action{transition:transform .18s var(--hb-ease-out),box-shadow .18s ease,filter .18s ease}
  .hb-action:hover{transform:translateY(-2px);box-shadow:var(--hb-shadow)}
  .hb-action:active{transform:scale(.94);box-shadow:none}
  .hb-tap{transition:transform .14s var(--hb-ease-out),background .15s ease,color .15s ease,box-shadow .15s ease}
  .hb-tap:active{transform:scale(.96)}
  .hb-sheet-closing{animation:hb-fadeout .2s ease forwards}
  .hb-sheet-closing>.hb-sheet{animation:hb-slidedown .22s var(--hb-ease-io) forwards}
  .hb-sheet{animation:hb-slideup .34s var(--hb-ease-out)}
  .hb-dialog[open]{animation:hb-dialog-in .24s var(--hb-ease-out)}
  .hb-dialog[open]::backdrop{animation:hb-fade .24s ease}
  .hb-switch-knob{transition:left .26s var(--hb-ease-spring),transform .26s var(--hb-ease-spring)}
  .hb-root button:not(:disabled){transition-property:transform,background,color,box-shadow,border-color,opacity;transition-duration:.15s}

  @media(prefers-reduced-motion:reduce){.hb-screen,.hb-sheet,.hb-fade,.hb-rise,.hb-skel,.hb-layer,.hb-layer::after,.hb-tab-l,.hb-tab-r,.hb-tab-fade,.hb-stagger>*,.hb-screen-body>*,.hb-unblur,.hb-menu,.hb-shake,.hb-enter,.hb-nav-ic,.hb-spinning svg{animation:none!important}.hb-tap,.hb-action,.hb-home,.hb-home::after,.hb-nav-pill,.hb-ink,.hb-switch-knob{transition:none!important}}
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
  if (chain && !broken) return <span title={`${chain.name} logo`} aria-label={`${sym} asset`} style={{width:size,height:size,display:'inline-grid',placeItems:'center',flexShrink:0}}><img src={chainLogo(chain.id)} alt="" width={size} height={size} loading="lazy" decoding="async" onError={()=>setBroken(true)} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover'}} /></span>;
  const normalized = sym.toUpperCase();
  const local = assetId==='polygon' || normalized==='POL' ? 'matic' : bundledLogos.has(normalized) ? normalized.toLowerCase() : null;
  return local
    ? <span title={`${sym} asset logo`} aria-label={`${sym} asset`} style={{width:size,height:size,display:'inline-grid',placeItems:'center',flexShrink:0}}><img src={`/asset-logos/${local}.svg`} alt="" width={size} height={size} loading="lazy" decoding="async" style={{width:size,height:size,borderRadius:'50%',objectFit:'contain'}}/></span>
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
// `footer` pins the primary action to the bottom edge so it never scrolls out of reach (forms, pickers).
export const Screen: React.FC<{ title?: React.ReactNode; onBack: () => void; right?: React.ReactNode; children: React.ReactNode; pad?: boolean; footer?: React.ReactNode }> = ({ title, onBack, right, children, pad = true, footer }) => (
  <div className="hb-screen" style={{ position: 'absolute', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', zIndex: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 8, flexShrink: 0 }}>
      <IconBtn icon="back" title="Back" onClick={onBack} />
      <h1 style={{ flex: 1, minWidth: 0, margin: 0, textAlign: 'center', fontWeight: 800, fontSize: 16, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
      <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
    <div className="hb-screen-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: pad ? '0 16px 20px' : 0 }}>{children}</div>
    {footer && <div className="hb-footer" style={{ flexShrink: 0, padding: '12px 16px', borderTop: `1px solid ${T.border}`, background: T.bg, display: 'flex', flexDirection: 'column', gap: 10 }}>{footer}</div>}
  </div>
);

// One input look for every form (token, NFT, network, contact): same radius, padding and spacing as the design system fields.
export const inputStyle: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 14, boxSizing: 'border-box', marginTop: 6, minHeight: 48 };
export const FieldLabel: React.FC<{ htmlFor: string; children: React.ReactNode; first?: boolean }> = ({ htmlFor, children, first }) => (
  <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.sub, marginTop: first ? 0 : 16 }}>{children}</label>
);

// Bottom sheet.
export const Sheet: React.FC<{ title?: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  const dialog = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  // Backdrop / Escape dismissals play the slide-down before unmounting; in-sheet actions close immediately as before.
  const dismiss = () => { if (closing) return; if (reducedMotion()) return onClose(); setClosing(true); setTimeout(onClose, 210); };
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus(); return () => previous?.focus(); }, []);
  return <div className={closing ? 'hb-fade hb-sheet-closing' : 'hb-fade'} onClick={dismiss} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); dismiss(); } }} style={{ position: 'absolute', inset: 0, background: 'var(--hb-overlay)', zIndex: 30, display: 'flex', alignItems: 'flex-end' }}>
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

// ---------- motion helpers ----------
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Eases a number toward its new value (balance count-up). Interruptions continue from the value on screen.
export function useTween(value: number | null, ms = 700): number | null {
  const [v, setV] = useState(value);
  const cur = useRef(value);
  useEffect(() => {
    if (value == null || cur.current == null || reducedMotion()) { cur.current = value; setV(value); return; }
    const a = cur.current, b = value; if (a === b) return;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); cur.current = a + (b - a) * e; setV(k < 1 ? cur.current : b); if (k < 1) raf = requestAnimationFrame(step); else cur.current = b; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

// Underlined tab strip whose indicator glides between tabs.
export function InkTabs<K extends string>({ tabs, value, onChange, label, gap = 18, pad = '10px 2px', fontSize = 15, style, children }: { tabs: readonly K[]; value: K; onChange: (k: K) => void; label: (k: K) => React.ReactNode; gap?: number; pad?: string; fontSize?: number; style?: React.CSSProperties; children?: React.ReactNode }) {
  const refs = useRef<Partial<Record<K, HTMLButtonElement | null>>>({});
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null);
  const tabKey = tabs.join('|');
  React.useLayoutEffect(() => { const el = refs.current[value]; if (el) setInk({ x: el.offsetLeft, w: el.offsetWidth }); }, [value, tabKey]);
  return <div role="tablist" style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${T.border}`, position: 'relative', ...style }}>
    {tabs.map((k) => <button key={k} role="tab" aria-selected={value === k} ref={(el) => { refs.current[k] = el; }} className="hb-inktab" onClick={() => onChange(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: pad, marginRight: gap, fontWeight: 700, fontSize, color: value === k ? T.text : T.sub }}>{label(k)}</button>)}
    {children}
    {ink && <span className="hb-ink" style={{ width: ink.w, transform: `translateX(${ink.x}px)` }} />}
  </div>;
}
