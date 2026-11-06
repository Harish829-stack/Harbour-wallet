import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/networks'; export * from './core/networkRegistry'; export { rpcUrl } from './core/rpc'; export { networkByChainId, tokenNetworks } from './core/customTokens'; export { nativeSymbol } from './core/balanceService';`, resolveDir: root, sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
const N = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const good = { name: ' Local  Dev ', rpcUrl: 'https://rpc.example.org/', chainId: '31337', symbol: 'LDV', explorerUrl: '' };

test('valid network is normalised', () => {
  const v = N.validateNetwork(good, []); assert.ok(v.ok); assert.deepEqual(v.network, { chainId: 31337, name: 'Local Dev', rpcUrl: 'https://rpc.example.org', symbol: 'LDV', explorerUrl: undefined });
});
test('field validation', () => {
  const f = (o) => { const v = N.validateNetwork({ ...good, ...o }, []); return v.ok ? 'ok' : v.field; };
  assert.equal(f({ name: '' }), 'name'); assert.equal(f({ rpcUrl: 'http://evil.example.com' }), 'rpcUrl'); assert.equal(f({ rpcUrl: 'https://u:p@x.org' }), 'rpcUrl');
  assert.equal(f({ rpcUrl: 'javascript:alert(1)' }), 'rpcUrl'); assert.equal(f({ chainId: '0' }), 'chainId'); assert.equal(f({ chainId: '1.5' }), 'chainId'); assert.equal(f({ chainId: '99999999999999999999' }), 'chainId');
  assert.equal(f({ chainId: '1' }), 'chainId', 'built-in chain id'); assert.equal(f({ symbol: '' }), 'symbol'); assert.equal(f({ explorerUrl: 'nope' }), 'explorerUrl');
  assert.equal(f({ rpcUrl: 'http://127.0.0.1:8545' }), 'ok', 'local node over http is allowed');
});
test('duplicates are rejected, edits are not', () => {
  const ex = [{ chainId: 31337, name: 'x', rpcUrl: 'https://a', symbol: 'X', addedAt: 1 }];
  assert.equal(N.validateNetwork(good, ex).ok, false); assert.equal(N.validateNetwork(good, [], 31337).ok, true);
});
test('RPC probe requires a JSON-RPC answer with the same chain id', async () => {
  const mk = (body, ok = true) => async () => ({ ok, status: ok ? 200 : 502, json: async () => body });
  assert.deepEqual(await N.probeRpcChainId('https://x', mk({ result: '0x7a69' })), { ok: true, chainId: 31337 });
  assert.equal((await N.probeRpcChainId('https://x', mk({ foo: 1 }))).code, 'RPC_INVALID');
  assert.equal((await N.probeRpcChainId('https://x', mk({}, false))).code, 'RPC_UNREACHABLE');
  assert.equal((await N.probeRpcChainId('https://x', async () => { throw new Error('down'); })).code, 'RPC_UNREACHABLE');
  assert.match((await N.checkNetwork({ chainId: 1, rpcUrl: 'https://x' }, mk({ result: '0x7a69' }))).error, /31337, not 1/);
  assert.equal((await N.checkNetwork({ chainId: 31337, rpcUrl: 'https://x' }, mk({ result: '0x7a69' }))).ok, true);
});
test('registry feeds rpcUrl, token networks and native symbol; overrides win', () => {
  N.setNetworkState({ custom: [{ chainId: 31337, name: 'Local Dev', rpcUrl: 'https://rpc.example.org', symbol: 'LDV', addedAt: 1 }], rpcOverrides: { '1': 'https://my.node' } });
  assert.equal(N.rpcUrl(31337), 'https://rpc.example.org'); assert.match(N.rpcUrl(56), /\/v1\/rpc\/smartchain$/);
  assert.match(N.rpcUrl(1), /\/v1\/rpc\/ethereum$/, 'Harbour networks ignore RPC overrides: the API proxy is the only endpoint');
  assert.equal(N.networkByChainId(31337).name, 'Local Dev'); assert.ok(N.tokenNetworks().some((n) => n.chainId === 31337)); assert.equal(N.nativeSymbol(31337), 'LDV'); assert.equal(N.nativeSymbol(137), 'POL');
  N.setNetworkState(null); assert.equal(N.rpcUrl(31337), undefined); assert.equal(N.networkByChainId(31337), undefined);
});
test('shipped EVM chains are reserved; legacy duplicate rows become RPC overrides; other registry chains can be added as custom', () => {
  assert.equal(N.isBuiltinChain(1), true, 'Ethereum is shipped');
  assert.equal(N.validateNetwork({ ...good, chainId: '1' }, []).ok, false);
  N.setNetworkState({ custom: [{ chainId: 1, name: 'Duplicate Ethereum', rpcUrl: 'https://saved.example/rpc', symbol: 'ETH', addedAt: 1 }], rpcOverrides: {} });
  assert.deepEqual(N.customNetworks(), []);
  assert.equal(N.rpcOverride(1), 'https://saved.example/rpc');
  // A chain wallet-core knows but this build does not ship (Callisto) is not built in: chainlist/site adds must persist.
  assert.equal(N.isBuiltinChain(820), false);
  assert.equal(N.validateNetwork({ ...good, chainId: '820' }, []).ok, true);
  N.setNetworkState({ custom: [{ chainId: 820, name: 'Callisto', rpcUrl: 'https://clo.example/rpc', symbol: 'CLO', addedAt: 1 }], rpcOverrides: {} });
  assert.equal(N.customNetworks().length, 1);
  N.setNetworkState(null);
});
