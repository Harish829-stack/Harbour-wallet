// Screens for feature "walletconnect": pair with a dApp (paste / scan a wc: link), list and disconnect WalletConnect sessions.
// Proposals and requests themselves are approved in the standard approval window (features/provider.tsx), never here.
import React, { useCallback, useEffect, useState } from 'react';
import type { Ctx } from '../types';
import { T } from '../../theme';
import { Btn, Screen, Spinner } from '../ui';
import { ErrorLine, Group, Note, SectionLabel } from '../settingsScreens';
import { AddressScanner } from '../send/parts';

interface Session { topic: string; origin: string; name: string; url: string; icon: string | null; chains: string[]; connectedAt: number; expiry: number | null }
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, background: T.surface, color: T.text, margin: '6px 0 10px' };
const host = (o: string) => { try { return new URL(o).host; } catch { return o; } };

const SiteDot: React.FC<{ s: Session }> = ({ s }) => {
  const [bad, setBad] = useState(false);
  const st: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, background: T.bgAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: T.accent, flexShrink: 0, objectFit: 'cover' };
  return s.icon && !bad ? <img src={s.icon} alt="" style={st} onError={() => setBad(true)} /> : <span style={st}>{(s.name || host(s.origin)).charAt(0).toUpperCase()}</span>;
};

export const WalletConnectScreen: React.FC<Ctx> = (c) => {
  const [configured, setConfigured] = useState<boolean | null>(null); const [sessions, setSessions] = useState<Session[]>([]);
  const [uri, setUri] = useState(''); const [projectId, setProjectId] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [info, setInfo] = useState(''); const [scan, setScan] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => { try { const r = await c.bg({ type: 'wcStatus' }); if (!r?.ok) throw new Error(r?.error || 'Could not load WalletConnect.'); setConfigured(!!r.configured); setSessions(r.sessions ?? []); } catch (e: any) { setErr(e.message); setConfigured(false); } }, [c.bg]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 3000); return () => clearInterval(t); }, [load]);

  const pair = async (raw: string) => {
    setErr(''); setInfo(''); setBusy(true);
    try { const r = await c.bg({ type: 'wcPair', uri: raw }); if (!r?.ok) throw new Error(r?.error || 'Could not connect.'); setUri(''); setInfo('Approve the connection in the Harbour window that opens. If nothing opens, refresh the QR code on the site and try again.'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveProject = async () => { setErr(''); setBusy(true); try { const r = await c.bg({ type: 'wcSetProjectId', projectId }); if (!r?.ok) throw new Error(r?.error || 'Could not save.'); setProjectId(''); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const disconnect = async (topic: string) => { setErr(''); setBusy(true); try { await c.bg({ type: 'wcDisconnect', topic }); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const paste = async () => { try { const t = await navigator.clipboard.readText(); if (t) setUri(t.trim()); } catch { setErr('Harbour could not read the clipboard. Paste the link into the field instead.'); } };

  return <Screen title="WalletConnect" onBack={c.nav.pop}>
    {configured === null ? <Spinner /> : <>
      <Note>Connect to sites that show a WalletConnect QR code or link. Each request still needs your approval in Harbour.</Note>
      {!configured ? <>
        <SectionLabel>Project ID required</SectionLabel>
        <Note>The WalletConnect relay needs a free project ID from cloud.reown.com. It identifies this app, not you, and is not secret.</Note>
        <label htmlFor="wc-project">Project ID</label>
        <input id="wc-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="32 hexadecimal characters" autoComplete="off" spellCheck={false} style={field} />
        <Btn onClick={saveProject} disabled={busy || !projectId.trim()}>Save project ID</Btn>
      </> : <>
        <label htmlFor="wc-uri">WalletConnect link</label>
        <input id="wc-uri" value={uri} onChange={(e) => setUri(e.target.value)} placeholder="wc:…" autoComplete="off" spellCheck={false} style={field} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Btn variant="ghost" onClick={paste} disabled={busy} style={{ flex: 1 }}>Paste</Btn>
          <Btn variant="ghost" onClick={() => setScan(true)} disabled={busy} style={{ flex: 1 }}>Scan QR</Btn>
        </div>
        <Btn onClick={() => pair(uri)} disabled={busy || !uri.trim()}>{busy ? 'Connecting…' : 'Connect'}</Btn>
      </>}
      <ErrorLine msg={err} />
      {info && <Note>{info}</Note>}
      <SectionLabel>Connected sites</SectionLabel>
      {sessions.length === 0 ? <Note>No WalletConnect sessions yet.</Note> : <Group>{sessions.map((s, i) => (
        <div key={s.topic} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderTop: i ? `1px solid ${T.border}` : 'none' }}>
          <SiteDot s={s} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || host(s.origin)}</div>
            <div style={{ color: T.sub, fontSize: 12, overflowWrap: 'anywhere' }}>{host(s.origin)} · {s.chains.length} network{s.chains.length === 1 ? '' : 's'}</div>
          </div>
          <Btn variant="ghost" onClick={() => disconnect(s.topic)} disabled={busy} style={{ width: 'auto', padding: '8px 14px' }}>Disconnect</Btn>
        </div>))}</Group>}
    </>}
    {scan && <AddressScanner onResult={() => {}} onRaw={(t) => { setScan(false); setUri(t); void pair(t); }} onClose={() => setScan(false)} />}
  </Screen>;
};
export const SCREENS_walletconnect: Record<string, React.FC<Ctx>> = { walletConnect: WalletConnectScreen };
