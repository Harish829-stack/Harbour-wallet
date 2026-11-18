// MetaMask's smart-accounts-kit ships analytics that are on by default and post to a MetaMask endpoint (toMetaMaskSmartAccount,
// createDelegation and others trigger it). A wallet must not phone home. This test (1) runs every kit-backed code path with the
// network spied and asserts nothing is sent, (2) shows the spy WOULD catch the kit's telemetry (positive control), and (3) fails if
// anything in src imports the kit's root entry, which is where the tracking calls live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';

delete process.env.DO_NOT_TRACK; delete process.env.CI; // analytics could only be switched on by silence here, so remove every opt-out
const seen = [];
globalThis.fetch = async (...a) => { seen.push(String(a[0]?.url ?? a[0])); return new Response('{}', { status: 200 }); }; // installed BEFORE the kit loads (it captures fetch at load)
const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/abi'; export * from './core/smartAccount/kit'; export * from './core/smartAccount/send'; export * from './core/smartAccount/constants'; export * from './core/smartAccount/userOp';`, resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, define: { 'import.meta.env': '{}' } });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const SINK = '0x000000000000000000000000000000000000dEaD';
const acct = privateKeyToAccount('0x' + '11'.repeat(32));

test('production kit paths make no network call (encoding, typed data, signing)', async () => {
  M.encodeCalls([{ to: SINK, value: 1n, data: '0x' }]);
  M.encodeCalls([{ to: SINK, value: 1n, data: '0x' }, { to: SINK, value: 0n, data: '0x12' }]);
  const op = { sender: acct.address, nonce: 1n, callData: '0x', callGasLimit: 1n, verificationGasLimit: 1n, preVerificationGas: 1n, maxFeePerGas: 1n, maxPriorityFeePerGas: 1n, signature: '0x' };
  await M.signUserOp(op, 84532, acct);
  await new Promise((r) => setTimeout(r, 400)); // the kit's sender batches after ~100 ms
  assert.deepEqual(seen, []);
});
test('positive control: the kit root entry DOES attempt telemetry (so the check above is meaningful)', async () => {
  const { toMetaMaskSmartAccount, Implementation } = await import('@metamask/smart-accounts-kit');
  const { createPublicClient, custom } = await import('viem');
  const client = createPublicClient({ chain: { id: 84532, name: 'x', nativeCurrency: { name: 'E', symbol: 'E', decimals: 18 }, rpcUrls: { default: { http: [] } } }, transport: custom({ request: async () => '0x' }) });
  await toMetaMaskSmartAccount({ client, implementation: Implementation.Stateless7702, address: acct.address, signer: { account: acct } });
  await new Promise((r) => setTimeout(r, 600));
  assert.ok(seen.some((u) => u.includes('mm-sdk-analytics')), 'telemetry attempt expected from the kit root entry: ' + JSON.stringify(seen));
});
test('nothing in src imports the kit root entry; only /utils (and only in core/smartAccount/kit.ts)', () => {
  const files = []; const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js|mjs)$/.test(n) && files.push(p); } }; walk(src);
  const bad = []; const used = [];
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/from\s+['"](@metamask\/smart-accounts-kit[^'"]*)['"]|import\(\s*['"](@metamask\/smart-accounts-kit[^'"]*)['"]\s*\)/g)) {
    const spec = m[1] ?? m[2]; used.push([f, spec]);
    if (spec !== '@metamask/smart-accounts-kit/utils') bad.push([f, spec]);
  }
  assert.deepEqual(bad, []);
  assert.deepEqual(used.map(([f]) => f.replace(src, '')), ['core/smartAccount/kit.ts']);
});
