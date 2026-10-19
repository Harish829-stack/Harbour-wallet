// Locks the per-chain RPC endpoint map (pure module, no network). Transpile-in-memory
// pattern (matches accessPolicy.test.js) so no TS loader is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// rpc.ts imports the network registry, so bundle it (still no network, no TS loader).
const out = await build({ entryPoints: [fileURLToPath(new URL('../src/core/rpc.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
const { rpcUrl } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('known EVM chains resolve to https RPC URLs', () => {
  for (const id of [1, 56, 137, 42161, 8453, 11155111]) {
    const u = rpcUrl(id);
    assert.ok(typeof u === 'string' && u.startsWith('https://'), `chain ${id} -> ${u}`);
  }
});

test('Sepolia is the only testnet endpoint wired', () => {
  assert.match(rpcUrl(11155111), /sepolia/i);
});

test('unknown chainId returns undefined (no guess)', () => {
  assert.equal(rpcUrl(999999), undefined);
});
