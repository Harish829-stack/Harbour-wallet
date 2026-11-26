import { evmTransport } from '../kit/evmTransport';
import { checkToken } from '../kit/clients/securityClient';
// Swap execution service (background). Mirrors TW's staged swap pipeline recovered from the App
// chunk actions: FetchSwapQuote -> (StageSwapApproval/ExecuteSwapApproval) -> StageSwapTransaction ->
// ExecuteSwap/BroadcastSwapTransaction -> GetSwapSettlementStatus -> RecordSwapTransaction.
import { createPublicClient, http, defineChain, erc20Abi, maxUint256, isAddress, encodeFunctionData } from 'viem';
import { evmAccountFromBytes } from '../core/provider/evmAccount';
import { local } from '../core/storage';
import { rpcUrl, solanaRpcUrl, protectedRpcUrl } from '../core/rpc';
import { openActiveKeys, activeAddresses } from './keys';
import type { VaultService } from '../core/vaultService';
import type { WalletService } from '../core/walletService';
import type { SwapAsset, SwapHistoryItem, SwapRoute, SwapRouteRequest, SwapSettings, SwapStep, SwapQuoteResult } from '../core/swap/types';
import { DEFAULT_SWAP_SETTINGS } from '../core/swap/types';
import { domainById, SWAP_DOMAINS } from '../core/swap/domains';
import { getSwapRoutes } from '../core/swap/engine';
import { swapError } from '../core/swap/errors';
import { backendTransaction, backendStatus, backendToken, setSwapBackend } from '../core/swap/backend';
import { simulateCallsParams, readSimulatedCalls, checkSwapEffect, checkSolSwapEffect, type SimCall, type SwapEffect } from '../core/swap/simGuard';
import { signedRequest } from '../core/harbour/client';
import { popularAssets, nativeAsset } from '../core/swap/tokens';
import { pickDust, DUST_DEFAULT_USD, type DustCandidate } from '../core/swap/dust';
import { validateLifiTransaction, isAllowedLifiTarget, parseSolanaTx, attachSolanaSignature, b64ToBytes, bytesToB64, JUPITER_PROGRAM, confirmedFloor } from '../core/swap/safety';
import { parseSolTx, resolveLookupTables, guardSolSwapTx, SWAP_BASE_PROGRAMS } from '../core/provider/solanaTx';
import { simulateSolTx, solAccountData } from '../core/provider/solSim';
import { SWAP_WATCH_TIMEOUT_MS, normalizeSlippage } from '../core/swap/rules';
import { SwapRouteStore, type HeldRoute } from '../core/swap/routeStore';
import { relayTransactions, relayTargets, relayChains } from '../core/swap/relay';
import { checkThorQuote, verifyThorInbound, thorRouterCall } from '../core/swap/thorchain';
import { utxoFamily } from '../core/chains/send/utxo';
import { chainById } from '../core/chains/index';
import { sendCalls, sendCallsAvailable } from './smartAccountService';
import { isSmartAccountChain } from '../core/smartAccount/constants';
type Call = { to: `0x${string}`; value: bigint; data: `0x${string}` };
import { isContractCode } from '../core/evmCode';
/**
 * Refuse a Jupiter-built Solana transaction unless every instruction is a known program (no direct token transfers, no
 * authority changes) and a dry run shows only the sold asset leaving and at least the confirmed minimum arriving (audit H1/M2).
 */
async function guardSolanaSwap(bytes: Uint8Array, wallet: string, step: SwapStep): Promise<void> {
  const bad = swapError('unsafe_transaction');
  let tx; try { tx = await resolveLookupTables(parseSolTx(bytes), (a) => solAccountData(solRpc, a)); } catch { throw bad; }
  const sell = step.from.asset.address === 'native' ? BigInt(step.from.amount) : 0n;
  if (guardSolSwapTx(tx, { wallet, sellLamports: sell, programs: [...SWAP_BASE_PROGRAMS, JUPITER_PROGRAM], allowTokenTransfers: false })) throw bad;
  const sim = await simulateSolTx(solRpc, bytes, wallet, tx);
  if (!sim.ok) throw swapError('simulation_failed');
  const why = checkSolSwapEffect(sim, step, confirmedFloor(step));
  if (why === 'not_verified') throw swapError('not_verified');
  if (why === 'below_minimum') throw swapError('price_moved');
  if (why) throw bad;
}

/** Routes live in the worker; the popup refers to them by id (audit H3). */
const held = new SwapRouteStore();

// Quotes and fresh transactions come from Harbour's swap service (backend /v1/swap), signed with the device key.
setSwapBackend((method, path, body) => signedRequest(method, path, body === undefined ? undefined : JSON.stringify(body), {}, AbortSignal.timeout(30_000)));

/** The request for a fresh quote of a confirmed step: same assets and amount, our own addresses and the user's own slippage
 *  (never a value carried in the route, which came from the backend). */
function freshRequest(_raw: unknown, step: SwapStep, fromAddress: string, toAddress: string, slippagePct: number): SwapRouteRequest {
  return { from: step.from.asset, to: step.to.asset, amount: step.from.amount, fromAddress, toAddress, slippage: String(slippagePct), sortBy: 'quantity', solanaTurbo: false };
}
async function jupiterTx(route: SwapRoute, turbo: boolean, user: string): Promise<string> {
  const r = await backendTransaction({ source: 'jupiter', ref: route.quoteRef ?? '', priority: turbo ? 'turbo' : 'fast', user });
  if (typeof r?.swapTransaction !== 'string') throw swapError('network');
  return r.swapTransaction;
}

/**
 * Dry-run the calls (approve first when needed, then the swap) and hold them to the confirmed step: only the sold asset
 * (at most the sold amount) and the calls' own native value may leave the wallet, and a same-chain swap must pay at least
 * the confirmed minimum. null = this network's RPC cannot simulate; the provider-specific checks still apply.
 */
/** Largest swap (USD, as quoted) that may go ahead when the RPC cannot simulate it. Larger swaps wait for a network that can. */
export const UNSIMULATED_MAX_USD = 250;
function unsimulated(route: SwapRoute): null {
  const usd = route.fromAmountUsd;
  if (!(typeof usd === 'number' && Number.isFinite(usd) && usd > 0 && usd <= UNSIMULATED_MAX_USD)) throw swapError('not_verified');
  return null;
}
async function guardEvmSwap(client: any, address: string, route: SwapRoute, step: SwapStep, calls: SimCall[]): Promise<SwapEffect | null> {
  let result: any;
  // Only an RPC that does not offer eth_simulateV1 is "cannot simulate" (shown as such on the confirm screen). Any other failure
  // (timeout, rate limit, server error) is retried once and then blocks the swap: it is never silently skipped (audit M4).
  for (let attempt = 0; ; attempt++) {
    try { result = await client.request({ method: 'eth_simulateV1', params: simulateCallsParams(calls) } as any); break; }
    catch (e: any) {
      const code = e?.code ?? e?.cause?.code; const msg = String(e?.details ?? e?.shortMessage ?? e?.message ?? '');
      // "method not found" (JSON-RPC -32601) or a message that names eth_simulateV1 as unavailable. A hostile RPC can still claim
      // this, so such swaps are limited to small amounts (UNSIMULATED_MAX_USD).
      if (code === -32601 || /eth_simulateV1.*(not (found|supported|available|exist)|does not exist|unsupported)|method not found|the method .* does not exist/i.test(msg)) return unsimulated(route);
      if (attempt >= 1) throw swapError('not_verified');
    }
  }
  const sim = readSimulatedCalls(result, address);
  if (!sim) return unsimulated(route);
  if (!sim.ok) throw swapError('simulation_failed');
  const check = checkSwapEffect(sim.changes, step, { maxNativeOut: calls.reduce((a, c) => a + c.value, 0n) });
  if (check.ok) return check.effect;
  // Some RPCs do not trace internal native transfers: a missing native payout is "not verified", not proof of theft.
  if (check.reason === 'nothing_received' && step.to.asset.address === 'native') return unsimulated(route);
  throw check.reason === 'below_minimum' ? swapError('price_moved') : swapError('unsafe_transaction');
}
/**
 * Highest max fee per gas Harbour signs for a swap, per chain (wei; audit M8): far above normal (~100-1000x on L2s) so real
 * spikes still go through, but a lying RPC cannot make a swap cost a fortune. Review when gas markets change. A chain without
 * an entry gets 5x the latest block's base fee (+ priority) instead of being blocked.
 */
const GWEI = 10n ** 9n;
export const MAX_FEE_PER_GAS: Record<number, bigint> = { 1: 1000n * GWEI, 56: 100n * GWEI, 137: 10_000n * GWEI, 42161: 50n * GWEI, 8453: 50n * GWEI, 11155111: 1000n * GWEI, 84532: 100n * GWEI };
const MAX_GAS = 3_000_000n;
const approveData = (spender: string, amount: bigint) => encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender as `0x${string}`, amount] });

const SETTINGS_KEY = 'wallet:swap:settings';
const HISTORY_KEY = 'wallet:swap:history';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
const USDT_MAINNET = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];

export interface SwapDeps { core: any; vault: VaultService; wallet: WalletService }
const fail = (e: any): { ok: false; error: string; code?: string; minAmount?: string } => {
  if (e && typeof e === 'object' && typeof e.code === 'string' && typeof e.message === 'string') return { ok: false, error: e.message, code: e.code, minAmount: e.minAmount };
  return { ok: false, error: e?.shortMessage || e?.message || 'Swap failed' };
};

// ---------- settings & history persistence ----------
export async function getSettings(): Promise<SwapSettings> {
  const s = (await local.get<Partial<SwapSettings>>(SETTINGS_KEY)) ?? {};
  return { ...DEFAULT_SWAP_SETTINGS, ...s, slippage: normalizeSlippage(String(s.slippage ?? DEFAULT_SWAP_SETTINGS.slippage)), recentAssets: Array.isArray(s.recentAssets) ? s.recentAssets.slice(0, 6) : [] };
}
export async function setSettings(patch: Partial<SwapSettings>): Promise<SwapSettings> {
  const cur = await getSettings();
  const next: SwapSettings = { ...cur };
  if (typeof patch.slippage === 'string') next.slippage = normalizeSlippage(patch.slippage);
  for (const k of ['mev', 'solanaTurbo', 'unlimitedAllowance', 'gasless'] as const) if (typeof patch[k] === 'boolean') next[k] = patch[k] as boolean;
  if (patch.sortBy && ['quantity', 'security', 'latency', 'outcome'].includes(patch.sortBy)) next.sortBy = patch.sortBy;
  await local.set(SETTINGS_KEY, next);
  return next;
}
export async function rememberAssets(assets: SwapAsset[]): Promise<void> {
  const cur = await getSettings();
  const seen = new Set<string>(); const list: SwapAsset[] = [];
  for (const a of [...assets, ...cur.recentAssets]) { if (!seen.has(a.assetId)) { seen.add(a.assetId); list.push(a); } }
  await local.set(SETTINGS_KEY, { ...cur, recentAssets: list.slice(0, 6) });
}
export async function listHistory(): Promise<SwapHistoryItem[]> { return (await local.get<SwapHistoryItem[]>(HISTORY_KEY)) ?? []; }
async function saveHistory(item: SwapHistoryItem): Promise<void> {
  const list = (await listHistory()).filter((h) => h.id !== item.id);
  await local.set(HISTORY_KEY, [item, ...list].slice(0, 100));
}

// ---------- chain clients ----------
function evmClient(chainId: number, url?: string) {
  const u = url ?? rpcUrl(chainId);
  if (!u) throw swapError('unsupported_domain');
  const chain = defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: 'native', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [u] } }, contracts: { multicall3: { address: MULTICALL3 } } });
  return { chain, client: createPublicClient({ chain, transport: url ? http(u, { timeout: 15000, retryCount: 1 }) : evmTransport(chainId) }) };
}
async function solRpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(solanaRpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15000) });
  const j = await res.json();
  if (j?.error) throw new Error(j.error.message || 'Solana RPC error');
  return j.result;
}

// ---------- bitcoin (THORChain swaps) ----------
const btcChain = () => { const c = chainById('bitcoin'); if (!c) throw swapError('unsupported_domain'); return c; };
const sendEnv = (core: any) => ({ core, fetch: (u: any, i?: any) => fetch(u, i) });
async function btcBalance(address: string): Promise<bigint> {
  const c = btcChain(); let last: unknown;
  for (const u of (c.endpoints ?? []).map((x: string) => x.replace(/\/$/, ''))) {
    try {
      const r = await fetch(`${u}/address/${address}`, { signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: any = await r.json(); const cs = j.chain_stats ?? {}; const ms = j.mempool_stats ?? {};
      return BigInt(cs.funded_txo_sum ?? 0) - BigInt(cs.spent_txo_sum ?? 0) + BigInt(ms.funded_txo_sum ?? 0) - BigInt(ms.spent_txo_sum ?? 0);
    } catch (e) { last = e; }
  }
  throw last ?? new Error('No Bitcoin endpoint');
}

// ---------- balances ----------
export async function getBalances(deps: SwapDeps, assets: SwapAsset[]): Promise<Record<string, string>> {
  const addresses = await activeAddresses(deps.vault); // read-only: no keystore decryption (OBS-05)
  const out: Record<string, string> = {};
  await Promise.all(SWAP_DOMAINS.map(async (d) => {
    const list = assets.filter((a) => a.domainId === d.id);
    const owner = addresses[d.addressKey];
    if (!list.length || !owner) return;
    try {
      if (d.kind === 'evm') {
        const { client } = evmClient(d.chainId!);
        const tokens = list.filter((a) => a.address !== 'native');
        if (list.some((a) => a.address === 'native')) {
          const n = list.find((a) => a.address === 'native')!;
          out[n.assetId] = (await client.getBalance({ address: owner as `0x${string}` })).toString();
        }
        if (tokens.length) {
          const res = await client.multicall({ allowFailure: true, contracts: tokens.map((t) => ({ address: t.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf' as const, args: [owner as `0x${string}`] })) });
          tokens.forEach((t, i) => { const r = res[i]; out[t.assetId] = r.status === 'success' ? String(r.result) : '0'; });
        }
      } else if (d.kind === 'utxo') {
        const n = list.find((a) => a.address === 'native');
        if (n) out[n.assetId] = String(await btcBalance(owner));
      } else {
        if (list.some((a) => a.address === 'native')) {
          const n = list.find((a) => a.address === 'native')!;
          out[n.assetId] = String((await solRpc('getBalance', [owner])).value ?? 0);
        }
        const sums = new Map<string, bigint>();
        for (const programId of TOKEN_PROGRAMS) {
          try {
            const r = await solRpc('getTokenAccountsByOwner', [owner, { programId }, { encoding: 'jsonParsed' }]);
            for (const acc of r?.value ?? []) { const info = acc?.account?.data?.parsed?.info; if (info?.mint) sums.set(info.mint, (sums.get(info.mint) ?? 0n) + BigInt(info.tokenAmount?.amount ?? '0')); }
          } catch { /* program may have no accounts / be rate limited */ }
        }
        for (const t of list.filter((a) => a.address !== 'native')) out[t.assetId] = (sums.get(t.address) ?? 0n).toString();
      }
    } catch { for (const a of list) if (out[a.assetId] === undefined) out[a.assetId] = '0'; }
  }));
  return out;
}

// "Max" for a native sell leaves room for network fees (TW: MaxAmountForSwapTip).
export async function maxSpendable(deps: SwapDeps, asset: SwapAsset): Promise<{ max: string; belowFee: boolean }> {
  const bal = BigInt((await getBalances(deps, [asset]))[asset.assetId] ?? '0');
  if (asset.address !== 'native') return { max: bal.toString(), belowFee: false };
  const d = domainById(asset.domainId)!;
  let reserve: bigint;
  if (d.kind === 'utxo') {
    // exact: wallet-core's max plan at the average fee rate, plus room for the 80-byte OP_RETURN memo output
    const from = (await activeAddresses(deps.vault)).bitcoin;
    const q = await utxoFamily.quote(sendEnv(deps.core), { chain: btcChain(), from, to: from, amount: 0n, asset: { kind: 'native' } } as any);
    const avg = q.tiers.find((t) => t.id === 'average')!;
    const max = avg.max > 0n ? avg.max - BigInt(Math.ceil(Number(avg.detail?.split(' ')[0] ?? 2) * 90)) : 0n;
    return max > 546n ? { max: max.toString(), belowFee: false } : { max: '0', belowFee: true };
  }
  if (d.kind === 'solana') reserve = 10_000_000n; // fee + priority + possible token-account rent
  else { const { client } = evmClient(d.chainId!); const gp = await client.getGasPrice(); reserve = (gp * 600_000n * 12n) / 10n; }
  return bal > reserve ? { max: (bal - reserve).toString(), belowFee: false } : { max: '0', belowFee: true };
}

// ---------- gasless (smart account operation, sponsored) ----------
// Uses the user's own smart account (MetaMask Stateless7702, Settings > Wallet > Smart account) through smartAccountService.sendCalls.
// Behind the remote flag `smartAccounts`; if anything is unavailable the callers fall back to normal transactions.
/** Offered only when the flag is on and the gateway can reach a bundler (Sepolia and Base Sepolia for now). */
export async function gaslessAvailable(): Promise<boolean> { return (await sendCallsAvailable(11155111)) || (await sendCallsAvailable(84532)); }
async function gaslessActive(chainId: number): Promise<boolean> {
  return isSmartAccountChain(chainId) && (await sendCallsAvailable(chainId));
}
/** Run calls as one sponsored operation; null when unavailable (caller falls back to normal transactions). */
async function tryGasless(chainId: number, client: any, privateKey: Uint8Array, sender: string, calls: Call[]): Promise<`0x${string}` | null> {
  return sendCalls({ chainId, client, account: sender, privateKey, calls, sponsor: true });
}

// ---------- quote ----------
export async function quote(deps: SwapDeps, p: { from: SwapAsset; to: SwapAsset; amount: string; slippage: string }): Promise<{ ok: true; result: SwapQuoteResult } | ReturnType<typeof fail>> {
  try {
    const settings = await getSettings();
    const addrs = await activeAddresses(deps.vault);
    const fd = domainById(p.from.domainId); const td = domainById(p.to.domainId);
    if (!fd || !td) throw swapError('unsupported_domain');
    const fromAddress = addrs[fd.addressKey]; const toAddress = addrs[td.addressKey];
    if (!fromAddress || !toAddress) throw swapError('invalid_asset');
    const result = await getSwapRoutes({ from: p.from, to: p.to, amount: p.amount, slippage: normalizeSlippage(p.slippage), fromAddress, toAddress, sortBy: settings.sortBy, solanaTurbo: settings.solanaTurbo });
    // annotate ERC-20 approvals with the on-chain allowance so the CTA can say "Approve and Swap"
    if (fd.kind === 'evm') {
      const { client } = evmClient(fd.chainId!);
      await Promise.all(result.routes.map(async (r) => {
        const a = r.steps[0].approval; if (!a) return;
        try {
          const cur = (await client.readContract({ address: a.tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [fromAddress as `0x${string}`, a.spender as `0x${string}`] })) as bigint;
          a.needed = cur < BigInt(a.minAmount);
        } catch { a.needed = true; }
      }));
    }
    // advisory GoPlus token-risk warning for the buy side (never blocks; failures are silent)
    if (td.kind === 'evm' && p.to.address !== 'native') {
      const risk = await checkToken(td.chainId!, p.to.address);
      if (risk.risky) for (const r of result.routes) r.warnings.push({ code: 'token_risk', message: `Token flagged as risky: ${risk.flags.join(', ')}` });
    }
    result.routes = held.put(result.routes, { slippagePct: Number(normalizeSlippage(p.slippage)), owner: fromAddress });
    return { ok: true, result };
  } catch (e) { return fail(e); }
}

/** The held route for the popup's id, checked against the account that is active now. */
async function heldFor(deps: SwapDeps, routeId: unknown): Promise<HeldRoute> {
  const d = domainById(held.peek(routeId)?.route.steps[0]?.fromDomainId ?? '');
  if (!d) throw swapError('quote_expired');
  const owner = (await activeAddresses(deps.vault))[d.addressKey] as string | undefined;
  return held.get(routeId, owner ?? '');
}

// ---------- approval ----------
async function ourContext(deps: SwapDeps, step: SwapStep) {
  const d = domainById(step.fromDomainId)!;
  const keys = await openActiveKeys(deps.core, deps.vault, deps.wallet);
  return { d, keys, address: keys.addresses[d.addressKey] as string };
}
function checkStepShape(route: SwapRoute, stepIndex: number): SwapStep {
  const step = route?.steps?.[stepIndex];
  if (!step || route.steps.length !== 1 || stepIndex !== 0) throw swapError('unsupported_pair');
  if (!domainById(step.fromDomainId) || !domainById(step.toDomainId)) throw swapError('unsupported_domain');
  return step;
}

/** The spender the aggregator named for this very quote (LI.FI approvalAddress, Relay's approve item, THORChain's router). */
function expectedSpender(source: SwapRoute['source'], raw: any): string {
  if (source === 'relay') return String(raw?.approveSpender ?? '');
  if (source === 'thorchain') return String(raw?.quote?.router ?? '');
  return String(raw?.estimate?.approvalAddress ?? '');
}

/** Approve the sold token for a previewed route. Unlimited approvals only when the user turned them on in swap settings. */
export async function approve(deps: SwapDeps, p: { routeId: unknown; confirmId: unknown }) {
  try {
    const h = await heldFor(deps, p.routeId);
    held.checkConfirm(h, p.confirmId);
    const settings = await getSettings();
    return await held.exclusive(() => approveHeld(deps, h, settings.unlimitedAllowance));
  } catch (e) { return fail(e); }
}

async function approveHeld(deps: SwapDeps, h: HeldRoute, unlimited: boolean) {
  const p = { route: h.route, unlimited };
  try {
    const step = checkStepShape(p.route, 0);
    const a = step.approval; const { d, keys, address } = await ourContext(deps, step);
    if (d.kind !== 'evm' || !a || !isAddress(a.tokenAddress) || !isAddress(a.spender)) { keys.dispose(); throw swapError('unsupported_pair'); }
    const raw: any = step.raw;
    // the spender must be the one the aggregator named for this very quote
    if (expectedSpender(p.route.source, raw).toLowerCase() !== a.spender.toLowerCase()) { keys.dispose(); throw swapError('unsafe_transaction'); }
    // ...and it must be a contract we can verify independently of that response
    if (p.route.source === 'lifi' && !isAllowedLifiTarget(d.chainId!, a.spender)) { keys.dispose(); throw swapError('unsafe_transaction'); }
    if (p.route.source === 'relay' && !(await relayTargets(d.chainId!)).has(a.spender.toLowerCase())) { keys.dispose(); throw swapError('unsafe_transaction'); }
    if (p.route.source === 'thorchain') { try { await verifyThorInbound({ inbound_address: raw?.quote?.inbound_address, router: raw?.quote?.router }, step); } catch (e) { keys.dispose(); throw e; } }
    // gasless swaps batch the approval into the sponsored user operation (approve + swap in one op)
    if (await gaslessActive(d.chainId!)) { keys.dispose(); return { ok: true as const, skipped: true, deferred: true }; }
    try {
      const account = evmAccountFromBytes(keys.evmPrivateKey());
      const { chain, client } = evmClient(d.chainId!);
      const spender = a.spender as `0x${string}`; const token = a.tokenAddress as `0x${string}`;
      const need = BigInt(a.minAmount);
      const amount = p.unlimited ? maxUint256 : need;
      const send = async (value: bigint) => {
        const gas = await client.estimateContractGas({ account, address: token, abi: erc20Abi, functionName: 'approve', args: [spender, value] });
        const data = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, value] });
        return broadcastEvm(client, chain, account, { to: token, data, value: 0n, gas: (gas * 12n) / 10n }, undefined);
      };
      const cur = (await client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, spender] })) as bigint;
      if (cur >= need) return { ok: true as const, skipped: true };
      // USDT on Ethereum reverts when raising a non-zero allowance: reset first.
      if (cur > 0n && token.toLowerCase() === USDT_MAINNET && d.chainId === 1) { const h0 = await send(0n); await client.waitForTransactionReceipt({ hash: h0, timeout: 120_000 }); }
      const hash = await send(amount);
      const id = crypto.randomUUID(); const now = Date.now();
      h.historyId = id;
      await saveHistory({ id, createdAt: now, updatedAt: now, status: 'approving', address, fromAsset: step.from.asset, toAsset: step.to.asset, fromAmount: step.from.amount, toAmountExpected: step.to.amount, toAmountMin: step.to.minAmount, provider: step.provider.name, stepIndex: 0, stepCount: 1, approvalTxHash: hash, fromDomainId: step.fromDomainId, toDomainId: step.toDomainId });
      const rc = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (rc.status !== 'success') { await patchHistory(id, { status: 'failed', error: 'Approval failed' }); throw new Error('Approval transaction failed'); }
      await patchHistory(id, { status: 'swapping' });
      return { ok: true as const, id, hash };
    } finally { keys.dispose(); }
  } catch (e) { return fail(e); }
}

async function patchHistory(id: string, patch: Partial<SwapHistoryItem>) {
  const it = (await listHistory()).find((h) => h.id === id); if (it) await saveHistory({ ...it, ...patch, updatedAt: Date.now() });
}

// Sign locally and broadcast raw (optionally through an MEV-protected RPC).
async function broadcastEvm(client: any, chain: any, account: any, tx: { to: `0x${string}`; data: `0x${string}`; value: bigint; gas: bigint }, protectedUrl?: string): Promise<`0x${string}`> {
  const req: any = await client.prepareTransactionRequest({ account, chain, to: tx.to, data: tx.data, value: tx.value, gas: tx.gas });
  const t: any = { chainId: chain.id, to: tx.to, data: tx.data, value: tx.value, gas: req.gas ?? tx.gas, nonce: req.nonce };
  let cap = MAX_FEE_PER_GAS[chain.id];
  if (cap == null) { const b = await client.getBlock({ blockTag: 'latest' }).catch(() => null); cap = b?.baseFeePerGas != null ? b.baseFeePerGas * 5n + 2n * GWEI : 0n; }
  if (BigInt(t.gas) > MAX_GAS || BigInt(req.maxFeePerGas ?? req.gasPrice ?? 0n) > cap) throw swapError('fee_too_high');
  if (req.maxFeePerGas != null) { t.type = 'eip1559'; t.maxFeePerGas = req.maxFeePerGas; t.maxPriorityFeePerGas = req.maxPriorityFeePerGas; }
  else { t.type = 'legacy'; t.gasPrice = req.gasPrice; }
  const serialized = await account.signTransaction(t);
  const sender = protectedUrl ? createPublicClient({ chain, transport: http(protectedUrl, { timeout: 15000 }) }) : client;
  return sender.sendRawTransaction({ serializedTransaction: serialized });
}

// ---------- submit ----------
/** Send a previewed route. Single use: the route is gone afterwards whatever happens. */
export async function submit(deps: SwapDeps, p: { routeId: unknown; confirmId: unknown }) {
  try {
    const h = await heldFor(deps, p.routeId);
    held.checkConfirm(h, p.confirmId);
    return await held.exclusive(async () => { held.consume(h.route.id); return submitHeld(deps, h); });
  } catch (e) { return fail(e); }
}

async function submitHeld(deps: SwapDeps, h: HeldRoute) {
  const p = { route: h.route, id: h.historyId };
  try {
    const step = checkStepShape(p.route, 0);
    const settings = await getSettings();
    const slippagePct = h.slippagePct;
    const { d, keys, address } = await ourContext(deps, step);
    try {
      if (!address || address.toLowerCase() !== h.owner) throw swapError('quote_expired');
      let hash: string; let requestId: string | undefined;
      const toDomain = domainById(step.toDomainId)!;
      const ownTo = keys.addresses[toDomain.addressKey]; // payouts always go to our own account, never to an address carried in the route
      if (!ownTo) throw swapError('invalid_asset');
      if (p.route.source === 'jupiter') {
        if (d.kind !== 'solana') throw swapError('unsupported_pair');
        const b64 = await jupiterTx(p.route, settings.solanaTurbo, address);
        const bytes = b64ToBytes(b64);
        const parsed = parseSolanaTx(bytes);
        const { key } = keys.solanaKey();
        const feePayer = deps.core.Base58.encodeNoCheck(parsed.accountKeys[0]);
        const programs = parsed.accountKeys.map((k) => deps.core.Base58.encodeNoCheck(k));
        if (feePayer !== address || parsed.sigSlots !== 1 || !programs.includes(JUPITER_PROGRAM)) throw swapError('unsafe_transaction');
        await guardSolanaSwap(bytes, address, step);
        const sig: Uint8Array = key.sign(parsed.message, deps.core.Curve.ed25519);
        const signed = attachSolanaSignature(bytes, parsed, sig);
        hash = await solRpc('sendTransaction', [bytesToB64(signed), { encoding: 'base64', skipPreflight: false, maxRetries: 3, preflightCommitment: 'confirmed' }]);
      } else if (p.route.source === 'relay') {
        if (d.kind !== 'evm') throw swapError('unsupported_pair');
        const raw: any = step.raw;
        const fresh = await backendTransaction({ source: 'relay', request: freshRequest(raw, step, address, ownTo, slippagePct) });
        const plan = relayTransactions(fresh, step, { ourAddress: address, chainId: d.chainId!, slippagePct, targets: await relayTargets(d.chainId!), ownTo, chains: await relayChains() });
        const account = evmAccountFromBytes(keys.evmPrivateKey());
        if (account.address.toLowerCase() !== address.toLowerCase()) throw swapError('unsafe_transaction');
        const { chain, client } = evmClient(d.chainId!);
        {
          const ap = plan.txs.find((t) => t.kind === 'approve');
          const short = !!ap && ((await client.readContract({ address: ap.to, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, step.approval!.spender as `0x${string}`] })) as bigint) < BigInt(step.from.amount);
          await guardEvmSwap(client, address, p.route, step, plan.txs.filter((t) => t.kind === 'execute' || short).map((t) => ({ from: address, to: t.to, data: t.data, value: t.value })));
        }
        let last: `0x${string}` | undefined;
        if (await gaslessActive(d.chainId!)) {
          const calls: Call[] = [];
          for (const tx of plan.txs) {
            if (tx.kind === 'approve') {
              const cur = (await client.readContract({ address: tx.to, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, step.approval!.spender as `0x${string}`] })) as bigint;
              if (cur >= BigInt(step.from.amount)) continue;
            }
            calls.push({ to: tx.to, data: tx.data, value: tx.value });
          }
          last = (await tryGasless(d.chainId!, client, keys.evmPrivateKey(), address, calls)) ?? undefined;
        }
        if (!last) for (const tx of plan.txs) {
          if (tx.kind === 'approve') {
            const cur = (await client.readContract({ address: tx.to, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, step.approval!.spender as `0x${string}`] })) as bigint;
            if (cur >= BigInt(step.from.amount)) continue;
          } else {
            const code = await client.getCode({ address: tx.to });
            if (!isContractCode(code)) throw swapError('unsafe_transaction'); // routers are real contracts, never wallets
          }
          let gas: bigint;
          try { gas = ((await client.estimateGas({ account, to: tx.to, data: tx.data, value: tx.value })) * 12n) / 10n; }
          catch { throw swapError('simulation_failed'); }
          const h = await broadcastEvm(client, chain, account, { ...tx, gas }, tx.kind === 'execute' && settings.mev ? protectedRpcUrl(d.chainId!) : undefined);
          if (tx.kind === 'approve') { const rc = await client.waitForTransactionReceipt({ hash: h, timeout: 120_000 }); if (rc.status !== 'success') throw new Error('Approval transaction failed'); }
          else last = h;
        }
        if (!last) throw swapError('unsafe_transaction');
        hash = last; requestId = plan.requestId;
      } else if (p.route.source === 'thorchain') {
        const raw: any = step.raw;
        // THORChain asks for a fresh quote right before sending (vault addresses rotate)
        const fresh = await backendTransaction({ source: 'thorchain', request: freshRequest(raw, step, address, ownTo, slippagePct) });
        fresh.memo = checkThorQuote(fresh, step, ownTo);
        await verifyThorInbound(fresh, step);
        if (d.kind === 'utxo') {
          const chain = btcChain(); const env = sendEnv(deps.core);
          const sp: any = { chain, from: address, to: String(fresh.inbound_address), amount: BigInt(step.from.amount), asset: { kind: 'native' }, memo: String(fresh.memo) };
          const q = await utxoFamily.quote(env, sp);
          if (q.issues.some((i) => i.blocking)) throw swapError('insufficient_gas');
          const key = keys.privateKeyFor(chain, address);
          let built;
          try { built = await utxoFamily.build(env, sp, key, q, 'fast'); } finally { key.fill(0); }
          hash = await utxoFamily.broadcast(env, chain, built);
        } else if (d.kind === 'evm') {
          const call = thorRouterCall(fresh, step);
          const account = evmAccountFromBytes(keys.evmPrivateKey());
          if (account.address.toLowerCase() !== address.toLowerCase()) throw swapError('unsafe_transaction');
          const { chain, client } = evmClient(d.chainId!);
          if (step.from.asset.address !== 'native') {
            const cur = (await client.readContract({ address: step.from.asset.address as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, call.to] })) as bigint;
            if (cur < BigInt(step.from.amount)) throw swapError('unsafe_transaction'); // approval must target this router first
          }
          const code = await client.getCode({ address: call.to });
          if (!isContractCode(code)) throw swapError('unsafe_transaction'); // routers are real contracts, never wallets
          await guardEvmSwap(client, address, p.route, step, [{ from: address, ...call }]);
          let gas: bigint;
          try { gas = ((await client.estimateGas({ account, ...call })) * 12n) / 10n; }
          catch { throw swapError('simulation_failed'); }
          hash = await broadcastEvm(client, chain, account, { ...call, gas }, undefined);
        } else throw swapError('unsupported_pair');
      } else {
        if (d.kind !== 'evm') throw swapError('unsupported_pair');
        const refreshed = await backendTransaction({ source: 'lifi', ref: p.route.quoteRef ?? '' });
        const bad = validateLifiTransaction(refreshed, step, { ourAddress: address, chainId: d.chainId!, slippagePct, destKind: toDomain.kind, destLifiChainId: toDomain.lifiChainId });
        if (bad) throw bad;
        const account = evmAccountFromBytes(keys.evmPrivateKey());
        if (account.address.toLowerCase() !== address.toLowerCase()) throw swapError('unsafe_transaction');
        const { chain, client } = evmClient(d.chainId!);
        const tx = refreshed.transactionRequest;
        const to = tx.to as `0x${string}`; const data = tx.data as `0x${string}`; const value = tx.value == null ? 0n : BigInt(tx.value);
        // the destination must be a contract (a swap router), never a plain wallet
        const code = await client.getCode({ address: to });
        if (!isContractCode(code)) throw swapError('unsafe_transaction'); // routers are real contracts, never wallets
        const a = step.approval;
        const allowanceShort = async () => !!a && step.from.asset.address !== 'native'
          && ((await client.readContract({ address: a.tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, a.spender as `0x${string}`] })) as bigint) < BigInt(a.minAmount);
        const approveCall = (): Call => ({ to: a!.tokenAddress as `0x${string}`, value: 0n, data: approveData(a!.spender, BigInt(a!.minAmount)) });
        await guardEvmSwap(client, address, p.route, step, [...((await allowanceShort()) ? [approveCall()] : []), { to, data, value }].map((c) => ({ from: address, ...c })));
        let gaslessHash: `0x${string}` | null = null;
        if (await gaslessActive(d.chainId!)) {
          // one sponsored op: (approve) + swap; the bundler simulates it as a whole
          gaslessHash = await tryGasless(d.chainId!, client, keys.evmPrivateKey(), address, [...((await allowanceShort()) ? [approveCall()] : []), { to, data, value }]);
          // gasless unavailable after the approval was deferred: approve normally first
          if (!gaslessHash && (await allowanceShort())) {
            const c = approveCall();
            const g = ((await client.estimateGas({ account, ...c })) * 12n) / 10n;
            const h = await broadcastEvm(client, chain, account, { ...c, gas: g }, undefined);
            const rc = await client.waitForTransactionReceipt({ hash: h, timeout: 120_000 }); if (rc.status !== 'success') throw new Error('Approval transaction failed');
          }
        }
        if (gaslessHash) hash = gaslessHash;
        else {
          let gas: bigint;
          try { gas = ((await client.estimateGas({ account, to, data, value })) * 12n) / 10n; }
          catch { throw swapError('simulation_failed'); }
          hash = await broadcastEvm(client, chain, account, { to, data, value, gas }, settings.mev ? protectedRpcUrl(d.chainId!) : undefined);
        }
      }
      const now = Date.now();
      const crossChain = step.fromDomainId !== step.toDomainId;
      const item: SwapHistoryItem = {
        id: p.id ?? crypto.randomUUID(), createdAt: now, updatedAt: now, status: crossChain ? 'bridging' : 'swapping', address,
        fromAsset: step.from.asset, toAsset: step.to.asset, fromAmount: step.from.amount, toAmountExpected: step.to.amount, toAmountMin: step.to.minAmount,
        provider: step.provider.name, stepIndex: 0, stepCount: 1, txHash: hash, fromDomainId: step.fromDomainId, toDomainId: step.toDomainId, bridge: crossChain ? step.provider.id : undefined,
        source: p.route.source, requestId,
      };
      const prev = p.id ? (await listHistory()).find((h) => h.id === p.id) : undefined;
      await saveHistory(prev ? { ...prev, ...item, createdAt: prev.createdAt, approvalTxHash: prev.approvalTxHash } : item);
      await rememberAssets([step.to.asset, step.from.asset]);
      return { ok: true as const, id: item.id, hash };
    } finally { keys.dispose(); }
  } catch (e) { return fail(e); }
}

// ---------- pre-sign preview: "you send X, you get Y" ----------
export interface SwapPreviewSide { symbol: string; decimals: number; amount: string; /** native coin the transactions carry beyond a native sale (bridge/messaging fees) */ extraNative?: string; nativeSymbol?: string }
export interface SwapPreview {
  /** 'simulated' = an on-chain dry run of the exact transactions matched the quote; 'checked' = the transactions were
   *  checked against the quote but this network could not simulate them (or it is a Bitcoin send to THORChain). */
  verification: 'simulated' | 'checked';
  send: SwapPreviewSide;
  receive: SwapPreviewSide & { minAmount: string; network: string; afterBridge: boolean; /** our own address that receives it */ address: string };
}
/**
 * Builds the same fresh transactions the submit step will sign, runs every pre-sign check on them and simulates them, without
 * touching keys. The confirm screen shows the result; submit repeats all of it on its own fresh transactions.
 */
export async function preview(deps: SwapDeps, q: { routeId: unknown }): Promise<{ ok: true; preview: SwapPreview; confirmId: string } | ReturnType<typeof fail>> {
  try {
    const h = await heldFor(deps, q.routeId);
    const p = { route: h.route };
    const step = checkStepShape(p.route, 0);
    const settings = await getSettings();
    const slippagePct = h.slippagePct;
    const d = domainById(step.fromDomainId)!; const td = domainById(step.toDomainId)!;
    const addrs = await activeAddresses(deps.vault);
    const address = addrs[d.addressKey] as string | undefined; const ownTo = addrs[td.addressKey] as string | undefined;
    if (!address || !ownTo) throw swapError('invalid_asset');
    const raw: any = step.raw; const source = p.route.source;
    let effect: SwapEffect | null = null; let simulated = false; let extraNative = 0n;
    if (d.kind === 'evm') {
      const { client } = evmClient(d.chainId!);
      const allowance = async (token: string, spender: string) => (await client.readContract({ address: token as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, spender as `0x${string}`] })) as bigint;
      const withApproval = async (spender: string | undefined, call: SimCall): Promise<SimCall[]> => {
        if (step.from.asset.address === 'native' || !spender) return [call];
        return (await allowance(step.from.asset.address, spender)) < BigInt(step.from.amount)
          ? [{ from: address, to: step.from.asset.address, data: approveData(spender, BigInt(step.from.amount)), value: 0n }, call] : [call];
      };
      let calls: SimCall[];
      if (source === 'relay') {
        const fresh = await backendTransaction({ source: 'relay', request: freshRequest(raw, step, address, ownTo, slippagePct) });
        const plan = relayTransactions(fresh, step, { ourAddress: address, chainId: d.chainId!, slippagePct, targets: await relayTargets(d.chainId!), ownTo, chains: await relayChains() });
        const exec = plan.txs.filter((t) => t.kind === 'execute').map((t) => ({ from: address, to: t.to, data: t.data, value: t.value }));
        calls = exec.length === 1 ? await withApproval(step.approval?.spender, exec[0]) : exec;
      } else if (source === 'thorchain') {
        const fresh = await backendTransaction({ source: 'thorchain', request: freshRequest(raw, step, address, ownTo, slippagePct) });
        fresh.memo = checkThorQuote(fresh, step, ownTo);
        await verifyThorInbound(fresh, step);
        const call = thorRouterCall(fresh, step);
        calls = await withApproval(call.to, { from: address, ...call });
      } else if (source === 'lifi') {
        const refreshed = await backendTransaction({ source: 'lifi', ref: p.route.quoteRef ?? '' });
        const bad = validateLifiTransaction(refreshed, step, { ourAddress: address, chainId: d.chainId!, slippagePct, destKind: td.kind, destLifiChainId: td.lifiChainId });
        if (bad) throw bad;
        const tx = refreshed.transactionRequest;
        calls = await withApproval(step.approval?.spender, { from: address, to: tx.to, data: tx.data, value: tx.value == null ? 0n : BigInt(tx.value) });
      } else throw swapError('unsupported_pair');
      effect = await guardEvmSwap(client, address, p.route, step, calls);
      const carried = calls.reduce((a, c) => a + c.value, 0n) - (step.from.asset.address === 'native' ? BigInt(step.from.amount) : 0n);
      if (carried > 0n) extraNative = carried;
      simulated = effect != null;
    } else if (d.kind === 'solana') {
      if (source !== 'jupiter') throw swapError('unsupported_route');   // Solana-source LI.FI bridges cannot be verified (audit H1)
      const b64 = await jupiterTx(p.route, settings.solanaTurbo, address);
      if (!/^[A-Za-z0-9+/=]+$/.test(b64)) throw swapError('unsafe_transaction');
      const bytes = b64ToBytes(b64); const parsed = parseSolanaTx(bytes);
      if (deps.core.Base58.encodeNoCheck(parsed.accountKeys[0]) !== address || parsed.sigSlots !== 1 || !parsed.accountKeys.some((k) => deps.core.Base58.encodeNoCheck(k) === JUPITER_PROGRAM)) throw swapError('unsafe_transaction');
      await guardSolanaSwap(bytes, address, step);   // includes a dry run
      simulated = true;
    } else if (source === 'thorchain') {
      const fresh = await backendTransaction({ source: 'thorchain', request: freshRequest(raw, step, address, ownTo, slippagePct) });
      fresh.memo = checkThorQuote(fresh, step, ownTo);
      await verifyThorInbound(fresh, step);
    } else throw swapError('unsupported_pair');
    const sameChain = step.fromDomainId === step.toDomainId;
    return { ok: true, confirmId: held.issueConfirm(h.route.id), preview: {
      verification: simulated ? 'simulated' : 'checked',
      send: { symbol: step.from.asset.symbol, decimals: step.from.asset.decimals, amount: (effect && step.from.asset.address !== 'native' ? effect.sent : BigInt(step.from.amount)).toString(),
        ...(extraNative > 0n ? { extraNative: extraNative.toString(), nativeSymbol: d.nativeSymbol } : {}) },
      receive: { symbol: step.to.asset.symbol, decimals: step.to.asset.decimals, amount: (effect?.received ?? BigInt(step.to.amount)).toString(), minAmount: step.to.minAmount, network: td.name, afterBridge: !sameChain, address: ownTo },
    } };
  } catch (e) { return fail(e); }
}

// ---------- settlement status (GetSwapSettlementStatus) ----------
export async function status(id: string): Promise<{ ok: true; item: SwapHistoryItem } | { ok: false; error: string }> {
  const item = (await listHistory()).find((h) => h.id === id);
  if (!item) return { ok: false, error: 'Swap not found' };
  if (item.status === 'success' || item.status === 'failed' || item.status === 'timeout' || !item.txHash) return { ok: true, item };
  const fd = domainById(item.fromDomainId)!; const td = domainById(item.toDomainId)!;
  let next: Partial<SwapHistoryItem> | null = null;
  try {
    if (item.source === 'relay' && item.requestId) {
      const st = (await backendStatus({ source: 'relay', txHash: item.txHash, requestId: item.requestId, fromDomainId: item.fromDomainId, toDomainId: item.toDomainId })).status;
      if (st === 'success') next = { status: 'success' };
      else if (st === 'failed' || st === 'refunded') next = { status: 'failed', error: st === 'refunded' ? 'Swap refunded' : 'Swap failed' };
    } else if (item.source === 'thorchain') {
      const st = (await backendStatus({ source: 'thorchain', txHash: item.txHash, fromDomainId: item.fromDomainId, toDomainId: item.toDomainId })).status;
      if (st === 'success') next = { status: 'success' };
      else if (st === 'refunded' || st === 'failed') next = { status: 'failed', error: st === 'refunded' ? 'Swap refunded by THORChain' : 'Swap failed' };
    } else if (fd.kind === 'solana' && fd.id === td.id) {
      const r = await solRpc('getSignatureStatuses', [[item.txHash], { searchTransactionHistory: true }]);
      const s = r?.value?.[0];
      if (s?.err) next = { status: 'failed', error: 'Transaction failed on-chain' };
      else if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) next = { status: 'success' };
    } else if (fd.id === td.id) {
      const { client } = evmClient(fd.chainId!);
      try { const rc = await client.getTransactionReceipt({ hash: item.txHash as `0x${string}` }); next = rc.status === 'success' ? { status: 'success' } : { status: 'failed', error: 'Transaction reverted' }; }
      catch { /* not mined yet */ }
    } else {
      const st = await backendStatus({ source: 'lifi', txHash: item.txHash, fromDomainId: fd.id, toDomainId: td.id, bridge: item.bridge });
      if (st.status === 'success') next = { status: 'success' };
      else if (st.status === 'failed' || st.status === 'refunded') next = { status: 'failed', error: st.detail || 'Bridge failed' };
    }
  } catch { /* transient RPC/API failure: keep polling */ }
  if (!next && Date.now() - item.createdAt > SWAP_WATCH_TIMEOUT_MS) next = { status: 'timeout', error: 'Transaction is taking way more than expected' };
  if (next) { const upd = { ...item, ...next, updatedAt: Date.now() }; await saveHistory(upd); return { ok: true, item: upd }; }
  return { ok: true, item };
}

// ---------- token search (TW: /v1/search/assets; Harbour: curated list + LI.FI token lookup) ----------
export async function searchTokens(query: string, domainId?: string): Promise<SwapAsset[]> {
  const q = (query ?? '').trim();
  const pool = popularAssets(domainId && domainById(domainId) ? domainId : undefined);
  if (!q) return pool;
  const lq = q.toLowerCase();
  const hits = pool.filter((a) => a.symbol.toLowerCase().includes(lq) || a.name.toLowerCase().includes(lq) || a.address.toLowerCase() === lq);
  if (q.length >= 2 && q.length <= 64) {
    const ids = domainId && domainById(domainId) ? [domainId] : SWAP_DOMAINS.map((d) => d.id);
    const found = await Promise.all(ids.map((id) => backendToken(id, q)));
    for (const a of found) if (a && !hits.some((h) => h.assetId === a.assetId)) hits.push(a);
  }
  return hits;
}

// ---------- dust cleaner ----------
/** Small token balances on one EVM/Solana network (curated + recently used tokens; prices from LI.FI's token API). */
export async function scanDust(deps: SwapDeps, domainId: string, thresholdUsd = DUST_DEFAULT_USD): Promise<{ ok: true; items: DustCandidate[] } | ReturnType<typeof fail>> {
  try {
    const d = domainById(domainId); if (!d || d.kind === 'utxo') throw swapError('unsupported_domain');
    const settings = await getSettings();
    const pool = [...popularAssets(domainId), ...settings.recentAssets.filter((a) => a.domainId === domainId)].filter((a, i, all) => a.address !== 'native' && all.findIndex((b) => b.assetId === a.assetId) === i);
    const balances = await getBalances(deps, pool);
    const held = pool.filter((a) => { try { return BigInt(balances[a.assetId] ?? '0') > 0n; } catch { return false; } });
    const priced = await Promise.all(held.map(async (a) => ({ asset: a, balance: balances[a.assetId], priceUsd: a.priceUsd ?? (await backendToken(domainId, a.address))?.priceUsd })));
    return { ok: true, items: pickDust(priced, thresholdUsd) };
  } catch (e) { return fail(e); }
}

/** Convert each selected dust balance into the native coin, one after another (best quote, approve if needed, swap). */
export async function convertDust(deps: SwapDeps, assets: SwapAsset[]): Promise<{ ok: true; results: Array<{ assetId: string; ok: boolean; id?: string; hash?: string; error?: string }> } | ReturnType<typeof fail>> {
  try { return await held.exclusive(() => convertDustNow(deps, assets)); } catch (e) { return fail(e); }
}
async function convertDustNow(deps: SwapDeps, assets: SwapAsset[]): Promise<{ ok: true; results: Array<{ assetId: string; ok: boolean; id?: string; hash?: string; error?: string }> }> {
  const results: Array<{ assetId: string; ok: boolean; id?: string; hash?: string; error?: string }> = [];
  for (const a of assets.slice(0, 10)) {
    try {
      const bal = (await getBalances(deps, [a]))[a.assetId] ?? '0';
      if (BigInt(bal) <= 0n) { results.push({ assetId: a.assetId, ok: false, error: 'No balance' }); continue; }
      const settings = await getSettings();
      const q = await quote(deps, { from: a, to: nativeAsset(a.domainId), amount: bal, slippage: settings.slippage });
      if (!q.ok) { results.push({ assetId: a.assetId, ok: false, error: (q as any).error ?? 'No quote' }); continue; }
      const route = q.result.routes.find((r) => r.steps.length === 1);
      if (!route) { results.push({ assetId: a.assetId, ok: false, error: 'No route' }); continue; }
      const h = await heldFor(deps, route.id);
      if (route.steps[0].approval?.needed) {
        const ap: any = await approveHeld(deps, h, false);
        if (!ap.ok) { results.push({ assetId: a.assetId, ok: false, error: ap.error ?? 'Approval failed' }); continue; }
      }
      held.consume(route.id);
      const sub: any = await submitHeld(deps, h);
      results.push(sub.ok ? { assetId: a.assetId, ok: true, id: sub.id, hash: sub.hash } : { assetId: a.assetId, ok: false, error: sub.error ?? 'Swap failed' });
    } catch (e: any) { results.push({ assetId: a.assetId, ok: false, error: e?.message ?? 'Swap failed' }); }
  }
  return { ok: true, results };
}
