// Home header indicator for the dApp connected in the active browser tab (Trust Wallet shows the site's icon with a green
// dot beside the network button; tapping opens a card with the network, the site and a Disconnect action).
import React, { useCallback, useEffect, useState } from 'react';
import { T } from '../theme';
import { Btn } from './ui';

interface Site { id: string; origin: string; host: string; title: string; icon: string | null; networkName: string }
type Bg = (m: any) => Promise<any>;

const SiteIcon: React.FC<{ site: Site; size: number }> = ({ site, size }) => {
  const [bad, setBad] = useState(false);
  const style: React.CSSProperties = { width: size, height: size, borderRadius: 999, objectFit: 'cover', background: T.bgAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: T.accent, fontSize: size * 0.42 };
  return site.icon && !bad ? <img src={site.icon} alt="" style={style} onError={() => setBad(true)} /> : <span style={style}>{(site.title || site.host).charAt(0).toUpperCase()}</span>;
};

export const ConnectedSite: React.FC<{ bg: Bg; refreshKey?: unknown }> = ({ bg, refreshKey }) => {
  const [site, setSite] = useState<Site | null>(null); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(() => { void bg({ type: 'providerCurrentSite' }).then((r) => setSite(r?.ok ? r.item : null)).catch(() => setSite(null)); }, [bg]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (!site) return null;
  const disconnect = async () => {
    setBusy(true);
    try { await bg({ type: 'providerDisconnect', id: site.id }); } finally { setBusy(false); setOpen(false); setSite(null); load(); }
  };
  return <>
    <button className="hb-tap" onClick={() => setOpen((o) => !o)} title={`Connected to ${site.host}`} aria-label={`Connected to ${site.host}`} aria-expanded={open}
      style={{ position: 'relative', width: 36, height: 36, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
      <SiteIcon site={site} size={36} />
      <span aria-hidden style={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 999, background: T.success, border: `2px solid ${T.bg}` }} />
    </button>
    {open && <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
      <div role="dialog" aria-label="Connected site" style={{ position: 'absolute', left: 12, right: 12, top: 62, zIndex: 21, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 18, padding: 14, boxShadow: '0 12px 32px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.bg, borderRadius: 12, padding: '10px 12px', gap: 8 }}>
          <strong style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.networkName}</strong>
          <span style={{ color: T.success, fontWeight: 700, fontSize: 14 }}>Connected</span>
        </div>
        <div style={{ textAlign: 'center', padding: '18px 0 16px' }}>
          <div style={{ display: 'inline-block' }}><SiteIcon site={site} size={56} /></div>
          <div style={{ fontWeight: 800, fontSize: 16, marginTop: 8, overflowWrap: 'anywhere' }}>{site.title || site.host}</div>
          <div style={{ color: T.sub, fontSize: 13, marginTop: 2, overflowWrap: 'anywhere' }}>{site.host}</div>
        </div>
        <Btn variant="ghost" onClick={disconnect} disabled={busy} style={{ width: '100%' }}>{busy ? 'Disconnecting…' : 'Disconnect'}</Btn>
      </div>
    </>}
  </>;
};
