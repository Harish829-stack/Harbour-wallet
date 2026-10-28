// Shared bits for the first-run landing (home) and its Features / Networks / Security pages.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ALL_CHAINS, chainLogo } from '../../core/chains/index';
import './landing.css';

export const NETWORKS = ALL_CHAINS.filter((c) => !c.testnet);
export const ROW_A = ['bitcoin', 'ethereum', 'solana', 'smartchain', 'polygon', 'arbitrum', 'base', 'optimism', 'avalanchec', 'tron', 'cardano', 'doge', 'aptos', 'sui', 'ton', 'cosmos'];
export const ROW_B = ['litecoin', 'ripple', 'stellar', 'near', 'polkadot', 'zksync', 'linea', 'blast', 'celo', 'fantom', 'cronos', 'kava', 'osmosis', 'algorand', 'tezos', 'filecoin'];
export const known = (ids: string[]) => ids.filter((id) => NETWORKS.some((c) => c.id === id));
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Adds .in to every [data-reveal] element once it scrolls into view. Re-runs when `key` (the page) changes.
export function useReveal(root: React.RefObject<HTMLElement>, key: string = '') {
  useEffect(() => {
    const els = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-reveal]') ?? []);
    if (reduced() || typeof IntersectionObserver === 'undefined') { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [root, key]);
}

export const CountUp: React.FC<{ to: number; suffix?: string }> = ({ to, suffix = '' }) => {
  const ref = useRef<HTMLSpanElement>(null); const [v, setV] = useState(reduced() ? to : 0);
  useEffect(() => {
    const el = ref.current; if (!el || reduced()) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now(); const step = (t: number) => { const k = Math.min(1, (t - t0) / 1200); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(el); return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{v}{suffix}</span>;
};

export const NetChip: React.FC<{ id: string }> = ({ id }) => { const c = NETWORKS.find((n) => n.id === id)!; return <div className="lp-netchip"><img src={chainLogo(id)} alt="" width={28} height={28}/><span>{c.name}</span></div>; };
export const Marquee: React.FC<{ children: ReactNode; reverse?: boolean; slow?: boolean }> = ({ children, reverse, slow }) => (
  <div className="lp-marquee" aria-hidden="true"><div className={`lp-track${reverse ? ' rev' : ''}${slow ? ' slow' : ''}`}>{children}{children}</div></div>
);

// Landing sub-pages live in the hash query (#/onboarding?page=features) so the back button and shared links work.
export type Page = 'home' | 'features' | 'networks' | 'security';
const SUBPAGES = ['features', 'networks', 'security'];
const readPage = (): Page => { const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('page') ?? ''; return (SUBPAGES.includes(p) ? p : 'home') as Page; };
export const pageHref = (p: Page) => (p === 'home' ? '#/onboarding' : `#/onboarding?page=${p}`);
export function usePage(): Page {
  const [p, setP] = useState<Page>(readPage);
  useEffect(() => { const f = () => setP(readPage()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return p;
}
