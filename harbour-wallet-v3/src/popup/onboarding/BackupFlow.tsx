import React, { useEffect, useMemo, useState } from 'react';
import { Eye, ShieldAlert, PenLine, EyeOff, UserX, CheckCircle2, Undo2 } from 'lucide-react';
import { Confetti } from './FlowFrame';
import { RevealGate } from '../wallet/revealGate';
import { SeedCanvas, SecretWord } from '../wallet/SeedCanvas';
import { chipWord, shuffleWords, verifySelection } from '../../core/backupVerify';

type Phase = 'auth' | 'reveal' | 'verify' | 'done';
/** Secret-phrase backup: re-authenticate, reveal, then prove it by tapping the words in order (TW "BACKUP_SEEDPHRASE" flow).
 *  The phrase is held in component state only and dropped on unmount. */
export const BackupFlow: React.FC<{ bg: (m: any) => Promise<any>; walletId?: string; presetMnemonic?: string; granted?: boolean; autoBiometric?: boolean; onDone: () => void; onCancel: () => void }> = ({ bg, walletId, presetMnemonic, granted, autoBiometric, onDone, onCancel }) => {
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
  if (phase === 'auth') return <div className="ob-backup"><RevealGate bg={bg} walletId={walletId} autoBiometric={autoBiometric} onGranted={() => setPhase('reveal')} onCancel={onCancel}/></div>;
  if (phase === 'done') return <div className="ob-backup" data-testid="backup-done"><Confetti/><div className="fx-success"><span className="fx-success-ic"><CheckCircle2 size={26}/></span><div><b>Your secret phrase is backed up</b><span>Keep your copy offline and somewhere only you can reach.</span></div></div><button className="ob-primary" onClick={onDone}>Done</button></div>;
  if (phase === 'reveal') return (
    <div className="ob-backup">
      <div className="fx-tips">
        <div><PenLine size={20}/><b>Write it down</b>All {words.length || 12} words, in order, on paper.</div>
        <div><EyeOff size={20}/><b>Keep it offline</b>No screenshots, cloud notes or email.</div>
        <div><UserX size={20}/><b>Never share it</b>Harbour will never ask for your phrase.</div>
      </div>
      {loading ? <p className="ob-muted" role="status">Revealing...</p> : err ? <p className="ob-error" role="alert">{err}</p> : (
        <div className="ob-seed-wrap">
          <SeedCanvas words={words} revealed={shown}/>
          {!shown && <button type="button" className="ob-reveal-cover" onClick={() => setShown(true)} aria-label="Reveal secret phrase"><span><Eye size={20}/> Click to reveal<small>Make sure no one is watching</small></span></button>}
        </div>)}
      <div className="fx-row"><button className="ob-secondary" onClick={onCancel}>Cancel</button><button className="ob-primary" disabled={!shown || !words.length} onClick={() => setPhase('verify')} data-testid="backup-continue">I wrote it down</button></div>
    </div>
  );
  return (
    <div className="ob-backup" data-testid="backup-verify">
      <div className="fx-callout"><ShieldAlert size={18}/><span><b>Confirm your secret phrase.</b> Tap the words in the order you wrote them down. {picked.length} of {words.length} placed.</span></div>
      <ol className="ob-seed-grid ob-picked" aria-label="Selected words">{words.map((_, i) => <li key={i} aria-label={`Position ${i + 1}, ${picked[i] ? 'filled' : 'empty'}`} className={picked[i] ? 'ob-word filled' : 'ob-word'} style={state.firstWrong === i ? { borderColor: 'var(--hb-error)' } : undefined}><small>{i + 1}</small> {picked[i] ? <SecretWord word={chipWord(picked[i])}/> : null}</li>)}</ol>
      {state.firstWrong >= 0 && <p className="ob-error" role="alert">That word is not in the right place. Remove it and try again.</p>}
      {err && <p className="ob-error" role="alert">{err}</p>}
      <div className="ob-chips">{chips.map((c, n) => <button key={c} type="button" className="ob-chip" aria-label={`Word option ${n + 1}`} disabled={picked.includes(c)} onClick={() => setPicked([...picked, c])}><SecretWord word={chipWord(c)}/></button>)}</div>
      <div className="fx-row">
        <button className="ob-secondary" disabled={!picked.length} onClick={() => setPicked(picked.slice(0, -1))}><Undo2 size={16}/> Undo</button>
        <button className="ob-primary" disabled={!state.complete || busy} onClick={finish} data-testid="backup-verify-submit">{busy ? 'Saving...' : 'Verify'}</button>
      </div>
    </div>
  );
};
