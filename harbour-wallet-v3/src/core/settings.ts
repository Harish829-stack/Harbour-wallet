// Harbour settings model. Pure (no browser APIs) so it is unit-testable.
//
// Evidence (Trust Wallet extension 26.41.0, bundle RE; see evidences/re-evidence/26-settings/SETTINGS-SPEC.md):
//   [certain] settings slice initial state + reducer names            (background.js, `initialState$8`)
//   [certain] AUTO_LOCK_OPTIONS=[1,5,10,15,30,60,0], default 10, 0 = never, sanitizeLockTime
//   [certain] SUPPORTED_LOCALE (30 locales)                           (background.js, `init_intl`)
//   [certain] colour modes light | dark | system, default system
//   [certain] token cell layouts 1 | 2 | 3
//   [certain] 170-entry base-currency table with `rating` (popular = rating>0) (useSelectedBaseCurrency chunk)
// Deliberate Harbour deviations are marked `DEVIATION` below and listed in the spec.

// DEVIATION (HW-2026-011, CCSS B-06): TW offers 0 = "Never". Harbour always auto-locks, capped at 4 hours; a stored 0
// (or any value not in the list) is normalised to the default by sanitizeLockTime.
export const AUTO_LOCK_OPTIONS = [1, 5, 10, 15, 30, 60, 240] as const; // minutes
export const MAX_LOCK_MINUTES = 240;
export const DEFAULT_LOCK_MINUTES = 10;
export const isAutoLockEnabled = (m: number) => m > 0;
export const sanitizeLockTime = (m: unknown): number =>
  typeof m === 'number' && (AUTO_LOCK_OPTIONS as readonly number[]).includes(m) ? m : DEFAULT_LOCK_MINUTES;

// TW label rule (`useAutoLockLabel`): 0 -> Never; multiples of 60 -> "# hour(s)"; else "# minute(s)".
export function autoLockLabel(m: number): string {
  if (m === 0) return 'Never';
  if (m >= 60 && m % 60 === 0) { const h = m / 60; return `${h} ${h === 1 ? 'hour' : 'hours'}`; }
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
}

export const SUPPORTED_LOCALES = ['ar', 'bg-BG', 'my-MM', 'zh-CN', 'zh-TC', 'cs-CZ', 'da-DK', 'en', 'fr', 'de', 'el-GR', 'id', 'it', 'ja', 'kk-KZ', 'ko', 'lv-LV', 'lo-LA', 'pl-PL', 'pt', 'pt-BR', 'ro-RO', 'ru', 'si-LK', 'es-ES', 'es-LA', 'sv-SE', 'tr', 'uk-UA', 'vi'] as const;
// TW `checkLocale()`: same-language match, else "en". TW's single `find` returns the FIRST same-prefix entry, so a
// browser set to pt-BR gets plain "pt" because "pt" precedes "pt-BR" in the list. Harbour prefers an exact match first.
export function pickLocale(navigatorLanguage: string | undefined): string {
  const nl = navigatorLanguage ?? 'en';
  const all = SUPPORTED_LOCALES as readonly string[];
  return all.find((l) => l === nl) ?? all.find((l) => l.split('-')[0] === nl.split('-')[0]) ?? 'en';
}
// Browser-usable BCP-47 tag for Intl (zh-TC is not a valid region; TW's "TC" means Traditional Chinese).
export const intlTag = (locale: string): string => (locale === 'zh-TC' ? 'zh-TW' : locale === 'es-LA' ? 'es-419' : locale);
// TW label = capitalize(name) + " - " + locale.split("-")[0].toUpperCase(). The name text itself is not in the
// bundle (only message ids), so Harbour uses the language's own name from Intl.DisplayNames. [guessing]
export function localeLabel(locale: string, displayNames?: (tag: string) => string | undefined): string {
  const tag = intlTag(locale);
  let name: string | undefined;
  try { name = displayNames ? displayNames(tag) : new Intl.DisplayNames([tag], { type: 'language' }).of(tag); } catch { name = undefined; }
  const base = name ? name.charAt(0).toUpperCase() + name.slice(1) : locale;
  return `${base} - ${locale.split('-')[0].toUpperCase()}`;
}

export type ColorMode = 'light' | 'dark' | 'system';
export const COLOR_MODES: ColorMode[] = ['system', 'light', 'dark']; // TW enum order: LIGHT, DARK, SYSTEM; Harbour lists system first. [guessing] on TW row order
export type TokenLayout = 1 | 2 | 3;
export const TOKEN_LAYOUTS: TokenLayout[] = [1, 2, 3];

export interface Settings {
  version: 1;
  locale: string;
  baseCurrency: string;
  colorMode: ColorMode;
  lockTimeInMinutes: number;
  preferSidePanel: boolean;
  isDefaultWallet: boolean;
  layout: { tokenCellLayout: TokenLayout; hideNFTs: boolean; hideLowBalanceAssets: boolean };
  privacy: { hideBalancesOnDashboard: boolean };
  developerSettings: { isCustomNonceEnabled: boolean; isAdvancedGasControlsEnabled: boolean; isAdvancedTransactionDataEnabled: boolean; isEthSignEnabled: boolean };
  pushNotifications: { isPushEnabled: boolean; isSendAndReceiveEnabled: boolean; topics: Record<string, boolean> };
}

// TW defaults, except:
//  DEVIATION preferSidePanel: TW true. With true the toolbar icon opens the side panel instead of the popup,
//    which would silently change how an existing Harbour install behaves. Harbour starts false.
//  DEVIATION layout.hideNFTs / hideLowBalanceAssets: TW true/true. Harbour starts false/false so a fresh wallet
//    (all balances 0) does not render an empty Home list.
//  OMITTED privacy.isAnalyticsEnabled: Harbour has no analytics, so there is nothing to toggle.
export const DEFAULT_SETTINGS = (navigatorLanguage?: string): Settings => ({
  version: 1,
  locale: pickLocale(navigatorLanguage),
  baseCurrency: 'USD',
  colorMode: 'system',
  lockTimeInMinutes: DEFAULT_LOCK_MINUTES,
  preferSidePanel: false,
  isDefaultWallet: false,
  layout: { tokenCellLayout: 3, hideNFTs: false, hideLowBalanceAssets: false },
  privacy: { hideBalancesOnDashboard: false },
  developerSettings: { isCustomNonceEnabled: false, isAdvancedGasControlsEnabled: false, isAdvancedTransactionDataEnabled: false, isEthSignEnabled: false },
  pushNotifications: { isPushEnabled: true, isSendAndReceiveEnabled: true, topics: { product_announcement: true } },
});

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

// Apply an untrusted partial patch onto a settings object. Unknown keys are dropped, wrong types / out-of-range
// values are ignored (the existing value is kept). `currencies` is the set of valid base-currency codes.
export function applyPatch(cur: Settings, patch: unknown, currencies: ReadonlySet<string> | null = null): Settings {
  if (!isObj(patch)) return cur;
  const next: Settings = JSON.parse(JSON.stringify(cur));
  if (typeof patch.locale === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(patch.locale)) next.locale = patch.locale;
  if (typeof patch.baseCurrency === 'string' && (!currencies || currencies.has(patch.baseCurrency))) next.baseCurrency = patch.baseCurrency;
  if (patch.colorMode === 'light' || patch.colorMode === 'dark' || patch.colorMode === 'system') next.colorMode = patch.colorMode;
  if ('lockTimeInMinutes' in patch) next.lockTimeInMinutes = (AUTO_LOCK_OPTIONS as readonly number[]).includes(patch.lockTimeInMinutes as number) ? (patch.lockTimeInMinutes as number) : next.lockTimeInMinutes;
  next.preferSidePanel = bool(patch.preferSidePanel, next.preferSidePanel);
  next.isDefaultWallet = bool(patch.isDefaultWallet, next.isDefaultWallet);
  if (isObj(patch.layout)) {
    const l = patch.layout;
    if (l.tokenCellLayout === 1 || l.tokenCellLayout === 2 || l.tokenCellLayout === 3) next.layout.tokenCellLayout = l.tokenCellLayout;
    next.layout.hideNFTs = bool(l.hideNFTs, next.layout.hideNFTs);
    next.layout.hideLowBalanceAssets = bool(l.hideLowBalanceAssets, next.layout.hideLowBalanceAssets);
  }
  if (isObj(patch.privacy)) next.privacy.hideBalancesOnDashboard = bool(patch.privacy.hideBalancesOnDashboard, next.privacy.hideBalancesOnDashboard);
  if (isObj(patch.developerSettings)) {
    const d = patch.developerSettings; const t = next.developerSettings;
    t.isCustomNonceEnabled = bool(d.isCustomNonceEnabled, t.isCustomNonceEnabled);
    t.isAdvancedGasControlsEnabled = bool(d.isAdvancedGasControlsEnabled, t.isAdvancedGasControlsEnabled);
    t.isAdvancedTransactionDataEnabled = bool(d.isAdvancedTransactionDataEnabled, t.isAdvancedTransactionDataEnabled);
    t.isEthSignEnabled = bool(d.isEthSignEnabled, t.isEthSignEnabled);
  }
  if (isObj(patch.pushNotifications)) {
    const p = patch.pushNotifications; const t = next.pushNotifications;
    // TW `setPushNotifications` sets isPushEnabled and isSendAndReceiveEnabled together.
    if (typeof p.isPushEnabled === 'boolean') { t.isPushEnabled = p.isPushEnabled; t.isSendAndReceiveEnabled = p.isPushEnabled; }
    if (isObj(p.topics)) for (const [k, v] of Object.entries(p.topics)) if (/^[a-z_]{1,40}$/.test(k) && typeof v === 'boolean') t.topics[k] = v;
  }
  return next;
}

// Tolerant load: anything stored (older shape, corrupt, missing) -> a valid Settings.
export function normalizeSettings(raw: unknown, navigatorLanguage?: string, currencies: ReadonlySet<string> | null = null): Settings {
  return applyPatch(DEFAULT_SETTINGS(navigatorLanguage), raw, currencies);
}

// Which settings changes need a background side effect.
export function sideEffects(prev: Settings, next: Settings): { lockTimer: boolean; sidePanel: boolean } {
  return { lockTimer: prev.lockTimeInMinutes !== next.lockTimeInMinutes, sidePanel: prev.preferSidePanel !== next.preferSidePanel };
}

// ---------- Home asset visibility (Preferences: hide <$0.01, hide NFTs) ----------
// TW hides assets whose fiat value is below one cent. Harbour only hides an asset when it KNOWS the value:
// an unknown price/balance (RPC failed, non-EVM asset with no balance support) is never hidden, so a network
// error cannot make the portfolio look empty.
export const LOW_BALANCE_USD = 0.01;
export function isLowBalance(usdValue: number | null | undefined): boolean {
  return typeof usdValue === 'number' && Number.isFinite(usdValue) && usdValue < LOW_BALANCE_USD;
}
