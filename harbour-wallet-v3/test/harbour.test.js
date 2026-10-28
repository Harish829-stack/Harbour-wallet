// Harbour backend wiring (src/core/harbour): request signing, the RPC proxy hook and the mappers into the wallet's types.
// Mocked fetch only; the live interop with the Go API is exercised by backend/run.sh against a running stack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const out = await build({ stdin: { contents: `export * from './device'; export * from './client'; export * from './fetchHook'; export * from './data'; export * from './config';`, resolveDir: fileURLToPath(new URL('../src/core/harbour/', import.meta.url)), sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_HB_API_URL: 'http://api.test' }) } });
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
    if (url.includes('/broadcast')) return calls.filter((c) => c.url.includes('/broadcast')).length === 1 ? json({ tx_hash: '0xabc', status: 'pending' }) : json({ error: { code: 'insufficient_funds', message: 'Not enough balance to cover the amount and network fee.' } }, 422);
    return json({}, 404);
  };
  H.setRawFetch(base);
  const f = H.makeHarbourFetch(base);
  const read = await (await f('http://api.test/v1/rpc/sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}' })).json();
  assert.equal(read.result, '0x10');
  const rpcCall = calls.find((c) => c.url.includes('/v1/rpc/'));
  assert.ok(rpcCall.headers['X-HB-Signature'] && rpcCall.headers['X-HB-Device'] && rpcCall.headers['X-HB-Session'].startsWith('sepolia-'));
  const sent = await (await f('http://api.test/v1/rpc/sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":7,"method":"eth_sendRawTransaction","params":["0x02ff"]}' })).json();
  assert.deepEqual([sent.id, sent.result], [7, '0xabc']);
  assert.ok(calls.some((c) => c.url === 'http://api.test/v1/tx/sepolia/broadcast' && JSON.parse(c.body).raw === '0x02ff'));
  const failed = await (await f('http://api.test/v1/rpc/sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":8,"method":"eth_sendRawTransaction","params":["0x02ee"]}' })).json();
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
  assert.deepEqual([cols[0].id, cols[0].items[0].name, cols[0].image], ['sepolia:0xc0', '#7', 'http://api.test/v1/media/' + 'a'.repeat(32)]);
  assert.deepEqual(H.refsFor('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD').map((r) => r.chain), ['sepolia', 'base-sepolia']);
});
