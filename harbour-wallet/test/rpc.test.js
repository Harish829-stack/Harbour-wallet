// Locks the per-chain RPC endpoint map (pure module, no network). Transpile-in-memory
// pattern (matches accessPolicy.test.js) so no TS loader is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/core/rpc.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { rpcUrl } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

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
