// Regression tests for the 2026-11-26 swap/earn security audit (claude/swap-earn-security-audit-2026-11-26.md): every
// fixed finding has a test that feeds a real or minimally changed provider answer and asserts it is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { encodeFunctionData, parseAbi } from 'viem';

const out = await build({
  stdin: {
    contents: `export * from './relay'; export * from './safety'; export * from './thorchain'; export * from './routeStore'; export * from './tokens'; export * from './domains'; export * from './simGuard';`,
    resolveDir: fileURLToPath(new URL('../src/core/swap/', import.meta.url)), sourcefile: 'entry.ts', loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const code = (f) => { try { f(); return null; } catch (e) { return e.code ?? e.message; } };

// ---------------------------------------------------------------- H2: Relay cross-chain orders
const chainsJson = fx('relay-chains-min.json');
const chains = await M.relayChains(async () => ({ ok: true, json: async () => chainsJson }));
const ME = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const SOLME = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
const relayCase = (name) => {
  const c = fx(name); const step = c.route.steps[0];
  const d = M.domainById(step.fromDomainId);
  const ownTo = step.toDomainId === 'solana' ? SOLME : ME;
  const targets = new Set([chains.get(d.chainId).depository.toLowerCase(), '0xf70da97812cb96acdf810712aa562db8dfa3dbef']);
  if (step.approval) step.approval.spender = String(c.fresh.steps[0].items[0].data.data).replace(/^0x095ea7b3.{24}(.{40}).*$/i, '0x$1');
  const run = (fresh = c.fresh, s = step, o = {}) => M.relayTransactions(fresh, s, { ourAddress: ME, chainId: d.chainId, slippagePct: 2, targets: new Set([...targets, s.approval?.spender?.toLowerCase()].filter(Boolean)), ownTo, chains, ...o });
  return { c, step, run, ownTo };
};

test('H2 Relay: order ids recomputed from live orders match the ids Relay returned (USDC Ethereum → ETH Base, ETH Base → SOL)', () => {
  for (const n of ['relay-order-usdc-eth-base.json', 'relay-order-eth-base-sol.json']) {
    const { c } = relayCase(n); const o = c.fresh.protocol.v2;
    const vmOf = (id) => [...chains.values()].find((x) => x.protocolChainId === id)?.vm;
    assert.equal(M.relayOrderId(o.orderData, vmOf), o.orderId, n);
  }
});

test('H2 Relay: the live cross-chain answers pass; changed recipient, chain, token, minimum, refund, calls, deposit id or depositor are refused', () => {
  for (const n of ['relay-order-usdc-eth-base.json', 'relay-order-eth-base-sol.json']) {
    const { c, step, run } = relayCase(n);
    assert.equal(code(() => run()), null, n);
    const mut = (f) => { const x = structuredClone(c.fresh); f(x, x.protocol.v2.orderData); return x; };
    const evil = step.toDomainId === 'solana' ? '7uTT8Xi5RWXzy7h9XL244GRgEycDYDhLjr3ZyNdXi8pZ' : '0x000000000000000000000000000000000000bad1';
    const cases = {
      recipient: mut((x, o) => { o.output.payments[0].recipient = evil; }),
      // even a recipient change with a matching order id (the backend rewrote both) is caught by the recipient check
      outputChain: mut((x, o) => { o.output.chainId = 'arbitrum'; }),
      outputToken: mut((x, o) => { o.output.payments[0].currency = step.toDomainId === 'solana' ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' : '0xaf88d065e77c8cc2239327c5edb3a432268e5831'; }),
      refundTo: mut((x, o) => { o.inputs[0].refunds[0].recipient = step.toDomainId === 'solana' ? '0x000000000000000000000000000000000000bad1' : evil; }),
      calls: mut((x, o) => { o.output.calls = ['0x1234']; }),
      payAmount: mut((x, o) => { o.inputs[0].payment.amount = '1'; }),
      orderIdOnly: mut((x) => { x.protocol.v2.orderId = '0x' + '11'.repeat(32); }),
      salt: mut((x, o) => { o.salt = '0x' + '22'.repeat(32); }),
      noProtocol: mut((x) => { delete x.protocol; }),
    };
    for (const [k, f] of Object.entries(cases)) assert.notEqual(code(() => run(f)), null, `${n}: ${k}`);
    // deposit committing to another order, or crediting another depositor
    const dep = c.fresh.steps.at(-1).items[0].data;
    const abi = parseAbi(['function depositNative(address depositor, bytes32 id) payable', 'function depositErc20(address depositor, address token, uint256 amount, bytes32 id)']);
    const reEncode = (args) => { const x = structuredClone(c.fresh); x.steps.at(-1).items[0].data.data = encodeFunctionData({ abi, functionName: step.from.asset.address === 'native' ? 'depositNative' : 'depositErc20', args }); return x; };
    const id = c.fresh.protocol.v2.orderId;
    const native = step.from.asset.address === 'native';
    assert.equal(code(() => run(reEncode(native ? [ME, id] : [ME, step.from.asset.address, BigInt(step.from.amount), id]))), null, `${n}: re-encoded original`);
    assert.notEqual(code(() => run(reEncode(native ? [ME, '0x' + '33'.repeat(32)] : [ME, step.from.asset.address, BigInt(step.from.amount), '0x' + '33'.repeat(32)]))), null, `${n}: other id`);
    assert.notEqual(code(() => run(reEncode(native ? ['0x000000000000000000000000000000000000bad1', id] : ['0x000000000000000000000000000000000000bad1', step.from.asset.address, BigInt(step.from.amount), id]))), null, `${n}: other depositor`);
    assert.ok(dep);
    // the confirmed minimum is the floor (a fresh order with a lower minimum is a price move, never signed)
    const s2 = structuredClone(step); s2.to.minAmount = (BigInt(c.fresh.protocol.v2.orderData.output.payments[0].minimumAmount) * 2n).toString(); s2.to.amount = (BigInt(s2.to.minAmount) * 2n).toString();
    assert.equal(code(() => run(c.fresh, s2)), 'price_moved', `${n}: floor`);
    // no chain list (api.relay.link unreachable) or no recipient: cross-chain refused
    assert.equal(code(() => run(c.fresh, step, { chains: new Map() })), 'unsupported_route');
    assert.equal(code(() => run(c.fresh, step, { ownTo: undefined })), 'unsupported_route');
  }
});

// ---------------------------------------------------------------- H4: the confirmed minimum is the floor
const ETH = M.nativeAsset('ethereum'); const BTC = M.nativeAsset('bitcoin');
const USDC = M.popularAssets('ethereum').find((a) => a.symbol === 'USDC');
const stepOf = (from, to, amount, out, min, extra = {}) => ({ id: 's', type: 'swap', provider: { id: 'p', name: 'p' }, fromDomainId: from.domainId, toDomainId: to.domainId,
  from: { asset: from, amount }, to: { asset: to, amount: out, minAmount: min }, slippage: { userSelected: 2 }, providerFees: [], raw: {}, ...extra });

test('H4: confirmedFloor is the confirmed minimum less 0.1%', () => {
  assert.equal(M.confirmedFloor(stepOf(ETH, USDC, '1', '1000000', '980000')), 980000n - 980n);
});

test('H4 THORChain: the signed memo carries the confirmed minimum as LIMIT; shorthand and shortened assets are checked (M3)', () => {
  const BTCADDR = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
  const st = stepOf(ETH, BTC, '10000000000000000', '150000', '147000');
  const q = (memo, extra = {}) => ({ inbound_address: '0x2222222222222222222222222222222222222222', router: '0x3333333333333333333333333333333333333333', memo, expected_amount_out: '150000', expiry: Math.floor(Date.now() / 1000) + 600, ...extra });
  assert.equal(M.checkThorQuote(q(`=:BTC.BTC:${BTCADDR}:0/1/0`), st, BTCADDR), `=:BTC.BTC:${BTCADDR}:146853/1/0`);   // LIMIT 0 (no protection) becomes the floor
  assert.equal(M.checkThorQuote(q(`=:b:${BTCADDR}`), st, BTCADDR), `=:b:${BTCADDR}:146853`);                       // shorthand b = BTC.BTC
  assert.equal(code(() => M.checkThorQuote(q(`=:e:${BTCADDR}`), st, BTCADDR)), 'unsafe_transaction');                 // e = ETH.ETH: another asset
  assert.equal(code(() => M.checkThorQuote(q(`=:x:${BTCADDR}`), st, BTCADDR)), 'unsafe_transaction');                 // unknown shorthand
  assert.equal(code(() => M.checkThorQuote(q(`=:BTC.BTC:${BTCADDR}:1`, { expected_amount_out: '140000' }), st, BTCADDR)), 'price_moved');
  const toUsdc = stepOf(BTC, USDC, '100000', '60000000', '59000000');
  const ME = '0x1111111111111111111111111111111111111111';
  assert.match(M.checkThorQuote(q(`=:ETH.USDC-EB48:${ME}:0`, { expected_amount_out: '6000000000' }), toUsdc, ME), /^=:ETH\.USDC-EB48:0x1111111111111111111111111111111111111111:5894100000$/);
  assert.equal(code(() => M.checkThorQuote(q(`=:ETH.USDC-0X1234:${ME}:0`, { expected_amount_out: '6000000000' }), toUsdc, ME)), 'unsafe_transaction');  // other contract
  assert.equal(code(() => M.checkThorQuote(q(`=:ETH.USDC:${ME}:0`, { expected_amount_out: '6000000000' }), toUsdc, ME)), 'unsafe_transaction');        // no contract at all
  assert.ok(M.sameThorAsset('ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48', M.thorAsset(USDC)));
});

// ---------------------------------------------------------------- H1 / M2: Solana dry-run effects (Jupiter)
test('H1/M2 Solana: only the sold token may leave, the bought asset must reach the confirmed minimum, unreadable token balances refuse', () => {
  const SOLA = M.nativeAsset('solana'); const SUSDC = { ...SOLA, assetId: 'x', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', decimals: 6 };
  const sell = stepOf(SOLA, SUSDC, '1000000000', '150000000', '147000000'); const floor = M.confirmedFloor(sell);
  const ok = { ok: true, solDelta: -1_000_005_000n, tokensChecked: true, tokenWarnings: [], tokenChanges: [{ mint: SUSDC.address, amount: '149000000', direction: 'in' }] };
  assert.equal(M.checkSolSwapEffect(ok, sell, floor), null);
  assert.equal(M.checkSolSwapEffect({ ...ok, tokenChanges: [...ok.tokenChanges, { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', amount: '5', direction: 'out' }] }, sell, floor), 'unexpected_outflow');   // drains another token
  assert.equal(M.checkSolSwapEffect({ ...ok, tokenChanges: [{ mint: SUSDC.address, amount: '100', direction: 'in' }] }, sell, floor), 'below_minimum');
  assert.equal(M.checkSolSwapEffect({ ...ok, solDelta: -3_000_000_000n }, sell, floor), 'oversend');
  assert.equal(M.checkSolSwapEffect({ ...ok, tokensChecked: false }, sell, floor), 'not_verified');
  assert.equal(M.checkSolSwapEffect({ ...ok, tokenWarnings: ['tokenDelegated'] }, sell, floor), 'unexpected_outflow');
  const buy = stepOf(SUSDC, SOLA, '150000000', '1000000000', '980000000');
  const ok2 = { ok: true, solDelta: 990_000_000n, tokensChecked: true, tokenWarnings: [], tokenChanges: [{ mint: SUSDC.address, amount: '150000000', direction: 'out' }] };
  assert.equal(M.checkSolSwapEffect(ok2, buy, M.confirmedFloor(buy)), null);
  assert.equal(M.checkSolSwapEffect({ ...ok2, tokenChanges: [{ mint: SUSDC.address, amount: '150000001', direction: 'out' }] }, buy, M.confirmedFloor(buy)), 'oversend');
  assert.equal(M.checkSolSwapEffect({ ...ok2, solDelta: 100_000_000n }, buy, M.confirmedFloor(buy)), 'below_minimum');
});

// ---------------------------------------------------------------- H3 / M5: worker-held routes
test('H3/M5 route store: ids minted in the worker, owner-bound, confirmation required and replaced, single use, one flow at a time', async () => {
  const S = new M.SwapRouteStore();
  const r = { id: 'from-backend', source: 'lifi', expiresAt: 1_000_000, steps: [stepOf(ETH, USDC, '1', '2', '1')], tags: [], warnings: [] };
  const [shown] = S.put([r], { slippagePct: 2, owner: '0xAbC' }, 0);
  assert.notEqual(shown.id, 'from-backend');
  shown.steps[0].to.minAmount = '0';                                   // editing the popup's copy changes nothing held
  assert.equal(S.get(shown.id, '0xabc', 1).route.steps[0].to.minAmount, '1');
  assert.equal(code(() => S.get(shown.id, '0xother', 1)), 'price_moved');
  assert.equal(code(() => S.get('nope', '0xabc', 1)), 'price_moved');
  const h = S.get(shown.id, '0xabc', 1);
  assert.equal(code(() => S.checkConfirm(h, undefined, 1)), 'price_moved');
  const c1 = S.issueConfirm(shown.id, 1); const c2 = S.issueConfirm(shown.id, 2);
  assert.equal(code(() => S.checkConfirm(h, c1, 3)), 'price_moved');   // replaced by the later preview
  assert.equal(code(() => S.checkConfirm(h, c2, 3)), null);
  assert.equal(code(() => S.checkConfirm(h, c2, 3 + M.CONFIRM_TTL_MS)), 'price_moved');
  assert.equal(code(() => S.get(shown.id, '0xabc', 1_000_000 + M.ROUTE_GRACE_MS)), 'price_moved');   // expired
  S.consume(shown.id); assert.equal(code(() => S.get(shown.id, '0xabc', 1)), 'price_moved');
  let release; const first = S.exclusive(() => new Promise((res) => { release = res; }));
  await assert.rejects(() => S.exclusive(async () => 1), (e) => e.code === 'busy');
  release(); await first; assert.equal(await S.exclusive(async () => 7), 7);
});
