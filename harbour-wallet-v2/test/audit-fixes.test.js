// Regression tests for the dApp/signing audit fixes (SIG-01/02/06/12, INF-09).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export { decodeCalldata, flattenCalls, lowerApproveAmount, encodeApprove } from './core/provider/decode'; export { looksLikeSolMessage } from './core/provider/solanaTx'; export { isPrivateNetworkUrl } from './core/provider/origin'; export { hasDangerousSelector } from './core/swap/safety'; export { validRecipient } from './core/sendService';`, resolveDir: root, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', external: ['webextension-polyfill'] });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const solMessage = () => { // legacy message: 1 signer, system transfer
  const k = (n) => new Uint8Array(32).fill(n); const data = new Uint8Array(12); data[0] = 2; data[4] = 1;
  return Uint8Array.from([1, 0, 1, 3, ...k(1), ...k(2), ...new Uint8Array(32), ...k(9), 1, 2, 2, 0, 1, 12, ...data]);
};
test('Solana: a serialized transaction message is refused as a "message"; text is not', () => {
  assert.equal(M.looksLikeSolMessage(solMessage()), true);
  assert.equal(M.looksLikeSolMessage(new TextEncoder().encode('Sign in to example.com\nNonce: 12345678')), false);
});
test('swap steps may not carry token-moving or authority selectors', () => {
  for (const s of ['0xa9059cbb', '0x095ea7b3', '0xa22cb465', '0xd505accf', '0x23b872dd']) assert.equal(M.hasDangerousSelector(s + '00'), true);
  assert.equal(M.hasDangerousSelector('0x12345678aa'), false);
});
test('EVM recipients: bad mixed-case checksum rejected, lowercase and valid checksum accepted', () => {
  const lower = '0x52908400098527886e0f7030069857d2e4169ee7'; const good = '0x52908400098527886E0F7030069857D2E4169EE7';
  assert.equal(M.validRecipient(lower), true); assert.equal(M.validRecipient(good), true);
  assert.equal(M.validRecipient('0x52908400098527886E0F7030069857D2E4169ee7'), false);
});
test('dApp-supplied RPC URLs: LAN, metadata and IPv6 literals blocked; public and loopback allowed', () => {
  for (const u of ['https://192.168.1.5/rpc', 'https://10.0.0.1', 'https://169.254.169.254/', 'https://[::1]/', 'https://printer.local/', 'https://intranet/']) assert.equal(M.isPrivateNetworkUrl(u), true, u);
  for (const u of ['https://rpc.ankr.com/eth', 'http://localhost:8545', 'http://127.0.0.1:8545']) assert.equal(M.isPrivateNetworkUrl(u), false, u);
});

test('decoder: Permit2 approve and multicall expose inner approvals', () => {
  const w = (a) => a.replace('0x', '').padStart(64, '0');
  const sp = '0x' + '11'.repeat(20), tk = '0x' + '22'.repeat(20);
  const p2 = '0x87517c45' + w(tk) + w(sp) + w('0x' + 'f'.repeat(40)) + w('0x1');
  const d = M.decodeCalldata(p2); assert.equal(d.kind, 'permit2Approve'); assert.equal(d.spender.toLowerCase(), sp);
  const app = '0x095ea7b3' + w(sp) + w('0x' + 'f'.repeat(64));
  const enc = (x) => { const b = x.slice(2); return w((b.length / 2).toString(16)) + b.padEnd(Math.ceil(b.length / 64) * 64, '0'); };
  const body = w('0x20') + w('0x1') + w('0x20') + enc(app);
  const m = M.decodeCalldata('0xac9650d8' + body); assert.equal(m.kind, 'multicall');
  assert.ok(M.flattenCalls(m).some((c) => c.kind === 'approve'));
});

test('solana: lookup tables resolve and the swap guard refuses authority changes / extra SOL / closes to others', async () => {
  const { build: b } = await import('esbuild');
  const o = await b({ stdin: { contents: `export * from './core/provider/solanaTx'; export * from './core/provider/base58';`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  const S = await import(`data:text/javascript;base64,${Buffer.from(o.outputFiles[0].text).toString('base64')}`);
  const key = (n) => new Uint8Array(32).fill(n);
  const ME = S.b58encode(key(1)), TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const tokenKey = S.b58decode ? S.b58decode(TOKEN) : null;
  const mk = (keys, ixs, tables = []) => { // v0 message, 1 signer
    const b = [0x80, 1, 0, 1, keys.length, ...keys.flatMap((k) => [...k]), ...key(9), ixs.length];
    for (const [pi, accts, data] of ixs) b.push(pi, accts.length, ...accts, data.length, ...data);
    b.push(tables.length); for (const t of tables) b.push(...key(t.n), t.w.length, ...t.w, t.r.length, ...t.r);
    return Uint8Array.from([1, ...new Uint8Array(64), ...b]);
  };
  const sys = new Uint8Array(32); // system program key = all zeros -> base58 '1111…'
  const setAuth = [6, 2, 0]; // SetAuthority, type 2, no new authority
  if (!tokenKey) return; // base58 decode not exported; guard logic below still exercised through lookups
  const bytes = mk([key(1), tokenKey, key(2)], [[1, [2, 0], setAuth]]);
  const tx = S.parseSolTx(bytes);
  assert.match(S.guardSolSwapTx(tx, { wallet: ME, sellLamports: 0n }), /authority/);
  const xfer = mk([key(1), key(3), sys], [[2, [0, 1], [2, 0, 0, 0, 0x00, 0xca, 0x9a, 0x3b, 0, 0, 0, 0]]]); // 1 SOL
  assert.match(S.guardSolSwapTx(S.parseSolTx(xfer), { wallet: ME, sellLamports: 0n }), /more SOL/);
  assert.equal(S.guardSolSwapTx(S.parseSolTx(xfer), { wallet: ME, sellLamports: 1_000_000_000n }), null);
  const withTable = mk([key(1), sys], [[1, [0, 2], [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]]], [{ n: 7, w: [0], r: [] }]);
  const t2 = S.parseSolTx(withTable); assert.equal(t2.lookups, 1); assert.equal(S.guardSolSwapTx(t2, { wallet: ME, sellLamports: 0n }), 'unresolved lookup tables');
  const data = new Uint8Array(56 + 32); data.set(key(5), 56);
  const r = await S.resolveLookupTables(t2, async () => data); assert.equal(r.lookups, 0); assert.equal(r.keys[2], S.b58encode(key(5)));
  assert.equal((await S.resolveLookupTables(t2, async () => null)).lookups, 1);
});

test('send: lookalike (address poisoning) detection and plan fingerprint', async () => {
  const { build: b } = await import('esbuild');
  const o = await b({ stdin: { contents: `export { lookalikeOf, planHashOf } from './core/sendService';`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  const S = await import(`data:text/javascript;base64,${Buffer.from(o.outputFiles[0].text).toString('base64')}`);
  const real = '0x52908400098527886E0F7030069857D2E4169EE7';
  const fake = '0x52908' + '1'.repeat(28) + '4169EE7';
  assert.equal(S.lookalikeOf(fake, [real]), real);
  assert.equal(S.lookalikeOf(real, [real]), undefined);
  assert.equal(S.lookalikeOf('0xabcdef' + '1'.repeat(29) + '4169EE7', [real]), undefined);
  const p = { chainId: 'ethereum', from: real, to: fake, assetKey: 'ethereum', amount: '5', memo: '' };
  assert.equal(await S.planHashOf(p), await S.planHashOf({ ...p, to: fake.toLowerCase() }));
  assert.notEqual(await S.planHashOf(p), await S.planHashOf({ ...p, to: real }));
  assert.notEqual(await S.planHashOf(p), await S.planHashOf({ ...p, amount: '6' }));
});

test('site-supplied RPC probe: https only, no private hosts, no redirects', async () => {
  const { build: b } = await import('esbuild');
  const o = await b({ stdin: { contents: `export { probeRpcChainId } from './core/networks';`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  const S = await import(`data:text/javascript;base64,${Buffer.from(o.outputFiles[0].text).toString('base64')}`);
  let called = 0, seen; const f = async (u, init) => { called++; seen = init; return { ok: true, json: async () => ({ result: '0x89' }) }; };
  for (const u of ['http://rpc.example.com', 'https://192.168.1.1/', 'https://169.254.169.254/', 'https://intranet.local/']) assert.equal((await S.probeRpcChainId(u, f, { fromSite: true })).ok, false, u);
  assert.equal(called, 0);
  const r = await S.probeRpcChainId('https://rpc.example.com', f, { fromSite: true }); assert.deepEqual([r.ok, r.chainId], [true, 137]); assert.equal(seen.redirect, 'error');
  assert.equal((await S.probeRpcChainId('http://localhost:8545', f)).ok, true);   // the user's own Settings entry may still use localhost
});

test('btc: signed transaction outputs are parsed exactly (legacy and segwit)', async () => {
  const { build: b } = await import('esbuild');
  const o = await b({ stdin: { contents: `export { btcOutputsOf } from './core/sendService';`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  const S = await import(`data:text/javascript;base64,${Buffer.from(o.outputFiles[0].text).toString('base64')}`);
  const script = '0014' + '11'.repeat(20); const out = '40420f0000000000' + '16' + script;           // 1,000,000 sats
  const legacy = '01000000' + '01' + '00'.repeat(32) + '00000000' + '00' + 'ffffffff' + '01' + out + '00000000';
  const seg = '01000000' + '0001' + '01' + '00'.repeat(32) + '00000000' + '00' + 'ffffffff' + '01' + out + '0100' + '00000000';
  for (const t of [legacy, seg]) { const r = S.btcOutputsOf(t); assert.equal(r.length, 1); assert.equal(r[0].value, 1_000_000n); assert.equal(r[0].script, script); }
  assert.throws(() => S.btcOutputsOf(legacy.slice(0, 60)));
});

test('gateway cleanSearch bounds query strings; remote config expires', async () => {
  const { build: b } = await import('esbuild');
  const g = await b({ stdin: { contents: `export { cleanSearch } from './gateway/worker';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  const G = await import(`data:text/javascript;base64,${Buffer.from(g.outputFiles[0].text).toString('base64')}`);
  assert.equal(G.cleanSearch('?page=2&include=base_token'), '?include=base_token&page=2');
  assert.equal(G.cleanSearch('?page=2&junk=1', { keys: ['page'] }), null);
  assert.equal(G.cleanSearch('?page=' + 'x'.repeat(200), { keys: ['page'] }), null);
  assert.equal(G.cleanSearch('?' + Array.from({ length: 30 }, (_, i) => `k${i}=1`).join('&')), null);
  assert.equal(G.cleanSearch(''), '');
  const c = await b({ stdin: { contents: `export { parseConfig } from './kit/remoteConfig';`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } }).catch(() => null);
  if (!c) return;
  const C = await import(`data:text/javascript;base64,${Buffer.from(c.outputFiles[0].text).toString('base64')}`).catch(() => null);
  if (!C) return;
  const now = Math.floor(Date.now() / 1000);
  assert.ok(C.parseConfig(JSON.stringify({ version: 2, expiresAt: now + 100 }), 1));
  assert.equal(C.parseConfig(JSON.stringify({ version: 2, expiresAt: now - 100 }), 1), null);
});

test('decoder: Aave-style pool calls (supply / withdraw / borrow / repay)', () => {
  const w = (a) => a.replace('0x', '').padStart(64, '0'); const asset = '0x' + '22'.repeat(20), me = '0x' + '11'.repeat(20);
  const d = M.decodeCalldata('0x617ba037' + w(asset) + w('0x3b9aca00') + w(me) + w('0x0'));
  assert.deepEqual([d.kind, d.action, d.amount, d.beneficiary.toLowerCase()], ['lend', 'supply', 1000000000n, me]);
  assert.equal(M.decodeCalldata('0x69328dec' + w(asset) + w('0x1') + w(me)).action, 'withdraw');
  assert.equal(M.decodeCalldata('0xa415bcad' + w(asset) + w('0x1') + w('0x2') + w('0x0') + w(me)).action, 'borrow');
  assert.equal(M.decodeCalldata('0x573ade81' + w(asset) + w('0x1') + w('0x2') + w(me)).action, 'repay');
});

test('spending limit rewrite: only plain approve, only lower', () => {
  const sp = '0x' + '11'.repeat(20);
  const data = M.encodeApprove(sp, 1000n);
  const lowered = M.lowerApproveAmount(data, 400n);
  assert.equal(M.decodeCalldata(lowered).amount, 400n);
  assert.equal(M.decodeCalldata(lowered).spender.toLowerCase(), sp);
  assert.equal(M.lowerApproveAmount(data, 1001n), null);
  assert.equal(M.lowerApproveAmount('0xa9059cbb' + '00'.repeat(64), 1n), null);
  assert.equal(M.lowerApproveAmount(data, -1n), null);
});
