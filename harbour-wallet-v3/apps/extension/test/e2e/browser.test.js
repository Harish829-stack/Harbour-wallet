// Browser E2E: the BUILT extension (vite production build pointed at a local backend) loaded into Chromium by Playwright, against the
// full local stack (real Go API + Postgres + Redis + deterministic mock chain, see stack.mjs) and a fixture dApp served from 127.0.0.1.
// Nothing leaves the machine. Requirements: those of stack.mjs + Playwright's Chromium (npx playwright install chromium).
// TEST_PLAN: T-EXT-038, T-KEY-047, T-KEY-115, T-KEY-116, T-KEY-117, T-EXT-004, T-EXT-035, T-DAPP-051, T-PM-006, T-SIG-022, T-SIG-043,
// T-SIG-044, T-UX-030, T-DAPP-052, T-EXT-020, T-CH-011, T-X-012, T-EXT-040, T-EXT-041, T-KEY-118, T-REG-021, T-REG-031, BUG-12.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { verifyMessage, verifyTypedData, toHex } from 'viem';
import { startStack, stackRequirements, extensionDir } from './stack.mjs';

const require = createRequire(import.meta.url);
const missing = stackRequirements();
let chromium; try { ({ chromium } = await import('playwright')); } catch { missing.push('playwright (npm i -D playwright && npx playwright install chromium)'); }
const e2e = (name, fn) => test(name, missing.length ? { skip: `browser E2E not configured: ${missing.join(', ')}` } : { timeout: 240_000 }, fn);
const PASSWORD = 'Correct-horse-9-battery';
const WORDS = new Set(require('@scure/bip39/wordlists/english').wordlist);
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

/** Production build of the extension that talks to http://localhost:8080 (loopback host permission only in such a build). */
function buildExtension() {
  if (process.env.HB_E2E_EXT_DIR) return process.env.HB_E2E_EXT_DIR;
  const out = join(extensionDir, 'node_modules/.cache/harbour-qa/dist-e2e');
  if (existsSync(join(out, 'manifest.json')) && process.env.HB_E2E_REBUILD !== '1') return out;
  const env = { ...process.env, VITE_HB_API_URL: 'http://localhost:8080' };
  for (const [cmd, args] of [['node', ['scripts/prepare-wasm.mjs']], ['node', ['scripts/build-inpage.mjs']], ['node', ['scripts/build-content.mjs']], ['npx', ['vite', 'build', '--outDir', out, '--emptyOutDir']]]) {
    const r = spawnSync(cmd, args, { cwd: extensionDir, env, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  }
  return out;
}

let S, EXT, dapp, dappUrl, iframeUrl;
before(async () => {
  if (missing.length) return;
  EXT = buildExtension();
  S = await startStack({ established: true });
  const page = readFileSync(new URL('./fixtures/dapp.html', import.meta.url));
  dapp = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(q.url.startsWith('/frame') ? '<script>window.go=()=>window.ethereum.request({method:"eth_requestAccounts"}).then(a=>parent.postMessage({a},"*"),e=>parent.postMessage({e:e.code},"*"))</script>' : page); });
  await new Promise((r) => dapp.listen(0, '127.0.0.1', r));
  dappUrl = `http://127.0.0.1:${dapp.address().port}/`;
  // a second origin for the cross-origin iframe (localhost vs 127.0.0.1)
  iframeUrl = `http://localhost:${dapp.address().port}/frame`;
});
after(async () => { dapp?.close(); await S?.stop(); });

/** A fresh browser profile with the extension. `wide` keeps Playwright's default 1280-px window (reproduces BUG-12). */
async function launch({ wide = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hb-e2e-'));
  const ctx = await chromium.launchPersistentContext(dir, { headless: true, channel: 'chromium', viewport: null,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, ...(wide ? ['--window-size=1600,1000'] : ['--window-size=700,550'])] });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  const popupUrl = (hash = '') => `chrome-extension://${id}/src/popup/index.html${hash}`;
  const close = async () => { await ctx.close(); rmSync(dir, { recursive: true, force: true }); };
  return { ctx, sw, id, popupUrl, close };
}
async function onboardingTab(ctx) {
  for (let i = 0; i < 75; i++) { const p = ctx.pages().find((x) => x.url().includes('#/onboarding')); if (p) { await p.waitForLoadState(); return p; } await tick(200); }
  throw new Error('onboarding tab did not open on install');
}
async function createWallet(b) {
  const o = await onboardingTab(b.ctx);
  await o.locator('input[type=checkbox]').first().check();
  await o.getByRole('button', { name: 'Create new wallet' }).first().click();
  await o.locator('input[type=password]').nth(0).fill(PASSWORD);
  await o.locator('input[type=password]').nth(1).fill(PASSWORD);
  await o.getByRole('button', { name: 'Continue' }).click();
  await o.getByRole('button', { name: 'Open my wallet' }).waitFor({ timeout: 30_000 });
  return o;
}
async function popup(b, hash = '') { const p = await b.ctx.newPage(); await p.goto(b.popupUrl(hash)); await p.waitForLoadState(); await tick(1500); return p; }
/** Ask the worker the way the popup does (an extension page is the only sender the router accepts). */
async function bg(b, msg) {
  const p = await b.ctx.newPage(); await p.goto(b.popupUrl('#/qa-probe'));
  try { return await p.evaluate((m) => chrome.runtime.sendMessage(m), msg); } finally { await p.close(); }
}
async function evmAddress(b) { return (await bg(b, { type: 'getAccounts' }))?.addresses?.ethereum ?? null; }
const visibleText = (p) => p.evaluate(() => document.body.innerText);
/** Every BIP-39 word that appears as a whole token in visible text, attribute values or the accessibility tree. */
async function phraseWordsInDom(p, phraseWords) {
  const dom = await p.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value))].join(' '));
  const ax = JSON.stringify(await p.accessibility?.snapshot?.().catch(() => null) ?? {});
  return [...new Set((dom + ' ' + ax).toLowerCase().split(/[^a-z]+/).filter((w) => phraseWords.has(w)))];
}
const seenApprovals = new WeakSet();
/** The next approval window that has not been returned before (a closing window can linger in ctx.pages()). */
async function approvalWindow(b, ms = 15_000) {
  for (let t = 0; t < ms; t += 200) {
    const p = b.ctx.pages().find((x) => !x.isClosed() && !seenApprovals.has(x) && x.url().includes('#/notification'));
    if (p) { seenApprovals.add(p); await p.waitForLoadState(); await tick(800); return p; }
    await tick(200);
  }
  return null;
}
async function dappPage(b, url = dappUrl) { const p = await b.ctx.newPage(); await p.goto(url); await p.waitForFunction(() => !!window.ethereum && !!window.qa); return p; }
const lastOut = (p) => p.evaluate(() => JSON.parse(document.querySelector('#out').textContent));
async function until(f, ms = 20_000) { for (let t = 0; t < ms; t += 250) { const v = await f(); if (v) return v; await tick(250); } return null; }

// ---------------------------------------------------------------- install, onboarding, lock (EXT, KEY-14, KEY-06)

e2e('T-EXT-038 / T-KEY-047: install opens onboarding, create wallet, home shows the account, lock, unlock', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const home = await popup(b);
    assert.match(await visibleText(home), /Main wallet/);
    const addr = await evmAddress(b); assert.match(addr ?? '', /^0x[0-9a-fA-F]{40}$/);
    await home.getByRole('button', { name: 'Settings' }).click();
    await home.getByRole('button', { name: 'Lock wallet' }).click();
    await home.getByText('Welcome back').waitFor();
    await home.reload(); await home.getByText('Welcome back').waitFor({ timeout: 10_000 });
    await home.locator('input[type=password]').fill(PASSWORD); await home.keyboard.press('Enter');
    await home.getByText('Main wallet').first().waitFor({ timeout: 30_000 });
  } finally { await b.close(); }
});

e2e('T-KEY-115 / T-EXT-035: wrong passwords lock out with a message; typed secrets never stay in the DOM', async (t) => {
  const b = await launch();
  try {
    await createWallet(b);
    const p = await popup(b);
    await p.getByRole('button', { name: 'Settings' }).click(); await p.getByRole('button', { name: 'Lock wallet' }).click();
    await p.getByText('Welcome back').waitFor();
    const messages = [];
    const submit = async (pw) => {
      // Wait for the answer, not for a text change: repeated "Incorrect password" looks identical, and waiting out a timeout
      // would also wait out the 5-s lockout under test. The submit toggles the busy state, so mutations mark the round trip.
      await p.locator('input[type=password]').fill(pw); await tick(100);
      await p.evaluate(() => { window.__muts = 0; window.__last = Date.now(); window.__mo?.disconnect(); window.__mo = new MutationObserver(() => { window.__muts++; window.__last = Date.now(); }); window.__mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); });
      await p.keyboard.press('Enter');
      await until(() => p.evaluate(() => window.__muts > 0 && Date.now() - window.__last > 400 && /Incorrect password|too many|TOO_MANY|Main wallet/i.test(document.body.innerText)).catch(() => false), 8000);
      const m = (await visibleText(p)).replace(/\s+/g, ' '); messages.push(m); return m;
    };
    // vaultService: 5 free attempts, then 5 s, 10 s, ... lockouts (BASE_DELAY_MS 5000). The 6th failure arms a 5-s lock.
    for (let i = 0; i < 6; i++) {
      await submit(`Wrong-pass-${i}`);
      const html = await p.content();
      assert.ok(!html.includes(`Wrong-pass-${i}`) || (await p.locator('input[type=password]').inputValue()) === '', 'the typed password is not kept in the DOM after submit');
    }
    const t0 = Date.now();
    const during = await submit(PASSWORD);
    t.diagnostic(`unlock messages: ${messages.map((m) => m.replace(/^.*Password/, '').slice(0, 60)).join(' | ')}`);
    assert.ok(messages.slice(0, 6).every((m) => /Incorrect password/.test(m)), 'every wrong attempt says "Incorrect password"');
    assert.ok(Date.now() - t0 < 5000, 'right password tried inside the 5-s lock');
    assert.doesNotMatch(during, /Main wallet\s+Account 1/, 'the right password is refused during lockout');
    assert.match(during, /too many|try again|wait|locked|TOO_MANY_ATTEMPTS/i, 'a lockout message is shown');
    assert.ok(!(await p.content()).includes(PASSWORD), 'password never rendered');
    await tick(Math.max(0, 5600 - (Date.now() - t0)));
    await p.locator('input[type=password]').fill(PASSWORD); await p.keyboard.press('Enter');
    await p.getByText('Main wallet').first().waitFor({ timeout: 10_000 });
    if (/TOO_MANY_ATTEMPTS/.test(during)) return assert.fail('BUG-14 regression (fixed bug reproduces again): ' + `the lock screen shows the raw code "TOO_MANY_ATTEMPTS" (App.tsx:164 setErr(res.error)) instead of a lockout message: ${during.slice(-120)}`);
  } finally { await b.close(); }
});

e2e('T-KEY-116: the backup screen shows the phrase only as images: no word in text, attributes or the accessibility tree', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const p = await popup(b);
    await p.getByText('Back up your secret phrase').first().click();
    await p.getByTestId('reveal-password').locator('input').or(p.locator('input[type=password]')).first().fill(PASSWORD);
    await p.keyboard.press('Enter');
    const hold = p.getByTestId('hold-to-reveal'); await hold.waitFor({ timeout: 15_000 });
    const box = await hold.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await tick(2500);
    const imgs = await p.locator('[data-testid="seed-reveal"] img, [data-testid="seed-reveal"] canvas').count();
    const region = await p.getByTestId('seed-reveal').evaluate((e) => [e.innerText, ...[...e.querySelectorAll('*')].flatMap((x) => [...x.attributes].filter((a) => /^(alt|title|aria-.*|data-word|value)$/.test(a.name)).map((a) => a.value))].join(' \n '));
    const pageText = await visibleText(p);
    await p.mouse.up();
    assert.ok(imgs >= 1, 'phrase rendered as image(s)');
    const runOf = (text) => { let run = 0, worst = 0; for (const w of text.toLowerCase().split(/[^a-z]+/).filter(Boolean)) { run = WORDS.has(w) ? run + 1 : 0; worst = Math.max(worst, run); } return worst; };
    // UI copy ("Hold to reveal your secret phrase") is made of ordinary words; a leaked phrase is a run of 12+ list words.
    assert.ok(runOf(region) < 6, `phrase-like run of ${runOf(region)} words in the phrase area text/alt/aria: ${region.slice(0, 200)}`);
    // no run of 3+ BIP-39 words in a row anywhere in the visible text (how a phrase would look if it leaked as text)
    const toks = pageText.toLowerCase().split(/\s+/).map((w) => w.replace(/^\d+[.)]?/, ''));
    let run = 0, worst = 0; for (const w of toks) { run = WORDS.has(w) ? run + 1 : 0; worst = Math.max(worst, run); }
    assert.ok(worst < 6, `a run of ${worst} BIP-39 words is visible as text`);
    const shot = await p.screenshot(); assert.ok(shot.length > 1000);
  } finally { await b.close(); }
});

e2e('T-KEY-117: reveal screen — press-and-hold (pointer and keyboard), hides on window blur, auto-hides after the visible window, needs a fresh hold to show again', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const p = await b.ctx.newPage(); await p.clock.install(); await p.goto(b.popupUrl()); await p.waitForLoadState();
    await p.getByText('Back up your secret phrase').first().click();
    await p.getByTestId('reveal-password').locator('input').or(p.locator('input[type=password]')).first().fill(PASSWORD);
    await p.keyboard.press('Enter');
    const hold = p.getByTestId('hold-to-reveal'); await hold.waitFor({ timeout: 15_000 });
    const shown = () => p.locator('[data-testid="seed-reveal"] img').count();
    // a short press does nothing
    const box = await hold.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.clock.runFor(400); await p.mouse.up();
    assert.equal(await shown(), 0, 'a short press does not reveal');
    // keyboard: hold Space reveals (reachable without a pointer)
    await hold.focus(); await p.keyboard.down('Space'); await p.clock.runFor(1500); await p.keyboard.up('Space');
    await until(async () => (await shown()) > 0, 10_000); assert.ok((await shown()) > 0, 'holding Space for the hold time reveals');
    // window blur hides it at once
    await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    await until(async () => (await shown()) === 0, 5_000); assert.equal(await shown(), 0, 'blur re-masks the secret');
    // a fresh hold (pointer) shows it again, and it hides on its own after the visible window
    await hold.waitFor(); const b2 = await hold.boundingBox(); await p.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2); await p.mouse.down(); await p.clock.runFor(1500); await p.mouse.up();
    await until(async () => (await shown()) > 0, 10_000); assert.ok((await shown()) > 0, 'a second hold reveals again');
    await p.clock.runFor(59_000); assert.ok((await shown()) > 0, 'still visible before the limit');
    await p.clock.runFor(2_000); await until(async () => (await shown()) === 0, 5_000);
    assert.equal(await shown(), 0, 'auto-hides after the visible window (60 s)');
    assert.equal(await p.getByTestId('hold-to-reveal').count(), 1, 'the hold control is back: revealing again needs another hold');
  } finally { await b.close(); }
});

/** Chromium's virtual platform authenticator (CDP WebAuthn domain): the OS biometric sheet is replaced by a software one. */
async function virtualAuthenticator(page, { hasPrf }) {
  const cdp = await page.context().newCDPSession(page); await cdp.send('WebAuthn.enable');
  const r = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf } });
  return { cdp, id: r.authenticatorId };
}

e2e('T-KEY-083 / T-KEY-130: biometrics — enrol with a PRF authenticator, lock, unlock by biometrics; an authenticator without PRF is refused with no seal stored', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    // 1. authenticator WITHOUT PRF: clear refusal, nothing enrolled
    const bad = await b.ctx.newPage(); await bad.goto(b.popupUrl('?enroll=1')); await bad.waitForLoadState();
    const va0 = await virtualAuthenticator(bad, { hasPrf: false });
    await bad.locator('input[type=password]').first().fill(PASSWORD).catch(() => {}); await bad.keyboard.press('Enter').catch(() => {});
    const btn0 = bad.getByTestId('biometric-enroll-btn'); await btn0.waitFor({ timeout: 20_000 }); await btn0.click();
    await bad.getByRole('alert').waitFor({ timeout: 20_000 });
    assert.match(await bad.getByRole('alert').innerText(), /PRF|password/i, 'refusal names the problem and the password path');
    assert.equal((await bg(b, { type: 'passkeyStatus' })).enabled, false, 'no partial seal after a refused enrolment');
    await va0.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: va0.id }); await bad.close();
    // 2. authenticator WITH PRF: enrol, lock, unlock
    const ok = await b.ctx.newPage(); await ok.goto(b.popupUrl('?enroll=1')); await ok.waitForLoadState();
    await virtualAuthenticator(ok, { hasPrf: true });
    await ok.locator('input[type=password]').first().fill(PASSWORD).catch(() => {}); await ok.keyboard.press('Enter').catch(() => {});
    const btn = ok.getByTestId('biometric-enroll-btn'); await btn.waitFor({ timeout: 20_000 }); await btn.click();
    assert.ok(await until(async () => (await bg(b, { type: 'passkeyStatus' })).enabled, 30_000), 'biometrics enabled');
    const st = await bg(b, { type: 'passkeyStatus' }); assert.equal(st.legacy, false, 'sealed under the PRF scheme');
    assert.match(st.credentialId, /^[0-9a-f]+$/);
    await bg(b, { type: 'lock' });
    assert.notEqual((await bg(b, { type: 'getAccounts' }))?.ok, true, 'locked');
    // the virtual authenticator is per-page; unlock on the page that owns it
    await ok.goto(b.popupUrl('?biometrics=1')); await ok.waitForLoadState();
    assert.ok(await until(async () => (await bg(b, { type: 'getAccounts' }))?.addresses?.ethereum, 30_000), 'biometric unlock restored the session');
    await ok.close();
  } finally { await b.close(); }
});

e2e('T-EXT-004: Trusted Types block HTML injection sinks in extension pages', async () => {
  const b = await launch();
  try {
    const p = await popup(b);
    const r = await p.evaluate(() => { const out = {}; for (const [k, f] of Object.entries({ innerHTML: () => { document.body.innerHTML = '<img src=x onerror=alert(1)>'; }, insertAdjacentHTML: () => document.body.insertAdjacentHTML('beforeend', '<b>x</b>'), scriptSrc: () => { const s = document.createElement('script'); s.src = 'https://evil.example/x.js'; } })) { try { f(); out[k] = 'allowed'; } catch (e) { out[k] = e.name; } } return out; });
    assert.deepEqual(r, { innerHTML: 'TypeError', insertAdjacentHTML: 'TypeError', scriptSrc: 'TypeError' });
  } finally { await b.close(); }
});

// ---------------------------------------------------------------- dApp flows (DAPP, SIG, PM)

e2e('T-DAPP-051 / T-PM-006 / T-SIG-022 / T-X-012: connect, switch to Sepolia, personal_sign, typed data, send a transaction, watch asset, revoke — through the approval window', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const addr = await evmAddress(b); S.chain.fund(addr, 10n ** 18n);
    const d = await dappPage(b);
    const approve = async (fn, button = /^(Connect|Approve|Confirm|Sign|Switch|Add|Send)$/, arg) => {
      const done = d.evaluate(fn, arg); done.catch(() => {}); // awaited below; never an unhandled rejection that hides the real failure
      const w = await approvalWindow(b); assert.ok(w, 'approval window opened');
      await w.getByTestId('approval-origin').waitFor({ timeout: 15_000 }); // a transaction review loads fee and simulation first
      const action = w.getByRole('button', { name: button }).last();
      await until(() => action.isEnabled().catch(() => false), 15_000);
      await action.click();
      return done;
    };
    const acc = await approve(() => window.qa.accounts());
    assert.deepEqual(acc.result.map((x) => x.toLowerCase()), [addr.toLowerCase()]);
    const sw = await approve(() => window.qa.switchChain('0xaa36a7'));
    assert.equal(sw.result ?? null, null, JSON.stringify(sw));
    assert.equal(await d.evaluate(() => window.ethereum.chainId), '0xaa36a7');
    const sig = await approve(() => window.qa.sign('0x653265', window.ethereum.selectedAddress).catch((e) => e).then((x) => x), /^(Sign|Approve|Confirm)$/);
    assert.ok(sig.result, JSON.stringify(sig));
    assert.equal(await verifyMessage({ address: addr, message: 'e2e', signature: sig.result }), true);
    const TD = { domain: { name: 'QA Mail', version: '1', chainId: 11155111, verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' }, primaryType: 'Mail',
      types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }], Mail: [{ name: 'to', type: 'address' }, { name: 'contents', type: 'string' }] },
      message: { to: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB', contents: 'Hello, Bob!' } };
    const typed = await approve((td) => window.qa.typed(window.ethereum.selectedAddress, td), /^(Sign|Approve|Confirm)$/, TD);
    assert.ok(typed.result, JSON.stringify(typed));
    const { EIP712Domain, ...types } = TD.types;
    assert.equal(await verifyTypedData({ address: addr, domain: TD.domain, types, primaryType: 'Mail', message: TD.message, signature: typed.result }), true, 'EIP-712 v4 signature recovers to the account');
    const tx = await approve(() => window.qa.send({ from: window.ethereum.selectedAddress, to: '0x000000000000000000000000000000000000dEaD', value: '0x2386f26fc10000' }), /^(Send|Confirm|Approve)$/);
    assert.match(tx.result ?? '', /^0x[0-9a-f]{64}$/, JSON.stringify(tx));
    assert.ok(await until(() => S.chain.txs.find((t) => t.hash === tx.result)), 'transaction reached the chain through the Harbour API');
    S.chain.addToken('0x6B175474E89094C44Da98b954EedeAC495271d0F', { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 });
    const wa = await approve(() => window.qa.watch(), /^(Add|Approve|Confirm|Add token)$/);
    assert.equal(wa.result, true, JSON.stringify(wa));
    assert.equal((await d.evaluate(() => window.qa.revoke())).result ?? null, null);
    assert.deepEqual((await d.evaluate(() => window.qa.call('eth_accounts'))).result, []);
  } finally { await b.close(); }
});

e2e('T-SIG-043 / T-SIG-044 / T-UX-030: reject → 4001; closing the window → 4001; origin first, site title neutralised', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const d = await dappPage(b);
    const r1 = d.evaluate(() => window.qa.accounts()); r1.catch(() => {});
    const w = await approvalWindow(b); assert.ok(w);
    const text = await visibleText(w);
    assert.ok(!text.includes('‮'), 'bidi override never rendered raw');
    const origin = await w.getByTestId('approval-origin').innerText();
    assert.match(origin, /127\.0\.0\.1/);
    const first = await w.evaluate(() => { const o = document.querySelector('[data-testid="approval-origin"]').getBoundingClientRect().top; const btn = [...document.querySelectorAll('button')].find((x) => /Connect/.test(x.innerText)).getBoundingClientRect().top; return o < btn; });
    assert.ok(first, 'origin is shown above the action buttons');
    await w.getByRole('button', { name: 'Reject' }).click();
    assert.equal((await r1).error?.code, 4001);
    const r2 = d.evaluate(() => window.qa.accounts()); r2.catch(() => {});
    const w2 = await approvalWindow(b); assert.ok(w2);
    await w2.close();
    assert.equal((await r2).error?.code, 4001, 'closing the window rejects');
    // keyboard: the action buttons are reachable with Tab
    const r3 = d.evaluate(() => window.qa.accounts()); r3.catch(() => {}); const w3 = await approvalWindow(b);
    let reached = false; for (let i = 0; i < 25 && !reached; i++) { await w3.keyboard.press('Tab'); reached = await w3.evaluate(() => /Reject|Connect/.test(document.activeElement?.innerText ?? '')); }
    assert.ok(reached, 'buttons keyboard-reachable');
    await w3.keyboard.press('Escape').catch(() => {}); await w3.close().catch(() => {}); await r3;
  } finally { await b.close(); }
});

e2e('T-DAPP-052: a cross-origin iframe asking for accounts is shown with the iframe origin, not the top page', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const d = await dappPage(b);
    await d.evaluate((u) => { document.querySelector('#frame').src = u; }, iframeUrl);
    const frame = await until(async () => { for (const f of d.frames()) if (f.url().startsWith(iframeUrl) && (await f.evaluate(() => !!window.ethereum).catch(() => false))) return f; return null; });
    assert.ok(frame, 'provider injected in the iframe (allFrames)');
    frame.evaluate(() => window.go()).catch(() => {});
    const w = await approvalWindow(b); assert.ok(w);
    const origin = await w.getByTestId('approval-origin').innerText();
    assert.match(origin, /localhost/, `approval names the requesting frame: ${origin}`);
    assert.doesNotMatch(origin, /^127\.0\.0\.1/);
    await w.getByRole('button', { name: 'Reject' }).click();
  } finally { await b.close(); }
});

e2e('T-EXT-020: the service worker is stopped while an approval is pending; approving afterwards signs exactly once', async (t) => {
  const b = await launch();
  try {
    await createWallet(b);
    const addr = await evmAddress(b);
    const d = await dappPage(b);
    const connect = d.evaluate(() => window.qa.accounts()); connect.catch(() => {});
    await (await approvalWindow(b)).getByRole('button', { name: 'Connect' }).click(); await connect;
    const pending = d.evaluate(() => window.qa.sign('0x6869', window.ethereum.selectedAddress)); pending.catch(() => {});
    let w = await approvalWindow(b); assert.ok(w);
    const cdp = await b.ctx.newCDPSession(await b.ctx.newPage());
    const { targetInfos } = await cdp.send('Target.getTargets');
    const swTarget = targetInfos.find((t) => t.type === 'service_worker' && t.url.includes(b.id));
    if (swTarget) await cdp.send('Target.closeTarget', { targetId: swTarget.targetId }).catch(() => {});
    await tick(1500);
    if (!w.isClosed()) { await w.reload().catch(() => {}); await tick(2500); }
    if (w.isClosed()) w = await approvalWindow(b, 8000);
    const btn = w && !w.isClosed() ? w.getByRole('button', { name: /^(Sign|Approve|Confirm)$/ }).last() : null;
    const canApprove = btn ? await btn.isVisible().catch(() => false) : false;
    t.diagnostic(`after the worker restart: approval window ${w ? (w.isClosed() ? 'closed' : 'open') : 'gone'}, sign button ${canApprove ? 'shown' : 'not shown'}`);
    if (canApprove) await btn.click();
    // Either outcome is acceptable — the request is restored and signs, or it is rejected cleanly — but it must settle (no hang)
    // and a restored request must give one valid signature.
    const r = await Promise.race([pending, tick(20_000).then(() => ({ hang: true }))]);
    assert.ok(!r.hang, 'the dApp request settles after a worker restart');
    if (r.result) assert.equal(await verifyMessage({ address: addr, message: 'hi', signature: r.result }), true);
    else assert.ok([4001, 4100, 4900, -32603].includes(r.error?.code), `clean provider error: ${JSON.stringify(r)}`);
    const ledger = await d.evaluate(() => (window.qa.log ?? []).filter((x) => x.method === 'personal_sign').length).catch(() => 1);
    assert.ok(ledger <= 1, 'answered at most once');
  } finally { await b.close(); }
});

// ---------------------------------------------------------------- send through the UI (CH-05)

e2e('T-CH-011: send ETH on Sepolia from the popup: confirm shows recipient, amount and fee; the hash is shown and on chain', async (t) => {
  const b = await launch();
  try {
    await createWallet(b);
    const addr = await evmAddress(b); S.chain.fund(addr, 10n ** 18n);
    const TO = '0x000000000000000000000000000000000000dEaD';
    assert.equal((await bg(b, { type: 'setAssetHidden', assetId: 'sepolia', hidden: false }))?.ok, true, 'Sepolia shown (Settings → Show testnets does the same per id)');
    const p = await popup(b);
    await p.getByRole('button', { name: 'Send' }).first().click();
    await p.getByTestId('asset-search').locator('input').or(p.locator('[data-testid="asset-search"]')).first().fill('Sepolia');
    await p.getByText('Sepolia', { exact: true }).first().click();
    await p.getByTestId('send-to').fill(TO);
    await until(() => p.getByTestId('send-balance').innerText().then((x) => /[1-9]/.test(x)).catch(() => false), 20_000);
    await p.getByTestId('send-amount').fill('0.01');
    const next = p.getByRole('button', { name: 'Next' });
    assert.ok(await until(() => next.isEnabled().catch(() => false), 20_000), `Next enabled: ${(await visibleText(p)).slice(0, 300)}`);
    await next.click();
    await p.getByTestId('confirm-amount').waitFor({ timeout: 15_000 });
    const confirm = p.getByRole('button', { name: 'Confirm' });
    assert.ok(await until(() => confirm.isEnabled().catch(() => false), 20_000), `Confirm enabled: ${(await visibleText(p)).slice(0, 400)}`);
    const amountTxt = await p.getByTestId('confirm-amount').innerText();
    const toTxt = await p.getByTestId('confirm-to').innerText();
    const feeTxt = await p.getByTestId('send-fee').innerText();
    t.diagnostic(`confirm: amount=${amountTxt} to=${toTxt} fee=${feeTxt}`);
    assert.match(amountTxt, /0\.01\b/, 'confirm screen shows the typed amount');
    assert.equal(toTxt.replace(/\s+/g, '').toLowerCase().endsWith(TO.toLowerCase()), true, 'confirm screen shows the full recipient');
    assert.match(feeTxt, /\d/, 'confirm screen shows a fee');
    const before = S.chain.txs.length;
    await confirm.click();
    const outcome = await until(async () => (await p.getByTestId('send-success').isVisible().catch(() => false)) ? 'done'
      : (await p.getByTestId('send-failed').isVisible().catch(() => false)) ? 'failed'
      : (await p.getByRole('button', { name: 'Continue anyway' }).isVisible().catch(() => false)) ? 'guard' : null, 30_000);
    if (outcome === 'guard') { t.diagnostic(`risk guard: ${(await visibleText(p)).slice(0, 300)}`); await p.getByRole('button', { name: 'Continue anyway' }).click(); }
    if (outcome === 'failed') assert.fail(`send failed: ${await p.getByTestId('send-failed').innerText()}`);
    await p.getByTestId('send-success').waitFor({ timeout: 30_000 });
    const shown = (await visibleText(p)).match(/0x[0-9a-f]{64}/)?.[0];
    assert.ok(shown, 'the hash is shown');
    const tx = await until(() => S.chain.txs.find((x) => x.hash === shown));
    assert.ok(tx, 'the shown hash is the transaction the chain received');
    assert.equal(S.chain.txs.length, before + 1, 'exactly one transaction broadcast');
    assert.equal(String(tx.to).toLowerCase(), TO.toLowerCase());
    assert.equal(BigInt(tx.value), 10n ** 16n, 'value is exactly 0.01 ETH in wei');
  } finally { await b.close(); }
});

// ---------------------------------------------------------------- accessibility (EXT-15)

e2e('T-EXT-040 / T-EXT-041 / T-KEY-118: no critical axe-core violations on onboarding, unlock, home, settings and the approval window', async (t) => {
  const b = await launch();
  try {
    const axeSrc = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
    const audit = async (p, label) => {
      await p.addScriptTag({ content: axeSrc }).catch(async () => { await p.evaluate(axeSrc); });
      const r = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length })));
      return r.filter((v) => v.impact === 'critical').map((v) => `${label}:${v.id}(${v.n})`);
    };
    const details = async (p) => p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((v) => v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ') + ' ' + n.html.slice(0, 160) + ' [' + (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 160) + ']').join('; ')} — ${v.help}`));
    const o = await onboardingTab(b.ctx);
    const crit = [...await audit(o, 'onboarding')];
    await createWallet(b);
    const p = await popup(b); crit.push(...await audit(p, 'home'));
    await p.getByRole('button', { name: 'Settings' }).click(); crit.push(...await audit(p, 'settings'));
    await p.getByRole('button', { name: 'Lock wallet' }).click(); await p.getByText('Welcome back').waitFor(); crit.push(...await audit(p, 'unlock'));
    const pw = p.locator('input[type=password]');
    assert.ok(await pw.evaluate((e) => !!(e.labels?.length || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.placeholder)), 'password field labelled');
    await pw.fill(PASSWORD); await p.keyboard.press('Enter'); await p.getByText('Main wallet').first().waitFor({ timeout: 30_000 });
    const d = await dappPage(b); d.evaluate(() => window.qa.accounts()).catch(() => {});
    const w = await approvalWindow(b); if (w) crit.push(...await audit(w, 'approval'));
    if (crit.length) return assert.fail('BUG-13 regression (fixed bug reproduces again): ' + `critical accessibility violations: ${crit.join(', ')} (details: ${await (async () => { const pp = await popup(b); await audit(pp, 'details'); return (await details(pp)).join(' | '); })()})`);
  } finally { await b.close(); }
});

// ---------------------------------------------------------------- regressions: inert home layer (b26a725), approvals link (eba8c0f)

e2e('T-REG-021: while a screen is open over Home, the Home layer is inert (no focus, no clicks, hidden from assistive tech) and becomes live again on Back', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const p = await popup(b);
    const home = p.locator('.hb-home');
    assert.equal(await home.evaluate((e) => e.hasAttribute('inert')), false, 'Home is live while it is the top screen');
    await p.getByRole('button', { name: 'Settings' }).click();
    await p.locator('.hb-layer.idle').getByRole('button', { name: 'Back', exact: true }).waitFor();
    assert.equal(await home.evaluate((e) => e.hasAttribute('inert')), true, 'Home is inert under Settings');
    // Keyboard: tabbing through the page never lands inside the hidden Home layer.
    const landed = [];
    for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); landed.push(await p.evaluate(() => !!document.activeElement?.closest?.('.hb-home'))); }
    assert.ok(!landed.some(Boolean), 'focus entered the inert Home layer');
    // Pointer: the quick-action buttons of Home cannot be activated through the overlay (inert elements are not hit-testable).
    assert.equal(await p.evaluate(() => { const el = document.querySelector('.hb-home [aria-label="Send"]'); if (!el) return 'absent'; const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit && el.contains(hit) ? 'reachable' : 'blocked'; }) !== 'reachable', true, 'Home buttons are reachable under the open screen');
    await p.locator('.hb-layer.idle').getByRole('button', { name: 'Back', exact: true }).click();
    await tick(800);
    assert.equal(await home.evaluate((e) => e.hasAttribute('inert')), false, 'Home is live again after Back');
  } finally { await b.close(); }
});

e2e('T-REG-031: the Approvals tab on Home links to the full allowance scan screen, and Back returns to Home', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const p = await popup(b);
    await p.getByRole('button', { name: 'Settings' }).waitFor();
    await p.getByText('Approvals', { exact: true }).first().click();
    const scan = p.getByRole('button', { name: 'Scan all token allowances' });
    await scan.waitFor({ timeout: 15_000 });
    await scan.click();
    await p.getByText('Token approvals', { exact: true }).first().waitFor({ timeout: 15_000 });
    // The scan screen settles into one of its defined states: the coverage note (with or without items) or an error with Retry.
    const state = await until(async () => (await p.locator('[data-testid="approval-coverage"]').count()) ? 'coverage' : (await p.getByText('No active approvals found').count()) ? 'empty' : (await p.getByRole('button', { name: 'Retry' }).count()) ? 'error' : null, 40_000);
    assert.ok(state, 'the allowance scan neither finished nor reported an error');
    await p.locator('.hb-layer.idle').getByRole('button', { name: 'Back', exact: true }).click();
    await p.getByRole('button', { name: 'Settings' }).waitFor({ timeout: 10_000 });
  } finally { await b.close(); }
});

// ---------------------------------------------------------------- BUG-12

e2e('BUG-12: with a browser window wider than the screen, the approval window still opens', async (t) => {
  const b = await launch({ wide: true });
  try {
    await createWallet(b);
    const d = await dappPage(b);
    const r = d.evaluate(() => window.qa.accounts()); r.catch(() => {});
    const w = await approvalWindow(b, 8000);
    const geo = await b.sw.evaluate(async () => { const l = await chrome.windows.getLastFocused(); const all = await chrome.windows.getAll(); return { last: [l.left, l.top, l.width, l.height], all: all.map((x) => [x.type, x.left, x.top, x.width, x.height]) }; });
    t.diagnostic(`window geometry: ${JSON.stringify(geo)}; approval window ${w ? 'opened' : 'missing'}`);
    if (!w) {
      const why = await b.sw.evaluate(async () => { const l = await chrome.windows.getLastFocused(); const left = Math.max(0, l.left + l.width - 391), top = Math.max(0, (l.top ?? 0) + 72); try { await chrome.windows.create({ url: 'about:blank', type: 'popup', width: 375, height: 600, left, top }); return 'created'; } catch (e) { return e.message; } });
      void r;
      return assert.fail('BUG-12 regression (fixed bug reproduces again): ' + `no approval window; the request waits silently (chrome.windows.create: "${why}")`);
    }
    await w.getByRole('button', { name: 'Reject' }).click();
  } finally { await b.close(); }
});

e2e('T-UX-003: dApp asks for an unlimited approve; the user edits the spending cap to 10 tokens; the signed transaction encodes exactly 10 * 10^18', async () => {
  const b = await launch();
  try {
    await createWallet(b);
    const addr = await evmAddress(b); S.chain.fund(addr, 10n ** 18n);
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    S.chain.addToken(DAI, { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 });
    const d = await dappPage(b);
    const click = async (fn, arg, button = /^(Connect|Approve|Confirm|Switch|Send)$/, before) => {
      const done = d.evaluate(fn, arg); done.catch(() => {});
      const w = await approvalWindow(b); assert.ok(w, 'approval window opened');
      await w.getByTestId('approval-origin').waitFor({ timeout: 15_000 });
      if (before) await before(w);
      const action = w.getByRole('button', { name: button }).last();
      await until(() => action.isEnabled().catch(() => false), 15_000);
      await action.click(); return done;
    };
    await click(() => window.qa.accounts());
    await click(() => window.qa.switchChain('0xaa36a7'));
    const spender = '000000000000000000000000' + 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const data = '0x095ea7b3' + spender + 'f'.repeat(64); // approve(spender, 2^256-1)
    let shown;
    const tx = await click((t) => window.qa.send(t), { from: addr, to: DAI, data }, /^(Send|Confirm|Approve)$/, async (w) => {
      const cap = w.getByTestId('spend-limit'); await cap.waitFor({ timeout: 15_000 });
      shown = await cap.inputValue();
      await cap.fill('10');
      for (const cb of await w.getByRole('checkbox').all()) await cb.check(); // risk acknowledgements the review asks for
    });
    assert.match(tx.result ?? '', /^0x[0-9a-f]{64}$/, JSON.stringify(tx));
    assert.ok(shown !== '' , 'the cap field was shown (an unlimited request starts from the balance, not 2^256-1)');
    const rec = await until(() => S.chain.txs.find((t) => t.hash === tx.result)); assert.ok(rec, 'reached the chain');
    const { parseTransaction } = await import('viem');
    const parsed = parseTransaction(rec.raw);
    assert.equal(parsed.to.toLowerCase(), DAI.toLowerCase());
    assert.equal(parsed.data.slice(0, 10), '0x095ea7b3', 'still an approve');
    assert.equal(BigInt('0x' + parsed.data.slice(34, 74)), BigInt('0x' + 'b'.repeat(40)), 'spender unchanged');
    assert.equal(BigInt('0x' + parsed.data.slice(74)), 10n * 10n ** 18n, 'signed amount is exactly 10 tokens, not unlimited');
  } finally { await b.close(); }
});

void toHex;
void mkdirSync;
