// E2E (full stack): address-tracking quota of a NEW device (24 h probation tier) against the real Harbour API. TEST_PLAN: T-DATA-004
// (quota path), BUG-10. Same environment requirements as fullstack.test.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT } from '../qa/harness.mjs';
import { startStack, stackRequirements } from './stack.mjs';

const realFetch = globalThis.fetch; const missing = stackRequirements();
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
let S, F, M;
before(async () => {
  if (missing.length) return;
  S = await startStack({});
  const H = await harness(`import './background/index'; export { listAddresses } from './core/harbour/client'; // quota suite`);
  ({ F, M } = H); H.reset();
  F.fetchImpl = async (url, init) => { const u = new URL(url); if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new TypeError('NETWORK_DISABLED_IN_TESTS'); u.hostname = '127.0.0.1'; return realFetch(u.toString(), init); };
});
after(async () => { await S?.stop(); });
const send = (m) => F.listeners['runtime.onMessage'].at(-1)(m, INTERNAL);

test('BUG-10: on a new device, accounts beyond the address/backfill quota are not silently dropped from tracking', missing.length ? { skip: `E2E stack not configured: ${missing.join(', ')}` } : {}, async (t) => {
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT })).ok, true);
  await tick(2500);
  for (let i = 0; i < 2; i++) await send({ type: 'addAccount' }); // 3 accounts × 18 indexed networks = 54 refs; probation backfill budget is 40/day
  await tick(2500);
  const st = await send({ type: 'listWallets' });
  const want = new Set(st.wallets.flatMap((w) => w.accounts.map((a) => a.addresses.ethereum.toLowerCase())));
  const have = new Set((await M.listAddresses()).addresses.map((a) => a.address.toLowerCase()));
  const untracked = [...want].filter((a) => !have.has(a));
  const statuses = S.logs.join('').split('\n').filter((l) => l.includes('/v1/me/addresses') && l.includes('"PUT"')).map((l) => { try { return JSON.parse(l).status; } catch { return '?'; } });
  t.diagnostic(`PUT /v1/me/addresses statuses: ${statuses.join(',')}; tracked ${have.size}/${want.size} accounts`);
  const acc = await send({ type: 'getAccounts' }); const det = await send({ type: 'walletsDetailed' });
  const surfaced = /quota|limit|not tracked|syncing/i.test(JSON.stringify([acc, det]));
  if (untracked.length && !surfaced) return assert.fail('BUG-10 regression (fixed bug reproduces again): ' + `${untracked.length} of ${want.size} accounts untracked on a new device (PUT statuses ${statuses.join(',')}) and nothing tells the user`);
  // BUG-10 (fixed): what fits the device quota is tracked (the active account first); the rest is reported to the user with the right count.
  assert.ok(have.has(acc.addresses.ethereum.toLowerCase()), 'the active account is tracked');
  assert.ok(have.size >= 2, `as many accounts as fit the 40/day probation budget are tracked (${have.size})`);
  if (untracked.length) { assert.equal(acc.tracking?.untracked, untracked.length, JSON.stringify(acc.tracking)); assert.equal(det.tracking?.untracked, untracked.length); }
});
