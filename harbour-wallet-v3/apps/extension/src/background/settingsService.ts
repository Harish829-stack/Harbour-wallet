// Settings persistence + the side effects that make settings REAL (auto-lock alarm, side panel, exchange rates).
//
// Auto-lock design follows the TW extension (BrowserService.runTimer/stopTimer/resetTimer in background.js):
//   chrome.alarms.create(NAME, { delayInMinutes: lockTime }) when auto-lock is enabled (0 = never -> no alarm),
//   re-armed ("reset") on UI activity and when the timer option changes; the alarm handler locks the vault.
import browser from 'webextension-polyfill';
import { local, KEYS } from '../core/storage';
import { applyPatch, normalizeSettings, sideEffects, isAutoLockEnabled, type Settings } from '../core/settings';
import { CURRENCY_CODES, getRate, type RateStore, type UsdPer } from '../core/fiat';

export const LOCK_ALARM = 'harbour:auto-lock';

// Serialise read-modify-write so two quick toggles cannot lose an update.
let chain: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => { const run = chain.then(fn, fn); chain = run.catch(() => undefined); return run; };

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await local.get(KEYS.SETTINGS), typeof navigator !== 'undefined' ? navigator.language : 'en', CURRENCY_CODES);
}

export const rateStore: RateStore = {
  get: async () => { const v = await local.get<{ at: number; usdPer: UsdPer }>(KEYS.FIAT_RATES); return v && typeof v.at === 'number' && v.usdPer && typeof v.usdPer === 'object' ? v : undefined; },
  set: (v) => local.set(KEYS.FIAT_RATES, v),
};
export async function cachedRate(code: string): Promise<{ code: string; usdPer: number; at: number } | null> {
  if (code === 'USD') return { code, usdPer: 1, at: Date.now() };
  const v = await rateStore.get(); const r = v?.usdPer?.[code];
  return typeof r === 'number' && r > 0 ? { code, usdPer: r, at: v!.at } : null;
}

// ---- auto-lock timer
export async function armLockTimer(minutes?: number): Promise<void> {
  const m = minutes ?? (await loadSettings()).lockTimeInMinutes;
  await browser.alarms.clear(LOCK_ALARM);
  if (isAutoLockEnabled(m)) await browser.alarms.create(LOCK_ALARM, { delayInMinutes: m });
}
export const clearLockTimer = () => browser.alarms.clear(LOCK_ALARM);

// ---- side panel (TW: `preferSidePanel`, row shown only when the browser supports it)
export const sidePanelSupported = (): boolean => typeof chrome !== 'undefined' && typeof (chrome as any).sidePanel?.setPanelBehavior === 'function';
export async function applySidePanel(prefer: boolean): Promise<boolean> {
  if (!sidePanelSupported()) return false;
  try { await (chrome as any).sidePanel.setPanelBehavior({ openPanelOnActionClick: prefer }); return true; } catch { return false; }
}

// Apply a validated patch. A base-currency change is only accepted when an exchange rate for it is available,
// otherwise the whole Home screen would silently show wrong (unconverted) numbers.
export async function saveSettings(patch: unknown): Promise<{ ok: true; settings: Settings; rate: { code: string; usdPer: number; at: number } | null; stale?: boolean } | { ok: false; error: string }> {
  return serial(async () => {
    const prev = await loadSettings();
    const next = applyPatch(prev, patch, CURRENCY_CODES);
    let stale = false;
    if (next.baseCurrency !== prev.baseCurrency) {
      const r = await getRate(next.baseCurrency, rateStore);
      if (!r.ok) return { ok: false as const, error: r.error };
      stale = r.stale;
    }
    await local.set(KEYS.SETTINGS, next);
    const fx = sideEffects(prev, next);
    if (fx.lockTimer) await armLockTimer(next.lockTimeInMinutes);
    if (fx.sidePanel) await applySidePanel(next.preferSidePanel);
    return { ok: true as const, settings: next, rate: await cachedRate(next.baseCurrency), stale };
  });
}
