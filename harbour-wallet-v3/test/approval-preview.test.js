// Audit A3: a contract call the wallet cannot decode or simulate must not look like a routine approval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export { buildView } from './background/provider/view';`, resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const { buildView } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const ME = '0x1111111111111111111111111111111111111111';
const DAPP = '0x2222222222222222222222222222222222222222';
const net = { chainId: 1, name: 'Ethereum', symbol: 'ETH', decimals: 18, testnet: false, custom: false, explorer: null, rpcUrls: [] };
const deps = (simulate) => ({
  perms: { get: async () => ({ chainId: 1, accountName: 'A', evmAddress: ME, others: {} }) },
  networks: { list: () => [net], get: () => net },
  signer: { accounts: async () => null },
  kv: { get: async () => undefined, set: async () => {} },
  fetch: async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' }),
  tokenMeta: async () => null, probeChainId: async () => 1,
  rpc: async (_c, method) => {
    if (method === 'eth_getCode') return '0x6080';
    if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
    if (method === 'eth_estimateGas') return '0x5208';
    if (method === 'eth_simulateV1') { if (!simulate) throw new Error('method not found'); return [{ calls: [{ status: '0x1', logs: [] }] }]; }
    throw new Error('unavailable');
  },
});
const view = (data, value, simulate) => buildView({ id: 'r1', kind: 'tx', ns: 'evm', method: 'eth_sendTransaction', origin: 'https://dapp.example', isTopFrame: true, params: { chainId: 1, tx: { from: ME, to: DAPP, value, data } } }, deps(simulate));

test('unknown call with no preview is flagged and high risk', async () => {
  const v = await view('0xdeadbeef00', '0x0', false);
  for (const w of ['unknownCall', 'simulationUnavailable', 'blindCall']) assert.ok(v.warnings.includes(w), w);
});
test('native value sent with no preview is high risk even for a decoded call', async () => {
  const v = await view('0xa9059cbb' + '00'.repeat(12) + '33'.repeat(20) + '00'.repeat(31) + '01', '0xde0b6b3a7640000', false);
  assert.ok(v.warnings.includes('simulationUnavailable') && v.warnings.includes('blindCall'));
  assert.ok(!v.warnings.includes('unknownCall'));
});
test('decoded zero-value call without a preview warns but is not high risk', async () => {
  const v = await view('0xa9059cbb' + '00'.repeat(12) + '33'.repeat(20) + '00'.repeat(31) + '01', '0x0', false);
  assert.ok(v.warnings.includes('simulationUnavailable')); assert.ok(!v.warnings.includes('blindCall'));
});
test('a working simulation clears the blind-call warnings; an unknown call is still named', async () => {
  const v = await view('0xdeadbeef00', '0x0', true);
  assert.ok(!v.warnings.includes('simulationUnavailable') && !v.warnings.includes('blindCall'));
  assert.ok(v.warnings.includes('unknownCall'));
});
test('a plain transfer (no data) raises none of them', async () => {
  const v = await view('0x', '0xde0b6b3a7640000', false);
  for (const w of ['unknownCall', 'simulationUnavailable', 'blindCall']) assert.ok(!v.warnings.includes(w), w);
});
