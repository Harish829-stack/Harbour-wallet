import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './settings'; export * from './fiat';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

// ---------- auto-lock (TW: AUTO_LOCK_OPTIONS=[1,5,10,15,30,60,0], default 10) ----------
test('auto-lock options, default and sanitising (HW-011: no "Never", max 4 h)', () => {
  assert.deepEqual([...M.AUTO_LOCK_OPTIONS], [1, 5, 10, 15, 30, 60, 240]);
  assert.equal(M.DEFAULT_LOCK_MINUTES, 10); assert.equal(M.MAX_LOCK_MINUTES, 240);
  assert.equal(M.sanitizeLockTime(30), 30); assert.equal(M.sanitizeLockTime(0), 10); assert.equal(M.sanitizeLockTime(240), 240);
  for (const bad of [2, -1, 61, '5', null, undefined, NaN]) assert.equal(M.sanitizeLockTime(bad), 10);
  assert.equal(M.isAutoLockEnabled(0), false); assert.equal(M.isAutoLockEnabled(1), true);
});
test('auto-lock labels follow useAutoLockLabel', () => {
  assert.deepEqual([1, 5, 10, 15, 30, 60, 240].map(M.autoLockLabel), ['1 minute', '5 minutes', '10 minutes', '15 minutes', '30 minutes', '1 hour', '4 hours']);
  assert.equal(M.autoLockLabel(120), '2 hours');
});

// ---------- locales ----------
test('locale list and pick (TW checkLocale)', () => {
  assert.equal(M.SUPPORTED_LOCALES.length, 30);
  assert.equal(M.pickLocale('en-US'), 'en'); assert.equal(M.pickLocale('pt-BR'), 'pt-BR');
  assert.equal(M.pickLocale('pt-PT'), 'pt'); assert.equal(M.pickLocale('es-MX'), 'es-ES'); assert.equal(M.pickLocale('de-AT'), 'de');
  assert.equal(M.pickLocale('xx'), 'en'); assert.equal(M.pickLocale(undefined), 'en');
  assert.equal(M.intlTag('zh-TC'), 'zh-TW'); assert.equal(M.intlTag('es-LA'), 'es-419'); assert.equal(M.intlTag('fr'), 'fr');
  assert.equal(M.localeLabel('de', () => 'deutsch'), 'Deutsch - DE');
  assert.equal(M.localeLabel('pt-BR', () => 'português'), 'Português - PT');
  assert.equal(M.localeLabel('en', () => undefined), 'en - EN');
});

// ---------- settings model ----------
test('defaults mirror TW initial state (documented deviations only)', () => {
  const d = M.DEFAULT_SETTINGS('fr-FR');
  assert.equal(d.locale, 'fr'); assert.equal(d.baseCurrency, 'USD'); assert.equal(d.colorMode, 'system'); assert.equal(d.lockTimeInMinutes, 10);
  assert.equal(d.layout.tokenCellLayout, 3); assert.equal(d.isDefaultWallet, false);
  assert.deepEqual(d.pushNotifications, { isPushEnabled: true, isSendAndReceiveEnabled: true, topics: { product_announcement: true } });
  assert.deepEqual(d.developerSettings, { isCustomNonceEnabled: false, isAdvancedGasControlsEnabled: false, isAdvancedTransactionDataEnabled: false, isEthSignEnabled: false });
  // deviations
  assert.equal(d.preferSidePanel, false); assert.equal(d.layout.hideNFTs, false); assert.equal(d.layout.hideLowBalanceAssets, false);
  assert.equal('isAnalyticsEnabled' in d.privacy, false);
});
test('applyPatch validates every field and never mutates the input', () => {
  const cur = M.DEFAULT_SETTINGS('en'); const snap = JSON.stringify(cur);
  const n = M.applyPatch(cur, { colorMode: 'dark', lockTimeInMinutes: 30, locale: 'de', baseCurrency: 'EUR', preferSidePanel: true, layout: { tokenCellLayout: 1, hideNFTs: true }, privacy: { hideBalancesOnDashboard: true } }, M.CURRENCY_CODES);
  assert.equal(JSON.stringify(cur), snap);
  assert.deepEqual([n.colorMode, n.lockTimeInMinutes, n.locale, n.baseCurrency, n.preferSidePanel, n.layout.tokenCellLayout, n.layout.hideNFTs, n.layout.hideLowBalanceAssets, n.privacy.hideBalancesOnDashboard], ['dark', 30, 'de', 'EUR', true, 1, true, false, true]);
});
test('applyPatch ignores junk: wrong types, out-of-range, unknown keys, prototype pollution', () => {
  const cur = M.DEFAULT_SETTINGS('en');
  const n = M.applyPatch(cur, { colorMode: 'purple', lockTimeInMinutes: 7, locale: 'xx', baseCurrency: 'ZZZ', preferSidePanel: 'yes', layout: { tokenCellLayout: 9, hideNFTs: 1 }, bogus: 1, __proto__: { polluted: true }, constructor: { prototype: { polluted: true } } }, M.CURRENCY_CODES);
  assert.deepEqual(n, cur); assert.equal({}.polluted, undefined);
  assert.equal(M.applyPatch(cur, null), cur); assert.equal(M.applyPatch(cur, 'x'), cur); assert.equal(M.applyPatch(cur, [1]), cur);
});
test('push toggle moves send&receive with it; topics only accept boolean + sane keys', () => {
  const cur = M.DEFAULT_SETTINGS('en');
  const off = M.applyPatch(cur, { pushNotifications: { isPushEnabled: false } });
  assert.deepEqual([off.pushNotifications.isPushEnabled, off.pushNotifications.isSendAndReceiveEnabled], [false, false]);
  const t = M.applyPatch(cur, { pushNotifications: { topics: { product_announcement: false, 'Bad Key!': true, price_alerts: 'x', news: true } } });
  assert.deepEqual(t.pushNotifications.topics, { product_announcement: false, news: true });
});
test('normalizeSettings tolerates corrupt / old storage', () => {
  for (const raw of [undefined, null, 5, 'x', [], { colorMode: 42 }]) { const n = M.normalizeSettings(raw, 'en', M.CURRENCY_CODES); assert.equal(n.colorMode, 'system'); assert.equal(n.lockTimeInMinutes, 10); }
  assert.equal(M.normalizeSettings({ colorMode: 'light', lockTimeInMinutes: 0 }).lockTimeInMinutes, 10); // a legacy "Never" is migrated to the default
});
test('sideEffects only reports what changed', () => {
  const a = M.DEFAULT_SETTINGS('en');
  assert.deepEqual(M.sideEffects(a, M.applyPatch(a, { colorMode: 'dark' })), { lockTimer: false, sidePanel: false });
  assert.deepEqual(M.sideEffects(a, M.applyPatch(a, { lockTimeInMinutes: 1, preferSidePanel: true })), { lockTimer: true, sidePanel: true });
});
test('low-balance rule hides only KNOWN sub-cent values', () => {
  assert.equal(M.isLowBalance(0), true); assert.equal(M.isLowBalance(0.0099), true); assert.equal(M.isLowBalance(0.01), false); assert.equal(M.isLowBalance(25), false);
  assert.equal(M.isLowBalance(null), false); assert.equal(M.isLowBalance(undefined), false); assert.equal(M.isLowBalance(NaN), false);
});

// ---------- currency table ----------
test('currency table = TW table: 170 entries, 8 popular, 3 crypto, every fiat has a name', () => {
  assert.equal(M.BASE_CURRENCIES.length, 170);
  assert.deepEqual(M.POPULAR_CURRENCIES.map((c) => c.code).sort(), ['AUD', 'BNB', 'BTC', 'ETH', 'EUR', 'GBP', 'RUB', 'USD']);
  assert.deepEqual(M.BASE_CURRENCIES.filter((c) => c.isCrypto).map((c) => c.code), ['BTC', 'ETH', 'BNB']);
  assert.ok(M.BASE_CURRENCIES.every((c) => c.name && c.code.length >= 3));
  assert.equal(M.POPULAR_CURRENCIES.length + M.OTHER_CURRENCIES.length, 170);
});

// ---------- rates ----------
const ER = { result: 'success', rates: { USD: 1, EUR: 0.8, JPY: 160, XXX: 3, BTC: 0.00001, GBP: 'nope', INR: 0 } };
const CG = { bitcoin: { usd: 100000 }, ethereum: { usd: 2450.05 }, binancecoin: { usd: -1 } };
test('mapRates: USD-per-unit semantics, drops junk and unknown codes, crypto only from CoinGecko', () => {
  const r = M.mapRates(ER, CG);
  assert.equal(r.USD, 1); assert.ok(Math.abs(r.EUR - 1.25) < 1e-12); assert.ok(Math.abs(r.JPY - 1 / 160) < 1e-12);
  assert.equal(r.XXX, undefined); assert.equal(r.GBP, undefined); assert.equal(r.INR, undefined);
  assert.equal(r.BTC, 100000); assert.equal(r.ETH, 2450.05); assert.equal(r.BNB, undefined); // BTC rate inside ER ignored
  assert.deepEqual(M.mapRates(null, null), { USD: 1 });
});
const memStore = (init) => { let v = init; return { get: async () => v, set: async (x) => { v = x; }, peek: () => v }; };
const okF = (calls) => async (url) => { calls.push(url); return { ok: true, status: 200, json: async () => (url.includes('er-api') ? ER : CG) }; };
test('getRate: fetches, caches (TTL), serves stale on failure, reports failure when never priced', async () => {
  const calls = []; const store = memStore();
  const a = await M.getRate('EUR', store, okF(calls), 1_000);
  assert.deepEqual([a.ok, a.usdPer, a.stale], [true, 1.25, false]); assert.equal(calls.length, 2);
  await M.getRate('EUR', store, okF(calls), 1_000 + 60_000); assert.equal(calls.length, 2); // fresh cache
  const boom = async () => { throw new Error('offline'); };
  const stale = await M.getRate('EUR', store, boom, 1_000 + M.RATES_TTL_MS + 5);
  assert.deepEqual([stale.ok, stale.usdPer, stale.stale], [true, 1.25, true]);
  const never = await M.getRate('JPY', memStore(), boom, 5); assert.equal(never.ok, false); assert.match(never.error, /JPY/);
  assert.equal((await M.getRate('USD', memStore(), boom)).usdPer, 1);
  assert.equal((await M.getRate('NOPE', memStore(), boom)).ok, false);
});
test('getRate: partial outage keeps earlier codes (CoinGecko down, fiat up)', async () => {
  const store = memStore({ at: 0, usdPer: { USD: 1, BTC: 90000 } });
  const f = async (url) => url.includes('er-api') ? { ok: true, status: 200, json: async () => ER } : { ok: false, status: 429, json: async () => ({}) };
  const eur = await M.getRate('EUR', store, f, M.RATES_TTL_MS + 10); assert.equal(eur.ok, true);
  assert.equal(store.peek().usdPer.BTC, 90000); // not lost
  const btc = await M.getRate('BTC', store, f, M.RATES_TTL_MS * 3); assert.deepEqual([btc.ok, btc.usdPer, btc.stale], [true, 90000, true]);
});

// ---------- formatting ----------
const ctx = (code, usdPer, locale = 'en') => ({ code, usdPer, locale });
test('formatFiat: USD, EUR conversion, tiny floor, JPY 0 decimals', () => {
  assert.equal(M.formatFiat(1234.5, ctx('USD', 1)), '$1,234.50');
  assert.equal(M.formatFiat(125, ctx('EUR', 1.25)), '€100.00');
  assert.equal(M.formatFiat(0.004, ctx('USD', 1)), '<$0.01');
  assert.equal(M.formatFiat(0, ctx('USD', 1)), '$0.00');
  assert.match(M.formatFiat(100, ctx('JPY', 1 / 160)), /^¥16,000$|^JP¥16,000$|^￥16,000$/);
  assert.equal(M.formatFiat(NaN, ctx('USD', 1)), '—');
});
test('formatFiat: locale changes separators; crypto base shows up to 8 decimals', () => {
  assert.match(M.formatFiat(1234.5, ctx('EUR', 1, 'de')), /1\.234,50\s?€/);
  assert.equal(M.formatFiat(5000, ctx('BTC', 100000)), '0.05 BTC');
  assert.equal(M.formatFiat(0.0001, ctx('BTC', 100000)), '<0.00000001 BTC');
});
test('formatFiatPrice keeps significant digits for tiny prices; compact for market cap', () => {
  assert.equal(M.formatFiatPrice(0.00001234, ctx('USD', 1)), '$0.00001234');
  assert.equal(M.formatFiatPrice(2450.049, ctx('USD', 1)), '$2,450.05');
  assert.equal(M.formatFiatPrice(0.5, ctx('USD', 1)), '$0.50');
  assert.equal(M.formatFiatCompact(1_500_000_000, ctx('USD', 1)), '$1.50B');
  assert.equal(M.formatFiatCompact(0, ctx('USD', 1)), '$0.00');
  assert.equal(M.formatFiatSigned(12, ctx('USD', 1)), '+$12.00');
});
