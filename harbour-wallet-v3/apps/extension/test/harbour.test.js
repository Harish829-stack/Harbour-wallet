// Harbour backend wiring (src/core/harbour): request signing, the RPC proxy hook and the mappers into the wallet's types.
// Mocked fetch only; the live interop with the Go API is exercised by backend/run.sh against a running stack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { keccak_256 } from '@noble/hashes/sha3';
const txHash = (raw) => '0x' + Buffer.from(keccak_256(Buffer.from(raw.slice(2), 'hex'))).toString('hex');

const out = await build({ stdin: { contents: `export * from './device'; export * from './client'; export * from './fetchHook'; export * from './data'; export * from './config'; export * as __schema from './schema';`, resolveDir: fileURLToPath(new URL('../src/core/harbour/', import.meta.url)), sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_HB_API_URL: 'https://api.test' }) } });
const H = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('canonical string matches backend/internal/devicesig', () => {
  const c = H.canonical('post', '/v1/me?x=1', '1700000000', 'nonce-nonce-nonce', 'dev', new TextEncoder().encode('{}'));
  assert.equal(c, 'HB1\nPOST\n/v1/me?x=1\n1700000000\nnonce-nonce-nonce\ndev\n44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
});

test('RPC proxy: reads are signed, eth_sendRawTransaction becomes /v1/tx broadcast with friendly errors', async () => {
  let mem; H.setDeviceStorage({ load: async () => mem, save: async (v) => { mem = v; }, forget: async () => { mem = undefined; } });
  const calls = [];
  const base = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method, headers: init.headers ?? {}, body: typeof init.body === 'string' ? init.body : init.body ? new TextDecoder().decode(init.body) : '' });
    if (url.endsWith('/v1/devices/challenge')) return json({ challenge: 'c', difficulty: 4 });
    if (url.endsWith('/v1/devices')) return json({ device_id: '11111111-1111-1111-1111-111111111111' }, 201);
    if (url.includes('/v1/rpc/')) return json({ jsonrpc: '2.0', id: 1, result: '0x10' });
    if (url.includes('/broadcast')) return calls.filter((c) => c.url.includes('/broadcast')).length === 1 ? json({ tx_hash: txHash('0x02ff'), status: 'pending' }) : json({ error: { code: 'insufficient_funds', message: 'Not enough balance to cover the amount and network fee.' } }, 422);
    return json({}, 404);
  };
  H.setRawFetch(base);
  const f = H.makeHarbourFetch(base);
  const read = await (await f('https://api.test/v1/rpc/sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}' })).json();
  assert.equal(read.result, '0x10');
  const rpcCall = calls.find((c) => c.url.includes('/v1/rpc/'));
  assert.ok(rpcCall.headers['X-HB-Signature'] && rpcCall.headers['X-HB-Device'] && rpcCall.headers['X-HB-Session'].startsWith('sepolia-'));
  const sent = await (await f('https://api.test/v1/rpc/sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":7,"method":"eth_sendRawTransaction","params":["0x02ff"]}' })).json();
  assert.deepEqual([sent.id, sent.result], [7, txHash('0x02ff')]);
  assert.ok(calls.some((c) => c.url === 'https://api.test/v1/tx/sepolia/broadcast' && JSON.parse(c.body).raw === '0x02ff'));
  const failed = await (await f('https://api.test/v1/rpc/sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":8,"method":"eth_sendRawTransaction","params":["0x02ee"]}' })).json();
  assert.equal(failed.error.message, 'Not enough balance to cover the amount and network fee.');
  // Other URLs are untouched.
  const n = calls.length; await f('https://example.org/x', {}); assert.equal(calls[n].url, 'https://example.org/x'); assert.equal(calls[n].headers['X-HB-Signature'], undefined);
});

test('mappers: history rows and NFTs in the wallet shapes (spam airdrops dropped, media through Harbour)', () => {
  const rows = [{ chain: 'base-sepolia', address: '0xa', tx_hash: '0xh1', block_time: '2026-10-28T10:00:00Z', direction: 'in', finality: 'finalized', transfers: [
    { chain: 'base-sepolia', asset_ref: 'native', kind: 'native', symbol: 'ETH', decimals: 18, spam: false, amount_raw: '1000', amount: '0.000000000000001', direction: 'in', counterparty: '0xb' },
    { chain: 'base-sepolia', asset_ref: '0xspam', kind: 'token', symbol: 'FREE', decimals: 18, spam: true, amount_raw: '1', amount: '1', direction: 'in' },
    { chain: 'base-sepolia', asset_ref: '0xusdc', kind: 'token', symbol: 'USDC', decimals: 6, spam: false, amount_raw: '2500000', amount: '2.5', direction: 'out', counterparty: '0xc' }] }];
  rows.push({ chain: 'sepolia', address: '0xa', tx_hash: '0xh2', block_time: '2026-10-28T10:00:00Z', direction: 'out', finality: 'finalized', transfers: [
    { chain: 'sepolia', asset_ref: 'native', kind: 'native', symbol: 'ETH', decimals: 18, spam: false, amount_raw: '0', amount: '0', direction: 'out', counterparty: '0xd' },
    { chain: 'sepolia', asset_ref: '0xnew', kind: 'token', symbol: null, decimals: null, spam: false, amount_raw: '1000000000000000', amount: '1000000000000000', direction: 'out', counterparty: '0xd' }] },
  { chain: 'sepolia', address: '0xa', tx_hash: '0xh3', block_time: '2026-10-28T10:00:00Z', direction: 'out', finality: 'finalized', transfers: [
    { chain: 'sepolia', asset_ref: 'native', kind: 'native', symbol: 'ETH', decimals: 18, spam: false, amount_raw: '0', amount: '0', direction: 'out', counterparty: '0xe' }] });
  const items = H.historyItems(rows, (id, h) => `https://x/${id}/${h}`);
  // zero-value native legs are dropped next to real legs; a call with only a zero leg is one contract row; unknown decimals -> blank amount
  assert.deepEqual(items.slice(2).map((x) => [x.hash, x.kind, x.amount]), [['0xh2', 'send', ''], ['0xh3', 'contract', '']]);
  items.length = 2;
  assert.deepEqual([items[0].assetId, items[0].kind, items[0].symbol, items[0].token], ['base-sepolia', 'receive', 'ETH', undefined]);
  assert.deepEqual([items[1].kind, items[1].amount, items[1].token.address, items[1].url], ['send', '2.5', '0xusdc', 'https://x/base-sepolia/0xh1']);
  const cols = H.nftCollections([{ chain: 'sepolia', address: '0xa', contract: '0xC0', collection: 'Cats', token_id: '7', amount: '1', name: null, standard: 'erc721', image_url: '/v1/media/' + 'a'.repeat(32), spam: false }]);
  assert.deepEqual([cols[0].id, cols[0].items[0].name, cols[0].image], ['sepolia:0xc0', '#7', 'https://api.test/v1/media/' + 'a'.repeat(32)]);
  const tracked = H.refsFor('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD').map((r) => r.chain);       // indexed networks only; RPC-only ones are read live
  for (const c of ['ethereum', 'base', 'polygon', 'sepolia', 'base-sepolia']) assert.ok(tracked.includes(c), c);
  assert.ok(!tracked.includes('classic') && !tracked.includes('metis'));
});

test('a broadcast whose returned hash is not keccak256(raw) is refused', async () => {
  let mem; H.setDeviceStorage({ load: async () => mem, save: async (v) => { mem = v; }, forget: async () => { mem = undefined; } });
  const base = async (url) => url.endsWith('/v1/devices/challenge') ? json({ challenge: 'c', difficulty: 4 }) : url.endsWith('/v1/devices') ? json({ device_id: '11111111-1111-1111-1111-111111111111' }, 201)
    : url.includes('/broadcast') ? json({ tx_hash: '0x' + '11'.repeat(32), status: 'pending' }) : json({}, 404);
  H.setRawFetch(base); const f = H.makeHarbourFetch(base);
  const r = await (await f('https://api.test/v1/rpc/sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":9,"method":"eth_sendRawTransaction","params":["0x02ff"]}' })).json();
  assert.equal(r.result, undefined); assert.match(r.error.message, /could not confirm/);
});
test('API and realtime URLs: https/wss only, plain http/ws only for loopback', () => {
  assert.equal(H.isSecureEndpoint('https://api.harbour.example'), true);
  assert.equal(H.isSecureEndpoint('http://localhost:8080'), true);
  assert.equal(H.isSecureEndpoint('http://127.0.0.1:8080'), true);
  assert.equal(H.isSecureEndpoint('http://api.harbour.example'), false);
  assert.equal(H.isSecureEndpoint('http://localhost.evil.example'), false);
  assert.equal(H.isSecureEndpoint('wss://rt.harbour.example/connection/websocket', 'ws'), true);
  assert.equal(H.isSecureEndpoint('ws://rt.harbour.example/connection/websocket', 'ws'), false);
  assert.equal(H.isSecureEndpoint('ws://localhost:8000/connection/websocket', 'ws'), true);
});
test('only device_unknown re-registers; a revoked device keeps its key', async () => {
  let mem; H.setDeviceStorage({ load: async () => mem, save: async (v) => { mem = v; }, forget: async () => { mem = undefined; } });
  let regs = 0; let code = 'device_revoked';
  const base = async (url) => {
    if (url.endsWith('/v1/devices/challenge')) return json({ challenge: 'c', difficulty: 4 });
    if (url.endsWith('/v1/devices')) { regs++; return json({ device_id: '11111111-1111-1111-1111-11111111111' + regs }, 201); }
    return json({ error: { code, message: 'This device needs to sign in again.' } }, 401);
  };
  H.setRawFetch(base);
  await assert.rejects(H.api('GET', '/v1/me')); assert.equal(regs, 1);
  code = 'device_unknown'; await assert.rejects(H.api('GET', '/v1/me')); assert.equal(regs, 2);
});
test('a server-chosen proof-of-work difficulty above the cap is refused', async () => {
  let mem; H.setDeviceStorage({ load: async () => mem, save: async (v) => { mem = v; }, forget: async () => { mem = undefined; } });
  await assert.rejects(H.deviceIdentity('https://api.test', async () => json({ challenge: 'c', difficulty: 40 })), /could not set up/);
});

// HW-2026-014: API responses are shape-checked and must only describe the requested addresses.
test('HW-014: schema guards reject malformed or foreign-address responses', async () => {
  const S = H.__schema; const refs = [{ chain: 'sepolia', address: '0xAbC0000000000000000000000000000000000001' }];
  const asset = { chain: 'sepolia', asset_ref: 'native', kind: 'native', symbol: 'ETH', name: 'Ether', decimals: 18, logo_url: null, spam: false, verified: true };
  const good = { value_usd: 1, addresses: [{ chain: 'sepolia', address: '0xabc0000000000000000000000000000000000001', synced: true, backfill_state: 'done', as_of_block: 1, value_usd: 1, assets: [{ ...asset, amount_raw: '1000', amount: '0.000000000000001', price: { usd: 1, flag: '' }, value_usd: 1 }] }] };
  assert.equal(S.checkPortfolio(good, refs), good);
  assert.throws(() => S.checkPortfolio({ ...good, addresses: [{ ...good.addresses[0], address: '0x' + '99'.repeat(20) }] }, refs), /not requested/);
  assert.throws(() => S.checkPortfolio({ value_usd: 'x', addresses: [] }), /unexpected portfolio/);
  assert.throws(() => S.checkPortfolio({ ...good, addresses: [{ ...good.addresses[0], assets: [{ ...good.addresses[0].assets[0], amount_raw: '-1' }] }] }), /portfolio asset/);
  assert.throws(() => S.checkHistory({ items: [{ chain: 'sepolia', address: refs[0].address, tx_hash: '0x1', block_time: 't', direction: 'in', finality: 'final', transfers: [{ ...asset, amount_raw: '1', amount: '1', direction: 'sideways' }] }] }, refs), /history transfer/);
  assert.throws(() => S.checkNfts({ nfts: [{ chain: 'sepolia', address: '0x' + '22'.repeat(20), contract: '0x1', token_id: '1', amount: '1', standard: 'erc721', name: null, collection: null, image_url: null, spam: false }] }, refs), /not requested/);
  assert.throws(() => S.checkBroadcast({ tx_hash: '0x' + '11'.repeat(32), status: 'pending' }, '0x02ff'), /could not confirm/);
});
