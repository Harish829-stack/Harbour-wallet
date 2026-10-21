import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Bundle the pure swap core (no chrome.* / network at import time) into one in-memory ESM module.
const entry = fileURLToPath(new URL('../src/core/swap/index.test-entry.ts', import.meta.url));
const out = await build({
  stdin: {
    contents: `
      export * from './rules'; export * from './amount'; export * from './errors'; export * from './safety';
      export * from './lifi'; export * from './jupiter'; export * from './tokens'; export * from './domains'; export * from './engine';`,
    resolveDir: fileURLToPath(new URL('../src/core/swap/', import.meta.url)), sourcefile: entry, loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('bundled swap logos require native identity or an exact curated contract', () => {
  assert.equal(M.knownLogoSymbol(M.nativeAsset('ethereum')), 'ETH');
  assert.equal(M.knownLogoSymbol(M.nativeAsset('polygon')), 'POL');
  assert.equal(M.knownLogoSymbol(M.makeToken('ethereum', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', 'USD Coin', 6)), 'USDC');
  assert.equal(M.knownLogoSymbol(M.makeToken('ethereum', '0x0000000000000000000000000000000000000001', 'USDC', 'Unverified', 6)), null);
});

// ---------------- rules ----------------
test('price impact severity uses TW thresholds (5 moderate / 20 severe) unless the server overrides', () => {
  assert.equal(M.priceImpactSeverity(undefined), 'none');
  assert.equal(M.priceImpactSeverity(-4.99), 'none');
  assert.equal(M.priceImpactSeverity(-5), 'moderate');
  assert.equal(M.priceImpactSeverity(-19.9), 'moderate');
  assert.equal(M.priceImpactSeverity(-20), 'severe');
  assert.equal(M.priceImpactSeverity(3), 'none'); // a gain is never a warning
  assert.equal(M.priceImpactSeverity(-8, 10, 30), 'none');
  assert.equal(M.priceImpactSeverity(-12, 10, 30), 'moderate');
  assert.equal(M.priceImpactSeverity(-31, 10, 30), 'severe');
});
test('slippage helpers clamp and normalise', () => {
  assert.equal(M.normalizeSlippage(''), '2');
  assert.equal(M.normalizeSlippage('-1'), '2');
  assert.equal(M.normalizeSlippage('abc'), '2');
  assert.equal(M.normalizeSlippage('45'), '30');
  assert.equal(M.normalizeSlippage('1.5'), '1.5');
  assert.equal(M.stepSlippage('2', 0.1), '2.1');
  assert.equal(M.stepSlippage('0', -0.1), '0');
  assert.equal(M.stepSlippage('29.95', 0.1), '30');
  assert.equal(M.acceptSlippageInput('2', '0x10'), '2');
  assert.equal(M.acceptSlippageInput('2', '-3'), '2');
  assert.equal(M.acceptSlippageInput('2', '99'), '30');
  assert.equal(M.isHighSlippage('5'), false);
  assert.equal(M.isHighSlippage('5.1'), true);
});
test('poll cadence is 2s/5s/10s', () => {
  assert.equal(M.pollDelayMs(0), 2000); assert.equal(M.pollDelayMs(14999), 2000);
  assert.equal(M.pollDelayMs(15000), 5000); assert.equal(M.pollDelayMs(39999), 5000);
  assert.equal(M.pollDelayMs(40000), 10000);
});
test('CTA resolution follows the recovered priority order', () => {
  const base = { isPairSet: true, hasSpendAmount: true, cannotCoverGas: false, showsAllowance: false, needsPriceImpactAck: false, insufficientBalance: false };
  assert.equal(M.resolveCta({ ...base, isPairSet: false }).kind, 'select-token');
  assert.equal(M.resolveCta({ ...base, hasSpendAmount: false }).kind, 'enter-amount');
  assert.equal(M.resolveCta({ ...base, cannotCoverGas: true, insufficientBalance: true }).kind, 'insufficient-gas');
  assert.equal(M.resolveCta({ ...base, showsAllowance: true }).kind, 'approve-and-swap');
  assert.equal(M.resolveCta({ ...base, needsPriceImpactAck: true }).kind, 'accept-price-impact');
  assert.equal(M.resolveCta({ ...base, insufficientBalance: true }).enabled, false);
  const ok = M.resolveCta(base); assert.deepEqual([ok.kind, ok.enabled], ['swap', true]);
});

// ---------------- amounts ----------------
test('toAtomic/fromAtomic are exact and reject junk', () => {
  assert.equal(M.toAtomic('1.5', 18), 1500000000000000000n);
  assert.equal(M.toAtomic('0.000001', 6), 1n);
  assert.equal(M.toAtomic('0.1234567', 6), 123456n); // extra digits truncated, never rounded up
  assert.equal(M.toAtomic('', 6), null); assert.equal(M.toAtomic('.', 6), null); assert.equal(M.toAtomic('1e3', 6), null); assert.equal(M.toAtomic('-1', 6), null);
  assert.equal(M.fromAtomic(1500000000000000000n, 18), '1.5');
  assert.equal(M.fromAtomic('garbage', 18), '0');
  assert.equal(M.rateOf('1000000000000000000', 18, '3000000000', 6), 3000);
  assert.equal(M.rateOf('0', 18, '1', 6), null);
});

// ---------------- errors ----------------
test('aggregator failures map onto user-facing swap errors', () => {
  const c = (s, m) => M.classifyAggregatorError(s, { message: m }).code;
  assert.equal(c(500, ''), 'server'); assert.equal(c(429, ''), 'server');
  assert.equal(c(404, 'No available quotes for the requested transfer'), 'no_liquidity');
  assert.equal(c(400, 'Amount too low'), 'amount_too_low');
  assert.equal(c(400, 'amount exceeds the max'), 'amount_too_high');
  assert.equal(c(400, 'Token not supported'), 'unsupported_pair');
  assert.equal(c(400, 'weird'), 'network');
});

// ---------------- fixtures ----------------
const ME = '0x1111111111111111111111111111111111111111';
const ROUTER = '0x2222222222222222222222222222222222222222';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const NATIVE = M.EVM_NATIVE;
const tok = (address, symbol, decimals, chainId = 1) => ({ address, symbol, decimals, chainId, name: symbol, priceUSD: '1' });
const lifiStep = (over = {}) => ({
  id: 'step-1', type: 'swap', tool: 'uniswap', toolDetails: { key: 'uniswap', name: 'Uniswap' },
  action: { fromToken: tok(USDC, 'USDC', 6), toToken: tok(NATIVE, 'ETH', 18), fromAmount: '100000000', fromAddress: ME, ...(over.action ?? {}) },
  estimate: { toAmount: '30000000000000000', toAmountMin: '29400000000000000', approvalAddress: ROUTER, executionDuration: 30, feeCosts: [], gasCosts: [{ token: tok(NATIVE, 'ETH', 18), amount: '2000000000000000', amountUSD: '6' }], ...(over.estimate ?? {}) },
  transactionRequest: { from: ME, to: ROUTER, chainId: 1, data: '0xabcdef', value: '0x0', ...(over.transactionRequest ?? {}) },
});
const stepOf = (raw) => M.mapLifiStep(raw, 2);

test('LI.FI step mapping: amounts, approval and fees', () => {
  const s = stepOf(lifiStep());
  assert.equal(s.from.asset.symbol, 'USDC'); assert.equal(s.to.asset.address, 'native');
  assert.equal(s.from.amount, '100000000'); assert.equal(s.to.minAmount, '29400000000000000');
  assert.deepEqual(s.approval && [s.approval.tokenAddress, s.approval.spender], [USDC, ROUTER]);
  assert.equal(s.networkFee.symbol, 'ETH'); assert.equal(s.networkFee.amount, '2000000000000000');
  assert.equal(s.provider.name, 'Uniswap');
});
test('LI.FI route mapping rejects routes through unsupported chains and derives price impact from USD', () => {
  const req = { slippage: '2' };
  const r = M.mapLifiRoute({ id: 'r1', fromAmountUSD: '100', toAmountUSD: '95', steps: [lifiStep()] }, req, 1000);
  assert.equal(r.priceImpact, -5); assert.equal(r.expiresAt, 1000 + 60000);
  const foreign = lifiStep({ action: { toToken: tok(NATIVE, 'X', 18, 999999) } });
  assert.equal(M.mapLifiRoute({ id: 'r2', steps: [foreign] }, req), null);
});
test('Jupiter route mapping', () => {
  const sol = M.nativeAsset('solana'); const usdc = M.makeToken('solana', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 'USD Coin', 6);
  const r = M.mapJupiterRoute({ inAmount: '1000000000', outAmount: '150000000', otherAmountThreshold: '148500000', priceImpactPct: '0.0123', routePlan: [{ swapInfo: { label: 'Orca' } }] },
    { from: sol, to: usdc, amount: '1000000000', slippage: '1', solanaTurbo: true }, 5);
  const s = r.steps[0];
  assert.equal(r.source, 'jupiter'); assert.equal(s.to.minAmount, '148500000');
  assert.ok(Math.abs(s.priceImpact + 1.23) < 1e-9);
  assert.equal(s.networkFee.upperBound, true); assert.equal(s.networkFee.amount, String(5000 + 1_000_000));
});

// ---------------- safety.validateLifiTransaction ----------------
const ctx = { ourAddress: ME, chainId: 1, slippagePct: 2 };
const check = (raw, step = stepOf(lifiStep())) => M.validateLifiTransaction(raw, step, ctx);
test('safety: accepts the transaction that matches the quote', () => { assert.equal(check(lifiStep()), null); });
test('safety: rejects wrong chain, wrong sender, zero/garbage target', () => {
  assert.equal(check(lifiStep({ transactionRequest: { chainId: 56 } }))?.code, 'unsafe_transaction');
  assert.equal(check(lifiStep({ transactionRequest: { from: '0x9999999999999999999999999999999999999999' } }))?.code, 'unsafe_transaction');
  assert.equal(check(lifiStep({ transactionRequest: { to: '0x0000000000000000000000000000000000000000' } }))?.code, 'unsafe_transaction');
  assert.equal(check(lifiStep({ transactionRequest: { to: 'nope' } }))?.code, 'unsafe_transaction');
  assert.equal(check(lifiStep({ transactionRequest: { data: 'zz' } }))?.code, 'unsafe_transaction');
});
test('safety: a token sell may not carry native value, and spender must equal the tx target', () => {
  assert.equal(check(lifiStep({ transactionRequest: { value: '0x1' } }))?.code, 'unsafe_transaction');
  const other = '0x3333333333333333333333333333333333333333';
  assert.equal(check(lifiStep({ transactionRequest: { to: other } }))?.code, 'unsafe_transaction');
});
test('safety: provider cannot change the amount being sold', () => {
  assert.equal(check(lifiStep({ action: { fromAmount: '200000000' } }))?.code, 'unsafe_transaction');
});
test('safety: native sell must send exactly the sell amount (plus native fees only)', () => {
  const raw = lifiStep({ action: { fromToken: tok(NATIVE, 'ETH', 18), toToken: tok(USDC, 'USDC', 6), fromAmount: '1000000000000000000' }, estimate: { toAmount: '3000000000', toAmountMin: '2940000000', approvalAddress: undefined }, transactionRequest: { value: '0xde0b6b3a7640000' } });
  const step = stepOf(raw);
  assert.equal(M.validateLifiTransaction(raw, step, ctx), null);
  const over = { ...raw, transactionRequest: { ...raw.transactionRequest, value: '0x1bc16d674ec80000' } }; // 2 ETH
  assert.equal(M.validateLifiTransaction(over, step, ctx)?.code, 'unsafe_transaction');
  const under = { ...raw, transactionRequest: { ...raw.transactionRequest, value: '0x1' } };
  assert.equal(M.validateLifiTransaction(under, step, ctx)?.code, 'unsafe_transaction');
});
test('safety: min-out must honour slippage and price may not drift past it', () => {
  assert.equal(check(lifiStep({ estimate: { toAmountMin: '1000' } }))?.code, 'unsafe_transaction');          // min way below tolerance
  assert.equal(check(lifiStep({ estimate: { toAmount: '20000000000000000', toAmountMin: '19600000000000000' } }))?.code, 'price_moved'); // output fell ~33% since quote
});

// ---------------- Solana tx helpers ----------------
test('Solana tx parse/attach on a synthetic transaction', () => {
  const keyA = new Uint8Array(32).fill(7), keyB = new Uint8Array(32).fill(9);
  const message = new Uint8Array([1, 0, 1, 2, ...keyA, ...keyB, ...new Uint8Array(32), 0]);
  const tx = new Uint8Array([1, ...new Uint8Array(64), ...message]);
  const p = M.parseSolanaTx(tx);
  assert.equal(p.sigSlots, 1); assert.equal(p.msgOffset, 65); assert.deepEqual([...p.accountKeys[0]], [...keyA]); assert.deepEqual([...p.accountKeys[1]], [...keyB]);
  const sig = new Uint8Array(64).fill(5);
  const signed = M.attachSolanaSignature(tx, p, sig);
  assert.deepEqual([...signed.slice(1, 65)], [...sig]); assert.deepEqual([...signed.slice(65)], [...message]); assert.equal(tx[1], 0); // input not mutated
  assert.throws(() => M.attachSolanaSignature(tx, p, new Uint8Array(10)));
  assert.throws(() => M.parseSolanaTx(new Uint8Array([0])));
  assert.deepEqual([...M.b64ToBytes(M.bytesToB64(tx))], [...tx]);
});

// ---------------- tokens / domains ----------------
test('asset ids follow the TW convention and natives are per-domain', () => {
  assert.equal(M.nativeAsset('ethereum').assetId, 'c60');
  assert.equal(M.nativeAsset('solana').assetId, 'c501');
  assert.match(M.makeToken('ethereum', USDC, 'USDC', 'USD Coin', 6).assetId, /^c60_t0x/i);
  assert.ok(M.popularAssets('base').every((a) => a.domainId === 'base'));
  assert.equal(M.SWAP_DOMAINS.some((d) => d.id === 'sepolia'), false); // bitcoin swaps go through THORChain
  assert.equal(M.nativeAsset('bitcoin').assetId, 'c0');
});
