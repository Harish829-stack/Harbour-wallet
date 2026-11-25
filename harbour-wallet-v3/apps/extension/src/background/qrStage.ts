// QR wallet import (Trust Wallet mobile export): the UI decodes the camera frames and hands the encrypted keystores to the
// worker at once (`qrStage`), then keeps only an opaque stage id. The one-time code typed later is matched against the staged
// keystores here, so the UI never holds both halves (ciphertext + code) at the same time. Held in storage.session (trusted
// contexts only, memory-backed, cleared when the browser closes) for 5 minutes.
// The 6-character code is weak on its own: a screen recorder that sees the camera preview (the QR) and the typed code has both
// halves. So the stage is short-lived and is DESTROYED after 5 wrong codes, which also stops online guessing (seed-typing review).
import { session } from '../core/storage';

const KEY = 'wallet:qrStage';
const TTL_MS = 5 * 60_000;
export const QR_MAX_WRONG_CODES = 5;
const MAX_BYTES = 1_000_000;
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

export async function stageQrKeys(raw: unknown): Promise<{ ok: true; stageId: string; count: number } | { ok: false; error: string }> {
  const keys = Array.isArray(raw) ? raw : [];
  if (!keys.length || keys.length > 100) return { ok: false, error: 'Unexpected QR contents' };
  if (JSON.stringify(keys).length > MAX_BYTES) return { ok: false, error: 'Unexpected QR contents' };
  const stageId = hex(16);
  await session.set(KEY, { stageId, keys, exp: Date.now() + TTL_MS, wrong: 0 });
  return { ok: true, stageId, count: keys.length };
}

/** The staged keystores for `stageId`, or null when the id is wrong or the stage expired. */
export async function readQrStage(stageId: unknown): Promise<any[] | null> {
  const s = await session.get<{ stageId: string; keys: any[]; exp: number }>(KEY);
  if (!s || typeof stageId !== 'string' || s.stageId !== stageId) return null;
  if (s.exp < Date.now()) { await session.remove(KEY); return null; }
  return s.keys;
}
export async function clearQrStage(): Promise<void> { await session.remove(KEY); }
let qrQueue: Promise<unknown> = Promise.resolve();
/**
 * Checks a one-time code against the staged keystores (BUG-07). Checks run one at a time on a worker-wide queue and each attempt is
 * counted BEFORE `verify` runs (it is refunded when the code turns out right), so a batch of parallel guesses costs one strike each and
 * the stage is destroyed after QR_MAX_WRONG_CODES wrong codes however they are sent. `verify` returns whether the code was wrong.
 */
export function qrCodeCheck<R>(stageId: unknown, verify: () => Promise<{ wrongCode: boolean; value: R }>):
  Promise<{ ok: true; value: R } | { ok: false; error: 'INCORRECT_CODE' | 'QR_TOO_MANY_ATTEMPTS' | 'QR_EXPIRED' }> {
  const run = qrQueue.then(async () => {
    const s = await session.get<{ stageId: string; keys: any[]; exp: number; wrong?: number }>(KEY);
    if (!s || typeof stageId !== 'string' || s.stageId !== stageId) return { ok: false as const, error: 'QR_EXPIRED' as const };
    if (s.exp < Date.now()) { await session.remove(KEY); return { ok: false as const, error: 'QR_EXPIRED' as const }; }
    const before = s.wrong ?? 0;
    if (before >= QR_MAX_WRONG_CODES) { await session.remove(KEY); return { ok: false as const, error: 'QR_TOO_MANY_ATTEMPTS' as const }; }
    await session.set(KEY, { ...s, wrong: before + 1 }); // counted first: a check that is interrupted still costs a strike
    const r = await verify();
    if (!r.wrongCode) { await session.set(KEY, { ...s, wrong: before }); return { ok: true as const, value: r.value }; }
    if (before + 1 >= QR_MAX_WRONG_CODES) { await session.remove(KEY); return { ok: false as const, error: 'QR_TOO_MANY_ATTEMPTS' as const }; }
    return { ok: false as const, error: 'INCORRECT_CODE' as const };
  });
  qrQueue = run.then(() => undefined, () => undefined);
  return run;
}
/** Counts a wrong one-time code (kept for callers that verify outside qrCodeCheck). Serialized on the same queue. */
export function qrWrongCode(stageId: unknown): Promise<'INCORRECT_CODE' | 'QR_TOO_MANY_ATTEMPTS'> {
  return qrCodeCheck(stageId, async () => ({ wrongCode: true, value: null })).then((r) => (r.ok ? 'INCORRECT_CODE' : r.error === 'QR_EXPIRED' ? 'INCORRECT_CODE' : r.error));
}
