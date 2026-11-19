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

// ---------- B4: dead Blockscout hosts ----------
test('Arbitrum Sepolia and Polygon Amoy history use Etherscan V2 through the gateway, not the dead Blockscout hosts', async () => {
  const T = await load(`export * from './core/txHistory'; export { chainById } from './core/chains/index';`);
  for (const [id, chainid] of [['arbitrum-sepolia', 421614], ['polygon-amoy', 80002]]) {
    assert.equal(T.historySupportedFor(T.chainById(id)), true, id);
    const urls = [];
    const f = async (url) => { urls.push(String(url)); return json({ status: '1', message: 'OK', result: [] }); };
    const r = await T.fetchHistory(id, '0x1111111111111111111111111111111111111111', { solanaRpc: 'x' }, f);
    assert.equal(r.ok, true, id);
    assert.ok(urls.length && urls.every((u) => u.startsWith('https://api.test/v1/gw/etherscan/v2?chainid=' + chainid + '&')), urls.join(' '));
  }
});

// ---------- B5: staking data ----------
test('Solana total supply: first endpoint only, cached 12 h, last good value on failure', async () => {
  const S = await load(`export * from './core/staking/solana';`);
  S.resetSupplyForTests();
  let n = 0; let fail = false;
  const f = async (url) => { n++; if (fail) throw new Error('timeout'); assert.equal(url, 'https://gw.test/helius'); return json({ jsonrpc: '2.0', id: 1, result: { value: { total: 6e17 } } }); };
  const urls = ['https://gw.test/helius', 'https://public.test'];
  assert.equal(await S.solanaTotalSupply(f, urls, 1000), 6e17);
  assert.equal(await S.solanaTotalSupply(f, urls, 2000), 6e17); assert.equal(n, 1);
  fail = true;
  assert.equal(await S.solanaTotalSupply(f, urls, 1000 + S.SUPPLY_TTL_MS + 1), 6e17, 'stale value instead of no APR'); assert.equal(n, 2);
  S.resetSupplyForTests();
  assert.equal(await S.solanaTotalSupply(f, urls, 5000), null);
});
test('Cosmos tx search asks query= first and remembers the form that works per endpoint', async () => {
  const C = await load(`export * from './core/chains/adapters/history'; export { chainById } from './core/chains/index';`);
  C.resetTxSearchFormForTests();
  const run = async (id, accepts) => {
    const urls = [];
    const f = async (url) => { urls.push(String(url)); return url.includes(`/txs?${accepts}=`) ? json({ tx_responses: [] }) : json({ code: 2 }, 500); };
    await C.NON_EVM_HISTORY.cosmos(C.chainById(id), 'me1', f); return urls;
  };
  const hub = await run('cosmos', 'query'); assert.equal(hub.length, 2); assert.ok(hub.every((u) => u.includes('?query=')));
  const kava1 = await run('kava', 'events'); assert.equal(kava1.length, 3); // learns on the first direction
  const kava2 = await run('kava', 'events'); assert.equal(kava2.length, 2); assert.ok(kava2.every((u) => u.includes('?events=')));
});
test('Tezos bakers: largest staking balances first, without the sort TzKT refuses', async () => {
  const Z = await load(`export * from './core/staking/tezos';`);
  const rows = [{ address: 'tz1a', stakingBalance: 5 }, { address: 'tz1b', stakingBalance: 50 }, { bad: 1 }, { address: 'tz1c', stakingBalance: '20' }, { address: 'tz1d' }];
  assert.deepEqual(Z.topBakers(rows, 2).map((b) => b.address), ['tz1b', 'tz1c']);
  assert.deepEqual(Z.topBakers(null, 2), []);
});
test('Stride, Neutron and ZetaChain REST: no host that answers for another chain, cosmos.directory as a fallback', async () => {
  const R = await load(`export { chainById } from './core/chains/index';`);
  const stride = R.chainById('stride')?.endpoints ?? [];
  // stride-api.polkachu.com served Agoric (2026-11-19 capture: "expected 'agoric' got 'stride'"); publicnode 404s on every path.
  assert.ok(!stride.some((u) => /polkachu|publicnode/.test(u)), stride.join());
  assert.equal(stride[0], 'https://rest.cosmos.directory/stride');
  for (const id of ['neutron', 'zetachain']) assert.ok((R.chainById(id)?.endpoints ?? []).includes(`https://rest.cosmos.directory/${id}`), id);
});

// ---------- smart accounts: wallet_getCallsStatus logs ----------
test('wallet_getCallsStatus logs are only the own logs of the batch, never another operation in the same bundle', async () => {
  const K = await load(`export * from './core/smartAccount/calls5792';`);
  const EP = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
  const t = (x) => '0x' + x.repeat(64).slice(0, 64);
  const ev = (topic, ...rest) => ({ address: EP, topics: [topic, ...rest], data: '0x' });
  const xfer = (n) => ({ address: '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE', topics: [t('d'), t(String(n))], data: '0x' });
  const mine = t('a'); const other = t('b');
  // Captured shape (Sepolia, 2026-11-19): sponsor event, BeforeExecution, two transfers, UserOperationEvent, beneficiary payout.
  const one = [{ address: '0x777777777777AeC03fd955926DbF81597e66834C', topics: [t('7')], data: '0x' }, ev(K.BEFORE_EXECUTION_EVENT), xfer(1), xfer(2), ev(K.UOP_EVENT, mine), xfer(9)];
  assert.deepEqual(K.userOpLogs(one, mine), [xfer(1), xfer(2)]);
  // Two operations in one bundle: each gets its own slice.
  const two = [ev(K.BEFORE_EXECUTION_EVENT), xfer(3), ev(K.UOP_EVENT, other), xfer(4), xfer(5), ev(K.UOP_EVENT, mine.toUpperCase().replace('0X', '0x'))];
  assert.deepEqual(K.userOpLogs(two, mine), [xfer(4), xfer(5)]);
  assert.deepEqual(K.userOpLogs(two, other), [xfer(3)]);
  assert.equal(K.userOpLogs(two, t('c')), null);
  // A spoofed event from another contract does not count as a boundary.
  const spoof = [ev(K.BEFORE_EXECUTION_EVENT), xfer(6), { ...ev(K.UOP_EVENT, other), address: '0x1111111111111111111111111111111111111111' }, xfer(7), ev(K.UOP_EVENT, mine)];
  assert.equal(K.userOpLogs(spoof, mine).length, 3);
});

// ---------- efficiency ----------
test('coalescer: concurrent and back-to-back callers share one run; failures are not reused', async () => {
  const C = await load(`export * from './core/coalesce';`);
  let now = 0; const c = C.coalescer(2000, () => now);
  let runs = 0; const job = () => { runs++; return new Promise((r) => setTimeout(() => r(runs), 5)); };
  const [a, b] = await Promise.all([c('k', job), c('k', job)]); assert.equal(a, 1); assert.equal(b, 1);
  now = 1500; assert.equal(await c('k', job), 1); assert.equal(runs, 1);
  now = 4000; assert.equal(await c('k', job), 2);
  assert.equal(await c('other', job), 3);
  let boom = 0; await assert.rejects(c('x', async () => { boom++; throw new Error('x'); })); await assert.rejects(c('x', async () => { boom++; throw new Error('x'); })); assert.equal(boom, 2);
});

// ---------- privacy / hardening ----------
test('Tron data goes through the Harbour gateway relay first, with the public hosts as fallback', async () => {
  const N = await load(`export * from './core/chains/adapters/net'; export { chainById } from './core/chains/index';`);
  const e = N.endpointsOf(N.chainById('tron'));
  assert.equal(e[0], 'https://api.test/v1/gw/trongrid'); assert.ok(e.includes('https://api.trongrid.io'));
  assert.ok(!N.endpointsOf(N.chainById('cosmos')).some((u) => u.includes('/v1/gw/')));
  const off = await load(`export * from './core/chains/adapters/net'; export { chainById } from './core/chains/index';`, { VITE_HB_API_URL: 'https://api.test', VITE_HB_GATEWAY_URL: '' });
  assert.equal(off.endpointsOf(off.chainById('tron'))[0], 'https://api.trongrid.io');
});
test('realtime URL: a deployed API may not hand out a temporary tunnel; development setups may', () => {
  assert.equal(H.realtimeUrlAllowed('wss://rt.harbour.example/connection/websocket', 'https://api.harbour.example'), true);
  assert.equal(H.realtimeUrlAllowed('wss://edges-loads-sphere-scanner.trycloudflare.com/connection/websocket', 'https://api.harbour.example'), false);
  assert.equal(H.realtimeUrlAllowed('wss://edges-loads-sphere-scanner.trycloudflare.com/connection/websocket', 'http://localhost:8080'), true);
  assert.equal(H.realtimeUrlAllowed('wss://a.trycloudflare.com/connection/websocket', 'https://b.trycloudflare.com'), true);
  assert.equal(H.realtimeUrlAllowed('ws://rt.harbour.example/connection/websocket', 'https://api.harbour.example'), false);
});
test('WalletConnect is created with telemetry off', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../src/background/walletconnect/kit.ts', import.meta.url), 'utf8'), /new Core\(\{[^}]*telemetryEnabled: false/);
});
