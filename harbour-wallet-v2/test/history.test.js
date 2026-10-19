import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './marketData'; export * from './txHistory';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const ME = '0xAbCdEf0000000000000000000000000000000001';
const OTHER = '0x2222222222222222222222222222222222222222';

// ---------- chart ----------
test('market chart mapping sorts, drops junk, computes range change', () => {
  const body = { prices: [[3000, 110], [1000, 100], [2000, 'x'], [4000, 0], [5000, 121]] };
  const r = M.mapMarketChart(body, '1D', 6000);
  assert.deepEqual(r.points.map((p) => p.t), [1000, 3000, 5000]);
  assert.equal(r.last, 121); assert.ok(Math.abs(r.changePct - 21) < 1e-9);
});
test('1H range keeps only the last hour', () => {
  const now = 10_000_000; const body = { prices: [[now - 7_200_000, 90], [now - 3_000_000, 100], [now - 1000, 110]] };
  const r = M.mapMarketChart(body, '1H', now);
  assert.equal(r.points.length, 2); assert.ok(Math.abs(r.changePct - 10) < 1e-9);
});
test('too little data yields no chart rather than a fake one', () => {
  assert.deepEqual(M.mapMarketChart({ prices: [[1, 5]] }, '1D').points, []);
  assert.deepEqual(M.mapMarketChart(null, '1D').points, []);
});
test('fetchChart: unsupported asset, failure, 429, All falls back to 1Y, caching', async () => {
  assert.equal((await M.fetchChart('sepolia', '1D', async () => { throw new Error('no call'); })).ok, false);
  const good = { prices: [[1, 1], [2, 2]] }; const calls = [];
  const f = async (url) => { calls.push(url); return url.includes('days=max') ? { ok: false, status: 400, json: async () => ({}) } : { ok: true, status: 200, json: async () => good }; };
  const r = await M.fetchChart('bitcoin', 'All', f, 1);
  assert.equal(r.ok, true); assert.equal(calls.length, 2); assert.match(calls[1], /days=365/);
  await M.fetchChart('bitcoin', 'All', f, 2); assert.equal(calls.length, 2); // served from cache
  const rate = await M.fetchChart('solana', '1W', async () => ({ ok: false, status: 429, json: async () => ({}) }), 3);
  assert.equal(rate.ok, false); assert.match(rate.error, /rate-limited/);
  const net = await M.fetchChart('polygon', '1M', async () => { throw new Error('offline'); }, 4);
  assert.equal(net.ok, false);
});
test('coin info strips HTML and only keeps https links', () => {
  const i = M.mapCoinInfo({ description: { en: 'Hello <a href="x">world</a>  text' }, links: { homepage: ['http://bad', 'https://ok.example'] }, market_data: { market_cap: { usd: 5 }, total_volume: { usd: 6 }, circulating_supply: 7, total_supply: null } });
  assert.equal(i.description, 'Hello world text'); assert.equal(i.website, 'https://ok.example'); assert.equal(i.marketCap, 5); assert.equal(i.total, undefined);
});

// ---------- history ----------
test('fmtUnits is exact', () => {
  assert.equal(M.fmtUnits(1500000000000000000n, 18), '1.5'); assert.equal(M.fmtUnits(1n, 18), '0.000000000000000001'); assert.equal(M.fmtUnits(0n, 18), '0'); assert.equal(M.fmtUnits(123456789n, 8), '1.23456789');
});
test('Blockscout mapping: send, receive, contract call, failed', () => {
  const body = { items: [
    { hash: '0xa', timestamp: '2026-10-01T10:00:00.000000Z', from: { hash: ME }, to: { hash: OTHER }, value: '1000000000000000000', status: 'ok', method: null },
    { hash: '0xb', timestamp: '2026-10-02T10:00:00.000000Z', from: { hash: OTHER }, to: { hash: ME.toLowerCase() }, value: '250000000000000000', status: 'ok', method: null },
    { hash: '0xc', timestamp: '2026-10-03T10:00:00.000000Z', from: { hash: ME }, to: { hash: OTHER }, value: '0', status: 'ok', method: 'approve' },
    { hash: '0xd', timestamp: '2026-10-04T10:00:00.000000Z', from: { hash: ME }, to: { hash: OTHER }, value: '5', status: 'error', result: 'out of gas', method: null },
    { nothing: true },
  ] };
  const r = M.mapBlockscout(body, 'ethereum', ME);
  assert.equal(r.length, 4);
  assert.deepEqual([r[0].kind, r[0].amount, r[0].counterparty, r[0].status], ['send', '1', OTHER, 'confirmed']);
  assert.deepEqual([r[1].kind, r[1].amount, r[1].counterparty], ['receive', '0.25', OTHER]);
  assert.deepEqual([r[2].kind, r[2].method], ['contract', 'approve']);
  assert.equal(r[3].status, 'failed');
  assert.equal(r[0].url, 'https://etherscan.io/tx/0xa'); assert.equal(r[0].timestamp, Date.parse('2026-10-01T10:00:00Z'));
});
test('Etherscan-compatible mapping (BNB via Routescan)', () => {
  const r = M.mapEtherscanLike({ status: '1', result: [{ hash: '0x1', timeStamp: '1790000000', from: ME, to: OTHER, value: '2000000000000000000', isError: '0', methodId: '0x', functionName: '' }, { hash: '0x2', timeStamp: '1790000100', from: OTHER, to: ME, value: '0', isError: '1', methodId: '0xa9059cbb', functionName: 'transfer(address,uint256)' }] }, 'smartchain', ME);
  assert.deepEqual([r[0].kind, r[0].amount, r[0].symbol], ['send', '2', 'BNB']);
  assert.deepEqual([r[1].kind, r[1].status, r[1].method], ['contract', 'failed', 'transfer']);
  assert.equal(r[0].timestamp, 1790000000000);
  assert.deepEqual(M.mapEtherscanLike({ status: '0', result: 'Max rate limit reached' }, 'smartchain', ME), []);
});
test('Esplora mapping: receive, send (excludes change), self', () => {
  const me = 'bc1qme'; const o = 'bc1qother';
  const body = [
    { txid: 'r', vin: [{ prevout: { scriptpubkey_address: o, value: 100000 } }], vout: [{ scriptpubkey_address: me, value: 60000 }, { scriptpubkey_address: o, value: 39000 }], status: { confirmed: true, block_time: 1790000000 } },
    { txid: 's', vin: [{ prevout: { scriptpubkey_address: me, value: 50000 } }], vout: [{ scriptpubkey_address: o, value: 30000 }, { scriptpubkey_address: me, value: 19000 }], status: { confirmed: false } },
    { txid: 'x', vin: [{ prevout: { scriptpubkey_address: me, value: 50000 } }], vout: [{ scriptpubkey_address: me, value: 49000 }], status: { confirmed: true, block_time: 1790000500 } },
  ];
  const r = M.mapEsplora(body, me);
  assert.deepEqual([r[0].kind, r[0].amount, r[0].counterparty], ['receive', '0.0006', o]);
  assert.deepEqual([r[1].kind, r[1].amount, r[1].status], ['send', '0.0003', 'pending']);
  assert.deepEqual([r[2].kind, r[2].amount], ['self', '0.00049']);
});
test('Solana signatures mapping', () => {
  const r = M.mapSolanaSignatures({ result: [{ signature: 'sig1', blockTime: 1790000000, err: null, confirmationStatus: 'finalized' }, { signature: 'sig2', blockTime: null, err: { InstructionError: [0, 'x'] } }] });
  assert.deepEqual([r[0].status, r[1].status, r[0].timestamp, r[1].timestamp], ['confirmed', 'failed', 1790000000000, 0]);
});
test('fetchHistory routes per chain, sorts newest first, and reports failures', async () => {
  const urls = [];
  const f = async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => ({ items: [
    { hash: '0x1', timestamp: '2026-01-01T00:00:00Z', from: { hash: ME }, to: { hash: OTHER }, value: '1', status: 'ok' },
    { hash: '0x2', timestamp: '2026-02-01T00:00:00Z', from: { hash: OTHER }, to: { hash: ME }, value: '1', status: 'ok' }] }) }; };
  const r = await M.fetchHistory('base', ME, { solanaRpc: 'x' }, f);
  assert.equal(r.ok, true); assert.deepEqual(r.items.map((i) => i.id), ['0x2', '0x1']); assert.match(urls[0], /^https:\/\/base\.blockscout\.com\/api\/v2\/addresses\//);
  assert.equal((await M.fetchHistory('base', ME, { solanaRpc: 'x' }, async () => ({ ok: false, status: 500, json: async () => ({}) }))).ok, false);
  assert.equal((await M.fetchHistory('base', '', { solanaRpc: 'x' }, f)).ok, false);
  assert.equal((await M.fetchHistory('mars', ME, { solanaRpc: 'x' }, f)).ok, false);
  assert.equal(M.historySupported('smartchain'), true);
});
