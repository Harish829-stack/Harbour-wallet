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
/** Counts a wrong one-time code. Returns the error the UI should get: after QR_MAX_WRONG_CODES the staged keystores are deleted. */
export async function qrWrongCode(stageId: unknown): Promise<'INCORRECT_CODE' | 'QR_TOO_MANY_ATTEMPTS'> {
  const s = await session.get<{ stageId: string; keys: any[]; exp: number; wrong?: number }>(KEY);
  if (!s || s.stageId !== stageId) return 'INCORRECT_CODE';
  const wrong = (s.wrong ?? 0) + 1;
  if (wrong >= QR_MAX_WRONG_CODES) { await session.remove(KEY); return 'QR_TOO_MANY_ATTEMPTS'; }
  await session.set(KEY, { ...s, wrong }); return 'INCORRECT_CODE';
}
