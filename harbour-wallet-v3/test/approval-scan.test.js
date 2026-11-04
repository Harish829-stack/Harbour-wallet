import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// Testnet approval scan: allowances are read on chain for known (token, spender) pairs through batched Multicall3 calls.
const bundle = async (contents) => {
  const out = await build({ stdin: { contents, resolveDir: fileURLToPath(new URL('../src/core/', import.meta.url)), sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const M = await bundle(`export * from './approvalScan'; export { APPROVAL_CHAINS, APPROVAL_UNSUPPORTED, GOPLUS_CHAINS } from './approvals';
import { decodeFunctionData, encodeFunctionResult, encodeAbiParameters, parseAbi, erc20Abi } from 'viem'; export { decodeFunctionData, encodeFunctionResult, encodeAbiParameters, parseAbi, erc20Abi };`);
const { decodeFunctionData, encodeFunctionResult, parseAbi, erc20Abi } = M;
const mcAbi = parseAbi(['struct Call3 { address target; bool allowFailure; bytes callData; }', 'struct Result { bool success; bytes returnData; }', 'function aggregate3(Call3[] calls) payable returns (Result[] returnData)']);

const OWNER = '0x' + '1'.repeat(40);
const A = (n) => '0x' + String(n).repeat(40);
const TOKEN_USDC = A('a'), TOKEN_USDT = A('b'), TOKEN_ODD = A('c'), TOKEN_LEDGER = A('d');
const POOL = A('e'), ROUTER = A('f'), DRAINER = A('9');
const MAXU = (1n << 256n) - 1n;

// A fake chain: allowances[`token:spender`] -> bigint; tokens listed in `broken` revert; metadata for symbol/name/decimals.
function fakeChain({ allowances = {}, broken = [], meta = {} } = {}) {
  const calls = { requests: 0, subcalls: 0 };
  const f = async (_url, init) => {
    const body = JSON.parse(init.body); calls.requests++;
    assert.equal(body.method, 'eth_call'); assert.equal(body.params[0].to.toLowerCase(), '0xca11bde05977b3631167028862be2a173976ca11');
    const { args: [list] } = decodeFunctionData({ abi: mcAbi, data: body.params[0].data });
    const results = list.map((c) => {
      calls.subcalls++;
      const t = c.target.toLowerCase(); if (broken.includes(t)) return { success: false, returnData: '0x' };
      const d = decodeFunctionData({ abi: erc20Abi, data: c.callData });
      if (d.functionName === 'allowance') { const v = allowances[`${t}:${d.args[1].toLowerCase()}`] ?? 0n; return { success: true, returnData: encodeFunctionResult({ abi: erc20Abi, functionName: 'allowance', result: v }) }; }
      const m = meta[t]; if (!m) return { success: false, returnData: '0x' };
      return { success: true, returnData: encodeFunctionResult({ abi: erc20Abi, functionName: d.functionName, result: m[d.functionName] }) };
    });
    const out = encodeFunctionResult({ abi: mcAbi, functionName: 'aggregate3', result: [results] });
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result: out }) };
  };
  return { f, calls };
}
const base = { owner: OWNER, chainId: 'base-sepolia', rpcUrls: ['http://rpc.test'], ledger: [] };
const spenders = [{ address: POOL, name: 'Aave V3 Pool' }, { address: ROUTER, name: 'Uniswap router' }];

test('only Sepolia and Base Sepolia are scannable; other networks are refused with the standard message', () => {
  assert.deepEqual(Object.keys(M.APPROVAL_CHAINS).sort(), ['base-sepolia', 'sepolia']);
  assert.equal(M.APPROVAL_UNSUPPORTED, "Approval scanning isn't available on this network.");
  assert.deepEqual(M.pickScanChains(M.APPROVAL_CHAINS), { ids: ['sepolia', 'base-sepolia'] });
  assert.deepEqual(M.pickScanChains(M.APPROVAL_CHAINS, ['base-sepolia', 'ethereum']), { ids: ['base-sepolia'] });
  for (const bad of [['ethereum'], 'polygon', [], ['solana'], [42]]) { const r = M.pickScanChains(M.APPROVAL_CHAINS, bad); assert.equal(r.code, 'unsupported_network'); assert.equal(r.error, M.APPROVAL_UNSUPPORTED); }
  assert.ok(M.GOPLUS_CHAINS.ethereum, 'mainnet map kept for later, but not scanned');
});

test('added tokens are checked against every known spender in ONE batched call; only live allowances are listed', async () => {
  const chain = fakeChain({ allowances: { [`${TOKEN_USDC}:${POOL}`]: MAXU, [`${TOKEN_USDT}:${ROUTER}`]: 5_000_000n } });
  const r = await M.scanOnChain({ ...base, fetcher: chain.f, spenders, tokens: [{ address: TOKEN_USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6 }, { address: TOKEN_USDT, symbol: 'USDT', name: 'Tether', decimals: 6 }] });
  assert.equal(chain.calls.requests, 1, 'one RPC request for 2 tokens x 2 spenders');
  assert.equal(chain.calls.subcalls, 4);
  assert.deepEqual(r.items.map((i) => [i.symbol, i.spenderName, i.unlimited, i.formatted]), [['USDC', 'Aave V3 Pool', true, 'Unlimited'], ['USDT', 'Uniswap router', false, '5']]);
  assert.deepEqual(r.coverage, { chainId: 'base-sepolia', tokens: 2, spenders: 2, pairs: 4, ledger: 0, unreadable: 0, truncated: false });
});

test('a zero allowance is never listed (revoked or spent), and nothing is invented for unknown pairs', async () => {
  const chain = fakeChain({ allowances: { [`${TOKEN_USDC}:${POOL}`]: 0n } });
  const r = await M.scanOnChain({ ...base, fetcher: chain.f, spenders, tokens: [{ address: TOKEN_USDC, symbol: 'USDC', decimals: 6 }] });
  assert.equal(r.items.length, 0);
});

test('ledger pairs are scanned even when the token was never added; unknown spender keeps its label; metadata read only for hits', async () => {
  const chain = fakeChain({ allowances: { [`${TOKEN_LEDGER}:${DRAINER}`]: 123n }, meta: { [TOKEN_LEDGER]: { symbol: 'AWETH', name: 'Aave WETH', decimals: 18 } } });
  const r = await M.scanOnChain({ ...base, fetcher: chain.f, spenders: [], tokens: [], ledger: [{ token: TOKEN_LEDGER, spender: DRAINER, label: 'claim.example.xyz', at: 7 }] });
  assert.equal(r.items.length, 1);
  assert.deepEqual([r.items[0].symbol, r.items[0].name, r.items[0].spenderName, r.items[0].approvedAt, r.items[0].formatted], ['AWETH', 'Aave WETH', 'claim.example.xyz', 7, '0.000000000000000123']);
  assert.equal(chain.calls.requests, 2, 'allowance batch + one metadata batch');
});

test('a ledger entry whose allowance is zero is reported as settled so it can be forgotten', async () => {
  const chain = fakeChain({});
  const r = await M.scanOnChain({ ...base, fetcher: chain.f, spenders: [], tokens: [], ledger: [{ token: TOKEN_LEDGER, spender: DRAINER }] });
  assert.equal(r.items.length, 0); assert.equal(r.settled.length, 1); assert.equal(r.settled[0].spender, DRAINER);
});

test('tokens whose allowance() reverts are counted as unreadable, not guessed', async () => {
  const chain = fakeChain({ broken: [TOKEN_ODD], allowances: { [`${TOKEN_USDC}:${POOL}`]: 1n } });
  const r = await M.scanOnChain({ ...base, fetcher: chain.f, spenders: [spenders[0]], tokens: [{ address: TOKEN_USDC, symbol: 'USDC', decimals: 6 }, { address: TOKEN_ODD, symbol: 'ODD', decimals: 18 }] });
  assert.equal(r.items.length, 1); assert.equal(r.coverage.unreadable, 1);
});

test('pairs are de-duplicated and the scan is capped (a big token list cannot make unbounded RPC traffic)', async () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ address: '0x' + (i + 1).toString(16).padStart(40, '0') }));
  const sp = Array.from({ length: 20 }, (_, i) => ({ address: '0x' + (i + 1000).toString(16).padStart(40, '0'), name: 'S' + i }));
  const chain = fakeChain({});
  const r = await M.scanOnChain({ ...base, fetcher: chain.f, spenders: sp, tokens: [...many, ...many] });
  assert.equal(r.coverage.tokens, 100); assert.equal(r.coverage.pairs, M.MAX_SCAN_PAIRS); assert.equal(r.coverage.truncated, true);
  assert.equal(chain.calls.requests, M.MAX_SCAN_PAIRS / 100, 'at most 8 RPC requests per chain');
});

test('readAllowance re-reads the live value (used right before a revoke)', async () => {
  const chain = fakeChain({ allowances: { [`${TOKEN_USDC}:${POOL}`]: 42n } });
  assert.equal(await M.readAllowance(['http://rpc.test'], TOKEN_USDC, OWNER, POOL, chain.f), 42n);
  assert.equal(await M.readAllowance(['http://rpc.test'], TOKEN_USDC, OWNER, ROUTER, chain.f), 0n);
  assert.equal(await M.readAllowance(['http://rpc.test'], TOKEN_ODD, OWNER, POOL, fakeChain({ broken: [TOKEN_ODD] }).f), null);
});

test('the coverage text says what was checked (an empty list is never "you have none")', () => {
  const name = (id) => ({ sepolia: 'Sepolia', 'base-sepolia': 'Base Sepolia' })[id] ?? id;
  const c = (chainId, tokens, spenders, ledger, unreadable) => ({ chainId, tokens, spenders, pairs: tokens * spenders, ledger, unreadable, truncated: false });
  assert.equal(M.coverageSummary({ coverage: [c('base-sepolia', 1, 3, 0, 0)] }, name),
    'Base Sepolia: 1 token checked against 3 known contracts. Approvals to other contracts for tokens you have not added are not listed yet.');
  const two = M.coverageSummary({ coverage: [c('sepolia', 5, 5, 2, 1), c('base-sepolia', 4, 3, 1, 0)] }, name);
  assert.match(two, /Sepolia: 5 tokens checked against 5 known contracts, plus 2 approvals made from this wallet\./);
  assert.match(two, /Base Sepolia: 4 tokens checked against 3 known contracts, plus 1 approval made from this wallet\./);
  assert.match(two, /1 could not be read\./);
  assert.equal(M.coverageSummary({ supported: ['sepolia', 'base-sepolia'] }, name), 'Scanned Sepolia and Base Sepolia.');
});

test('wiring: handler refuses unsupported networks, records Swap/Earn approvals in the ledger, and re-checks before revoke', () => {
  const h = readFileSync(new URL('../src/background/handlers/approvals.ts', import.meta.url), 'utf8');
  assert.match(h, /pickScanChains\(APPROVAL_CHAINS, msg\.chainIds \?\? msg\.chainId\)/);
  assert.match(h, /readAllowance\(getRpcUrls\(chain\), msg\.token, owner, msg\.spender\)/);
  assert.match(h, /alreadyRevoked/);
  const d = readFileSync(new URL('../src/background/handlers/testnetDefi.ts', import.meta.url), 'utf8');
  assert.match(d, /decodeCalldata\(call\.data\)[\s\S]{0,400}perms\.trackApproval\(\{[^}]*source: kind/);
  const ui = readFileSync(new URL('../src/popup/wallet/features/approvals.tsx', import.meta.url), 'utf8');
  assert.match(ui, /approval-coverage/); assert.match(ui, /isn't available on other networks/);
});
