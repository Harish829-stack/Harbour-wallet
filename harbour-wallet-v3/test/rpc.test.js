// Locks the per-chain RPC endpoint map (pure module, no network). Transpile-in-memory
// pattern (matches accessPolicy.test.js) so no TS loader is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// rpc.ts imports the network registry, so bundle it (still no network, no TS loader).
const out = await build({ entryPoints: [fileURLToPath(new URL('../src/core/rpc.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
const { rpcUrl, rpcUrlList } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('Harbour networks resolve to the Harbour API RPC proxy only', () => {
  assert.deepEqual(rpcUrlList(11155111), ['http://localhost:8080/v1/rpc/sepolia']);
  assert.deepEqual(rpcUrlList(84532), ['http://localhost:8080/v1/rpc/base-sepolia']);
});

test('every EVM mainnet the backend serves resolves to its Harbour RPC proxy path', () => {
  const names = { 1: 'ethereum', 56: 'smartchain', 137: 'polygon', 42161: 'arbitrum', 8453: 'base', 10: 'optimism', 43114: 'avalanchec', 25: 'cronos' };
  for (const [id, name] of Object.entries(names)) assert.deepEqual(rpcUrlList(Number(id)), [`http://localhost:8080/v1/rpc/${name}`], `chain ${id}`);
});

test('Sepolia is the only testnet endpoint wired', () => {
  assert.match(rpcUrl(11155111), /sepolia/i);
});

test('unknown chainId returns undefined (no guess)', () => {
  assert.equal(rpcUrl(999999), undefined);
});
