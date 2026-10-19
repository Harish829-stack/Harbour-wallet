import React, { useEffect, useMemo, useState } from 'react';
import { Eye, ShieldAlert } from 'lucide-react';
import { RevealGate } from '../wallet/revealGate';
import { chipWord, shuffleWords, verifySelection } from '../../core/backupVerify';

type Phase = 'auth' | 'reveal' | 'verify' | 'done';
/** Secret-phrase backup: re-authenticate, reveal, then prove it by tapping the words in order (TW "BACKUP_SEEDPHRASE" flow).
 *  The phrase is held in component state only and dropped on unmount. */
export const BackupFlow: React.FC<{ bg: (m: any) => Promise<any>; walletId?: string; presetMnemonic?: string; granted?: boolean; onDone: () => void; onCancel: () => void }> = ({ bg, walletId, presetMnemonic, granted, onDone, onCancel }) => {
  const [phase, setPhase] = useState<Phase>(presetMnemonic || granted ? 'reveal' : 'auth');
  const [phrase, setPhrase] = useState(presetMnemonic ?? ''); const [loading, setLoading] = useState(!presetMnemonic && !!granted); const [err, setErr] = useState('');
  const [shown, setShown] = useState(false); const [picked, setPicked] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const words = useMemo(() => phrase.split(' ').filter(Boolean), [phrase]);
  const chips = useMemo(() => shuffleWords(words), [phrase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setPhrase(''), []);
  useEffect(() => {
    if (phase !== 'reveal' || presetMnemonic || phrase) return;
    let live = true; setLoading(true);
    bg({ type: 'revealMnemonic', walletId }).then((r) => { if (!live) return; if (r?.ok) setPhrase(r.mnemonic); else setErr(r?.error === 'AUTH_REQUIRED' ? 'Verification expired. Go back and try again.' : r?.error || 'Could not reveal the phrase'); }).catch(() => live && setErr('Could not reveal the phrase')).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = verifySelection(words, picked.map(chipWord));
  const finish = async () => {
    if (busy) return; setBusy(true); setErr('');
    try { const r = await bg({ type: 'markBackedUp', walletId }); if (!r?.ok && r?.ok !== undefined) throw new Error(r.error || 'Could not save'); setPhrase(''); setPhase('done'); }
    catch (e: any) { setErr(e?.message || 'Could not save'); } finally { setBusy(false); }
  };
  if (phase === 'auth') return <div className="ob-backup"><RevealGate bg={bg} walletId={walletId} onGranted={() => setPhase('reveal')} onCancel={onCancel}/></div>;
  if (phase === 'done') return <div className="ob-backup" data-testid="backup-done"><div className="ob-banner"><ShieldAlert size={20} aria-hidden="true"/><span>Your secret phrase is backed up.</span></div><button className="ob-primary" onClick={onDone}>Done</button></div>;
  if (phase === 'reveal') return (
    <div className="ob-backup">
      <div className="ob-banner"><ShieldAlert size={20} aria-hidden="true"/><span>Write these {words.length || 12} words on paper, in order, and never share them with anyone.</span></div>
      {loading ? <p className="ob-muted" role="status">Revealing...</p> : err ? <p className="ob-error" role="alert">{err}</p> : (
        <div className="ob-seed-wrap">
          <ol className="ob-seed-grid" style={{ filter: shown ? 'none' : 'blur(7px)' }} aria-hidden={!shown}>{words.map((w, i) => <li key={i} className="ob-word"><small>{i + 1}</small> {w}</li>)}</ol>
          {!shown && <button type="button" className="ob-reveal-cover" onClick={() => setShown(true)} aria-label="Reveal secret phrase"><span><Eye size={16}/> Click to reveal</span></button>}
        </div>)}
      <div style={{ display: 'flex', gap: 12 }}><button className="ob-secondary" onClick={onCancel}>Cancel</button><button className="ob-primary" disabled={!shown || !words.length} onClick={() => setPhase('verify')} data-testid="backup-continue">Continue</button></div>
    </div>
  );
  return (
    <div className="ob-backup" data-testid="backup-verify">
      <p>Tap the words in the correct order.</p>
      <ol className="ob-seed-grid ob-picked" aria-label="Selected words">{words.map((_, i) => <li key={i} className="ob-word" style={state.firstWrong === i ? { borderColor: 'var(--hb-error)' } : undefined}><small>{i + 1}</small> {picked[i] ? chipWord(picked[i]) : ''}</li>)}</ol>
      {state.firstWrong >= 0 && <p className="ob-error" role="alert">That word is not in the right place. Remove it and try again.</p>}
      {err && <p className="ob-error" role="alert">{err}</p>}
      <div className="ob-chips">{chips.map((c) => <button key={c} type="button" className="ob-chip" disabled={picked.includes(c)} onClick={() => setPicked([...picked, c])}>{chipWord(c)}</button>)}</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="ob-secondary" disabled={!picked.length} onClick={() => setPicked(picked.slice(0, -1))}>Undo</button>
        <button className="ob-primary" disabled={!state.complete || busy} onClick={finish} data-testid="backup-verify-submit">{busy ? 'Saving...' : 'Verify'}</button>
      </div>
    </div>
  );
};
