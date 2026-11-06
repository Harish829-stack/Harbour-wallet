// Exercises the REAL background settings service (src/background/settingsService.ts) against an in-memory fake of
// webextension-polyfill, so the auto-lock alarm, side-panel and rate-gated currency change are tested end-to-end
// without a browser.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const fakeBrowser = `
const store = (g) => ({ get: async (k) => (k in g.data ? { [k]: g.data[k] } : {}), set: async (o) => { Object.assign(g.data, o); }, remove: async (k) => { delete g.data[k]; } });
const state = globalThis.__fake = { local: { data: {} }, session: { data: {} }, alarms: {}, calls: [], panel: null };
const browser = {
  storage: { local: store(state.local), session: store(state.session) },
  alarms: { clear: async (n) => { state.calls.push(['clear', n]); delete state.alarms[n]; return true; }, create: async (n, i) => { state.calls.push(['create', n, i]); state.alarms[n] = i; } },
};
globalThis.chrome = { sidePanel: { setPanelBehavior: async (o) => { state.panel = o; } } };
export default browser;`;
const plugin = { name: 'fake', setup(b) {
  b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'fake', namespace: 'fake' }));
  b.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: fakeBrowser, loader: 'js' }));
} };
const out = await build({ stdin: { contents: `export * from './background/settingsService'; export { CURRENCY_CODES } from './core/fiat';`, resolveDir: root, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', plugins: [plugin] });
const S = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const F = () => globalThis.__fake;

beforeEach(() => { const f = F(); f.local.data = {}; f.alarms = {}; f.calls = []; f.panel = null; });

test('first load = TW defaults; nothing is written until a change', async () => {
  const s = await S.loadSettings();
  assert.equal(s.lockTimeInMinutes, 10); assert.equal(s.colorMode, 'system'); assert.equal(s.baseCurrency, 'USD');
  assert.deepEqual(F().local.data, {});
});
test('changing the auto-lock timer persists it and arms the real alarm', async () => {
  const r = await S.saveSettings({ lockTimeInMinutes: 5 });
  assert.equal(r.ok, true); assert.equal(r.settings.lockTimeInMinutes, 5);
  assert.equal(F().alarms[S.LOCK_ALARM].delayInMinutes, 5);
  assert.equal((await S.loadSettings()).lockTimeInMinutes, 5); // survives a reload
});
test('HW-011: "Never" (0) is rejected; the alarm stays armed', async () => {
  await S.saveSettings({ lockTimeInMinutes: 15 }); assert.ok(F().alarms[S.LOCK_ALARM]);
  const r = await S.saveSettings({ lockTimeInMinutes: 0 });
  assert.equal(r.settings.lockTimeInMinutes, 15);
  assert.equal(F().alarms[S.LOCK_ALARM].delayInMinutes, 15);
});
test('an invalid timer value is ignored and does not touch the alarm', async () => {
  await S.saveSettings({ lockTimeInMinutes: 30 }); F().calls.length = 0;
  const r = await S.saveSettings({ lockTimeInMinutes: 7 });
  assert.equal(r.settings.lockTimeInMinutes, 30); assert.equal(F().calls.length, 0);
});
test('armLockTimer() with no argument uses the saved value; re-arming resets the countdown', async () => {
  await S.saveSettings({ lockTimeInMinutes: 1 }); F().calls.length = 0;
  await S.armLockTimer();
  assert.deepEqual(F().calls, [['clear', S.LOCK_ALARM], ['create', S.LOCK_ALARM, { delayInMinutes: 1 }]]);
});
test('unrelated changes (colour mode) do not re-arm the timer', async () => {
  await S.saveSettings({ lockTimeInMinutes: 5 }); F().calls.length = 0;
  const r = await S.saveSettings({ colorMode: 'dark' });
  assert.equal(r.settings.colorMode, 'dark'); assert.equal(F().calls.length, 0);
});
test('side panel preference is applied through chrome.sidePanel', async () => {
  assert.equal(S.sidePanelSupported(), true);
  await S.saveSettings({ preferSidePanel: true }); assert.deepEqual(F().panel, { openPanelOnActionClick: true });
  await S.saveSettings({ preferSidePanel: false }); assert.deepEqual(F().panel, { openPanelOnActionClick: false });
});
test('switching to a currency with no available rate is REFUSED and leaves settings unchanged', async () => {
  const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    const r = await S.saveSettings({ baseCurrency: 'EUR' });
    assert.equal(r.ok, false); assert.match(r.error, /EUR/);
    assert.equal((await S.loadSettings()).baseCurrency, 'USD');
  } finally { globalThis.fetch = realFetch; }
});
test('switching currency succeeds when a rate can be fetched, and the rate is cached for reload', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('er-api') ? { result: 'success', rates: { EUR: 0.8 } } : { bitcoin: { usd: 100000 } }) });
  try {
    const r = await S.saveSettings({ baseCurrency: 'EUR' });
    assert.equal(r.ok, true); assert.equal(r.settings.baseCurrency, 'EUR'); assert.ok(Math.abs(r.rate.usdPer - 1.25) < 1e-12);
    const c = await S.cachedRate('EUR'); assert.ok(Math.abs(c.usdPer - 1.25) < 1e-12);
    assert.equal((await S.cachedRate('JPY')), null);
    assert.equal((await S.cachedRate('USD')).usdPer, 1);
  } finally { globalThis.fetch = realFetch; }
});
test('concurrent saves do not lose updates', async () => {
  await Promise.all([S.saveSettings({ colorMode: 'dark' }), S.saveSettings({ layout: { tokenCellLayout: 1 } }), S.saveSettings({ privacy: { hideBalancesOnDashboard: true } }), S.saveSettings({ lockTimeInMinutes: 60 })]);
  const s = await S.loadSettings();
  assert.deepEqual([s.colorMode, s.layout.tokenCellLayout, s.privacy.hideBalancesOnDashboard, s.lockTimeInMinutes], ['dark', 1, true, 60]);
});
test('corrupt stored settings fall back to defaults instead of throwing', async () => {
  F().local.data['wallet:settings'] = { colorMode: 'neon', lockTimeInMinutes: 'soon', layout: 7 };
  const s = await S.loadSettings(); assert.equal(s.colorMode, 'system'); assert.equal(s.lockTimeInMinutes, 10); assert.equal(s.layout.tokenCellLayout, 3);
});
