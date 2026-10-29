import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { bg } from './api';
import { T } from './theme';

// Shows a clear message when the network is degraded or offline, and when prices are last-known (stale) values.
type Status = { state: 'ok' | 'degraded' | 'offline'; stale: boolean };
const POLL_MS = 20_000;

export const NetworkBanner: React.FC = () => {
  const [s, setS] = useState<Status>({ state: 'ok', stale: false });
  useEffect(() => {
    let dead = false;
    const poll = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { setS({ state: 'offline', stale: true }); return; }
      bg({ type: 'getNetworkStatus' }).then((r) => { if (!dead && r?.ok) setS({ state: r.state, stale: !!r.stale }); }).catch(() => {});
    };
    poll();
    const t = setInterval(poll, POLL_MS);
    window.addEventListener('online', poll); window.addEventListener('offline', poll);
    return () => { dead = true; clearInterval(t); window.removeEventListener('online', poll); window.removeEventListener('offline', poll); };
  }, []);
  const shown = !(s.state === 'ok' && !s.stale);
  const el = useRef<HTMLDivElement>(null);
  // Publish the banner's height so full-height screens shrink by it instead of being pushed off the bottom (nav bar, pinned buttons).
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!shown || !el.current) { root.style.removeProperty('--hb-banner-h'); return; }
    const set = () => root.style.setProperty('--hb-banner-h', `${el.current?.offsetHeight ?? 0}px`);
    set(); window.addEventListener('resize', set);
    return () => { window.removeEventListener('resize', set); root.style.removeProperty('--hb-banner-h'); };
  }, [shown, s.state]);
  if (!shown) return null;
  const text = s.state === 'offline'
    ? "You're offline. Showing the last known balances and prices."
    : s.state === 'degraded'
      ? 'The network is slow or partly unavailable. Some data may be out of date.'
      : 'Showing the last known prices. They may be out of date.';
  return (
    <div ref={el} role="status" aria-live="polite" style={{ position: 'sticky', top: 0, zIndex: 50, padding: '8px 14px', fontSize: 12, textAlign: 'center', background: T.bgAlt, color: T.sub, borderBottom: `1px solid ${T.border}` }}>
      {text}
    </div>
  );
};
