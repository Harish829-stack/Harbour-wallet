// QA: extension platform layer — manifest/CSP, router & event registry, UI port, boot loop & queue, Redux store persistence, signed remote
// config, offscreen clipboard, push notifications, settings side effects, and service-worker termination with a pending approval.
// TEST_PLAN: T-EXT-001, 002, 003, 006 (see worker-router), 007, 009, 010, 011, 012, 013, 014, 015, 017, 018, 019, 024, 025, 026, 027, 030,
// 037, 043, 044, 045, 046.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import fc from 'fast-check';
import { verifyMessage, toHex } from 'viem';
import { harness, SRC, PASSWORD, PHRASE_ABOUT } from './harness.mjs';
import { fakeClock } from './known-bug.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CACHE = join(ROOT, 'node_modules/.cache/harbour-qa'); mkdirSync(CACHE, { recursive: true });
const H = await harness(`
  import './background/index';
  export { registerEvent, dispatchEvent, stripExternalFlags, listEvents } from './background/kernel/events';
  export { bootWith, selfHeal, queue, BOOT_MAX_ATTEMPTS } from './background/kernel/boot';
  export { store, actions, hydrateStore } from './background/store/index';
  export { parseConfig, verifySignature, EMPTY_CONFIG } from './kit/remoteConfig';
  export { copySecretToClipboard } from './background/clipboard';
  export { LOCK_ALARM } from './background/settingsService';
  export { handlers as walletEvents } from './background/modules/wallet';
  export { handlers as marketEvents } from './background/modules/market';
  export { handlers as swapEvents } from './background/modules/swap';
  export { handlers as tokenEvents } from './background/modules/tokens';
  export { handlers as settingsCoreEvents } from './background/modules/settingsCore';
  export { allExtraHandlers } from './background/handlers/index';
  export { findSecretField } from './core/uiSafe';
`);
const { M, F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg, sender = INTERNAL) => F.listeners['runtime.onMessage'][0](msg, sender);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return null; await tick(10); } };
before(async () => { H.reset(); assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT })).ok, true); });

// ---------------------------------------------------------------- manifest / CSP (EXT-01, EXT-02)

async function manifestFor(env) {
  const out = await build({ entryPoints: [join(ROOT, 'manifest.config.ts')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', external: ['vite', '@crxjs/vite-plugin'],
    plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /^(vite|@crxjs\/vite-plugin)$/ }, (a) => ({ path: a.path, namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: a.path === 'vite' ? 'export const loadEnv = () => globalThis.__qaEnv;' : 'export const defineManifest = (f) => f;', loader: 'js' })); } }] });
  const f = join(CACHE, `manifest-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`); writeFileSync(f, out.outputFiles[0].text);
  globalThis.__qaEnv = env;
  try { return (await import(pathToFileURL(f).href)).default({ mode: 'production', command: 'build' }); } finally { rmSync(f, { force: true }); }
}
const EXPECTED_CSP = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; base-uri 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'";

test('T-EXT-001 / T-EXT-003: production manifest: exact permissions, https-only hosts, no external surface, strict CSP', async () => {
  const m = await manifestFor({ VITE_HB_API_URL: 'https://api.harbour.example' });
  assert.deepEqual([...m.permissions].sort(), ['alarms', 'clipboardWrite', 'gcm', 'idle', 'notifications', 'offscreen', 'scripting', 'sidePanel', 'storage']);
  assert.deepEqual(m.host_permissions, ['https://*/*']);
  for (const k of ['externally_connectable', 'web_accessible_resources', 'content_scripts', 'optional_permissions', 'optional_host_permissions', 'key', 'update_url', 'oauth2']) assert.equal(m[k], undefined, k);
  assert.equal(m.manifest_version, 3); assert.equal(m.background.type, 'module');
  assert.equal(m.content_security_policy.extension_pages, EXPECTED_CSP);
  const csp = m.content_security_policy.extension_pages;
  for (const bad of ["'unsafe-eval'", "'unsafe-inline'", 'http:', 'data:', '*']) assert.ok(!csp.split(/[ ;]+/).includes(bad), bad);
  assert.equal(m.content_security_policy.sandbox, undefined);
  // The built artefact (if built) matches the config (crxjs only adds the loader / web-accessible wasm for the worker, nothing else)
  const built = join(ROOT, 'dist/manifest.json');
  if (existsSync(built)) {
    const d = JSON.parse(readFileSync(built, 'utf8'));
    assert.equal(d.content_security_policy.extension_pages, EXPECTED_CSP);
    assert.deepEqual([...d.permissions].sort(), [...m.permissions].sort());
    assert.ok(d.host_permissions.every((h) => h === 'https://*/*' || /^http:\/\/(localhost|127\.0\.0\.1)\/\*$/.test(h)));
    assert.equal(d.externally_connectable, undefined);
    for (const w of d.web_accessible_resources ?? []) assert.ok(!(w.matches ?? []).includes('<all_urls>') || w.resources.every((r) => /\.(js|wasm)$/.test(r)), JSON.stringify(w));
  }
});

test('T-EXT-002: loopback host permissions appear only for a build that talks to a backend on this computer', async () => {
  assert.deepEqual((await manifestFor({ VITE_HB_API_URL: 'http://localhost:8080' })).host_permissions, ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*']);
  assert.deepEqual((await manifestFor({ VITE_HB_API_URL: 'http://127.0.0.1:8080' })).host_permissions, ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*']);
  assert.deepEqual((await manifestFor({ VITE_HB_API_URL: 'https://api.example' })).host_permissions, ['https://*/*']);
});

// ---------------------------------------------------------------- router / registry (EXT-03, EXT-05)

test('T-EXT-007: isInternal / source / internal flags are stripped before dispatch', async () => {
  let seen;
  M.registerEvent('INTERNAL', 'qaEcho', async (m) => { seen = m; return { ok: true }; });
  await send({ type: 'qaEcho', isInternal: true, source: 'popup', internal: 1, keep: 'x' });
  assert.deepEqual(seen, { type: 'qaEcho', keep: 'x' });
  assert.deepEqual(M.stripExternalFlags({ type: 't', isInternal: true }), { type: 't' });
});

test('T-EXT-009: duplicate registration throws; unknown events are undefined; a throwing handler gets a redacted error', async () => {
  assert.throws(() => M.registerEvent('INTERNAL', 'qaEcho', () => {}), /duplicate event INTERNAL_qaEcho/);
  assert.equal(await M.dispatchEvent('INTERNAL', 'nope', {}, { sender: {} }), undefined);
  M.registerEvent('INTERNAL', 'qaThrow', () => { throw new Error('failed https://eth-mainnet.g.alchemy.com/v2/AbCdEfGhIjKlMnOpQrStUvWx key 0x' + '46'.repeat(32)); });
  const r = await M.dispatchEvent('INTERNAL', 'qaThrow', {}, { sender: {} });
  assert.equal(r.ok, false); assert.ok(!r.error.includes('AbCdEfGhIjKlMnOpQrStUvWx') && !r.error.includes('46'.repeat(32)), r.error);
  const viaRouter = await send({ type: 'qaThrow' });
  assert.ok(!JSON.stringify(viaRouter).includes('alchemy'), 'router response is user text');
});

test('T-EXT-010: the handler maps of every module are pairwise disjoint (ASM-15: no handler silently shadows another)', () => {
  const maps = { wallet: M.walletEvents, market: M.marketEvents, swap: M.swapEvents, tokens: M.tokenEvents, settingsCore: M.settingsCoreEvents, extra: M.allExtraHandlers() };
  const owner = new Map();
  for (const [mod, map] of Object.entries(maps)) for (const k of Object.keys(map)) { assert.ok(!owner.has(k), `${k} defined in ${owner.get(k)} and ${mod}`); owner.set(k, mod); }
});

test('T-EXT-011: malformed raw messages: INVALID_REQUEST / unknown_message without touching prototypes', async () => {
  for (const raw of [null, undefined, 'lock', 5, [], { type: 5 }, { type: null }]) assert.deepEqual(await send(raw), { ok: false, error: 'INVALID_REQUEST' }, JSON.stringify(raw));
  for (const type of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) assert.deepEqual(await send({ type }), { error: 'unknown_message' }, type);
  assert.equal(({}).polluted, undefined);
});

// ---------------------------------------------------------------- UI port (EXT-06)

function uiPort(sender) {
  const L = { m: [], d: [] }; const out = []; let disconnected = false;
  const port = { name: 'harbour-ui', sender, onMessage: { addListener: (f) => L.m.push(f) }, onDisconnect: { addListener: (f) => L.d.push(f) }, postMessage: (m) => out.push(structuredClone(m)), disconnect: () => { disconnected = true; } };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  return { out, send: (m) => L.m.forEach((f) => f(m)), close: () => L.d.forEach((f) => f()), get disconnected() { return disconnected; } };
}
test('T-EXT-012: harbour-ui port: snapshot then patches for the popup; foreign senders disconnected; malformed requests ignored', async () => {
  const bad = uiPort({ id: 'test', url: 'https://evil.example/', tab: { id: 3 } });
  assert.equal(bad.disconnected, true); assert.equal(bad.out.length, 0);
  const p = uiPort(INTERNAL);
  assert.equal(p.out[0].kind, 'snapshot'); assert.ok(p.out[0].state.wallet);
  assert.equal(M.findSecretField(p.out[0].state), null);
  p.send({ id: 'x', msg: { type: 'status' } }); p.send(null); p.send({ msg: { type: 'status' } });
  p.send({ id: 7, msg: { type: 'status' } });
  const res = await until(() => p.out.find((m) => m.kind === 'response'));
  assert.deepEqual(res, { kind: 'response', id: 7, result: { hasVault: true, unlocked: true } });
  assert.equal(p.out.filter((m) => m.kind === 'response').length, 1, 'non-number ids ignored');
  M.store.dispatch(M.actions.live.patch({ balanceTick: 99 }));
  const patch = await until(() => p.out.find((m) => m.kind === 'patch' && m.patch.live));
  assert.equal(patch.patch.live.balanceTick, 99); assert.deepEqual(Object.keys(patch.patch), ['live'], 'only the changed slice');
  p.send({ id: 8, msg: { type: 'qaThrow' } });
  assert.equal((await until(() => p.out.find((m) => m.id === 8))).result.ok, false);
  p.close();
});

// ---------------------------------------------------------------- boot loop / queue / self-heal (EXT-07)

test('T-EXT-013: bootWith retries a failing step up to the limit and names the step when it gives up', async () => {
  let n = 0; await M.bootWith([{ name: 'flaky', run: async () => { if (++n < 20) throw new Error('nope'); } }], 20, 0);
  assert.equal(n, 20);
  let m = 0; await assert.rejects(M.bootWith([{ name: 'broken', run: async () => { m++; throw new Error('down'); } }], 20, 0), /boot step "broken" failed: down/);
  assert.equal(m, 20);
  const order = []; await M.bootWith([{ name: 'a', run: async () => order.push('a') }, { name: 'b', run: async () => order.push('b') }], 1, 0); assert.deepEqual(order, ['a', 'b']);
  assert.equal(M.BOOT_MAX_ATTEMPTS, 20);
});

test('T-EXT-014: queue keeps failed jobs and jobs without a handler; successful jobs are removed', async () => {
  await M.queue.enqueue('qa-ok', 1); await M.queue.enqueue('qa-fail', 2); await M.queue.enqueue('qa-unknown', 3);
  const done = []; M.queue.register('qa-ok', async (j) => { done.push(j.payload); }); M.queue.register('qa-fail', async () => { throw new Error('later'); });
  await M.queue.drain();
  assert.deepEqual(done, [1]);
  assert.deepEqual((await M.queue.list()).map((j) => j.kind).sort(), ['qa-fail', 'qa-unknown']);
  M.queue.register('qa-fail', async () => {}); await M.queue.drain();
  assert.deepEqual((await M.queue.list()).map((j) => j.kind), ['qa-unknown']);
});

test('T-EXT-015: selfHeal reloads at most once per hour', async () => {
  const clk = fakeClock(); const before = F.reloads ?? 0;
  try {
    assert.equal(await M.selfHeal('wasm'), true); assert.equal(await M.selfHeal('wasm'), false);
    clk.advance(60 * 60 * 1000 - 1); assert.equal(await M.selfHeal('wasm'), false);
    clk.advance(2); assert.equal(await M.selfHeal('wasm'), true);
    assert.equal((F.reloads ?? 0) - before, 2);
  } finally { clk.restore(); }
});

// ---------------------------------------------------------------- store (EXT-08)

test('T-EXT-017 / T-EXT-044: hydrate drops unknown slices, keeps defaults for missing keys, never persists transient slices; random persisted shapes never throw', async () => {
  await H.M.store.dispatch({ type: 'noop' });
  F.local.data['wallet:store'] = [1, 0, { slices: { settings: { lockTimeInMinutes: 7 }, bogus: { x: 1 }, wallet: { unlocked: true, secret: 'x' } } }];
  await M.hydrateStore();
  const s = M.store.getState();
  assert.equal(s.settings.lockTimeInMinutes, 7); assert.equal(s.settings.language, 'en', 'default kept'); assert.equal(s.bogus, undefined);
  M.store.dispatch(M.actions.settings.patch({ lockTimeInMinutes: 8 }));
  await until(() => F.local.data['wallet:store']?.[2]?.slices?.settings?.lockTimeInMinutes === 8, 2000);
  const persisted = F.local.data['wallet:store'][2].slices;
  for (const t of ['wallet', 'approvals', 'app', 'live']) assert.equal(persisted[t], undefined, `${t} is transient`);
  await fc.assert(fc.asyncProperty(fc.oneof(fc.jsonValue(), fc.dictionary(fc.constantFrom('settings', 'tx', 'fiat', 'nft', 'zzz'), fc.jsonValue())), async (slices) => {
    F.local.data['wallet:store'] = [1, 0, { slices }];
    await M.hydrateStore();
    const st = M.store.getState();
    for (const k of ['settings', 'tx', 'fiat', 'nft', 'wallet']) assert.ok(st[k] && typeof st[k] === 'object', k);
  }), { numRuns: 150, seed: 44 });
});

test('T-EXT-018: no store slice ever holds a secret-named field or the phrase/session keys (initial and after flows)', async () => {
  const st = M.store.getState();
  assert.equal(M.findSecretField(st), null);
  const text = JSON.stringify([st, F.local.data['wallet:store']]);
  for (const s of [PHRASE_ABOUT, PASSWORD, F.session.data['wallet:password'], F.session.data['wallet:unlock']]) assert.ok(!s || !text.includes(s));
});

test('T-EXT-043: rapid dispatches are persisted as one complete tuple after the debounce (never a partial write)', async () => {
  const writes = []; const orig = F.local.data; const watch = setInterval(() => { const v = F.local.data['wallet:store']; if (v) writes.push(JSON.stringify(v)); }, 1);
  for (let i = 0; i < 50; i++) M.store.dispatch(M.actions.settings.patch({ lockTimeInMinutes: 10 + (i % 5) }));
  await tick(600); clearInterval(watch); void orig;
  for (const w of writes) { const t = JSON.parse(w); assert.ok(Array.isArray(t) && t.length === 3 && t[2].slices && t[2].slices.settings); }
  assert.equal(JSON.parse(writes.at(-1))[2].slices.settings.lockTimeInMinutes, 14);
});

// ---------------------------------------------------------------- signed remote config (EXT-11)

const kp = crypto.generateKeyPairSync('ed25519');
const PUB = kp.publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
const signText = (t) => crypto.sign(null, Buffer.from(t), kp.privateKey).toString('base64');
test('T-EXT-024: Ed25519 config signature over the exact text (RFC 8032 test 1 + whitespace/key/base64 tampering)', async () => {
  const rfcPub = Buffer.from('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a', 'hex').toString('base64');
  const rfcSig = Buffer.from('e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b', 'hex').toString('base64');
  assert.equal(await M.verifySignature('', rfcSig, rfcPub), true);
  const text = '{"version":5,"flags":{"swap":true}}';
  assert.equal(await M.verifySignature(text, signText(text), PUB), true);
  assert.equal(await M.verifySignature(text + ' ', signText(text), PUB), false, 'whitespace change');
  assert.equal(await M.verifySignature(text, signText(text), rfcPub), false, 'wrong key');
  assert.equal(await M.verifySignature(text, '%%%not-base64', PUB), false);
  assert.equal(await M.verifySignature(text, signText(text), 'AAAA'), false, 'short key');
});

test('T-EXT-025 / T-EXT-026: downgrade and expired configs refused; non-boolean flags filtered; non-https URLs dropped; missing expiry accepted (AMB-11)', () => {
  const clk = fakeClock(1_800_000_000_000);
  try {
    const now = Math.floor(Date.now() / 1000);
    assert.equal(M.parseConfig(JSON.stringify({ version: 4 }), 5), null, 'downgrade');
    assert.equal(M.parseConfig(JSON.stringify({ version: 6, expiresAt: now - 1 }), 5), null, 'expired');
    assert.equal(M.parseConfig(JSON.stringify({ version: 6, expiresAt: String(now + 100) }), 5), null, 'non-numeric expiry');
    const c = M.parseConfig(JSON.stringify({ version: 6, expiresAt: now + 100, flags: { a: true, b: 'yes', c: 1, d: false }, chains: { x: true, y: null }, killedProviders: ['p', 3],
      announcements: [{ id: '1', title: 't', url: 'javascript:alert(1)' }, { id: '2', title: 't', url: 'http://plain' }, { id: '3', title: 't', url: 'https://ok.example' }, { title: 'no id' }],
      discover: [{ name: 'a', url: 'https://a' }, { name: 'b', url: 'javascript:x' }] }), 5);
    assert.deepEqual(c.flags, { a: true, d: false }); assert.deepEqual(c.chains, { x: true }); assert.deepEqual(c.killedProviders, ['p']);
    assert.deepEqual(c.announcements.map((a) => a.url), [undefined, undefined, 'https://ok.example']);
    assert.deepEqual(c.discover.map((d) => d.name), ['a']);
    assert.equal(M.parseConfig(JSON.stringify({ version: 5 }), 5)?.version, 5, 'same version without expiry accepted (documented replay window, AMB-11)');
  } finally { clk.restore(); }
});

test('T-EXT-045: parseConfig never throws; accepted output has only booleans in flags/chains and https URLs', () => {
  fc.assert(fc.property(fc.oneof(fc.string(), fc.jsonValue().map((v) => JSON.stringify(v)), fc.record({ version: fc.integer(), flags: fc.jsonValue(), chains: fc.jsonValue(), announcements: fc.jsonValue(), discover: fc.jsonValue() }).map((v) => JSON.stringify(v))), (text) => {
    const c = M.parseConfig(text, 0);
    if (c) {
      for (const v of [...Object.values(c.flags), ...Object.values(c.chains)]) assert.equal(typeof v, 'boolean');
      for (const a of c.announcements) assert.ok(a.url === undefined || a.url.startsWith('https://'));
      for (const d of c.discover ?? []) assert.ok(d.url.startsWith('https://'));
    }
  }), { numRuns: 3000, seed: 45 });
});

test('T-EXT-027: refreshing remote config through a failing endpoint keeps the previous config and kill switches', async () => {
  const before = (await send({ type: 'getRemoteConfig' }));
  for (const impl of [async () => new Response('oops', { status: 500 }), async () => { throw new TypeError('timeout'); }, async () => new Response('{not json', { status: 200 }), async () => new Response(JSON.stringify({ config: '{"version":99}', signature: 'AAAA' }), { status: 200 })]) {
    F.fetchImpl = impl;
    const r = await send({ type: 'refreshRemoteConfig' });
    assert.equal(r.ok, true); assert.equal(r.version, before.version);
  }
  F.fetchImpl = null;
  assert.deepEqual(await send({ type: 'getRemoteConfig' }), before);
});

// ---------------------------------------------------------------- offscreen clipboard (EXT-13)

test('T-EXT-030: concurrent copy requests share one offscreen document over its own port and each gets its own answer', async (t) => {
  const created = []; const orig = chrome.offscreen.createDocument;
  // Like Chrome: a second createDocument while one exists fails ("Only a single offscreen document may be created").
  let open = false;
  chrome.offscreen.createDocument = async (o) => { created.push(o); if (open) throw new Error('Only a single offscreen document may be created.'); open = true; return orig(o); };
  try {
    F.clipboard.length = 0;
    const rs = await Promise.allSettled([M.copySecretToClipboard('one', 60_000), M.copySecretToClipboard('two', 30_000)]);
    const failed = rs.filter((r) => r.status === 'rejected').map((r) => r.reason?.message);
    if (failed.length) return assert.fail('BUG-09 regression (fixed bug reproduces again): ' + `two concurrent copies: ${failed.length} failed (${failed.join(', ')}); clipboard got ${JSON.stringify(F.clipboard.map((c) => c.text))}; createDocument called ${created.length}×`);
    assert.deepEqual(F.clipboard.map((c) => c.text).sort(), ['one', 'two']);
    assert.equal(created.length, 1);
  } finally { chrome.offscreen.createDocument = orig; }
});

test('T-EXT-030b: a single copy uses a CLIPBOARD offscreen document, point-to-point port, and passes the clear delay', async () => {
  const created = []; const orig = chrome.offscreen.createDocument;
  chrome.offscreen.createDocument = async (o) => { created.push(o); return orig(o); };
  try {
    F.clipboard.length = 0;
    // a fresh bundle so no port is cached from the previous test
    const H3 = await harness(`export { copySecretToClipboard } from './background/clipboard'; // fresh clipboard module`);
    await H3.M.copySecretToClipboard('solo', 45_000);
    assert.deepEqual(F.clipboard, [{ text: 'solo', clearAfterMs: 45_000 }]);
    assert.deepEqual(created.map((c) => [c.url, c.reasons]), [['src/offscreen/clipboard.html', ['CLIPBOARD']]]);
    // a port named like the offscreen one but from another URL is refused
    let disconnected = false;
    F.listeners['runtime.onConnect'].forEach((f) => f({ name: 'harbour-offscreen', sender: { url: 'https://evil.example/' }, disconnect: () => { disconnected = true; }, onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }));
    assert.equal(disconnected, true);
  } finally { chrome.offscreen.createDocument = orig; }
});

// ---------------------------------------------------------------- push (EXT-16)

test('T-EXT-037: a push payload becomes a bounded notification; malformed payloads and non-https click URLs do nothing harmful', async () => {
  const fire = (type, ev) => (F.listeners['self.' + type] ?? []).forEach((f) => f(ev));
  const waits = []; const ev = (data) => ({ data: { json: () => { if (data === 'bad') throw new Error('x'); return data; } }, waitUntil: (p) => waits.push(p) });
  F.shown = [];
  fire('push', ev({ title: 'T'.repeat(500), body: 'B'.repeat(900), data: { chain: 'ethereum', tx_hash: '0x' + 'ab'.repeat(32) } }));
  fire('push', ev('bad'));
  fire('push', ev({ title: '<img src=x onerror=alert(1)>', data: { tx_hash: 'javascript:alert(1)' } }));
  await Promise.all(waits);
  assert.equal(F.shown.length, 3);
  assert.equal(F.shown[0].title.length, 80); assert.equal(F.shown[0].body.length, 200); assert.match(F.shown[0].data.url, /^https:\/\//);
  assert.equal(F.shown[1].title, 'Harbour'); assert.equal(F.shown[2].data.url, '', 'no URL for a malformed hash');
  F.opened = [];
  for (const url of ['javascript:alert(1)', 'http://x', 'https://etherscan.io/tx/0x1']) fire('notificationclick', { notification: { close() {}, data: { url } }, waitUntil: (p) => p });
  assert.deepEqual(F.opened, ['https://etherscan.io/tx/0x1']);
});

// ---------------------------------------------------------------- settings side effects (EXT-10)

test('T-EXT-046: setSettings applies its side effects: lock alarm re-armed with the new delay, side panel behaviour, store slice', async () => {
  F.session.data['wallet:manageGrant'] = { exp: Date.now() + 60_000, method: 'password' };
  assert.equal((await send({ type: 'setSettings', patch: { lockTimeInMinutes: 15 } })).ok, true);
  await send({ type: 'activity' });
  const alarm = F.alarms.find((a) => a[0] === M.LOCK_ALARM);
  assert.ok(alarm, 'lock alarm armed'); assert.equal(alarm[1].delayInMinutes, 15);
  assert.equal((await send({ type: 'setSettings', patch: { preferSidePanel: true } })).ok, true);
  await until(() => F.sidePanel?.openPanelOnActionClick === true, 1000);
  assert.equal(F.sidePanel?.openPanelOnActionClick, true);
  assert.equal((await send({ type: 'getSettings' })).settings.lockTimeInMinutes, 15);
});

// ---------------------------------------------------------------- worker termination with a pending approval (EXT-09)

test('T-EXT-019: a pending site request survives a service-worker restart; the restarted worker signs it exactly once', async () => {
  // Worker #1 receives the request
  const pagePort = (origin, tabId) => { const L = { m: [], d: [] }; const out = [];
    const port = { name: 'harbour-provider', sender: { id: 'test', url: origin + '/', origin, frameId: 0, documentId: 'd1', tab: { id: tabId, url: origin + '/' } }, onMessage: { addListener: (f) => L.m.push(f) }, onDisconnect: { addListener: (f) => L.d.push(f) }, postMessage: (m) => out.push(m) };
    return { port, out, post: (m) => L.m.forEach((f) => f(m)), close: () => L.d.forEach((f) => f()) }; };
  const origin = 'https://restart.example';
  // connect first (approve through worker #1)
  const p1 = pagePort(origin, 77); F.listeners['runtime.onConnect'].forEach((f) => f(p1.port));
  p1.post({ id: 'c1', ns: 'evm', method: 'eth_requestAccounts' });
  const conn = await until(async () => (await send({ type: 'providerPending' })).items.find((x) => x.kind === 'connect'));
  await send({ type: 'providerResolve', id: conn.id, decision: { approve: true } });
  await until(() => p1.out.find((m) => m.id === 'c1'));
  p1.post({ id: 's1', ns: 'evm', method: 'personal_sign', params: [toHex('restart'), '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'] });
  const pend = await until(async () => (await send({ type: 'providerPending' })).items.find((x) => x.kind === 'sign'));
  assert.ok(pend);
  // "Terminate" worker #1: its module state is gone, storage (local, session, IndexedDB) survives. Boot worker #2 from scratch.
  const H2 = await harness(`import './background/index'; // second worker instance`);
  const n2 = F.listeners['runtime.onMessage'].length - 1;
  const send2 = (msg) => F.listeners['runtime.onMessage'][n2](msg, INTERNAL);
  const listed = await until(async () => (await send2({ type: 'providerPending' })).items?.find((x) => x.id === pend.id));
  assert.ok(listed, 'the restarted worker still lists the request');
  // the content script reconnects to worker #2 and re-sends the same request id
  const onConnect2 = F.listeners['runtime.onConnect'].at(-1);
  const p2 = pagePort(origin, 77); onConnect2(p2.port);
  p2.post({ id: 's1', ns: 'evm', method: 'personal_sign', params: [toHex('restart'), '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'] });
  await tick(100);
  assert.equal((await send2({ type: 'providerPending' })).items.filter((x) => x.kind === 'sign').length, 1, 're-send does not duplicate the request');
  await send2({ type: 'providerResolve', id: pend.id, decision: { approve: true } });
  const res = await until(() => p2.out.find((m) => m.t === 'res' && m.id === 's1') ?? p1.out.find((m) => m.t === 'res' && m.id === 's1'));
  assert.ok(res?.result, JSON.stringify(res));
  assert.equal(await verifyMessage({ address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', message: 'restart', signature: res.result }), true);
  assert.deepEqual(await send2({ type: 'providerResolve', id: pend.id, decision: { approve: true } }).then((r) => r.ok), false, 'second approval of the same request does nothing');
  void H2;
});
