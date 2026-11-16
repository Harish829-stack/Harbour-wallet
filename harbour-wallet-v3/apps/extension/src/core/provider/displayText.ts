// Display integrity for text a site controls (messages to sign, typed-data values, sign-in fields, token and network names).
// Unicode has characters that are invisible or that change the ORDER in which the surrounding text is drawn (bidirectional
// overrides such as U+202E). A site can use them so the approval screen reads differently from the bytes that get signed:
// reversed domains, hidden words, text pushed out of sight. Same class as MetaMask's right-to-left-override fix
// (sanitizeString): such characters are never dropped silently on the approval screen, they are shown as a visible escape
// (for example \u{202E}), so what the user reads is what the wallet signs.
//
// This only changes what is DRAWN. Signing always uses the original request stored in the pending queue.

// C0 controls except TAB and LF, DEL and C1 controls, soft hyphen, Arabic letter mark, zero-width space and bidi marks (200B, 200E, 200F),
// line/paragraph separators and bidi embeddings/overrides (2028-202E), word joiner and invisible operators (2060-2064),
// bidi isolates (2066-2069), deprecated format characters (206A-206F), BOM, interlinear annotation (FFF9-FFFB), tag characters.
// The zero-width joiner / non-joiner (200C, 200D) stay: emoji sequences and several scripts need them, and they cannot reorder text.
const HIDDEN = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B\u200E\u200F\u2028-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uDB40[\uDC00-\uDC7F]/g;

/** True when the text contains a character that is invisible or reorders the text around it. */
export const hasHiddenChars = (s: string): boolean => { HIDDEN.lastIndex = 0; return HIDDEN.test(s); };

/** The text with every hidden / reordering character replaced by a visible escape such as \u{202E}. Everything else is unchanged. */
export function visibleText(s: string): string {
  return s.replace(HIDDEN, (c) => `\\u{${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}}`);
}

/** Site names and other short labels that are stored and listed later: hidden characters are removed, whitespace collapsed. */
export function plainLabel(s: unknown, max: number): string {
  return String(s ?? '').replace(HIDDEN, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** `visibleText` applied to every string (values and object keys) of a JSON-like value. Returns a copy; the input is not changed. */
export function visibleDeep<T>(v: T, depth = 0): T {
  if (typeof v === 'string') return visibleText(v) as unknown as T;
  if (!v || typeof v !== 'object' || depth > 32) return v;
  if (Array.isArray(v)) return v.map((x) => visibleDeep(x, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[visibleText(k)] = visibleDeep(x, depth + 1);
  return out as T;
}
