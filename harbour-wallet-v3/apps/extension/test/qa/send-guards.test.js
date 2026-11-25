// QA: popup send (sendQuote → sendSubmit) through the REAL worker against an in-process fake of the Harbour API (device registration,
// /v1/rpc/<chain> JSON-RPC, /v1/tx/<chain>/broadcast). The broadcast raw transaction is decoded and checked independently with
// @ethereumjs/tx: who signed it, for which chain, nonce, recipient and value — never what the request asked for.
// TEST_PLAN: T-SIG-049, T-SIG-050.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionFactory } from '@ethereumjs/tx';
import { keccak256 } from 'viem';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`import './background/index'; // send-guards`);
const { F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const ADDR0 = '0x9858effd232b4033e47d90003d41ec34ecaeda94';
const OTHER = '0x58a57ed9d8d624cbd12e2c467d34787555bb1b25';
const DEAD = '0x000000000000000000000000000000000000dead';

const chain = { latestNonce: 3, pendingNonce: 5, balance: 10n ** 18n, baseFee: 1_000_000_000n, raws: [], rpc: [] };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
const hex = (n) => '0x' + BigInt(n).toString(16);
function rpcAnswer(r) {
  chain.rpc.push({ method: r?.method, params: r?.params });
  const res = { eth_chainId: hex(11155111), eth_blockNumber: '0x100', eth_getBalance: hex(chain.balance), eth_getCode: '0x', eth_call: '0x',
    eth_getTransactionCount: hex(r?.params?.[1] === 'pending' ? chain.pendingNonce : chain.latestNonce), eth_estimateGas: '0x5208', eth_gasPrice: hex(chain.baseFee * 2n), eth_maxPriorityFeePerGas: hex(1_000_000_000n),
    eth_getBlockByNumber: { number: '0x100', baseFeePerGas: hex(chain.baseFee), timestamp: '0x1', hash: '0x' + '22'.repeat(32), transactions: [] },
    eth_feeHistory: { oldestBlock: '0xfc', baseFeePerGas: Array(5).fill(hex(chain.baseFee)), gasUsedRatio: Array(4).fill(0.5), reward: Array(4).fill([hex(1e9), hex(1e9), hex(2e9)]) } }[r?.method];
  return { jsonrpc: '2.0', id: r?.id ?? 1, ...(res !== undefined ? { result: res } : { error: { code: -32601, message: 'method not found' } }) };
}
async function api(url, init) {
  const u = new URL(url); let body = null;
  try { const b = init?.body; body = b == null ? null : JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch { /* not json */ }
  if (u.pathname === '/v1/devices/challenge') return json({ challenge: 'qa', difficulty: 0 });
  if (u.pathname === '/v1/devices') return json({ device_id: 'qa-device' });
  if (/^\/v1\/rpc\//.test(u.pathname)) return json(Array.isArray(body) ? body.map(rpcAnswer) : rpcAnswer(body));
  const bc = u.pathname.match(/^\/v1\/tx\/([^/]+)\/broadcast$/);
  if (bc) { chain.raws.push({ chain: bc[1], raw: body.raw }); return json({ tx_hash: keccak256(body.raw), status: 'pending' }); }
  return json({ error: { code: 'not_found', message: 'not found' } }, 404);
}
const decode = (raw) => { const tx = TransactionFactory.fromSerializedData(Buffer.from(raw.slice(2), 'hex')); return { tx, from: tx.getSenderAddress().toString().toLowerCase(), chainId: Number(tx.common.chainId()), to: tx.to?.toString().toLowerCase(), value: tx.value, nonce: Number(tx.nonce), maxFee: tx.maxFeePerGas ?? tx.gasPrice }; };
async function quoteAndSubmit(q, s = {}) {
  const quote = await send({ type: 'sendQuote', ...q }); if (!quote.ok) return { quote };
  const sub = await send({ type: 'sendSubmit', ...q, planHash: quote.planHash, ...s }); return { quote, sub };
}

before(async () => { H.reset(); F.fetchImpl = api; assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true); });
beforeEach(() => { chain.raws.length = 0; chain.rpc.length = 0; chain.latestNonce = 3; chain.pendingNonce = 5; chain.baseFee = 1_000_000_000n; });

test('T-SIG-050: from, chain id and tx fields in the request are ignored: the signer is the active account and the chain id comes from the registry', async () => {
  const { quote, sub } = await quoteAndSubmit({ chainId: 'sepolia', to: DEAD, amount: '0.01', tier: 'average', from: OTHER, evmChainId: 1, chainIdHex: '0x1', tx: { chainId: 1, from: OTHER, to: OTHER, value: '0xde0b6b3a7640000' }, nonce: 0 });
  assert.equal(quote.from.toLowerCase(), ADDR0, 'quote is for the active account');
  assert.equal(sub.ok, true, JSON.stringify(sub));
  assert.equal(chain.raws.length, 1); assert.equal(chain.raws[0].chain, 'sepolia');
  const d = decode(chain.raws[0].raw);
  assert.equal(d.from, ADDR0); assert.equal(d.chainId, 11155111); assert.equal(d.to, DEAD); assert.equal(d.value, 10n ** 16n);
  assert.equal(sub.hash, keccak256(chain.raws[0].raw));
  // a chain id string that is not a registry id is refused (no fallback to a default chain)
  for (const chainId of ['1', '0xaa36a7', 'Sepolia ', 'sepolia​', 'custom-1']) {
    const r = await send({ type: 'sendSubmit', chainId, to: DEAD, amount: '0.01', tier: 'average', planHash: quote.planHash });
    assert.equal(r.ok, false, `${JSON.stringify(chainId)} refused: ${JSON.stringify(r)}`);
  }
  assert.equal(chain.raws.length, 1, 'nothing else broadcast');
});

test('T-SIG-049: nonce comes from the pending count (a gap between latest and pending never reuses a nonce)', async () => {
  const { sub } = await quoteAndSubmit({ chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average' });
  assert.equal(sub.ok, true, JSON.stringify(sub));
  assert.equal(decode(chain.raws[0].raw).nonce, 5);
  assert.ok(chain.rpc.some((c) => c.method === 'eth_getTransactionCount' && c.params?.[1] === 'pending'));
});

test('T-SIG-049: a changed plan, a risen fee, and malformed / zero / negative / over-precise amounts are refused before signing', async (t) => {
  const { quote } = await quoteAndSubmit({ chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average' }, { planHash: 'skip' });
  // reuse the reviewed plan for another amount / recipient
  for (const change of [{ amount: '0.002' }, { to: OTHER }, { tokenId: 'x' }, { memo: 'hi' }]) {
    const r = await send({ type: 'sendSubmit', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average', planHash: quote.planHash, ...change });
    assert.equal(r.ok, false, `${JSON.stringify(change)}: ${JSON.stringify(r)}`);
  }
  // fee jump: the fee cap the Confirm screen showed is below the current fee
  const q2 = await send({ type: 'sendQuote', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average' });
  chain.baseFee = 50_000_000_000n;
  const jump = await send({ type: 'sendSubmit', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average', planHash: q2.planHash, feeCap: '1000' });
  assert.equal(jump.ok, false); assert.match(jump.error, /network fee changed/);
  chain.baseFee = 1_000_000_000n;
  for (const amount of ['-1', 'abc', '0.0000000000000000001', '1e18', '0x10', '1,5', ' ', '∞']) {
    const r = await send({ type: 'sendSubmit', chainId: 'sepolia', to: DEAD, amount, tier: 'average', planHash: q2.planHash });
    assert.equal(r.ok, false, `amount ${JSON.stringify(amount)}: ${JSON.stringify(r)}`);
  }
  const insufficient = await quoteAndSubmit({ chainId: 'sepolia', to: DEAD, amount: '5', tier: 'average' });
  assert.ok(insufficient.quote.quote.issues.some((i) => i.code === 'insufficient-funds' && i.blocking));
  assert.equal(insufficient.sub.ok, false);
  assert.equal(chain.raws.length, 0, 'nothing broadcast');
  // zero amount: the Send screen disables Next (prepare.tsx haveAmount), but the worker must enforce it too (dumb-UI rule)
  const zero = await quoteAndSubmit({ chainId: 'sepolia', to: DEAD, amount: '0', tier: 'average' });
  const signedZero = zero.sub?.ok === true;
  if (signedZero) return assert.fail('BUG-15 regression (fixed bug reproduces again): ' + `sendSubmit with amount "0" was signed and broadcast (${zero.sub.hash}): the user pays a network fee for a transfer of nothing`);
  assert.equal(chain.raws.length, 0);
});

test('T-SIG-049: an unknown or missing fee tier falls back to "average" (documented), sending to yourself is allowed with a warning', async () => {
  const a = await quoteAndSubmit({ chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'turbo' });
  assert.equal(a.quote.tier, 'average'); assert.equal(a.sub.ok, true);
  const b = await quoteAndSubmit({ chainId: 'sepolia', to: DEAD, amount: '0.001' });
  assert.equal(b.quote.tier, 'average'); assert.equal(b.sub.ok, true);
  const self = await quoteAndSubmit({ chainId: 'sepolia', to: ADDR0, amount: '0.001', tier: 'average' });
  const w = self.quote.quote.issues.find((i) => i.code === 'self-send'); assert.ok(w && !w.blocking, 'self-send warning, not blocking');
  assert.equal(self.sub.ok, true);
  assert.equal(decode(chain.raws.at(-1).raw).to, ADDR0);
});
