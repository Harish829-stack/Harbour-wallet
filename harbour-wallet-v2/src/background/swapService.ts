import { evmTransport } from '../kit/evmTransport';
import { checkToken } from '../kit/clients/securityClient';
// Swap execution service (background). Mirrors TW's staged swap pipeline recovered from the App
// chunk actions: FetchSwapQuote -> (StageSwapApproval/ExecuteSwapApproval) -> StageSwapTransaction ->
// ExecuteSwap/BroadcastSwapTransaction -> GetSwapSettlementStatus -> RecordSwapTransaction.
import { createPublicClient, http, defineChain, erc20Abi, maxUint256, isAddress, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { local } from '../core/storage';
import { rpcUrl, solanaRpcUrl, protectedRpcUrl } from '../core/rpc';
import { openActiveKeys } from './keys';
import type { VaultService } from '../core/vaultService';
import type { WalletService } from '../core/walletService';
import type { SwapAsset, SwapHistoryItem, SwapRoute, SwapSettings, SwapStep, SwapQuoteResult } from '../core/swap/types';
import { DEFAULT_SWAP_SETTINGS } from '../core/swap/types';
import { domainById, SWAP_DOMAINS } from '../core/swap/domains';
import { getSwapRoutes } from '../core/swap/engine';
import { swapError } from '../core/swap/errors';
import { lifiStepTransaction, lifiStatus, lifiToken } from '../core/swap/lifi';
import { popularAssets, nativeAsset } from '../core/swap/tokens';
import { pickDust, DUST_DEFAULT_USD, type DustCandidate } from '../core/swap/dust';
import { jupiterSwapTransaction } from '../core/swap/jupiter';
import { validateLifiTransaction, parseSolanaTx, attachSolanaSignature, b64ToBytes, bytesToB64, JUPITER_PROGRAM } from '../core/swap/safety';
import { SWAP_WATCH_TIMEOUT_MS, normalizeSlippage } from '../core/swap/rules';
import { relayQuote, relayTransactions, relayStatus } from '../core/swap/relay';
import { thorQuote, checkThorQuote, thorRouterCall, thorStatus } from '../core/swap/thorchain';
import { utxoFamily } from '../core/chains/send/utxo';
import { chainById } from '../core/chains/index';
import { sign as signDigestRaw, serializeSignature } from 'viem/accounts';
import { sendGasless, bundlerUrl, GASLESS_FLAG, type Call } from '../core/swap/gasless';
const getStore = () => import('./store'); // same chunk as the background entry: Rollup inlines this (no runtime import())

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
  const keys = await openActiveKeys(deps.core, deps.vault, deps.wallet);
  const addresses = keys.addresses; keys.dispose();
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
    const keys = await openActiveKeys(deps.core, deps.vault, deps.wallet); const from = keys.addresses.bitcoin; keys.dispose();
    const q = await utxoFamily.quote(sendEnv(deps.core), { chain: btcChain(), from, to: from, amount: 0n, asset: { kind: 'native' } } as any);
    const avg = q.tiers.find((t) => t.id === 'average')!;
    const max = avg.max > 0n ? avg.max - BigInt(Math.ceil(Number(avg.detail?.split(' ')[0] ?? 2) * 90)) : 0n;
    return max > 546n ? { max: max.toString(), belowFee: false } : { max: '0', belowFee: true };
  }
  if (d.kind === 'solana') reserve = 10_000_000n; // fee + priority + possible token-account rent
  else { const { client } = evmClient(d.chainId!); const gp = await client.getGasPrice(); reserve = (gp * 600_000n * 12n) / 10n; }
  return bal > reserve ? { max: (bal - reserve).toString(), belowFee: false } : { max: '0', belowFee: true };
}

// ---------- gasless (EIP-7702 + sponsored user operation) ----------
async function gaslessFlag(): Promise<boolean> {
  try { return (await getStore()).store.getState().sdkFeatureSlice.flags[GASLESS_FLAG] === true; } catch { return false; }
}
/** Offered only when the remote flag is on and the gateway can reach a bundler. */
export async function gaslessAvailable(): Promise<boolean> { return (await gaslessFlag()) && !!bundlerUrl(1); }
async function gaslessActive(chainId: number): Promise<boolean> {
  return !!bundlerUrl(chainId) && (await getSettings()).gasless && (await gaslessFlag());
}
/** Run calls as one sponsored user operation; null when gasless is unavailable (caller falls back to normal transactions). */
async function tryGasless(chainId: number, client: any, privateKey: `0x${string}`, sender: string, calls: Call[]): Promise<`0x${string}` | null> {
  const url = bundlerUrl(chainId); if (!url) return null;
  let id = 0;
  const bundler = async (method: string, params: unknown[]) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(20000) });
    const j = await r.json(); if (j?.error) throw new Error(j.error.message ?? 'bundler error'); return j.result;
  };
  try {
    const r = await sendGasless({
      chainId, sender: sender as `0x${string}`, bundler,
      getCode: (a) => client.getCode({ address: a }), call: async (to, data) => (await client.call({ to, data })).data ?? '0x', txCount: (a) => client.getTransactionCount({ address: a }),
      signDigest: async (hash) => { const sig = await signDigestRaw({ hash, privateKey }); return { r: sig.r, s: sig.s, yParity: Number(sig.yParity ?? (sig.v === 28n ? 1 : 0)), serialized: serializeSignature(sig) }; },
    }, calls);
    return r.txHash;
  } catch (e: any) {
    if (e?.code === 'gasless_unavailable') return null;
    throw e;
  }
}

// ---------- quote ----------
export async function quote(deps: SwapDeps, p: { from: SwapAsset; to: SwapAsset; amount: string; slippage: string }): Promise<{ ok: true; result: SwapQuoteResult } | ReturnType<typeof fail>> {
  try {
    const settings = await getSettings();
    const keys = await openActiveKeys(deps.core, deps.vault, deps.wallet);
    const addrs = keys.addresses; keys.dispose();
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
    return { ok: true, result };
  } catch (e) { return fail(e); }
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

export async function approve(deps: SwapDeps, p: { route: SwapRoute; stepIndex: number; unlimited: boolean }) {
  try {
    const step = checkStepShape(p.route, p.stepIndex);
    const a = step.approval; const { d, keys, address } = await ourContext(deps, step);
    if (d.kind !== 'evm' || !a || !isAddress(a.tokenAddress) || !isAddress(a.spender)) { keys.dispose(); throw swapError('unsupported_pair'); }
    const raw: any = step.raw;
    // the spender must be the one the aggregator named for this very quote
    if (expectedSpender(p.route.source, raw).toLowerCase() !== a.spender.toLowerCase()) { keys.dispose(); throw swapError('unsafe_transaction'); }
    // gasless swaps batch the approval into the sponsored user operation (approve + swap in one op)
    if (await gaslessActive(d.chainId!)) { keys.dispose(); return { ok: true as const, skipped: true, deferred: true }; }
    try {
      const account = privateKeyToAccount(keys.evmPrivateKey());
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
  if (req.maxFeePerGas != null) { t.type = 'eip1559'; t.maxFeePerGas = req.maxFeePerGas; t.maxPriorityFeePerGas = req.maxPriorityFeePerGas; }
  else { t.type = 'legacy'; t.gasPrice = req.gasPrice; }
  const serialized = await account.signTransaction(t);
  const sender = protectedUrl ? createPublicClient({ chain, transport: http(protectedUrl, { timeout: 15000 }) }) : client;
  return sender.sendRawTransaction({ serializedTransaction: serialized });
}

// ---------- submit ----------
export async function submit(deps: SwapDeps, p: { route: SwapRoute; stepIndex: number; id?: string }) {
  try {
    const step = checkStepShape(p.route, p.stepIndex);
    const settings = await getSettings();
    const slippagePct = Number(normalizeSlippage(String(step.slippage.userSelected ?? settings.slippage)));
    const { d, keys, address } = await ourContext(deps, step);
    try {
      if (!address) throw swapError('invalid_asset');
      if (Date.now() > p.route.expiresAt + 5 * 60_000) throw swapError('price_moved');
      let hash: string; let requestId: string | undefined;
      const toDomain = domainById(step.toDomainId)!;
      const ownTo = keys.addresses[toDomain.addressKey]; // payouts always go to our own account, never to an address carried in the route
      if (!ownTo) throw swapError('invalid_asset');
      if (p.route.source === 'jupiter') {
        if (d.kind !== 'solana') throw swapError('unsupported_pair');
        const raw: any = step.raw;
        const b64 = await jupiterSwapTransaction({ quote: raw.quote, priority: settings.solanaTurbo ? 'turbo' : 'fast' }, address);
        const bytes = b64ToBytes(b64);
        const parsed = parseSolanaTx(bytes);
        const { key } = keys.solanaKey();
        const feePayer = deps.core.Base58.encodeNoCheck(parsed.accountKeys[0]);
        const programs = parsed.accountKeys.map((k) => deps.core.Base58.encodeNoCheck(k));
        if (feePayer !== address || parsed.sigSlots !== 1 || !programs.includes(JUPITER_PROGRAM)) throw swapError('unsafe_transaction');
        const sig: Uint8Array = key.sign(parsed.message, deps.core.Curve.ed25519);
        const signed = attachSolanaSignature(bytes, parsed, sig);
        hash = await solRpc('sendTransaction', [bytesToB64(signed), { encoding: 'base64', skipPreflight: false, maxRetries: 3, preflightCommitment: 'confirmed' }]);
      } else if (p.route.source === 'relay') {
        if (d.kind !== 'evm') throw swapError('unsupported_pair');
        const raw: any = step.raw;
        const fresh = await relayQuote({ ...raw.request, from: step.from.asset, to: step.to.asset, amount: step.from.amount, fromAddress: address, toAddress: ownTo });
        const plan = relayTransactions(fresh, step, { ourAddress: address, chainId: d.chainId!, slippagePct });
        const account = privateKeyToAccount(keys.evmPrivateKey());
        if (account.address.toLowerCase() !== address.toLowerCase()) throw swapError('unsafe_transaction');
        const { chain, client } = evmClient(d.chainId!);
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
            if (!code || code === '0x') throw swapError('unsafe_transaction');
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
        const fresh = await thorQuote({ ...raw.request, from: step.from.asset, to: step.to.asset, amount: step.from.amount, fromAddress: address, toAddress: ownTo });
        checkThorQuote(fresh, step, ownTo, slippagePct);
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
          const account = privateKeyToAccount(keys.evmPrivateKey());
          if (account.address.toLowerCase() !== address.toLowerCase()) throw swapError('unsafe_transaction');
          const { chain, client } = evmClient(d.chainId!);
          if (step.from.asset.address !== 'native') {
            const cur = (await client.readContract({ address: step.from.asset.address as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, call.to] })) as bigint;
            if (cur < BigInt(step.from.amount)) throw swapError('unsafe_transaction'); // approval must target this router first
          }
          const code = await client.getCode({ address: call.to });
          if (!code || code === '0x') throw swapError('unsafe_transaction');
          let gas: bigint;
          try { gas = ((await client.estimateGas({ account, ...call })) * 12n) / 10n; }
          catch { throw swapError('simulation_failed'); }
          hash = await broadcastEvm(client, chain, account, { ...call, gas }, undefined);
        } else throw swapError('unsupported_pair');
      } else if (d.kind === 'solana') {
        // LI.FI Solana-source bridge legs: a base64 transaction we only sign when we are the sole signer and fee payer
        const refreshed = await lifiStepTransaction(step.raw);
        const b64 = refreshed?.transactionRequest?.data;
        if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b64)) throw swapError('unsafe_transaction');
        const fromAmt = String(refreshed?.action?.fromAmount ?? step.from.amount);
        if (fromAmt !== step.from.amount) throw swapError('unsafe_transaction');
        const outNow = BigInt(refreshed?.estimate?.toAmount ?? '0');
        if (outNow * 10_000n < BigInt(step.to.amount) * (10_000n - BigInt(Math.round(slippagePct * 100)))) throw swapError('price_moved');
        const bytes = b64ToBytes(b64); const parsed = parseSolanaTx(bytes);
        const { key } = keys.solanaKey();
        if (deps.core.Base58.encodeNoCheck(parsed.accountKeys[0]) !== address || parsed.sigSlots !== 1) throw swapError('unsafe_transaction');
        const sig: Uint8Array = key.sign(parsed.message, deps.core.Curve.ed25519);
        hash = await solRpc('sendTransaction', [bytesToB64(attachSolanaSignature(bytes, parsed, sig)), { encoding: 'base64', skipPreflight: false, maxRetries: 3, preflightCommitment: 'confirmed' }]);
      } else {
        if (d.kind !== 'evm') throw swapError('unsupported_pair');
        const refreshed = await lifiStepTransaction(step.raw);
        const bad = validateLifiTransaction(refreshed, step, { ourAddress: address, chainId: d.chainId!, slippagePct });
        if (bad) throw bad;
        const account = privateKeyToAccount(keys.evmPrivateKey());
        if (account.address.toLowerCase() !== address.toLowerCase()) throw swapError('unsafe_transaction');
        const { chain, client } = evmClient(d.chainId!);
        const tx = refreshed.transactionRequest;
        const to = tx.to as `0x${string}`; const data = tx.data as `0x${string}`; const value = tx.value == null ? 0n : BigInt(tx.value);
        // the destination must be a contract (a swap router), never a plain wallet
        const code = await client.getCode({ address: to });
        if (!code || code === '0x') throw swapError('unsafe_transaction');
        const a = step.approval;
        const allowanceShort = async () => !!a && step.from.asset.address !== 'native'
          && ((await client.readContract({ address: a.tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [address as `0x${string}`, a.spender as `0x${string}`] })) as bigint) < BigInt(a.minAmount);
        const approveCall = (): Call => ({ to: a!.tokenAddress as `0x${string}`, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [a!.spender as `0x${string}`, BigInt(a!.minAmount)] }) });
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

// ---------- settlement status (GetSwapSettlementStatus) ----------
export async function status(id: string): Promise<{ ok: true; item: SwapHistoryItem } | { ok: false; error: string }> {
  const item = (await listHistory()).find((h) => h.id === id);
  if (!item) return { ok: false, error: 'Swap not found' };
  if (item.status === 'success' || item.status === 'failed' || item.status === 'timeout' || !item.txHash) return { ok: true, item };
  const fd = domainById(item.fromDomainId)!; const td = domainById(item.toDomainId)!;
  let next: Partial<SwapHistoryItem> | null = null;
  try {
    if (item.source === 'relay' && item.requestId) {
      const st = await relayStatus(item.requestId);
      if (st === 'success') next = { status: 'success' };
      else if (st === 'failed' || st === 'refunded') next = { status: 'failed', error: st === 'refunded' ? 'Swap refunded' : 'Swap failed' };
    } else if (item.source === 'thorchain') {
      const st = await thorStatus(item.txHash);
      if (st === 'done') next = { status: 'success' };
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
      const st = await lifiStatus({ txHash: item.txHash, fromChain: fd.lifiChainId, toChain: td.lifiChainId, bridge: item.bridge });
      if (st.status === 'DONE') next = { status: 'success' };
      else if (st.status === 'FAILED' || st.status === 'INVALID') next = { status: 'failed', error: st.substatus || 'Bridge failed' };
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
    const found = await Promise.all(ids.map((id) => lifiToken(id, q)));
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
    const priced = await Promise.all(held.map(async (a) => ({ asset: a, balance: balances[a.assetId], priceUsd: a.priceUsd ?? (await lifiToken(domainId, a.address))?.priceUsd })));
    return { ok: true, items: pickDust(priced, thresholdUsd) };
  } catch (e) { return fail(e); }
}

/** Convert each selected dust balance into the native coin, one after another (best quote, approve if needed, swap). */
export async function convertDust(deps: SwapDeps, assets: SwapAsset[]): Promise<{ ok: true; results: Array<{ assetId: string; ok: boolean; id?: string; hash?: string; error?: string }> }> {
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
      let id: string | undefined;
      if (route.steps[0].approval?.needed) {
        const ap: any = await approve(deps, { route, stepIndex: 0, unlimited: false });
        if (!ap.ok) { results.push({ assetId: a.assetId, ok: false, error: ap.error ?? 'Approval failed' }); continue; }
        id = ap.id;
      }
      const sub: any = await submit(deps, { route, stepIndex: 0, id });
      results.push(sub.ok ? { assetId: a.assetId, ok: true, id: sub.id, hash: sub.hash } : { assetId: a.assetId, ok: false, error: sub.error ?? 'Swap failed' });
    } catch (e: any) { results.push({ assetId: a.assetId, ok: false, error: e?.message ?? 'Swap failed' }); }
  }
  return { ok: true, results };
}
