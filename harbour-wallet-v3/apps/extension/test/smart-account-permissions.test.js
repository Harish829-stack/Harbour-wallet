// P5 normalizer (src/core/smartAccount/permissions.ts): strict, refuses unlimited/expired/long/unknown. Not reachable from a dApp yet (Q7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/permissions'; export { specFor } from './core/provider/methods';`, resolveDir: src, sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const NOW = 1_800_000_000, KEY = '0x' + '12'.repeat(20);
const req = (o = {}) => ({ chainId: '0xaa36a7', to: KEY, expiry: NOW + 3600, permission: { type: 'native-token-allowance', data: { allowance: '0xde0b6b3a7640000' } }, ...o });
const code = (f) => { try { f(); } catch (e) { return e.code; } return null; };

test('a valid request normalizes', () => {
  const n = M.normalizePermissionRequest(req(), NOW);
  assert.equal(n.chainId, 11155111); assert.equal(n.allowance, 10n ** 18n); assert.equal(n.token, null); assert.equal(n.expiry, NOW + 3600);
  const e = M.normalizePermissionRequest(req({ permission: { type: 'erc20-token-allowance', data: { allowance: '0x64', tokenAddress: '0x' + '34'.repeat(20) } } }), NOW);
  assert.equal(e.token.toLowerCase(), '0x' + '34'.repeat(20));
});
test('unlimited, zero, expired, over 30 days, unknown fields/types, wrong chain and adjustable grants are refused', () => {
  assert.equal(code(() => M.normalizePermissionRequest(req({ permission: { type: 'native-token-allowance', data: { allowance: '0x' + 'f'.repeat(64) } } }), NOW)), -32602);
  assert.equal(code(() => M.normalizePermissionRequest(req({ permission: { type: 'native-token-allowance', data: { allowance: '0x0' } } }), NOW)), -32602);
  assert.equal(code(() => M.normalizePermissionRequest(req({ expiry: NOW - 1 }), NOW)), -32602);
  assert.equal(code(() => M.normalizePermissionRequest(req({ expiry: NOW + 31 * 86400 }), NOW)), -32602);
  assert.equal(code(() => M.normalizePermissionRequest(req({ extra: 1 }), NOW)), -32602);
  assert.equal(code(() => M.normalizePermissionRequest(req({ permission: { type: 'root', data: {} } }), NOW)), 5700);
  assert.equal(code(() => M.normalizePermissionRequest(req({ permission: { type: 'native-token-allowance', data: { allowance: '0x1', tokenAddress: KEY } } }), NOW)), -32602);
  assert.equal(code(() => M.normalizePermissionRequest(req({ chainId: '0x1' }), NOW)), 5710);
  assert.equal(code(() => M.normalizePermissionRequest(req({ isAdjustmentAllowed: true }), NOW)), -32602);
  assert.equal(code(() => M.normalizePermissionRequest(req({ to: 'nope' }), NOW)), -32602);
});
test('no provider method reaches the permission code yet', () => {
  for (const m of ['wallet_requestExecutionPermissions', 'wallet_grantPermissions', 'wallet_revokeExecutionPermission']) assert.equal(M.specFor('evm', m), null, m);
  void readFileSync;
});
