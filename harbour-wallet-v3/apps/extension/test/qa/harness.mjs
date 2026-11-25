// QA integration harness: bundles real worker/core modules (TypeScript, via esbuild) with fakes ONLY at the browser boundary:
// chrome.storage (local/session), alarms, notifications, runtime, and an in-memory extension-origin IndexedDB. wallet-core is the real
// WASM build. Same approach as test/pentest-regressions.test.js, factored out so every QA suite shares one fake surface.
//
//   const H = await harness(`export { handlers as walletH } from './background/modules/wallet'; ...`);
//   H.M            bundled module exports
//   H.core         wallet-core instance
//   H.F            fake browser state: { local.data, session.data, alarms, notes, setAccessLevel }
//   H.reset()      clears every store between tests (isolation)
//   H.ctx()        handler context { core, vault, wallet, sender } with cheap Argon2 params (only the cost differs from production)
import { build } from 'esbuild';
import { writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pkg from '@trustwallet/wallet-core';

export const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
export const CHEAP_ARGON2 = { m: 8, t: 1, p: 1 };
export const PASSWORD = 'Correct-horse-9-battery';
// BIP-39 reference phrase (TREZOR vectors) and a second unrelated valid phrase.
export const PHRASE_ABOUT = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
export const PHRASE_LEGAL = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

// The webextension-polyfill import resolves to the SAME fake object the `chrome` global exposes (built once in buildBrowser()).
const fakeBrowser = `export default globalThis.__fakeBrowser;`;

function buildBrowser(F) {
  const area = (g, name) => ({
    // Like Chrome, every call is processed in the order it was ISSUED and its result delivered asynchronously: a get reads the store at
    // issue time, so two gets issued before a remove both see the value (this is what makes check-then-act races observable).
    get: async (k) => { let o; if (k === null || k === undefined) o = structuredClone(g.data); else if (typeof k === 'object' && !Array.isArray(k)) { o = {}; for (const [x, d] of Object.entries(k)) o[x] = x in g.data ? structuredClone(g.data[x]) : d; } else { const ks = Array.isArray(k) ? k : [k]; o = {}; for (const x of ks) if (x in g.data) o[x] = structuredClone(g.data[x]); } await new Promise((r) => setTimeout(r, 0)); return o; },
    set: async (o) => { if (g.failWrites) throw new Error(g.failWrites); const changes = {}; for (const [k, v] of Object.entries(o)) { changes[k] = { oldValue: g.data[k], newValue: structuredClone(v) }; g.data[k] = structuredClone(v); } fire('storage.onChanged', changes, name); },
    remove: async (k) => { const changes = {}; for (const x of (Array.isArray(k) ? k : [k])) { if (x in g.data) changes[x] = { oldValue: g.data[x] }; delete g.data[x]; } if (Object.keys(changes).length) fire('storage.onChanged', changes, name); },
    clear: async () => { g.data = {}; },
    setAccessLevel: async (o) => { F.accessLevels.push([name, o.accessLevel]); },
  });
  const fire = (name, ...args) => { for (const f of F.listeners[name] ?? []) { try { const r = f(...args); r?.catch?.(() => {}); } catch { /* listener error */ } } };
  const ev = (name) => ({ addListener: (f) => { (F.listeners[name] ??= []).push(f); }, removeListener: (f) => { F.listeners[name] = (F.listeners[name] ?? []).filter((x) => x !== f); }, hasListener: (f) => (F.listeners[name] ?? []).includes(f) });
  let winId = 100;
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
  globalThis.OffscreenCanvas ??= class { constructor(w, h) { this.width = w; this.height = h; }
    getContext() { return new Proxy({}, { get: (t, k) => k === 'fillText' ? (txt) => F.painted.push(String(txt)) : k === 'measureText' ? (txt) => ({ width: String(txt).length * 8 }) : (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }); }
    async convertToBlob() { return new Blob([PNG], { type: 'image/png' }); } };
  const mkPort = (name, url, onPost) => { const L = { m: [], d: [] }; return { name, sender: { url, id: 'test' }, onMessage: { addListener: (f) => L.m.push(f), removeListener() {} }, onDisconnect: { addListener: (f) => L.d.push(f), removeListener() {} },
    postMessage: (m) => onPost(m, (r) => L.m.forEach((f) => f(r))), disconnect() { L.d.forEach((f) => f()); } }; };
  return {
    storage: { local: area(F.local, 'local'), session: area(F.session, 'session'), onChanged: ev('storage.onChanged') },
    alarms: { create: async (n, o) => { F.alarms = F.alarms.filter((a) => a[0] !== n); F.alarms.push([n, o]); }, clear: async (n) => { F.alarms = F.alarms.filter((a) => a[0] !== n); return true; },
      get: async (n) => { const a = F.alarms.find((x) => x[0] === n); return a ? { name: n, ...a[1] } : undefined; }, getAll: async () => F.alarms.map(([name, o]) => ({ name, ...o })), onAlarm: ev('alarms.onAlarm') },
    runtime: { getURL: (p) => 'chrome-extension://test/' + String(p).replace(/^\//, ''), id: 'test', lastError: undefined, getManifest: () => ({ version: '0.0.0', manifest_version: 3 }), reload: () => { F.reloads = (F.reloads ?? 0) + 1; },
      onMessage: ev('runtime.onMessage'), onConnect: ev('runtime.onConnect'), onInstalled: ev('runtime.onInstalled'), onStartup: ev('runtime.onStartup'), sendMessage: async () => undefined, getContexts: async () => [] },
    tabs: { query: async () => [], create: async (o) => { F.tabsCreated.push(o); return { id: 1, ...o }; }, get: async (id) => ({ id }), sendMessage: async () => undefined, onRemoved: ev('tabs.onRemoved'), onUpdated: ev('tabs.onUpdated') },
    windows: { create: async (o) => { const w = { id: ++winId, ...o }; F.windows.push(w); return w; }, get: async (id) => { const w = F.windows.find((x) => x.id === id); if (!w) throw new Error('No window'); return w; },
      update: async (id, o) => ({ id, ...o }), remove: async (id) => { F.windows = F.windows.filter((x) => x.id !== id); fire('windows.onRemoved', id); }, getLastFocused: async () => ({ id: 1, left: 0, top: 0, width: 1200, height: 800 }), onRemoved: ev('windows.onRemoved') },
    scripting: { registerContentScripts: async (l) => { for (const x of l) { if (F.scripts.some((y) => y.id === x.id)) throw new Error(`Duplicate script ID '${x.id}'`); F.scripts.push(x); } },
      updateContentScripts: async (l) => { for (const x of l) { const i = F.scripts.findIndex((y) => y.id === x.id); if (i < 0) throw new Error('not registered'); F.scripts[i] = { ...F.scripts[i], ...x }; F.scriptUpdates.push(x.id); } },
      getRegisteredContentScripts: async (f) => F.scripts.filter((x) => !f?.ids || f.ids.includes(x.id)), unregisterContentScripts: async () => { F.scripts = []; } },
    offscreen: { Reason: { CLIPBOARD: 'CLIPBOARD' }, closeDocument: async () => {}, createDocument: async ({ url }) => {
      if (F.offscreenFail) throw new Error(F.offscreenFail);
      const port = mkPort('harbour-offscreen', 'chrome-extension://test/' + url, (m, reply) => { if (m?.op === 'copy') { F.clipboard.push({ text: m.text, clearAfterMs: m.clearAfterMs }); setTimeout(() => reply({ op: 'copied', id: m.id, ok: true }), 0); } });
      setTimeout(() => fire('runtime.onConnect', port), 0); } },
    notifications: { create: (id, o) => { F.notes.push(o.title); return Promise.resolve(id); }, clear: async () => true, onClicked: ev('notifications.onClicked') },
    idle: { onStateChanged: ev('idle.onStateChanged'), setDetectionInterval() {} },
    sidePanel: { setPanelBehavior: async (o) => { F.sidePanel = o; }, setOptions: async () => {} },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, openPopup: async () => {} },
    permissions: { contains: async () => false, request: async () => false },
  };
}

const tick = (f) => setTimeout(f, 0);
const mk = (f) => { const q = {}; tick(() => { try { q.result = f(); q.onsuccess?.(); } catch (e) { q.error = e; q.onerror?.(); } }); return q; };
/** Minimal IndexedDB with per-transaction atomicity: writes are buffered and applied on commit, or dropped if the test arms a failure. */
function fakeIndexedDB(state) {
  const dbs = new Map();
  return { dbs, open(name) { const r = {}; tick(() => {
    let m = dbs.get(name); const fresh = !m; if (fresh) { m = new Map(); dbs.set(name, m); }
    r.result = { objectStoreNames: { contains: () => !fresh }, createObjectStore() {}, close() {}, transaction() {
      const pending = []; const tx = {};
      const st = { get: (k) => mk(() => { const v = structuredClone(m.get(k)); return state.idbReadHook ? state.idbReadHook(k, v) : v; }), /* idbReadHook: fault injection (wrong read-back) */ put: (v, k) => { pending.push(() => m.set(k, structuredClone(v))); return mk(() => k); },
        delete: (k) => { pending.push(() => m.delete(k)); return mk(() => undefined); }, getAllKeys: () => mk(() => [...m.keys()]) };
      tx.objectStore = () => st;
      tick(() => tick(() => tick(() => {
        if (state.idbFail) { tx.error = new Error(state.idbFail); tx.onabort?.(); return; }
        for (const p of pending) p(); tx.oncomplete?.();
      })));
      return tx; } };
    if (fresh) r.onupgradeneeded?.(); r.onsuccess?.(); }); return r; } };
}

let cached = new Map();
export async function harness(entry, { define, transform } = {}) {
  // transform: [[/path regex/, (source) => source]] rewrites matching source files at bundle time (test instrumentation only;
  // the files on disk are never changed).
  const cacheKey = entry + JSON.stringify(define ?? {}) + String(transform ?? '');
  if (cached.has(cacheKey)) return cached.get(cacheKey);
  globalThis.__fake ??= { local: { data: {} }, session: { data: {} }, alarms: [], notes: [], listeners: {}, accessLevels: [], idbFail: null, painted: [], clipboard: [], fetches: [],
    windows: [], scripts: [], scriptUpdates: [], tabsCreated: [] };
  const F = globalThis.__fake;
  globalThis.indexedDB ??= fakeIndexedDB(F);
  // No real network in QA tests (core rule 4): every fetch is recorded and answered by F.fetchImpl (default: refused).
  if (!globalThis.__qaFetch) { globalThis.__qaFetch = true; globalThis.fetch = async (input, init) => { const url = typeof input === 'string' ? input : input?.url ?? String(input);
    F.fetches.push({ url, method: init?.method ?? input?.method ?? 'GET', body: init?.body ?? null, headers: init?.headers ?? null });
    if (F.fetchImpl) return F.fetchImpl(url, init); throw new TypeError('NETWORK_DISABLED_IN_TESTS'); }; }
  // Service-worker global events (push, notificationclick, unhandledrejection) are recorded so tests can fire them.
  globalThis.addEventListener ??= (type, f) => { (F.listeners['self.' + type] ??= []).push(f); };
  globalThis.registration ??= { scope: 'chrome-extension://test/', showNotification: async (title, o) => { F.notes.push(title); F.shown = [...(F.shown ?? []), { title, ...o }]; } };
  globalThis.clients ??= { openWindow: async (url) => { F.opened = [...(F.opened ?? []), url]; } };
  globalThis.self ??= globalThis; // worker global (secretRender reads self.fonts)
  globalThis.__fakeBrowser ??= buildBrowser(F);
  globalThis.chrome ??= globalThis.__fakeBrowser;
  const plugin = { name: 'fake', setup(b) {
    b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'fake', namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: fakeBrowser, loader: 'js' }));
    for (const [re, fn] of transform ?? []) b.onLoad({ filter: re }, (a) => ({ contents: fn(readFileSync(a.path, 'utf8'), a.path), loader: a.path.endsWith('x') ? 'tsx' : 'ts' }));
  } };
  // Bundles go under node_modules/.cache so bare imports kept external (wallet-core) resolve from the extension's node_modules.
  const dir = fileURLToPath(new URL('../../node_modules/.cache/harbour-qa/', import.meta.url)); mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `bundle-${process.pid}-${cached.size}.mjs`);
  const out = await build({ stdin: { contents: entry, resolveDir: SRC, sourcefile: 'qa-entry.ts', loader: 'ts' }, bundle: true, write: false, format: 'esm', ...(process.env.HB_QA_COVERAGE ? { outfile: tmp } : {}),
    platform: 'node', plugins: [plugin], ...(process.env.HB_QA_COVERAGE ? { sourcemap: 'inline', sourcesContent: false } : {}), external: ['@trustwallet/wallet-core'], logLevel: 'silent', loader: { '.json': 'json' }, ...(define ? { define } : {}),
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
  writeFileSync(tmp, out.outputFiles[0].text);
  let M; try { M = await import(pathToFileURL(tmp).href); } finally { if (!process.env.HB_QA_COVERAGE) rmSync(tmp, { force: true }); }
  const core = await pkg.initWasm();
  const H = {
    M, core, F,
    reset() {
      F.local.data = {}; F.session.data = {}; F.alarms = []; F.notes.length = 0; F.local.failWrites = null; F.session.failWrites = null; F.idbFail = null; F.idbReadHook = null; F.painted.length = 0; F.clipboard.length = 0;
      F.offscreenFail = null; F.fetches.length = 0; F.fetchImpl = null; F.windows = []; F.tabsCreated.length = 0;
      for (const m of globalThis.indexedDB.dbs.values()) m.clear();
    },
    idb(name = 'harbour-secure') { return globalThis.indexedDB.dbs.get(name) ?? new Map(); },
    ctx(sender = {}) { return { core, vault: new M.VaultService(core, CHEAP_ARGON2), wallet: new M.WalletService(core), sender }; },
  };
  cached.set(cacheKey, H);
  return H;
}

/** Every string in a JSON-able value (keys and values), for leak scans. */
export function allStrings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); allStrings(x, out); }
  return out;
}
/** True when any BIP-39 phrase word sequence of `phrase` (all words in order) or a 64-hex private key appears in `value`. */
export function leaksSecret(value, phrases = [], keysHex = []) {
  const text = JSON.stringify(value ?? null);
  return phrases.some((p) => text.includes(p) || text.includes(p.split(' ').join('","'))) || keysHex.some((k) => text.toLowerCase().includes(k.toLowerCase().replace(/^0x/, '')));
}
