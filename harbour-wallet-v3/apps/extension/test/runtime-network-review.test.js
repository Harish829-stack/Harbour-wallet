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
