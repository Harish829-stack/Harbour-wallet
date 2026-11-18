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

test('no eth_simulateV1: the backend provider simulation fills the balance-change preview', async () => {
  const TOKEN = '0x' + '44'.repeat(20);
  const d = { ...deps(false), simulate: async (chainId, tx) => {
    assert.equal(chainId, 1); assert.equal(tx.from, ME);
    return { mode: 'full', success: true, warnings: [], changes: [
      { asset: TOKEN, kind: 'token', change_type: 'transfer', from: ME, to: DAPP, amount_raw: '100000000', amount: '100', symbol: 'USDC' },
      { asset: 'native', kind: 'native', change_type: 'transfer', from: DAPP, to: ME, amount_raw: '30000000000000000', amount: '0.03', symbol: 'ETH' },
      { asset: TOKEN, kind: 'token', change_type: 'approve', from: ME, to: DAPP, amount_raw: '1', symbol: 'USDC' },
    ] };
  } };
  const v = await buildView({ id: 'r2', kind: 'tx', ns: 'evm', method: 'eth_sendTransaction', origin: 'https://dapp.example', isTopFrame: true, params: { chainId: 1, tx: { from: ME, to: DAPP, value: '0x0', data: '0xdeadbeef00' } } }, d);
  assert.ok(!v.warnings.includes('simulationUnavailable') && !v.warnings.includes('blindCall'));
  const usdc = v.assetChanges.find((c) => c.symbol === 'USDC'); assert.equal(usdc.direction, 'out'); assert.equal(usdc.formatted, '100');
  const eth = v.assetChanges.find((c) => c.kind === 'native'); assert.equal(eth.direction, 'in'); assert.equal(eth.formatted, '0.03');
  assert.equal(v.assetChanges.length, 2, 'approvals are not balance changes');
});
test('backend simulation unsupported for the chain: still flagged as blind', async () => {
  const v = await buildView({ id: 'r3', kind: 'tx', ns: 'evm', method: 'eth_sendTransaction', origin: 'https://dapp.example', isTopFrame: true, params: { chainId: 1, tx: { from: ME, to: DAPP, value: '0x0', data: '0xdeadbeef00' } } }, { ...deps(false), simulate: async () => null });
  assert.ok(v.warnings.includes('simulationUnavailable') && v.warnings.includes('blindCall'));
});

test('atomic batch approval states the fee rule: free for the first smart-account transaction, otherwise paid by the user', async () => {
  const v = await buildView({ id: 'r2', kind: 'calls', ns: 'evm', method: 'wallet_sendCalls', origin: 'https://dapp.example', isTopFrame: true, params: { chainId: 1, n: { calls: [{ to: DAPP, value: '0x1', data: '0x' }] } } }, deps(false));
  const fee = v.multi.detail.Fee;
  assert.match(fee, /Free for your first smart-account transaction/); assert.match(fee, /Otherwise paid from your account/);
});

test('the estimated fee on a tx approval comes from the wallet preset, never from the site-supplied gasPrice (finding 26)', async () => {
  const d = deps(false);
  d.rpc = async (_c, method) => { if (method === 'eth_gasPrice') return '0x3b9aca00'; if (method === 'eth_maxPriorityFeePerGas') return '0x59682f00'; if (method === 'eth_getBlockByNumber') return { number: '0x10', baseFeePerGas: '0x3b9aca00' }; if (method === 'eth_getCode') return '0x6080'; if (method === 'eth_getBalance') return '0xde0b6b3a7640000'; if (method === 'eth_estimateGas') return '0x5208'; throw new Error('unavailable'); };
  const mk = (extra) => buildView({ id: 'r3', kind: 'tx', ns: 'evm', method: 'eth_sendTransaction', origin: 'https://dapp.example', isTopFrame: true, params: { chainId: 1, tx: { from: ME, to: DAPP, value: '0x1', data: '0x', gas: '0xf4240', ...extra } } }, d);
  const plain = await mk({}); const greedy = await mk({ gasPrice: '0x' + (50_000n * 10n ** 9n).toString(16) });
  assert.ok(plain.estimatedFee && BigInt(plain.estimatedFee) > 0n, 'the preset produces an estimate');
  assert.equal(greedy.estimatedFee, plain.estimatedFee, 'a site gasPrice does not change the number shown');
  assert.equal(greedy.defaultFeeLevel, 'average');
});
