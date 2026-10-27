// Secret-phrase backup verification that never sends a word to the UI.
// The worker paints every word as an image tile and gives the UI only opaque chip ids; the UI sends back the order it tapped.
// The session (storage.session) keeps the *equality pattern* of the words, never the words: posClass[i] is the class of the
// word at position i and chipClass[id] the class of the word on that chip. Equal words share a class, so either copy of a
// repeated word is accepted in either of its positions.
export interface BackupPlan { posClass: number[]; chips: { id: string; index: number }[]; chipClass: Record<string, number> }
export interface BackupCheck { valid: boolean; complete: boolean; firstWrong: number; count: number }

export function planBackup(words: string[], randomId: () => string, rand: () => number = Math.random): BackupPlan {
  const classes = new Map<string, number>();
  const posClass = words.map((w) => { if (!classes.has(w)) classes.set(w, classes.size); return classes.get(w)!; });
  const chips = words.map((_, index) => ({ id: randomId(), index }));
  for (let i = chips.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [chips[i], chips[j]] = [chips[j], chips[i]]; }
  const chipClass: Record<string, number> = Object.create(null);
  for (const c of chips) chipClass[c.id] = posClass[c.index];
  return { posClass, chips, chipClass };
}

/** `picked` is the ordered list of chip ids the user tapped. Valid while it is a correct prefix; complete when all positions match. */
export function checkPicks(s: { posClass: number[]; chipClass: Record<string, number> }, picked: unknown): BackupCheck {
  const list = Array.isArray(picked) ? picked : [];
  const ids = list.filter((x): x is string => typeof x === 'string');
  if (ids.length !== list.length || new Set(ids).size !== ids.length || ids.length > s.posClass.length) return { valid: false, complete: false, firstWrong: 0, count: ids.length };
  let firstWrong = -1;
  for (let i = 0; i < ids.length; i++) {
    const c = Object.prototype.hasOwnProperty.call(s.chipClass, ids[i]) ? s.chipClass[ids[i]] : undefined;
    if (c === undefined || c !== s.posClass[i]) { firstWrong = i; break; }
  }
  return { valid: firstWrong === -1, complete: firstWrong === -1 && ids.length === s.posClass.length, firstWrong, count: ids.length };
}
