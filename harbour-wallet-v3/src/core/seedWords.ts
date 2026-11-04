// Local, per-word check of a secret phrase while it is typed (seed-typing review 2026-11-04). The BIP39 word list is public, so
// checking words against it inside the page reveals nothing; the phrase itself is sent to the worker only once it has a valid
// length and every word is known (for the checksum check), instead of after every typing pause.
import { classifySecret, mnemonicWordCount } from './importKey';

export type PhraseAssessment =
  | { state: 'empty' } | { state: 'privateKey' } | { state: 'typing' }
  | { state: 'badWord'; index: number } | { state: 'tooLong' } | { state: 'complete' };

/** `raw` is the live field text; `words` the BIP39 list. The last word counts as unfinished (a prefix is fine) until a space follows. */
export function assessTypedPhrase(raw: string, words: ReadonlySet<string>, prefixes: ReadonlySet<string> = prefixSet(words)): PhraseAssessment {
  const t = String(raw ?? '').trim();
  if (!t) return { state: 'empty' };
  if (classifySecret(t) === 'privateKey') return { state: 'privateKey' };
  const list = t.toLowerCase().split(/\s+/);
  const unfinished = !/\s$/.test(raw);
  for (let i = 0; i < list.length; i++) {
    const w = list[i]; const last = i === list.length - 1;
    if (words.has(w)) continue;
    if (last && unfinished && prefixes.has(w)) continue;
    return { state: 'badWord', index: i };
  }
  const n = mnemonicWordCount(t);
  if (n > 24) return { state: 'tooLong' };
  if ((n === 12 || n === 18 || n === 24) && words.has(list[list.length - 1])) return { state: 'complete' };
  return { state: 'typing' };
}
/** Every prefix of every word (BIP39 English: 4 letters identify a word, so this stays small). */
export function prefixSet(words: ReadonlySet<string>): Set<string> {
  const out = new Set<string>(); for (const w of words) for (let i = 1; i <= w.length; i++) out.add(w.slice(0, i)); return out;
}
