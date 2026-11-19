// Fixes from the 2026-11-19 runtime network review (HAR captures + dApp console). One test per finding; mocked fetch only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { decodeFunctionData, encodeFunctionResult, encodeAbiParameters, multicall3Abi, parseAbi } from 'viem';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const load = async (contents, env = { VITE_HB_API_URL: 'https://api.test' }) => {
  const out = await build({ stdin: { contents, resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, define: { 'import.meta.env': JSON.stringify(env) } });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const H = await load(`export * from './core/harbour/device'; export * from './core/harbour/client'; export * from './core/harbour/fetchHook'; export * from './core/harbour/data'; export * from './core/harbour/config';`);
const deviceBase = (url) => (url.endsWith('/v1/devices/challenge') ? json({ challenge: 'c', difficulty: 4 }) : url.endsWith('/v1/devices') ? json({ device_id: '11111111-1111-1111-1111-111111111111' }, 201) : null);
let mem; H.setDeviceStorage({ load: async () => mem, save: async (v) => { mem = v; }, forget: async () => { mem = undefined; } });

// ---------- B1/B2: Earn and Swap reads ----------
test('testnet DeFi client groups concurrent contract reads into one Multicall3 request', async () => {
  const D = await load(`export * from './integrations/testnet-defi/client'; export { tokenAbi } from './integrations/testnet-defi/abis';`);
  const bodies = []; const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const b = JSON.parse(init.body); bodies.push(b);
    const one = (r) => {
      if (r.method === 'eth_chainId') return { jsonrpc: '2.0', id: r.id, result: '0x14a34' };
      const { args } = decodeFunctionData({ abi: multicall3Abi, data: r.params[0].data });
      const results = args[0].map(() => ({ success: true, returnData: encodeAbiParameters([{ type: 'uint8' }], [6]) }));
      return { jsonrpc: '2.0', id: r.id, result: encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results }) };
    };
    return json(Array.isArray(b) ? b.map(one) : one(b));
  };
  try {
    const c = D.defiClient('base-sepolia');
    const tokens = Array.from({ length: 30 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`);
    const got = await Promise.all(tokens.map((address) => c.readContract({ address, abi: parseAbi(['function decimals() view returns (uint8)']), functionName: 'decimals' })));
    assert.deepEqual(new Set(got), new Set([6]));
    const calls = bodies.flatMap((b) => (Array.isArray(b) ? b : [b])).filter((r) => r.method === 'eth_call');
    assert.ok(calls.length <= 2, `30 reads became ${calls.length} eth_call requests`);
    assert.ok(calls.every((r) => r.params[0].to.toLowerCase() === '0xca11bde05977b3631167028862be2a173976ca11'));
  } finally { globalThis.fetch = real; }
});
// ---------- B3: a backend that serves fewer networks ----------
test('networks the backend does not serve are never tracked, probed or asked for history', async () => {
  H.resetTrackingForTests(); H.resetServedForTests();
  const calls = [];
  const base = async (url, init = {}) => {
    const d = deviceBase(url); if (d) return d;
    calls.push(`${init.method ?? 'GET'} ${new URL(url).pathname}`);
    if (url.endsWith('/v1/me')) return json({ device_id: 'd', chains: ['sepolia', 'base-sepolia'] });
    if (url.includes('/v1/me/addresses')) return json({ addresses: [] });
    if (url.includes('/v1/me/history')) return json({ items: [] });
    return json({}, 404);
  };
  H.setRawFetch(base);
  await H.ensureTracked([{ chain: 'ethereum', address: '0xa' }, { chain: 'sepolia', address: '0xa' }, { chain: 'base', address: '0xa' }]);
  const puts = calls.filter((c) => c.startsWith('PUT'));
  assert.equal(puts.length, 1, 'one PUT with only the served network (no per-network probing)');
  await assert.rejects(H.fetchHarbourHistory('ethereum', '0xa', () => undefined), (e) => e.code === 'not_served');
  assert.equal(calls.filter((c) => c.includes('/v1/me/history')).length, 0);
  assert.deepEqual(await H.fetchHarbourHistory('sepolia', '0xa', () => undefined), []);
  assert.equal(await H.backendServes('ethereum'), false);
  assert.equal(await H.backendServes('sepolia'), true);
  assert.equal(calls.filter((c) => c === 'GET /v1/me').length, 1, '/v1/me is asked once and cached');
});
test('when /v1/me cannot be read, every network counts as served (previous behaviour)', async () => {
  H.resetServedForTests();
  H.setRawFetch(async (url) => deviceBase(url) ?? json({ error: { code: 'busy', message: 'x' } }, 503));
  assert.equal(await H.servedChains(), null);
  assert.equal(await H.backendServes('ethereum'), true);
  H.resetServedForTests();
});
// ---------- B3/B4: RPC for a network the backend refuses ----------
test('RPC: unknown_chain falls back to the public endpoints and later calls skip the backend', async () => {
  H.resetUnservedForTests();
  const seen = [];
  const base = async (url, init = {}) => {
    const d = deviceBase(url); if (d) return d;
    seen.push(String(url));
    if (url.startsWith('https://api.test/v1/rpc/')) return json({ error: { code: 'unknown_chain', message: "This network isn't supported.", retryable: false } }, 404);
    if (url.startsWith('https://api.test/v1/tx/')) return json({ error: { code: 'unknown_chain', message: "This network isn't supported.", retryable: false } }, 404);
    if (url === 'https://rpc-a.test') return json({}, 503);
    if (url === 'https://rpc-b.test') return json({ jsonrpc: '2.0', id: JSON.parse(init.body).id, result: '0x5' });
    return json({}, 404);
  };
  H.setRawFetch(base); H.setPublicRpcResolver((chain) => (chain === 'arbitrum-sepolia' ? ['https://api.test/v1/rpc/arbitrum-sepolia', 'https://rpc-a.test', 'https://rpc-b.test'] : []));
  const f = H.makeHarbourFetch(base);
  const r1 = await (await f('https://api.test/v1/rpc/arbitrum-sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":3,"method":"eth_getBalance","params":["0xa","latest"]}' })).json();
  assert.equal(r1.result, '0x5'); assert.equal(r1.id, 3);
  assert.equal(H.isUnserved('arbitrum-sepolia'), true);
  const before = seen.filter((u) => u.includes('/v1/rpc/')).length;
  const r2 = await (await f('https://api.test/v1/rpc/arbitrum-sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":4,"method":"eth_gasPrice"}' })).json();
  assert.equal(r2.result, '0x5');
  assert.equal(seen.filter((u) => u.includes('/v1/rpc/')).length, before, 'no second trip to the backend');
  // A broadcast on such a network goes to the public endpoints too.
  H.resetUnservedForTests();
  const sent = await (await f('https://api.test/v1/rpc/arbitrum-sepolia', { method: 'POST', body: '{"jsonrpc":"2.0","id":5,"method":"eth_sendRawTransaction","params":["0x02ff"]}' })).json();
  assert.equal(sent.result, '0x5');
  // A network with no public endpoint gets a plain-language error, not a crash.
  const none = await (await f('https://api.test/v1/rpc/polygon-amoy', { method: 'POST', body: '{"jsonrpc":"2.0","id":6,"method":"eth_chainId"}' })).json();
  assert.match(none.error.message, /not available right now/);
  H.resetUnservedForTests(); H.setPublicRpcResolver(() => []);
});
