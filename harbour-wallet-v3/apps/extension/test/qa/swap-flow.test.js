// QA: the LI.FI swap flow through the REAL worker messages (swapQuote → swapApprove → swapSubmit → swapStatus) against an in-process
// fake of the Harbour API: device registration, /v1/gw/lifi/v1 (routes, stepTransaction), /v1/rpc/ethereum (a tiny ERC-20 ledger:
// allowance follows the approvals actually broadcast) and /v1/tx/ethereum/broadcast. Every broadcast raw tx is decoded independently.
// TEST_PLAN: T-DEFI-001 (and T-DEFI-005 for the quote failure modes).
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionFactory } from '@ethereumjs/tx';
import { keccak256, decodeFunctionData, erc20Abi } from 'viem';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`import './background/index'; // swap-flow`);
const { F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const ME = '0x9858effd232b4033e47d90003d41ec34ecaeda94';
const ROUTER = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'; // LI.FI Diamond (allow-listed in core/swap/safety.ts)
const EVIL = '0x000000000000000000000000000000000000bad1';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const NATIVE = '0x0000000000000000000000000000000000000000';
const W = (h) => h.replace('0x', '').toLowerCase().padStart(64, '0');
const swapData = (receiver = ME, min = '29400000000000000') => '0x4630a0d8' + W('0x7') + W('0xc0') + W('0xc0') + W(receiver) + W(BigInt(min).toString(16)) + W('0xc0') + W('0x0');
const tok = (address, symbol, decimals) => ({ address, symbol, decimals, chainId: 1, name: symbol, priceUSD: '1' });
const lifiStep = (over = {}) => ({
  id: 'step-1', type: 'swap', tool: 'uniswap', toolDetails: { key: 'uniswap', name: 'Uniswap' },
  action: { fromToken: tok(USDC, 'USDC', 6), toToken: tok(NATIVE, 'ETH', 18), fromAmount: '100000000', fromAddress: ME, toAddress: ME, slippage: 0.02, ...(over.action ?? {}) },
  estimate: { toAmount: '30000000000000000', toAmountMin: '29400000000000000', approvalAddress: ROUTER, executionDuration: 30, feeCosts: [], gasCosts: [{ token: tok(NATIVE, 'ETH', 18), amount: '2000000000000000', amountUSD: '6' }], ...(over.estimate ?? {}) },
  transactionRequest: { from: ME, to: ROUTER, chainId: 1, data: swapData(), value: '0x0', ...(over.transactionRequest ?? {}) },
});

// ---------------------------------------------------------------- fake Harbour API + chain
const S = { allowance: 0n, nonce: 0, raws: [], lifi: [], quoteMode: 'ok', stepOver: {}, receipts: new Map(), txs: new Map() };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
const hex = (n) => '0x' + BigInt(n).toString(16);
function rpc(r) {
  const sel = String(r?.params?.[0]?.data ?? r?.params?.[0]?.input ?? '').slice(0, 10);
  const res = { eth_chainId: '0x1', eth_blockNumber: '0x100', eth_getBalance: hex(10n ** 18n), eth_getTransactionCount: hex(S.nonce), eth_estimateGas: hex(90_000), eth_gasPrice: hex(2e9), eth_maxPriorityFeePerGas: hex(1e9),
    eth_getCode: String(r?.params?.[0]).toLowerCase() === ROUTER.toLowerCase() ? '0x6080604052' : '0x',
    eth_call: sel === '0xdd62ed3e' ? '0x' + W(hex(S.allowance)) : sel === '0x70a08231' ? '0x' + W(hex(10n ** 12n)) : '0x',
    eth_getBlockByNumber: { number: '0x100', baseFeePerGas: hex(1e9), timestamp: '0x1', hash: '0x' + '33'.repeat(32), transactions: [], gasLimit: hex(3e7) },
    eth_feeHistory: { oldestBlock: '0xfc', baseFeePerGas: Array(5).fill(hex(1e9)), gasUsedRatio: Array(4).fill(0.5), reward: Array(4).fill([hex(1e9), hex(1e9), hex(2e9)]) },
    eth_getTransactionReceipt: S.receipts.get(String(r?.params?.[0]).toLowerCase()) ?? null, eth_getTransactionByHash: S.txs.get(String(r?.params?.[0]).toLowerCase()) ?? null }[r?.method];
  return { jsonrpc: '2.0', id: r?.id ?? 1, ...(res !== undefined ? { result: res } : { error: { code: -32601, message: `method not found: ${r?.method}` } }) };
}
function broadcast(raw) {
  const tx = TransactionFactory.fromSerializedData(Buffer.from(raw.slice(2), 'hex')); const hash = keccak256(raw);
  const d = { from: tx.getSenderAddress().toString().toLowerCase(), to: tx.to?.toString().toLowerCase(), data: '0x' + Buffer.from(tx.data).toString('hex'), value: tx.value, chainId: Number(tx.common.chainId()), nonce: Number(tx.nonce), hash };
  S.raws.push(d); S.nonce++;
  if (d.to === USDC.toLowerCase() && d.data.startsWith('0x095ea7b3')) S.allowance = decodeFunctionData({ abi: erc20Abi, data: d.data }).args[1];
  S.txs.set(hash, { hash, from: d.from, to: d.to, input: d.data, value: hex(d.value), nonce: hex(d.nonce), gas: hex(tx.gasLimit), blockNumber: '0x101', blockHash: '0x' + '44'.repeat(32), transactionIndex: '0x0', type: '0x2', chainId: '0x1', maxFeePerGas: hex(tx.maxFeePerGas ?? 0n), maxPriorityFeePerGas: hex(tx.maxPriorityFeePerGas ?? 0n), v: '0x0', r: '0x1', s: '0x1', yParity: '0x0', accessList: [] });
  S.receipts.set(hash, { transactionHash: hash, status: '0x1', blockNumber: '0x101', blockHash: '0x' + '44'.repeat(32), gasUsed: hex(60000), effectiveGasPrice: hex(2e9), cumulativeGasUsed: hex(60000), logs: [], from: d.from, to: d.to, transactionIndex: '0x0', type: '0x2', contractAddress: null, logsBloom: '0x' + '0'.repeat(512) });
  return hash;
}
async function api(url, init) {
  const u = new URL(url); let body = null;
  try { const b = init?.body; body = b == null ? null : JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch { /* not json */ }
  if (u.pathname === '/v1/devices/challenge') return json({ challenge: 'qa', difficulty: 0 });
  if (u.pathname === '/v1/devices') return json({ device_id: 'qa-device' });
  if (u.pathname.startsWith('/v1/rpc/')) return json(Array.isArray(body) ? body.map(rpc) : rpc(body));
  const bc = u.pathname.match(/^\/v1\/tx\/([^/]+)\/broadcast$/); if (bc) { const h = broadcast(body.raw); return json({ tx_hash: h, status: 'pending' }); }
  if (u.pathname.startsWith('/v1/gw/lifi/v1/')) {
    const p = u.pathname.slice('/v1/gw/lifi/v1'.length); S.lifi.push({ p, body });
    if (p === '/advanced/routes') {
      if (S.quoteMode === '429') return json({ message: 'Too many requests' }, 429);
      if (S.quoteMode === '500') return json({ message: 'internal' }, 500);
      if (S.quoteMode === 'none') return json({ routes: [] });
      return json({ routes: [{ id: 'r1', fromAmountUSD: '100', toAmountUSD: '95', steps: [lifiStep()] }] });
    }
    if (p === '/advanced/stepTransaction') return json(lifiStep(S.stepOver));
  }
  return json({ error: { code: 'not_found', message: 'not found' } }, 404);
}
const ASSET = { usdc: { assetId: `c60_t${USDC}`, domainId: 'ethereum', address: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6 }, eth: { assetId: 'c60', domainId: 'ethereum', address: 'native', symbol: 'ETH', name: 'Ether', decimals: 18 } };
const quote = () => send({ type: 'swapQuote', from: ASSET.usdc, to: ASSET.eth, amount: '100000000', slippage: '2' });

before(async () => { H.reset(); F.fetchImpl = api; assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true); });
beforeEach(() => { S.allowance = 0n; S.raws.length = 0; S.lifi.length = 0; S.quoteMode = 'ok'; S.stepOver = {}; });

test('T-DEFI-001: quote → approve (exact amount, to the LI.FI Diamond) → submit (validated, to the Diamond, paying us) → status success', async () => {
  const q = await quote(); assert.equal(q.ok, true, JSON.stringify(q));
  const route = q.result.routes.find((r) => r.source === 'lifi'); assert.ok(route, 'LI.FI route');
  const routesReq = S.lifi.find((x) => x.p === '/advanced/routes').body;
  assert.equal(routesReq.fromAddress.toLowerCase(), ME); assert.equal(routesReq.toAddress.toLowerCase(), ME); assert.equal(routesReq.fromAmount, '100000000');
  assert.equal(route.steps[0].approval.needed, true, 'allowance read on chain: approval needed');
  const ap = await send({ type: 'swapApprove', route, stepIndex: 0, unlimited: false }); assert.equal(ap.ok, true, JSON.stringify(ap));
  assert.equal(S.raws.length, 1); const a = S.raws[0];
  assert.equal(a.from, ME); assert.equal(a.chainId, 1); assert.equal(a.to, USDC.toLowerCase()); assert.equal(a.value, 0n);
  const args = decodeFunctionData({ abi: erc20Abi, data: a.data }); assert.equal(args.functionName, 'approve');
  assert.equal(args.args[0].toLowerCase(), ROUTER.toLowerCase()); assert.equal(args.args[1], 100_000_000n, 'exact amount, not unlimited');
  const sub = await send({ type: 'swapSubmit', route, stepIndex: 0, id: ap.id }); assert.equal(sub.ok, true, JSON.stringify(sub));
  assert.equal(S.raws.length, 2); const s = S.raws[1];
  assert.equal(s.to, ROUTER.toLowerCase()); assert.equal(s.from, ME); assert.equal(s.value, 0n); assert.equal(s.data, swapData().toLowerCase()); assert.equal(sub.hash, s.hash);
  assert.ok(S.lifi.some((x) => x.p === '/advanced/stepTransaction'), 'fresh step transaction requested right before signing');
  const st = await send({ type: 'swapStatus', id: sub.id }); assert.equal(st.ok, true); assert.equal(st.item.status, 'success', JSON.stringify(st.item));
  assert.equal(st.item.txHash, s.hash);
  // an approval is skipped when the allowance already covers the amount
  const again = await send({ type: 'swapApprove', route, stepIndex: 0, unlimited: false }); assert.equal(again.skipped, true); assert.equal(S.raws.length, 2);
});

test('T-DEFI-001: unlimited approval only when asked; a stepTransaction that pays someone else, targets another contract or changes the amount is refused unsigned', async () => {
  const route = (await quote()).result.routes.find((r) => r.source === 'lifi');
  assert.equal((await send({ type: 'swapApprove', route, stepIndex: 0, unlimited: true })).ok, true);
  assert.equal(decodeFunctionData({ abi: erc20Abi, data: S.raws[0].data }).args[1], 2n ** 256n - 1n);
  const n = S.raws.length;
  for (const over of [{ transactionRequest: { data: swapData(EVIL) } }, { transactionRequest: { to: EVIL } }, { action: { fromAmount: '200000000' } }, { transactionRequest: { chainId: 56 } }, { transactionRequest: { value: '0x1' } }, { estimate: { toAmountMin: '1000' } }]) {
    S.stepOver = over;
    const r = await send({ type: 'swapSubmit', route, stepIndex: 0 });
    assert.equal(r.ok, false, `${JSON.stringify(over)}: ${JSON.stringify(r)}`);
  }
  assert.equal(S.raws.length, n, 'nothing signed or broadcast');
  // a quote whose spender is not the Diamond is refused at approval
  const forged = structuredClone(route); forged.steps[0].approval.spender = EVIL; forged.steps[0].raw.estimate.approvalAddress = EVIL;
  const fa = await send({ type: 'swapApprove', route: forged, stepIndex: 0 }); assert.equal(fa.ok, false); assert.equal(S.raws.length, n);
  // a multi-step or tampered route shape is refused
  const two = structuredClone(route); two.steps.push(two.steps[0]);
  assert.equal((await send({ type: 'swapSubmit', route: two, stepIndex: 0 })).ok, false);
  const expired = structuredClone(route); expired.expiresAt = Date.now() - 10 * 60_000;
  assert.equal((await send({ type: 'swapSubmit', route: expired, stepIndex: 0 })).ok, false);
  assert.equal(S.raws.length, n);
});

test('T-DEFI-005: quote API 429 / 500 / no routes → a plain error code, no stale quote and nothing signed', async () => {
  for (const mode of ['429', '500', 'none']) {
    S.quoteMode = mode; const r = await quote();
    assert.equal(r.ok, false, `${mode}: ${JSON.stringify(r).slice(0, 200)}`);
    assert.equal(typeof r.error, 'string'); assert.doesNotMatch(r.error, /TypeError|at \S+:\d+/);
    assert.ok(!r.result, 'no stale routes returned');
  }
  assert.equal(S.raws.length, 0);
});
