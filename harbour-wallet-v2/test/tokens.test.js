import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './erc20'; export * from './customTokens'; export * from './sendService'; export * from './tokenPrice'; export { encodeAbiParameters, getAddress } from 'viem';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' },
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const TOKEN = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const OWNER = '0x7e80c8405dc2d4fc45c1a9220842620f24ff0e75';
const SEL = { name: '0x06fdde03', symbol: '0x95d89b41', decimals: '0x313ce567', balanceOf: '0x70a08231' };
const str = (v) => M.encodeAbiParameters([{ type: 'string' }], [v]);

// Mock JSON-RPC node. `contracts[addr]` = { name, symbol, decimals, balance, bytes32 }, `code` decides eth_getCode.
function node({ code = {}, contracts = {}, balance = 10n ** 18n, gas = 50_000n, gasPrice = 1_000_000_000n, fail = false, estimateFails = false } = {}) {
  const calls = [];
  const request = async ({ method, params }) => {
    calls.push(method);
    if (fail) throw new Error('HTTP request failed: fetch failed');
    if (method === 'eth_getCode') return code[params[0].toLowerCase()] ?? '0x';
    if (method === 'eth_call') {
      const { to, data } = params[0]; const c = contracts[to.toLowerCase()];
      if (!c) return '0x';
      const sel = data.slice(0, 10);
      if (sel === SEL.name) return c.bytes32 ? c.bytes32.name : c.name === undefined ? '0x' : str(c.name);
      if (sel === SEL.symbol) return c.bytes32 ? c.bytes32.symbol : c.symbol === undefined ? '0x' : str(c.symbol);
      if (sel === SEL.decimals) return c.decimals === undefined ? '0x' : M.encodeAbiParameters([{ type: 'uint8' }], [c.decimals]);
      if (sel === SEL.balanceOf) return M.encodeAbiParameters([{ type: 'uint256' }], [c.balance ?? 0n]);
    }
    if (method === 'eth_getBalance') return '0x' + balance.toString(16);
    if (method === 'eth_estimateGas') { if (estimateFails) throw new Error('execution reverted'); return '0x' + gas.toString(16); }
    if (method === 'eth_gasPrice') return '0x' + gasPrice.toString(16);
    if (method === 'eth_chainId') return '0x1';
    throw new Error('unmocked ' + method);
  };
  return { client: M.clientFromRequest(request), calls };
}
const asBytes32 = (s) => '0x' + Buffer.from(s).toString('hex').padEnd(64, '0');

test('valid ERC-20: reads name/symbol/decimals and returns the checksummed address (TW selectors 06fdde03/95d89b41/313ce567)', async () => {
  const { client } = node({ code: { [TOKEN.toLowerCase()]: '0x6080' }, contracts: { [TOKEN.toLowerCase()]: { name: 'Test Token', symbol: 'TST', decimals: 6 } } });
  const r = await M.probeToken(client, TOKEN.toLowerCase());
  assert.equal(r.ok, true);
  assert.deepEqual(r.token, { address: TOKEN, name: 'Test Token', symbol: 'TST', decimals: 6 });
});

test('address with no contract (HAR: eth_call answered "0x") is NOT_A_CONTRACT, never a token', async () => {
  const { client } = node({});
  const r = await M.probeToken(client, TOKEN);
  assert.equal(r.ok, false); assert.equal(r.code, 'NOT_A_CONTRACT');
});

test('a contract whose calls return "0x" (not ERC-20) is NOT_A_TOKEN', async () => {
  const { client } = node({ code: { [TOKEN.toLowerCase()]: '0x6080' }, contracts: {} });
  const r = await M.probeToken(client, TOKEN);
  assert.equal(r.ok, false); assert.equal(r.code, 'NOT_A_TOKEN');
});

test('bytes32 name/symbol (MKR style) is accepted as a fallback', async () => {
  const { client } = node({ code: { [TOKEN.toLowerCase()]: '0x60' }, contracts: { [TOKEN.toLowerCase()]: { bytes32: { name: asBytes32('Maker'), symbol: asBytes32('MKR') }, decimals: 18 } } });
  const r = await M.probeToken(client, TOKEN);
  assert.equal(r.ok, true); assert.equal(r.token.name, 'Maker'); assert.equal(r.token.symbol, 'MKR');
});

test('a dead node is NETWORK_ERROR, not "not a token"', async () => {
  const { client } = node({ fail: true });
  const r = await M.probeToken(client, TOKEN);
  assert.equal(r.ok, false); assert.equal(r.code, 'NETWORK_ERROR');
});

test('bad input: invalid address, unsupported network, absurd decimals', async () => {
  assert.equal((await M.probeToken(null, 'not an address')).code, 'INVALID_ADDRESS');
  assert.equal((await M.probeToken(null, TOKEN)).code, 'UNSUPPORTED_NETWORK');
  const { client } = node({ code: { [TOKEN.toLowerCase()]: '0x60' }, contracts: { [TOKEN.toLowerCase()]: { name: 'X', symbol: 'X', decimals: 255 } } });
  assert.equal((await M.probeToken(client, TOKEN)).code, 'NOT_A_TOKEN');
});

test('hostile metadata is cleaned: bidi/control characters stripped, length capped', async () => {
  const evil = 'Safe‮Coin\u0000​' + 'x'.repeat(200);
  const { client } = node({ code: { [TOKEN.toLowerCase()]: '0x60' }, contracts: { [TOKEN.toLowerCase()]: { name: evil, symbol: ' U\nSDT ', decimals: 6 } } });
  const r = await M.probeToken(client, TOKEN);
  assert.equal(r.ok, true);
  assert.ok(!/[‮\u0000​]/.test(r.token.name)); assert.ok(r.token.name.length <= 64); assert.equal(r.token.symbol, 'USDT');
});

test('token amounts are exact base units (no float rounding) and reject over-precision / zero / junk', () => {
  assert.equal(M.parseTokenAmount('1.5', 6), 1_500_000n);
  assert.equal(M.parseTokenAmount('0.000001', 6), 1n);
  assert.equal(M.parseTokenAmount('123456789.123456789', 18), 123456789123456789000000000n);
  assert.equal(M.parseTokenAmount('7', 0), 7n);
  for (const bad of ['', '.', '0', '0.0', '-1', '1e3', 'abc', '1.2.3']) assert.throws(() => M.parseTokenAmount(bad, 6), /Enter a valid amount/);
  assert.throws(() => M.parseTokenAmount('1.0000001', 6), /at most 6 decimal/);
  assert.equal(M.formatTokenAmount(1_500_000n, 6), '1.5');
});

test('transfer calldata is the ERC-20 transfer(address,uint256) selector a9059cbb', () => {
  const data = M.encodeTransfer(OWNER, 1_500_000n);
  assert.ok(data.startsWith('0xa9059cbb'));
  assert.equal(data.length, 2 + 8 + 64 + 64);
  assert.ok(data.endsWith((1_500_000n).toString(16).padStart(64, '0')));
});

test('sanitizeToken validates network/address/metadata and builds a stable id', () => {
  const ok = M.sanitizeToken({ chainId: 1, address: TOKEN.toLowerCase(), name: 'Test', symbol: 'TST', decimals: 6 }, 123);
  assert.equal(ok.ok, true); assert.equal(ok.token.id, `1_t${TOKEN.toLowerCase()}`); assert.equal(ok.token.address, TOKEN); assert.equal(ok.token.networkId, 'ethereum'); assert.equal(ok.token.manual, false);
  assert.equal(M.sanitizeToken({ chainId: 999999, address: TOKEN, name: 'a', symbol: 'a', decimals: 1 }).ok, false);
  assert.equal(M.sanitizeToken({ chainId: 1, address: '0x123', name: 'a', symbol: 'a', decimals: 1 }).ok, false);
  assert.equal(M.sanitizeToken({ chainId: 1, address: TOKEN, name: '', symbol: 'a', decimals: 1 }).ok, false);
  assert.equal(M.sanitizeToken({ chainId: 1, address: TOKEN, name: 'a', symbol: '', decimals: 1 }).ok, false);
  for (const d of [-1, 1.5, 33, 'x', NaN]) assert.equal(M.sanitizeToken({ chainId: 1, address: TOKEN, name: 'a', symbol: 'a', decimals: d }).ok, false, `decimals ${d}`);
  assert.equal(M.sanitizeToken({ chainId: 1, address: TOKEN, name: 'a', symbol: 'a', decimals: 32 }).ok, true);
});

test('upsert is idempotent per network+address, same address on another chain is a different token, list is capped', () => {
  const mk = (chainId, address = TOKEN) => M.sanitizeToken({ chainId, address, name: 'T', symbol: 'T', decimals: 6 }).token;
  let r = M.upsertToken([], mk(1)); assert.equal(r.existed, false);
  r = M.upsertToken(r.list, mk(1)); assert.equal(r.existed, true); assert.equal(r.list.length, 1);
  r = M.upsertToken(r.list, mk(56)); assert.equal(r.list.length, 2);
  assert.equal(M.removeToken(r.list, mk(1).id).length, 1);
  let big = [];
  for (let i = 0; i < M.MAX_TOKENS; i++) big = M.upsertToken(big, mk(1, '0x' + i.toString(16).padStart(40, '0'))).list;
  assert.ok('error' in M.upsertToken(big, mk(56, '0x' + 'f'.repeat(40))));
  assert.equal(M.readTokens('garbage').length, 0);
});

test('estimateSend (ERC-20): fee, balances, contract-recipient warning, low-gas detection', async () => {
  const contracts = { [TOKEN.toLowerCase()]: { name: 'T', symbol: 'T', decimals: 6, balance: 5_000_000n } };
  const to = '0x' + '22'.repeat(20);
  const good = node({ contracts, balance: 10n ** 16n, gas: 60_000n, gasPrice: 2_000_000_000n });
  const e = await M.estimateSend(good.client, { from: OWNER, to, amount: '1.5', token: { address: TOKEN, decimals: 6 } });
  assert.equal(e.feeWei, String(60_000n * 2_000_000_000n)); assert.equal(e.tokenBalance, '5000000');
  assert.equal(e.enoughGas, true); assert.equal(e.enoughBalance, true); assert.equal(e.recipientIsContract, false);
  const tooMuch = await M.estimateSend(good.client, { from: OWNER, to, amount: '9', token: { address: TOKEN, decimals: 6 } });
  assert.equal(tooMuch.enoughBalance, false);
  const noGas = node({ contracts, balance: 1n, gas: 60_000n });
  assert.equal((await M.estimateSend(noGas.client, { from: OWNER, to, amount: '1', token: { address: TOKEN, decimals: 6 } })).enoughGas, false);
  const toContract = node({ contracts, code: { [to.toLowerCase()]: '0x6080' } });
  assert.equal((await M.estimateSend(toContract.client, { from: OWNER, to, amount: '1', token: { address: TOKEN, decimals: 6 } })).recipientIsContract, true);
});

test('estimateSend (native): amount + fee must fit the balance; Max leaves fee headroom; revert surfaces a reason', async () => {
  const to = '0x' + '33'.repeat(20);
  const n = node({ balance: 10n ** 18n, gas: 21_000n, gasPrice: 10n ** 9n });
  const e = await M.estimateSend(n.client, { from: OWNER, to, amount: '0.5' });
  assert.equal(e.enoughGas, true);
  assert.ok(BigInt(e.maxNativeWei) < 10n ** 18n && BigInt(e.maxNativeWei) > 10n ** 18n - 21_000n * 10n ** 9n * 2n);
  assert.equal((await M.estimateSend(n.client, { from: OWNER, to, amount: '1' })).enoughGas, false); // 1 ETH + fee > 1 ETH
  const reverts = node({ estimateFails: true });
  const r = await M.estimateSend(reverts.client, { from: OWNER, to, amount: '0.1' });
  assert.match(r.error, /revert/);
  await assert.rejects(M.estimateSend(n.client, { from: OWNER, to: 'nope', amount: '1' }), /Invalid recipient/);
});

test('buildTransfer: native => value tx, token => calldata tx to the token contract', () => {
  const to = '0x' + '44'.repeat(20);
  const nat = M.buildTransfer({ from: OWNER, to, amount: '0.25' });
  assert.equal(nat.value, 250000000000000000n); assert.equal(nat.data, undefined);
  const tok = M.buildTransfer({ from: OWNER, to, amount: '2', token: { address: TOKEN, decimals: 6 } });
  assert.equal(tok.to, TOKEN); assert.ok(tok.data.startsWith('0xa9059cbb')); assert.equal(tok.value, undefined);
  assert.throws(() => M.buildTransfer({ from: OWNER, to: '0x12', amount: '1' }), /Invalid recipient/);
  assert.throws(() => M.buildTransfer({ from: OWNER, to, amount: '0' }), /Enter a valid amount/);
});

test('fetchTokenPrices maps CoinGecko contract prices, ignores failures and unknown chains', async () => {
  const seen = [];
  const f = async (url) => {
    seen.push(url);
    if (url.includes('/ethereum?')) return { ok: true, json: async () => ({ [TOKEN.toLowerCase()]: { usd: 1.01, usd_24h_change: -0.5 } }) };
    return { ok: false, json: async () => ({}) };
  };
  const p = await M.fetchTokenPrices([{ chainId: 1, address: TOKEN }, { chainId: 56, address: TOKEN }, { chainId: 11155111, address: TOKEN }], f);
  assert.deepEqual(p[`1_t${TOKEN.toLowerCase()}`], { price: 1.01, change: -0.5 });
  assert.equal(Object.keys(p).length, 1);
  assert.ok(seen.every((u) => u.startsWith('https://api.coingecko.com/api/v3/simple/token_price/')));
  assert.equal(seen.length, 2); // testnet has no platform => never queried
  assert.deepEqual(await M.fetchTokenPrices([{ chainId: 1, address: TOKEN }], async () => { throw new Error('offline'); }), {});
});
