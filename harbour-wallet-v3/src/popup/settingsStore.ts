// Popup-side settings store. One module-level source of truth that:
//   * mirrors the persisted settings (background `getSettings` / `setSettings`),
//   * applies the colour mode to <html data-theme>,
//   * holds the active fiat context so every money string in the UI converts + formats the same way,
//   * pings the background on user activity so the auto-lock timer counts idle time (TW: react-idle-timer -> RESET_TIMER).
import { useSyncExternalStore } from 'react';
import browser from 'webextension-polyfill';
import { DEFAULT_SETTINGS, normalizeSettings, applyPatch, intlTag, type Settings, type ColorMode } from '../core/settings';
import { CURRENCY_CODES, USD_CTX, formatFiat, formatFiatCompact, formatFiatPrice, formatFiatSigned, type FiatCtx, type UsdPer } from '../core/fiat';

type Bg = (m: any) => Promise<any>;
interface State { settings: Settings; fiat: FiatCtx; sidePanelSupported: boolean; loaded: boolean; rateStale: boolean }

let state: State = { settings: DEFAULT_SETTINGS(typeof navigator !== 'undefined' ? navigator.language : 'en'), fiat: { ...USD_CTX }, sidePanelSupported: false, loaded: false, rateStale: false };
const listeners = new Set<() => void>();
export const getSettingsState = () => state;
export const subscribeSettings = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useSettingsState = () => useSyncExternalStore(subscribeSettings, getSettingsState, getSettingsState);

// ---- theme
let mql: MediaQueryList | null = null;
const onScheme = () => paintTheme(state.settings.colorMode);
export function effectiveTheme(mode: ColorMode, prefersDark: boolean): 'light' | 'dark' { return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode; }
function paintTheme(mode: ColorMode) {
  if (typeof document === 'undefined') return;
  // Onboarding now uses the same --hb-* tokens as the wallet, so it follows the colour mode too.
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = effectiveTheme(mode, dark);
}
export function applyTheme(mode: ColorMode) {
  paintTheme(mode);
  if (typeof matchMedia !== 'function') return;
  if (!mql) mql = matchMedia('(prefers-color-scheme: dark)');
  mql.removeEventListener('change', onScheme);
  if (mode === 'system') mql.addEventListener('change', onScheme);
}

function commit(settings: Settings, rate: { code: string; usdPer: number } | null, extra: Partial<State> = {}) {
  const usdPer = settings.baseCurrency === 'USD' ? 1 : rate?.code === settings.baseCurrency ? rate.usdPer : 0;
  // No rate for the chosen currency => show USD rather than numbers converted with a wrong/zero rate.
  const fiat: FiatCtx = usdPer > 0 ? { code: settings.baseCurrency, usdPer, locale: settings.locale } : { code: 'USD', usdPer: 1, locale: settings.locale };
  state = { ...state, ...extra, settings, fiat, loaded: true };
  applyTheme(settings.colorMode);
  listeners.forEach((l) => l());
}

// Read persisted settings + cached rate straight from extension storage so the very first paint already has the
// right theme and currency (no flash). Never throws.
export async function initSettingsFromStorage(): Promise<void> {
  try {
    const got = await browser.storage.local.get(['wallet:settings', 'wallet:fiatRates']);
    const settings = normalizeSettings(got['wallet:settings'], navigator.language, CURRENCY_CODES);
    const table = (got['wallet:fiatRates'] as { usdPer?: UsdPer } | undefined)?.usdPer;
    const r = table?.[settings.baseCurrency];
    commit(settings, typeof r === 'number' && r > 0 ? { code: settings.baseCurrency, usdPer: r } : null);
  } catch { commit(state.settings, null); }
}

export async function refreshSettings(bg: Bg): Promise<void> {
  try {
    const r = await bg({ type: 'getSettings' });
    if (r?.ok) commit(normalizeSettings(r.settings, navigator.language, CURRENCY_CODES), r.rate ?? null, { sidePanelSupported: !!r.sidePanelSupported });
  } catch { /* keep what we have */ }
  void refreshRate(bg);
}
// Refresh the base-currency rate in the background (stale cache keeps showing meanwhile).
export async function refreshRate(bg: Bg): Promise<void> {
  const code = state.settings.baseCurrency;
  if (code === 'USD') return;
  try {
    const r = await bg({ type: 'getFiatRate', code });
    if (r?.ok && code === state.settings.baseCurrency) commit(state.settings, { code, usdPer: r.usdPer }, { rateStale: !!r.stale });
  } catch { /* offline: keep the cached rate */ }
}

// Persist a patch. Resolves with the error text when the background refuses (e.g. no exchange rate for the currency).
// Everything except a currency switch is applied optimistically (same validator as the background) and rolled
// back if the save fails; a currency switch waits for the background because it needs an exchange rate first.
const rateFor = (code: string) => (state.fiat.code === code && code !== 'USD' ? { code, usdPer: state.fiat.usdPer } : null);
function restore(settings: Settings, fiat: FiatCtx) { state = { ...state, settings, fiat }; applyTheme(settings.colorMode); listeners.forEach((l) => l()); }
export async function updateSettings(bg: Bg, patch: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  const beforeSettings = state.settings; const beforeFiat = state.fiat;
  const currencyChange = typeof patch.baseCurrency === 'string' && patch.baseCurrency !== beforeSettings.baseCurrency;
  if (!currencyChange) commit(applyPatch(beforeSettings, patch, CURRENCY_CODES), rateFor(beforeSettings.baseCurrency));
  try {
    const r = await bg({ type: 'setSettings', patch });
    if (!r?.ok) { restore(beforeSettings, beforeFiat); return { ok: false, error: r?.error || 'Could not save settings' }; }
    commit(normalizeSettings(r.settings, navigator.language, CURRENCY_CODES), r.rate ?? null, { rateStale: !!r.stale });
    return { ok: true };
  } catch (e: any) {
    restore(beforeSettings, beforeFiat);
    return { ok: false, error: e?.message || 'Could not save settings' };
  }
}

// ---- money formatting used across the UI (all inputs are USD numbers)
export const money = (usd: number) => formatFiat(usd, state.fiat);
export const moneySigned = (usd: number) => formatFiatSigned(usd, state.fiat);
export const moneyPrice = (usd: number) => formatFiatPrice(usd, state.fiat);
export const moneyCompact = (usd: number) => formatFiatCompact(usd, state.fiat);
export const currentLocaleTag = () => intlTag(state.settings.locale);
export const fmtNumber = (n: number, opts?: Intl.NumberFormatOptions) => { try { return n.toLocaleString(currentLocaleTag(), opts); } catch { return n.toLocaleString(undefined, opts); } };

// ---- activity ping for the auto-lock timer (throttled; only while a wallet screen is mounted)
let lastPing = 0;
export function startActivityPings(bg: Bg, everyMs = 20_000): () => void {
  const ping = () => { const now = Date.now(); if (now - lastPing < everyMs) return; lastPing = now; void bg({ type: 'activity' }).catch(() => {}); };
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  events.forEach((e) => window.addEventListener(e, ping, { passive: true }));
  ping();
  return () => events.forEach((e) => window.removeEventListener(e, ping));
}
