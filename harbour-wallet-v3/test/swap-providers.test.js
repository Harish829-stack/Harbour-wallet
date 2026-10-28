import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Phase 5 swap breadth: THORChain + Relay mapping/safety, quote racing, dust picking (pure core, fake fetch).
const out = await build({
  stdin: {
    contents: `export * from './thorchain'; export * from './relay'; export * from './engine'; export * from './dust'; export * from './tokens'; export * from './domains';`,
    resolveDir: fileURLToPath(new URL('../src/core/swap/', import.meta.url)), sourcefile: 'entry.ts', loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const ETH = M.nativeAsset('ethereum'); const BTC = M.nativeAsset('bitcoin'); const SOL = M.nativeAsset('solana');
const USDC = M.popularAssets('ethereum').find((a) => a.symbol === 'USDC');
const ME = '0x1111111111111111111111111111111111111111';
const BTCADDR = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
const req = (from, to, amount, extra = {}) => ({ from, to, amount, slippage: '1', fromAddress: from.domainId === 'bitcoin' ? BTCADDR : ME, toAddress: to.domainId === 'bitcoin' ? BTCADDR : to.domainId === 'solana' ? 'So1ana1111111111111111111111111111111111111' : ME, sortBy: 'quantity', ...extra });
const thorQuote = { inbound_address: '0x2222222222222222222222222222222222222222', router: '0x3333333333333333333333333333333333333333', memo: `=:BTC.BTC:${BTCADDR}:0/1/0`, expected_amount_out: '150000', expiry: Math.floor(Date.now() / 1000) + 600, fees: { total: '2000', slippage_bps: 12 }, total_swap_seconds: 900, recommended_min_amount_in: '1000' };

test('THORChain asset notation and fixed 1e8 unit conversion', () => {
  assert.equal(M.thorAsset(BTC), 'BTC.BTC'); assert.equal(M.thorAsset(ETH), 'ETH.ETH');
  assert.equal(M.thorAsset(USDC), 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48');
  assert.equal(M.thorAsset(SOL), null);
  assert.equal(M.toThorUnits('1000000000000000000', 18), 100000000n); assert.equal(M.fromThorUnits('100000000', 18), 10n ** 18n);
  assert.equal(M.toThorUnits('1500000', 6), 150000000n); assert.equal(M.fromThorUnits(150000000n, 6), 1500000n);
  assert.equal(M.thorSupports({ from: ETH, to: BTC }), true); assert.equal(M.thorSupports({ from: ETH, to: USDC }), false);
});

test('THORChain route mapping, fresh-quote checks and router calldata', () => {
  const r = req(ETH, BTC, '10000000000000000');
  const route = M.mapThorRoute(thorQuote, r);
  const st = route.steps[0];
  assert.equal(route.source, 'thorchain'); assert.equal(st.to.amount, '150000'); assert.equal(st.to.minAmount, '148500'); assert.equal(st.executionSeconds, 900);
  assert.doesNotThrow(() => M.checkThorQuote(thorQuote, st, BTCADDR, 1));
  assert.throws(() => M.checkThorQuote({ ...thorQuote, memo: '=:BTC.BTC:bc1qattacker:0/1/0' }, st, BTCADDR, 1), (e) => e.code === 'unsafe_transaction');
  assert.throws(() => M.checkThorQuote({ ...thorQuote, memo: `=:BTC.BTC:${BTCADDR}:0/1/0:aff:50` }, st, BTCADDR, 1), (e) => e.code === 'unsafe_transaction');   // affiliate fields
  assert.throws(() => M.checkThorQuote({ ...thorQuote, memo: `=:ETH.ETH:${BTCADDR}:0/1/0` }, st, BTCADDR, 1), (e) => e.code === 'unsafe_transaction');          // different output asset
  assert.throws(() => M.checkThorQuote({ ...thorQuote, expected_amount_out: '140000' }, st, BTCADDR, 1), (e) => e.code === 'price_moved');
  const call = M.thorRouterCall(thorQuote, st);
  assert.equal(call.to, '0x3333333333333333333333333333333333333333'); assert.equal(call.value, 10000000000000000n);
  assert.ok(call.data.startsWith('0x44bc937b')); // depositWithExpiry(address,address,uint256,string,uint256)
  const tok = M.mapThorRoute(thorQuote, req(USDC, BTC, '5000000')).steps[0];
  assert.equal(tok.approval.spender, thorQuote.router);
  assert.equal(M.thorRouterCall(thorQuote, tok).value, 0n);
});

test('THORChain status: finalised + signed outbound is done, REFUND outbound is refunded', () => {
  assert.equal(M.readThorStatus({ stages: { swap_finalised: { completed: true }, outbound_signed: { completed: true } } }), 'done');
  assert.equal(M.readThorStatus({ stages: { swap_finalised: { completed: false } } }), 'pending');
  assert.equal(M.readThorStatus({ out_txs: [{ memo: 'REFUND:ABC' }], stages: {} }), 'refunded');
});

const relayQ = (over = {}) => ({
  requestId: '0xreq',
  steps: [
    { id: 'approve', kind: 'transaction', items: [{ status: 'incomplete', data: { from: ME, to: USDC.address, chainId: 1, value: '0', data: '0x095ea7b3' + '0'.repeat(24) + '4444444444444444444444444444444444444444' + 'f'.repeat(64) } }] },
    { id: 'deposit', kind: 'transaction', requestId: '0xreq', items: [{ status: 'incomplete', data: { from: ME, to: '0x4444444444444444444444444444444444444444', chainId: 1, value: '0', data: '0xabcdef' } }] },
  ],
  fees: { gas: { amount: '1000', amountUsd: '0.5' }, relayer: { amount: '10', amountUsd: '0.01', currency: { symbol: 'USDC', decimals: 6 } } },
  details: { currencyIn: { amountUsd: '5' }, currencyOut: { amount: '2000000000000000', minimumAmount: '1980000000000000', amountUsd: '4.9' }, totalImpact: { percent: '-0.4' }, timeEstimate: 12 },
  ...over,
});

test('Relay route mapping and pre-sign validation of the fresh quote', () => {
  const r = req(USDC, M.nativeAsset('base'), '5000000');
  const route = M.mapRelayRoute(relayQ(), r);
  const st = route.steps[0];
  assert.equal(route.source, 'relay'); assert.equal(st.approval.spender.toLowerCase(), '0x4444444444444444444444444444444444444444'); assert.equal(st.to.minAmount, '1980000000000000');
  const ctx = { ourAddress: ME, chainId: 1, slippagePct: 1, targets: new Set(['0x4444444444444444444444444444444444444444']) };
  const plan = M.relayTransactions(relayQ(), st, ctx);
  assert.deepEqual(plan.txs.map((t) => t.kind), ['approve', 'execute']); assert.equal(plan.requestId, '0xreq');
  const evil = relayQ(); evil.steps[0].items[0].data.data = '0x095ea7b3' + '0'.repeat(24) + '9'.repeat(40) + 'f'.repeat(64);
  assert.throws(() => M.relayTransactions(evil, st, ctx), (e) => e.code === 'unsafe_transaction');
  const valued = relayQ(); valued.steps[1].items[0].data.value = '1';
  assert.throws(() => M.relayTransactions(valued, st, ctx), (e) => e.code === 'unsafe_transaction');
  const sig = relayQ(); sig.steps[1].kind = 'signature';
  assert.throws(() => M.relayTransactions(sig, st, ctx), (e) => e.code === 'unsupported_pair');
  const moved = relayQ({ details: { currencyOut: { amount: '1900000000000000', minimumAmount: '1881000000000000' } } });
  assert.throws(() => M.relayTransactions(moved, st, ctx), (e) => e.code === 'price_moved');
  assert.equal(M.relaySupports({ from: SOL, to: ETH }), false); assert.equal(M.relaySupports({ from: ETH, to: SOL }), true);
});

test('quote racing: providers per pair, failures dropped, best-return tag, best error when all fail', async () => {
  assert.deepEqual(M.eligibleProviders({ from: ETH, to: BTC }), ['thorchain']);
  assert.deepEqual(M.eligibleProviders({ from: ETH, to: USDC }), ['lifi', 'relay']);
  assert.deepEqual(M.eligibleProviders({ from: SOL, to: M.popularAssets('solana')[1] }), ['jupiter']);
  const f = async (url, init) => {
    if (String(url).includes('/quote/v2')) return new Response(JSON.stringify(relayQ()), { status: 200 });
    return new Response(JSON.stringify({ message: 'No available quotes for the requested transfer' }), { status: 404 });
  };
  const res = await M.getSwapRoutes(req(USDC, M.nativeAsset('base'), '5000000'), f);
  assert.equal(res.routes.length, 1); assert.equal(res.routes[0].source, 'relay'); assert.ok(res.routes[0].tags.includes('BEST_RETURN'));
  const allFail = async () => new Response(JSON.stringify({ message: 'amount too low' }), { status: 400 });
  await assert.rejects(M.getSwapRoutes(req(USDC, M.nativeAsset('base'), '5000000'), allFail), (e) => e.code === 'amount_too_low');
});

test('dust picker keeps priced non-native balances between 1 cent and the threshold, largest first', () => {
  const t = (sym, bal, price) => ({ asset: { ...USDC, assetId: sym, symbol: sym }, balance: bal, priceUsd: price });
  const out = M.pickDust([t('A', '2000000', 1), t('B', '4000000', 1), t('C', '9000000', 1), t('D', '5000', 1), { asset: ETH, balance: '1', priceUsd: 3000 }, t('E', '1000000', undefined)]);
  assert.deepEqual(out.map((x) => x.asset.symbol), ['B', 'A']);
});

test('THORChain vault/router must be confirmed by two independent nodes; Relay targets come from Relay itself', async () => {
  const r = req(ETH, BTC, '10000000000000000'); const st = M.mapThorRoute(thorQuote, r).steps[0];
  const node = (entry) => async () => ({ ok: true, json: async () => [entry] });
  const good = { chain: 'ETH', address: thorQuote.inbound_address, router: thorQuote.router };
  await M.verifyThorInbound(thorQuote, st, node(good));                                           // all configured nodes agree
  await assert.rejects(() => M.verifyThorInbound(thorQuote, st, node({ ...good, address: '0x9999999999999999999999999999999999999999' })), (e) => e.code === 'unsafe_transaction');
  await assert.rejects(() => M.verifyThorInbound(thorQuote, st, node({ ...good, halted: true })), (e) => e.code === 'unsafe_transaction');
  await assert.rejects(() => M.verifyThorInbound(thorQuote, st, async () => { throw new Error('down'); }), (e) => e.code === 'unsafe_transaction');   // nobody can confirm: refuse
  const t = await M.relayTargets(8453, async () => ({ ok: true, json: async () => ({ chains: [{ id: 8453, protocol: { v2: { depository: '0x5555555555555555555555555555555555555555' } } }] }) }));
  assert.ok(t.has('0x5555555555555555555555555555555555555555'));
  assert.equal((await M.relayTargets(56, async () => { throw new Error('down'); })).size, 0);
  const st2 = M.mapRelayRoute(relayQ(), req(USDC, M.nativeAsset('base'), '5000000')).steps[0];
  assert.throws(() => M.relayTransactions(relayQ(), st2, { ourAddress: ME, chainId: 1, slippagePct: 1, targets: new Set() }), (e) => e.code === 'unsafe_transaction');
});
