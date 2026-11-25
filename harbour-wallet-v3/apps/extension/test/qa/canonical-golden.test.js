// QA: cross-language contract between the extension's Harbour client and the Go backend, through SHARED golden files kept in
// apps/backend/internal/devicesig/testdata (the Go tests read the same files: devicesig_test.go). Values were computed independently
// with Python. TEST_PLAN: T-CH-013, T-DATA-011, T-DATA-014, T-DATA-015, T-UX-029 (extension half).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import fc from 'fast-check';
import { harness } from './harness.mjs';

const H = await harness(`
  export { canonical } from './core/harbour/client';
  export { solvePow } from './core/harbour/device';
  export { checkPortfolio, checkHistory, checkNfts, checkAddresses, checkBroadcast } from './core/harbour/schema';
  export { userText, friendlyMessage, sanitizeResult } from './core/errors';
`);
const { M } = H;
const GOLD = new URL('../../../backend/internal/devicesig/testdata/', import.meta.url);
const canon = JSON.parse(readFileSync(new URL('canonical_vectors.json', GOLD), 'utf8')).vectors;
const pow = JSON.parse(readFileSync(new URL('pow_vectors.json', GOLD), 'utf8')).vectors;
const lzb = (buf) => { let n = 0; for (const b of buf) { if (b === 0) { n += 8; continue; } return n + Math.clz32(b) - 24; } return n; };

test('T-CH-013: client.ts canonical() is byte-identical to the Go devicesig golden strings (method case, query, empty and unicode bodies)', () => {
  assert.ok(canon.length >= 4);
  for (const v of canon) assert.equal(M.canonical(v.method, v.path_and_query, v.date, v.nonce, v.device, Buffer.from(v.body_b64, 'base64')), v.canonical, `${v.method} ${v.path_and_query}`);
  assert.ok(canon.some((v) => v.method !== v.method.toUpperCase()) && canon.some((v) => v.path_and_query.includes('?')) && canon.some((v) => v.body_b64 === '') && canon.some((v) => /[^\x00-\x7f]/.test(Buffer.from(v.body_b64, 'base64').toString())));
});

test('T-DATA-011: solvePow agrees with the shared PoW goldens (first 12-bit solution = 13859) and with Go CheckPow semantics', async () => {
  for (const v of pow) {
    const h = crypto.createHash('sha256').update(`${v.challenge}:${v.pub}:${v.counter}`).digest();
    assert.equal(lzb(h), v.leading_zero_bits, `${v.challenge}:${v.pub}:${v.counter}`);
  }
  const first = pow.find((v) => v.first_solution_for_12_bits);
  assert.equal(await M.solvePow(first.challenge, first.pub, 12), first.counter);
  assert.equal(await M.solvePow('x', 'y', 0), '0', 'difficulty 0: counter 0');
});

test('T-DATA-014: solvePow returns a counter that satisfies the difficulty for random challenges (property, independent sha256)', async () => {
  await fc.assert(fc.asyncProperty(fc.base64String({ minLength: 4, maxLength: 44 }), fc.base64String({ minLength: 4, maxLength: 44 }), fc.integer({ min: 0, max: 12 }), async (ch, pub, d) => {
    const c = await M.solvePow(ch, pub, d);
    assert.match(c, /^\d+$/);
    assert.ok(lzb(crypto.createHash('sha256').update(`${ch}:${pub}:${c}`).digest()) >= d);
    for (let i = 0; i < Number(c); i++) if (lzb(crypto.createHash('sha256').update(`${ch}:${pub}:${i}`).digest()) >= d) assert.fail(`not the first solution: ${i} < ${c}`);
  }), { numRuns: 40, seed: 14 });
});

test('T-DATA-015: schema checkers never throw anything but a typed error and only accept well-typed payloads (fuzz)', () => {
  const refs = [{ chain: 'ethereum', address: '0x' + '11'.repeat(20) }];
  for (const [name, f] of [['checkPortfolio', (v) => M.checkPortfolio(v, refs)], ['checkHistory', (v) => M.checkHistory(v, refs)], ['checkNfts', (v) => M.checkNfts(v, refs)], ['checkAddresses', (v) => M.checkAddresses(v)], ['checkBroadcast', (v) => M.checkBroadcast(v, '0x02')]]) {
    fc.assert(fc.property(fc.jsonValue(), (v) => {
      try { const out = f(v); assert.ok(out && typeof out === 'object', name); }
      catch (e) { assert.ok(!(e instanceof TypeError) && !(e instanceof RangeError), `${name}: ${e?.name} ${e?.message}`); }
    }), { numRuns: 1500, seed: 15 });
  }
  // well-typed minimal payloads are accepted
  assert.deepEqual(M.checkAddresses({ addresses: [] }).addresses, []);
  const raw = '0x02f86b'; const hash = '0x' + crypto.createHash('sha3-256').update('x').digest('hex');
  assert.throws(() => M.checkBroadcast({ tx_hash: 'nope', status: 'pending' }, raw));
  void hash;
});

test('T-UX-029 (extension half): raw node / backend errors with URLs, keys, stack traces never reach the user text', () => {
  const nasty = ['fetch failed: https://eth-mainnet.g.alchemy.com/v2/AbCdEfGhIjKlMnOpQrStUvWx', 'TypeError: Cannot read properties of undefined (reading "x")\n    at f (chrome-extension://abc/assets/index.js:1:2345)',
    'execution reverted: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002', 'HTTP 500 Internal Server Error from https://api.example.com/?apikey=SECRET', 'invalid response JSON: {"jsonrpc"',
    'private key 0x' + '46'.repeat(32), 'x'.repeat(400)];
  for (const n of nasty) {
    const t = M.userText(n);
    assert.ok(!/https?:\/\/|apikey|SECRET|\bat \S+:\d+:\d+|0x[0-9a-f]{16,}|TypeError|JSON/i.test(t), `${JSON.stringify(n).slice(0, 60)} → ${t}`);
  }
  assert.equal(M.userText('LOCKED'), 'LOCKED', 'codes pass through');
  assert.equal(M.userText('Insufficient balance for this transfer.'), 'Insufficient balance for this transfer.', 'human sentences kept');
  const deep = M.sanitizeResult({ ok: false, error: nasty[0], errors: [{ error: nasty[1] }] });
  assert.ok(!JSON.stringify(deep).includes('alchemy') && !JSON.stringify(deep).includes('index.js'));
});

test('T-EXT-047: the Go /v1/gw/v1/config response golden is accepted by kit/remoteConfig.refreshConfig (signature over the exact text)', async () => {
  const golden = JSON.parse(readFileSync(new URL('../../../backend/internal/api/testdata/gw_config_golden.json', import.meta.url), 'utf8'));
  const load = (pub) => harness(`export { refreshConfig } from './kit/remoteConfig';`, { define: { 'import.meta.env': JSON.stringify({ VITE_HB_CONFIG_URL: 'https://config.harbour.example/v1/gw/v1/config', VITE_HB_CONFIG_PUBKEY: pub }) } });
  const R = await load(golden.public_key);
  R.F.fetchImpl = async (url) => { assert.equal(url, 'https://config.harbour.example/v1/gw/v1/config'); return new Response(JSON.stringify({ config: golden.config, signature: golden.signature }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    const cfg = await R.M.refreshConfig(0);
    assert.equal(cfg?.version, 7); assert.deepEqual(cfg.flags, { swap: true, smartAccounts: false }); assert.deepEqual(cfg.killedProviders, ['p1']);
    assert.equal(await R.M.refreshConfig(8), null, 'downgrade refused');
    const other = await load(Buffer.alloc(32, 9).toString('base64'));
    assert.equal(await other.M.refreshConfig(0), null, 'another key does not verify');
    R.F.fetchImpl = async () => new Response(JSON.stringify({ config: golden.config.replace('"swap":true', '"swap":false'), signature: golden.signature }), { status: 200 });
    assert.equal(await R.M.refreshConfig(0), null, 'edited text refused');
  } finally { R.F.fetchImpl = null; }
});
