import React, { useEffect, useRef, useState } from 'react';
import { Eye, ShieldAlert, PenLine, EyeOff, UserX, CheckCircle2, Undo2 } from 'lucide-react';
import { Confetti } from './FlowFrame';
import { RevealGate } from '../wallet/revealGate';
import { SeedPlaceholder } from '../wallet/SeedCanvas';
import { SecretImage, readSecretTheme, type SecretPicture } from '../secureField';

type Phase = 'auth' | 'reveal' | 'verify' | 'done';
interface Chip extends SecretPicture { id: string }
interface Session { id: string; wordCount: number; grid: SecretPicture | null; chips: Chip[] }

/** Secret-phrase backup: re-authenticate, reveal, then prove it by tapping the words in order (TW "BACKUP_SEEDPHRASE" flow).
 *  Dumb UI: the worker decrypts the phrase and sends back only images (the grid and one tile per word, shuffled) plus opaque
 *  chip ids (`backupBegin`). The UI reports the order of the ids the user tapped (`backupCheck`/`backupFinish`); the worker
 *  checks it. No word ever exists here as text. `granted`: the worker already holds a reveal grant (a just-created wallet). */
export const BackupFlow: React.FC<{ bg: (m: any) => Promise<any>; walletId?: string; granted?: boolean; autoBiometric?: boolean; onDone: () => void; onCancel: () => void }> = ({ bg, walletId, granted, autoBiometric, onDone, onCancel }) => {
  const [phase, setPhase] = useState<Phase>(granted ? 'reveal' : 'auth');
  const [session, setSession] = useState<Session | null>(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
  const [shown, setShown] = useState(false); const [picked, setPicked] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const [state, setState] = useState({ firstWrong: -1, complete: false });
  const sessionId = useRef(''); const seq = useRef(0);
  // Leaving the flow drops the worker-side session too.
  useEffect(() => () => { if (sessionId.current) void bg({ type: 'backupCancel', sessionId: sessionId.current }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'reveal' || session) return;
    let live = true; setLoading(true); setErr('');
    bg({ type: 'backupBegin', walletId, theme: readSecretTheme() }).then((r) => {
      if (!live) { if (r?.sessionId) void bg({ type: 'backupCancel', sessionId: r.sessionId }).catch(() => {}); return; }
      if (r?.ok) { sessionId.current = r.sessionId; setSession({ id: r.sessionId, wordCount: r.wordCount, grid: r.grid, chips: r.chips ?? [] }); }
      else setErr(r?.error === 'AUTH_REQUIRED' ? 'Verification expired. Go back and try again.' : r?.error || 'Could not reveal the phrase');
    }).catch(() => live && setErr('Could not reveal the phrase')).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const recheck = async (next: string[]) => {
    const n = ++seq.current;
    if (!next.length) { setState({ firstWrong: -1, complete: false }); return; }
    const r = await bg({ type: 'backupCheck', sessionId: sessionId.current, picked: next }).catch(() => null);
    if (n !== seq.current) return;
    if (r?.ok) setState({ firstWrong: r.firstWrong, complete: r.complete });
    else setErr(r?.error === 'BACKUP_EXPIRED' ? 'This backup session expired. Close it and start again.' : 'Could not check the words');
  };
  const pick = (id: string) => { if (picked.includes(id)) return; const next = [...picked, id]; setPicked(next); void recheck(next); };
  const undo = () => { const next = picked.slice(0, -1); setPicked(next); void recheck(next); };
  const finish = async () => {
    if (busy) return; setBusy(true); setErr('');
    try {
      const r = await bg({ type: 'backupFinish', sessionId: sessionId.current, picked });
      if (!r?.ok) throw new Error(r?.error === 'BACKUP_MISMATCH' ? 'The order does not match. Undo and try again.' : r?.error === 'BACKUP_EXPIRED' ? 'This backup session expired. Close it and start again.' : r?.error || 'Could not save');
      sessionId.current = ''; setSession(null); setPhase('done');
    } catch (e: any) { setErr(e?.message || 'Could not save'); } finally { setBusy(false); }
  };
  const chip = (id: string) => session?.chips.find((c) => c.id === id);
  const words = session?.wordCount ?? 12;
  if (phase === 'auth') return <div className="ob-backup"><RevealGate bg={bg} walletId={walletId} autoBiometric={autoBiometric} onGranted={() => setPhase('reveal')} onCancel={onCancel}/></div>;
  if (phase === 'done') return <div className="ob-backup" data-testid="backup-done"><Confetti/><div className="fx-success"><span className="fx-success-ic"><CheckCircle2 size={26}/></span><div><b>Your secret phrase is backed up</b><span>Keep your copy offline and somewhere only you can reach.</span></div></div><button className="ob-primary" onClick={onDone}>Done</button></div>;
  if (phase === 'reveal') return (
    <div className="ob-backup">
      <div className="fx-tips">
        <div><PenLine size={20}/><b>Write it down</b>All {words} words, in order, on paper.</div>
        <div><EyeOff size={20}/><b>Keep it offline</b>No screenshots, cloud notes or email.</div>
        <div><UserX size={20}/><b>Never share it</b>Harbour will never ask for your phrase.</div>
      </div>
      {loading ? <p className="ob-muted" role="status">Revealing...</p> : err ? <p className="ob-error" role="alert">{err}</p> : (
        <div className="ob-seed-wrap">
          {shown && session?.grid ? <SecretImage pic={session.grid} label="Secret phrase shown on screen" testid="seed-image" style={{ margin: '0 auto' }}/> : <SeedPlaceholder count={words}/>}
          {!shown && <button type="button" className="ob-reveal-cover" onClick={() => setShown(true)} aria-label="Reveal secret phrase" disabled={!session}><span><Eye size={20}/> Click to reveal<small>Make sure no one is watching</small></span></button>}
        </div>)}
      <div className="fx-row"><button className="ob-secondary" onClick={onCancel}>Cancel</button><button className="ob-primary" disabled={!shown || !session} onClick={() => { setSession((s) => (s ? { ...s, grid: null } : s)); setPhase('verify'); }} data-testid="backup-continue">I wrote it down</button></div>
    </div>
  );
  return (
    <div className="ob-backup" data-testid="backup-verify">
      <div className="fx-callout"><ShieldAlert size={18}/><span><b>Confirm your secret phrase.</b> Tap the words in the order you wrote them down. {picked.length} of {words} placed.</span></div>
      <ol className="ob-seed-grid ob-picked" aria-label="Selected words">{Array.from({ length: words }, (_, i) => { const c = picked[i] ? chip(picked[i]) : undefined; return <li key={i} aria-label={`Position ${i + 1}, ${c ? 'filled' : 'empty'}`} className={c ? 'ob-word filled' : 'ob-word'} style={state.firstWrong === i ? { borderColor: 'var(--hb-error)' } : undefined}><small>{i + 1}</small> {c ? <img src={c.image} width={c.width} height={c.height} alt="" aria-hidden="true" draggable={false} style={{ display: 'inline-block', verticalAlign: 'middle', userSelect: 'none', pointerEvents: 'none' }}/> : null}</li>; })}</ol>
      {state.firstWrong >= 0 && <p className="ob-error" role="alert">That word is not in the right place. Remove it and try again.</p>}
      {err && <p className="ob-error" role="alert">{err}</p>}
      <div className="ob-chips">{(session?.chips ?? []).map((c, n) => <button key={c.id} type="button" className="ob-chip" aria-label={`Word option ${n + 1}`} disabled={picked.includes(c.id)} onClick={() => pick(c.id)}><img src={c.image} width={c.width} height={c.height} alt="" aria-hidden="true" draggable={false} style={{ display: 'inline-block', verticalAlign: 'middle', userSelect: 'none', pointerEvents: 'none' }}/></button>)}</div>
      <div className="fx-row">
        <button className="ob-secondary" disabled={!picked.length} onClick={undo}><Undo2 size={16}/> Undo</button>
        <button className="ob-primary" disabled={!state.complete || busy} onClick={finish} data-testid="backup-verify-submit">{busy ? 'Saving...' : 'Verify'}</button>
      </div>
    </div>
  );
};
