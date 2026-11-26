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
      export * from './tokens'; export * from './domains'; export * from './engine'; export * from './backend'; export * from './simGuard';`,
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
  assert.equal(M.normalizeSlippage('45'), '5');
  assert.equal(M.normalizeSlippage('1.5'), '1.5');
  assert.equal(M.stepSlippage('2', 0.1), '2.1');
  assert.equal(M.stepSlippage('0', -0.1), '0');
  assert.equal(M.stepSlippage('4.95', 0.1), '5');
  assert.equal(M.acceptSlippageInput('2', '0x10'), '2');
  assert.equal(M.acceptSlippageInput('2', '-3'), '2');
  assert.equal(M.acceptSlippageInput('2', '99'), '5');
  assert.equal(M.isHighSlippage('3'), false);
  assert.equal(M.isHighSlippage('3.1'), true);
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
// ---------------- fixtures ----------------
const ME = '0x1111111111111111111111111111111111111111';
const ROUTER = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';   // LI.FI Diamond (the only allowed target)
const W = (h) => h.replace('0x', '').toLowerCase().padStart(64, '0');
// swapTokensGeneric(bytes32, string, string, address receiver, uint256 minAmountOut, SwapData[])
const swapData = (receiver = ME, min = '29400000000000000') => '0x4630a0d8' + W('0x7') + W('0xc0') + W('0xc0') + W(receiver) + W(BigInt(min).toString(16)) + W('0xc0') + W('0x0');
// BridgeData-first facet call: tuple at 0x40, then a second dynamic arg
const bridgeData = (receiver, o = {}) => '0xdeadbeef' + W('0x40') + W('0x200') + [W('0x7'), W('0x140'), W('0x160'), W('0x0'), W(o.asset ?? '0x0'), W(receiver), W((o.min ?? 100000000n).toString(16)), W((o.dest ?? 1n).toString(16)), W('0x0'), W(o.call ? '0x1' : '0x0')].join('') + W('0x0') + W('0x0') + W('0x0') + W('0x0');
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const NATIVE = M.EVM_NATIVE;
const tok = (address, symbol, decimals, chainId = 1) => ({ address, symbol, decimals, chainId, name: symbol, priceUSD: '1' });
const lifiStep = (over = {}) => ({
  id: 'step-1', type: 'swap', tool: 'uniswap', toolDetails: { key: 'uniswap', name: 'Uniswap' },
  action: { fromToken: tok(USDC, 'USDC', 6), toToken: tok(NATIVE, 'ETH', 18), fromAmount: '100000000', fromAddress: ME, ...(over.action ?? {}) },
  estimate: { toAmount: '30000000000000000', toAmountMin: '29400000000000000', approvalAddress: ROUTER, executionDuration: 30, feeCosts: [], gasCosts: [{ token: tok(NATIVE, 'ETH', 18), amount: '2000000000000000', amountUSD: '6' }], ...(over.estimate ?? {}) },
  transactionRequest: { from: ME, to: ROUTER, chainId: 1, data: swapData(), value: '0x0', ...(over.transactionRequest ?? {}) },
});
// The confirmed step as Harbour's swap service returns it (backend internal/swapsvc maps LI.FI's step the same way).
const assetOf = (t) => (t.address === NATIVE ? M.nativeAsset('ethereum') : M.makeToken('ethereum', t.address, t.symbol, t.symbol, t.decimals));
const stepOf = (raw) => ({
  id: raw.id, type: 'swap', provider: { id: 'uniswap', name: 'Uniswap' }, fromDomainId: 'ethereum', toDomainId: 'ethereum',
  from: { asset: assetOf(raw.action.fromToken), amount: raw.action.fromAmount },
  to: { asset: assetOf(raw.action.toToken), amount: raw.estimate.toAmount, minAmount: raw.estimate.toAmountMin },
  slippage: { userSelected: 2 }, providerFees: [],
  approval: raw.action.fromToken.address !== NATIVE && raw.estimate.approvalAddress ? { tokenAddress: raw.action.fromToken.address, spender: raw.estimate.approvalAddress, minAmount: raw.action.fromAmount } : undefined,
  raw,
});

// ---------------- backend answers are screened ----------------
const ETHA = () => M.nativeAsset('ethereum'); const USDCA = () => M.makeToken('ethereum', USDC, 'USDC', 'USD Coin', 6);
const qreq = (over = {}) => ({ from: USDCA(), to: ETHA(), fromAddress: ME, toAddress: ME, amount: '100000000', slippage: '2', sortBy: 'quantity', ...over });
const backendRoute = (over = {}, stepOver = {}) => ({ id: 'r1', source: 'lifi', expiresAt: 1, tags: ['RECOMMENDED'], warnings: [], steps: [{
  id: 's1', type: 'swap', provider: { id: 'uniswap', name: 'Uniswap <b>', logoUrl: 'javascript:alert(1)' }, fromDomainId: 'ethereum', toDomainId: 'ethereum',
  from: { asset: { ...USDCA(), name: 'evil' }, amount: '100000000' }, to: { asset: { ...ETHA(), logoUrl: 'https://evil/x.png' }, amount: '30000000000000000', minAmount: '29400000000000000' },
  slippage: { userSelected: 2 }, providerFees: [], approval: { tokenAddress: USDC, spender: ROUTER, minAmount: '100000000' }, raw: {}, ...stepOver }], ...over });
test('backend routes: only the exact requested trade is kept, shown with the user\'s own assets', () => {
  const r = M.acceptRoute(backendRoute(), qreq(), 1000);
  assert.equal(r.steps[0].from.asset.name, 'USD Coin'); assert.equal(r.steps[0].to.asset.logoUrl, ETHA().logoUrl);
  assert.equal(r.steps[0].provider.logoUrl, undefined); assert.ok(!/[<>]/.test(r.steps[0].provider.name)); assert.equal(r.expiresAt, 1000 + 60000);
  assert.equal(M.acceptRoute(backendRoute({}, { slippage: { userSelected: 30 } }), qreq()).steps[0].slippage.userSelected, 2); // never the server's slippage
  const st = backendRoute().steps[0];
  assert.equal(M.acceptRoute(backendRoute({}, { from: { ...st.from, amount: '99' } }), qreq()), null);                                   // other amount
  assert.equal(M.acceptRoute(backendRoute({}, { to: { ...st.to, asset: USDCA() } }), qreq()), null);                                       // other asset
  assert.equal(M.acceptRoute(backendRoute({}, { to: { ...st.to, minAmount: '1000' } }), qreq()), null);                                    // minimum looser than the slippage
  assert.ok(M.acceptRoute(backendRoute({}, { to: { ...st.to, minAmount: '29380000000000000' } }), qreq()));   // 2.07% below: within the 0.1% rounding tolerance (live Layerswap)
  assert.equal(M.acceptRoute(backendRoute({}, { to: { ...st.to, minAmount: '29300000000000000' } }), qreq()), null); // 2.33% below: refused
  assert.equal(M.acceptRoute(backendRoute({}, { approval: { tokenAddress: USDC, spender: ROUTER, minAmount: '1' } }), qreq()), null);       // approval for another amount
  assert.equal(M.acceptRoute(backendRoute({ source: 'evil' }), qreq()), null);
  assert.equal(M.acceptRoute(backendRoute({ steps: [st, st] }), qreq()), null);
});
test('backend quotes: errors map to swap errors; no usable route is no_liquidity; sorting + best-return tag', async () => {
  const reply = (status, body) => async () => new Response(JSON.stringify(body), { status });
  M.setSwapBackend(reply(422, { error: { code: 'amount_too_low', minAmount: '5000' } }));
  await assert.rejects(M.getSwapRoutes(qreq()), (e) => e.code === 'amount_too_low' && e.minAmount === '5000');
  M.setSwapBackend(reply(502, { error: { code: 'weird' } }));
  await assert.rejects(M.getSwapRoutes(qreq()), (e) => e.code === 'server');
  M.setSwapBackend(async () => { throw new Error('offline'); });
  await assert.rejects(M.getSwapRoutes(qreq()), (e) => e.code === 'network');
  M.setSwapBackend(reply(200, { routes: [backendRoute({ source: 'evil' })] }));
  await assert.rejects(M.getSwapRoutes(qreq()), (e) => e.code === 'no_liquidity');
  const a = backendRoute({ id: 'a' }); const b = backendRoute({ id: 'b', source: 'relay' }, { to: { asset: ETHA(), amount: '31000000000000000', minAmount: '30400000000000000' } });
  let sent;
  M.setSwapBackend(async (method, path, body) => { sent = { method, path, body }; return new Response(JSON.stringify({ routes: [a, b] }), { status: 200 }); });
  const res = await M.getSwapRoutes(qreq(), ['lifi', 'relay']);
  assert.deepEqual(res.routes.map((r) => r.id), ['b', 'a']); assert.ok(res.routes[0].tags.includes('BEST_RETURN'));
  assert.equal(sent.path, '/v1/swap/quotes'); assert.deepEqual(sent.body.providers, ['lifi', 'relay']); assert.equal(sent.body.from.logoUrl, undefined);
});

// ---------------- simulation guard ("you send X, you get Y") ----------------
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const topic = (a) => '0x' + a.replace('0x', '').toLowerCase().padStart(64, '0');
const log = (token, from, to, amount) => ({ address: token, topics: [TRANSFER, topic(from), topic(to)], data: '0x' + BigInt(amount).toString(16) });
const POOL = '0x4444444444444444444444444444444444444444'; const NATIVE_P = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const simResult = (logs, status = '0x1') => [{ calls: [{ status, logs }] }];
test('simulation guard: the wallet loses only the sold amount and gets at least the minimum', () => {
  const st = stepOf(lifiStep());   // sell 100 USDC for >= 0.0294 ETH
  const ok = M.readSimulatedCalls(simResult([log(USDC, ME, POOL, '100000000'), log(NATIVE_P, POOL, ME, '30000000000000000')]), ME);
  const r = M.checkSwapEffect(ok.changes, st, { maxNativeOut: 0n });
  assert.equal(r.ok, true); assert.equal(r.effect.received, 30000000000000000n); assert.equal(r.effect.sent, 100000000n);
  const drain = M.readSimulatedCalls(simResult([log(USDC, ME, POOL, '100000000'), log('0x5555555555555555555555555555555555555555', ME, POOL, '1'), log(NATIVE_P, POOL, ME, '30000000000000000')]), ME);
  assert.equal(M.checkSwapEffect(drain.changes, st, { maxNativeOut: 0n }).reason, 'unexpected_outflow');   // another token leaves the wallet
  const over = M.readSimulatedCalls(simResult([log(USDC, ME, POOL, '200000000'), log(NATIVE_P, POOL, ME, '30000000000000000')]), ME);
  assert.equal(M.checkSwapEffect(over.changes, st, { maxNativeOut: 0n }).reason, 'oversend');
  const short = M.readSimulatedCalls(simResult([log(USDC, ME, POOL, '100000000'), log(NATIVE_P, POOL, ME, '1000')]), ME);
  assert.equal(M.checkSwapEffect(short.changes, st, { maxNativeOut: 0n }).reason, 'below_minimum');
  const eth = M.readSimulatedCalls(simResult([log(USDC, ME, POOL, '100000000'), log(NATIVE_P, ME, POOL, '5')]), ME);
  assert.equal(M.checkSwapEffect(eth.changes, st, { maxNativeOut: 0n }).reason, 'unexpected_outflow');    // native leaves although the tx sends none
  assert.deepEqual(M.readSimulatedCalls(simResult([], '0x0'), ME).ok, false);
  assert.equal(M.readSimulatedCalls({}, ME), null);
  const p = M.simulateCallsParams([{ from: ME, to: USDC, data: '0x095ea7b3', value: 0n }, { from: ME, to: ROUTER, data: '0x12', value: 10n }]);
  assert.equal(p[0].blockStateCalls[0].calls.length, 2); assert.equal(p[0].blockStateCalls[0].calls[1].value, '0xa'); assert.equal(p[0].traceTransfers, true);
});
test('simulation guard: native sells may spend the sale plus the value carried; cross-chain only checks outflows', () => {
  const raw = lifiStep({ action: { fromToken: tok(NATIVE, 'ETH', 18), toToken: tok(USDC, 'USDC', 6), fromAmount: '1000' }, estimate: { toAmount: '3000', toAmountMin: '2940', approvalAddress: undefined } });
  const st = stepOf(raw);
  const res = M.readSimulatedCalls(simResult([log(NATIVE_P, ME, POOL, '1010'), log(USDC, POOL, ME, '3000')]), ME);
  assert.equal(M.checkSwapEffect(res.changes, st, { maxNativeOut: 1010n }).ok, true);
  assert.equal(M.checkSwapEffect(res.changes, st, { maxNativeOut: 1000n }).reason, 'oversend');
  const bridge = { ...st, toDomainId: 'base' };
  const out = M.readSimulatedCalls(simResult([log(NATIVE_P, ME, POOL, '1000')]), ME);
  const r = M.checkSwapEffect(out.changes, bridge, { maxNativeOut: 1000n }); assert.equal(r.ok, true); assert.equal(r.effect.received, null);
});

// ---------------- safety.validateLifiTransaction ----------------
const ctx = { ourAddress: ME, chainId: 1, slippagePct: 2, destKind: 'evm', destLifiChainId: 1 };
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
  const raw = lifiStep({ action: { fromToken: tok(NATIVE, 'ETH', 18), toToken: tok(USDC, 'USDC', 6), fromAmount: '1000000000000000000' }, estimate: { toAmount: '3000000000', toAmountMin: '2940000000', approvalAddress: undefined }, transactionRequest: { value: '0xde0b6b3a7640000', data: swapData(ME, '2940000000') } });
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
  // audit H4: a fresh answer 1.5% lower, with a min-out honouring 2% of THAT price, would guarantee ~3.5% less than confirmed: refused
  const lower = lifiStep({ estimate: { toAmount: '29550000000000000', toAmountMin: '28959000000000000' }, transactionRequest: { data: swapData(ME, '28959000000000000') } });
  assert.equal(check(lower)?.code, 'price_moved');
  // audit M1: native fees declared in the (untrusted) response are believed only up to a per-chain cap
  const fee = (amt) => ({ estimate: { feeCosts: [{ token: tok(NATIVE, 'ETH', 18), amount: amt }] }, transactionRequest: { value: '0x' + BigInt(amt).toString(16) } });
  assert.equal(check(lifiStep(fee('2000000000000000'))), null);                         // 0.002 ETH bridge fee: fine
  assert.equal(check(lifiStep(fee('500000000000000000')))?.code, 'unsafe_transaction');  // 0.5 ETH "fee" on a token sale: refused
  // the same fresh answer whose on-chain min-out still meets the confirmed minimum is fine
  assert.equal(check(lifiStep({ estimate: { toAmount: '29550000000000000', toAmountMin: '29400000000000000' } })), null);
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

test('safety: router must be the LI.FI Diamond and calldata must pay us', () => {
  const other = '0x3333333333333333333333333333333333333333';
  assert.equal(check(lifiStep({ estimate: { approvalAddress: other }, transactionRequest: { to: other } }))?.code, 'unsafe_transaction');   // consistent but not LI.FI's contract
  assert.equal(check(lifiStep({ transactionRequest: { data: swapData(other) } }))?.code, 'unsafe_transaction');                           // receiver is an attacker
  assert.equal(check(lifiStep({ transactionRequest: { data: swapData(ME, '1000') } }))?.code, 'unsafe_transaction');                       // min-out weaker than the quoted minimum
  assert.equal(check(lifiStep({ transactionRequest: { data: '0xabcdef' } }))?.code, 'unsafe_transaction');                                  // unrecognised shape: fail closed
});
test('safety: bridge calls (BridgeData) are decoded; receiver, destination call and sold asset are enforced', () => {
  const I = M.decodeLifiCall(bridgeData(ME, { asset: USDC })); assert.equal(I.kind, 'bridge'); assert.equal(I.receiver.toLowerCase(), ME); assert.equal(I.minAmount, 100000000n);
  const raw = (data) => lifiStep({ transactionRequest: { data } });
  assert.equal(check(raw(bridgeData(ME, { asset: USDC }))), null);
  assert.equal(check(raw(bridgeData('0x3333333333333333333333333333333333333333', { asset: USDC })))?.code, 'unsafe_transaction');
  assert.equal(check(raw(bridgeData(ME, { asset: USDC, call: true })))?.code, 'unsafe_transaction');
  assert.equal(check(raw(bridgeData(ME, { asset: '0x3333333333333333333333333333333333333333' })))?.code, 'unsafe_transaction');
  assert.equal(check(raw(bridgeData(ME, { asset: USDC, min: 200000000n })))?.code, 'unsafe_transaction');
  // audit H2: a bridge to a non-EVM chain hides the real receiver; it is never signed. The destination chain must be the confirmed one.
  assert.equal(M.validateLifiTransaction(raw(bridgeData(M.LIFI_NON_EVM_RECEIVER, { asset: USDC })), stepOf(lifiStep()), { ...ctx, destKind: 'solana', destLifiChainId: 1151111081099710 })?.code, 'unsupported_route');
  assert.equal(M.validateLifiTransaction(raw(bridgeData(ME, { asset: USDC })), stepOf(lifiStep()), { ...ctx, destKind: 'solana' })?.code, 'unsupported_route');
  assert.equal(check(raw(bridgeData(ME, { asset: USDC, dest: 56n })))?.code, 'unsafe_transaction');
  assert.equal(M.validateLifiTransaction(raw(bridgeData(ME, { asset: USDC })), stepOf(lifiStep()), { ...ctx, destLifiChainId: undefined })?.code, 'unsafe_transaction');
});

// Real LI.FI answer (2026-11-26): a Layerswap bridge whose minimum sits 1.00005% under the output at 1% slippage. It must pass the
// pre-sign checks (0.1% rounding tolerance), and the same transaction paying someone else must not.
test('live LI.FI Layerswap bridge passes the pre-sign checks; a tampered receiver does not', async () => {
  const { readFileSync } = await import('node:fs');
  const fx = JSON.parse(readFileSync(new URL('./fixtures/lifi-layerswap-live.json', import.meta.url), 'utf8'));
  const ctx = { ourAddress: fx.fresh.transactionRequest.from, chainId: 42161, slippagePct: 1, destKind: 'evm', destLifiChainId: 8453 };
  assert.equal(M.validateLifiTransaction(fx.fresh, fx.step, { ...ctx, destLifiChainId: 42161 })?.code, 'unsafe_transaction');   // wrong destination chain
  assert.equal(M.validateLifiTransaction(fx.fresh, fx.step, ctx), null);
  const evil = structuredClone(fx.fresh); const me = ctx.ourAddress.slice(2).toLowerCase();
  evil.transactionRequest.data = evil.transactionRequest.data.replace(me, '3333333333333333333333333333333333333333');
  assert.equal(M.validateLifiTransaction(evil, fx.step, ctx)?.code, 'unsafe_transaction');
});
