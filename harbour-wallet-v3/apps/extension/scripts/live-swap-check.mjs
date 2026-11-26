// Runs the extension's own pre-sign checks on REAL provider answers captured by the backend live test
// (apps/backend: go test -tags live ./internal/swapsvc ./internal/earnsvc with HB_LIVE_OUT=<dir>). Nothing is signed or sent.
//   node scripts/live-swap-check.mjs <dir>
import { build } from 'esbuild';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/live-swap-check.mjs <dir>'); process.exit(2); }
const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `
  export { acceptRoute } from './core/swap/backend'; export { validateLifiTransaction, parseSolanaTx, b64ToBytes, JUPITER_PROGRAM } from './core/swap/safety';
  export { relayTransactions, relayTargets } from './core/swap/relay'; export { checkThorQuote } from './core/swap/thorchain';
  export { prepareSwap, setUniswapBackend } from './integrations/testnet-defi/uniswap'; export { verifyKitTx } from './integrations/testnet-defi/aavekit';
  export { BASE_SEPOLIA, SEPOLIA } from './integrations/testnet-defi/config'; export { domainById } from './core/swap/domains';`,
  resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const read = (f) => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), 'utf8')) : null);
const results = []; const ok = (name, detail = '') => results.push(['PASS', name, detail]); const bad = (name, detail) => results.push(['FAIL', name, detail]);
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (bytes) => { let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of bytes) { if (b) break; s = '1' + s; } return s; };
const tsReq = (r) => ({ from: r.from, to: r.to, fromAddress: r.fromAddress, toAddress: r.toAddress, amount: r.amount, slippage: r.slippage, sortBy: r.sortBy || 'quantity' });

// 1. every live route passes the client's route screening
for (const name of ['lifi_eth_usdc_ethereum', 'lifi_usdc_eth_base', 'lifi_bridge_arb_base', 'relay_usdc_eth_to_base', 'relay_eth_base_to_sol', 'jupiter_sol_usdc', 'all_eth_usdc_ethereum']) {
  const q = read(`${name}.quotes.json`); if (!q) { bad(`${name}: routes`, 'no capture'); continue; }
  const routes = q.result.routes; const kept = routes.map((r) => M.acceptRoute(structuredClone(r), tsReq(q.request))).filter(Boolean);
  (kept.length === routes.length ? ok : bad)(`${name}: route screening`, `${kept.length}/${routes.length} routes accepted`);
}
const relayChains = read('relay_chains.json');
const relayFetch = async () => ({ ok: true, json: async () => relayChains });

// 2. fresh transactions pass the provider-specific pre-sign checks
for (const name of ['lifi_eth_usdc_ethereum', 'lifi_usdc_eth_base', 'lifi_bridge_arb_base', 'relay_usdc_eth_to_base', 'relay_eth_base_to_sol', 'jupiter_sol_usdc']) {
  const t = read(`${name}.transaction.json`); const q = read(`${name}.quotes.json`); if (!t || !q) { bad(`${name}: transaction`, 'no capture'); continue; }
  const req = tsReq(q.request); const route = M.acceptRoute(structuredClone(t.route), req); if (!route) { bad(`${name}: transaction`, 'route refused'); continue; }
  const step = route.steps[0]; const d = M.domainById(step.fromDomainId); const td = M.domainById(step.toDomainId);
  try {
    if (route.source === 'lifi') {
      const e = M.validateLifiTransaction(t.fresh, step, { ourAddress: req.fromAddress, chainId: d.chainId, slippagePct: Number(req.slippage), destKind: td.kind });
      e ? bad(`${name}: LI.FI pre-sign checks`, `${e.code} (tx.to=${t.fresh?.transactionRequest?.to}, selector=${String(t.fresh?.transactionRequest?.data).slice(0, 10)})`) : ok(`${name}: LI.FI pre-sign checks`, `to=${t.fresh.transactionRequest.to}`);
    } else if (route.source === 'relay') {
      if (!relayChains) { bad(`${name}: Relay pre-sign checks`, 'no relay_chains capture'); continue; }
      const targets = await M.relayTargets(d.chainId, relayFetch);
      const plan = M.relayTransactions(t.fresh, step, { ourAddress: req.fromAddress, chainId: d.chainId, slippagePct: Number(req.slippage), targets });
      ok(`${name}: Relay pre-sign checks`, `${plan.txs.map((x) => x.kind).join('+')} to ${[...new Set(plan.txs.map((x) => x.to))].join(',')}`);
    } else if (route.source === 'jupiter') {
      const p = M.parseSolanaTx(M.b64ToBytes(t.fresh.swapTransaction));
      const keys = p.accountKeys.map(b58);
      (keys[0] === req.fromAddress && p.sigSlots === 1 && keys.includes(M.JUPITER_PROGRAM) ? ok : bad)(`${name}: Jupiter tx shape`, `fee payer ${keys[0] === req.fromAddress ? 'is us' : keys[0]}, signers ${p.sigSlots}, Jupiter program ${keys.includes(M.JUPITER_PROGRAM)}`);
    }
  } catch (e) { bad(`${name}: pre-sign checks`, e?.code ?? e?.message); }
}

// 3. Uniswap (Sepolia): Harbour's full prepareSwap validation on the live backend answer
for (const native of [true, false]) {
  const u = read(`uniswap_sepolia_${native}.json`); if (!u) { bad(`uniswap ${native ? 'ETH->USDC' : 'USDC->ETH'}`, 'no capture'); continue; }
  const r = u.request;
  M.setUniswapBackend(async () => u.prepared);
  const client = { getBalance: async () => 10n ** 21n, readContract: async (c) => ({ symbol: 'USDC', decimals: 6, balanceOf: 10n ** 12n })[c.functionName] };
  const realNow = Date.now; Date.now = () => (r.deadline - 300) * 1000;
  try {
    const p = await M.prepareSwap(client, r.swapper, r.tokenIn, r.tokenOut, BigInt(r.amount), r.slippageBps, r.deadline);
    ok(`uniswap ${native ? 'ETH->USDC' : 'USDC->ETH'}: prepareSwap checks`, p.calls.map((c) => c.label).join(' + '));
  } catch (e) { bad(`uniswap ${native ? 'ETH->USDC' : 'USDC->ETH'}: prepareSwap checks`, e.message); }
  finally { Date.now = realNow; }
}

// 4. Aave (Base Sepolia): the live native supply plan passes verifyKitTx
const a = read('aave_supply_native.json'); const m = read('aave_markets.json');
if (a && m) {
  const market = m.markets.find((x) => x.chain.chainId === 84532);
  const weth = market.reserves.find((r) => r.acceptsNative);
  const plan = a.data.value; const ctx = { owner: a.request.sender, token: '0x0000000000000000000000000000000000000000', aToken: weth.aToken.address, amount: 10n ** 14n, action: 'supply', deployment: M.BASE_SEPOLIA };
  try {
    const calls = plan.__typename === 'ApprovalRequired' ? [M.verifyKitTx(plan.approval, ctx, 'approval'), M.verifyKitTx(plan.originalTransaction, ctx, 'main')] : [M.verifyKitTx(plan, ctx, 'main')];
    ok('aave native supply: verifyKitTx', calls.map((c) => c.label).join(' + '));
  } catch (e) { bad('aave native supply: verifyKitTx', e.message); }
} else bad('aave native supply', 'no capture');

for (const [s, n, d] of results) console.log(`${s}  ${n}${d ? `  — ${d}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
