// Secret-phrase backup verification (TW chunks/backup-seedphrase: step 1 shows the phrase after password/biometric
// re-authentication, step 2 "verify seed phrase" asks the user to pick the words back in order; mismatch -> validation error).
export function shuffleWords(words: string[], rand: () => number = Math.random): string[] {
  const a = words.map((w, i) => ({ w, i })); // keep indexes so duplicate words stay distinct
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.map((x) => `${x.i}:${x.w}`);
}
export const chipWord = (chip: string): string => chip.slice(chip.indexOf(':') + 1);
export interface VerifyState { complete: boolean; valid: boolean; firstWrong: number }
/** `selected` is the sequence of chosen words; it is valid while it is a prefix of `words`. */
export function verifySelection(words: string[], selected: string[]): VerifyState {
  let firstWrong = -1;
  for (let i = 0; i < selected.length; i++) if (selected[i] !== words[i]) { firstWrong = i; break; }
  return { complete: selected.length === words.length && firstWrong === -1, valid: firstWrong === -1, firstWrong };
}
