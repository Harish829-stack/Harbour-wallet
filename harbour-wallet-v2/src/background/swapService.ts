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
import { popularAssets } from '../core/swap/tokens';
import { jupiterSwapTransaction } from '../core/swap/jupiter';
import { validateLifiTransaction, parseSolanaTx, attachSolanaSignature, b64ToBytes, bytesToB64, JUPITER_PROGRAM } from '../core/swap/safety';
import { SWAP_WATCH_TIMEOUT_MS, normalizeSlippage } from '../core/swap/rules';

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
  for (const k of ['mev', 'solanaTurbo', 'unlimitedAllowance'] as const) if (typeof patch[k] === 'boolean') next[k] = patch[k] as boolean;
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
  return { chain, client: createPublicClient({ chain, transport: http(u, { timeout: 15000, retryCount: 1 }) }) };
}
async function solRpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(solanaRpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15000) });
  const j = await res.json();
  if (j?.error) throw new Error(j.error.message || 'Solana RPC error');
  return j.result;
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
  if (d.kind === 'solana') reserve = 10_000_000n; // fee + priority + possible token-account rent
  else { const { client } = evmClient(d.chainId!); const gp = await client.getGasPrice(); reserve = (gp * 600_000n * 12n) / 10n; }
  return bal > reserve ? { max: (bal - reserve).toString(), belowFee: false } : { max: '0', belowFee: true };
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

export async function approve(deps: SwapDeps, p: { route: SwapRoute; stepIndex: number; unlimited: boolean }) {
  try {
    const step = checkStepShape(p.route, p.stepIndex);
    const a = step.approval; const { d, keys, address } = await ourContext(deps, step);
    if (d.kind !== 'evm' || !a || !isAddress(a.tokenAddress) || !isAddress(a.spender)) { keys.dispose(); throw swapError('unsupported_pair'); }
    const raw: any = step.raw;
    // the spender must be the one the aggregator named for this very quote
    if (String(raw?.estimate?.approvalAddress ?? '').toLowerCase() !== a.spender.toLowerCase()) { keys.dispose(); throw swapError('unsafe_transaction'); }
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
      let hash: string;
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
      } else {
        if (d.kind !== 'evm') throw swapError('unsupported_pair'); // EVM<->Solana bridge legs are not signable here yet
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
        let gas: bigint;
        try { gas = ((await client.estimateGas({ account, to, data, value })) * 12n) / 10n; }
        catch { throw swapError('simulation_failed'); }
        hash = await broadcastEvm(client, chain, account, { to, data, value, gas }, settings.mev ? protectedRpcUrl(d.chainId!) : undefined);
      }
      const now = Date.now();
      const crossChain = step.fromDomainId !== step.toDomainId;
      const item: SwapHistoryItem = {
        id: p.id ?? crypto.randomUUID(), createdAt: now, updatedAt: now, status: crossChain ? 'bridging' : 'swapping', address,
        fromAsset: step.from.asset, toAsset: step.to.asset, fromAmount: step.from.amount, toAmountExpected: step.to.amount, toAmountMin: step.to.minAmount,
        provider: step.provider.name, stepIndex: 0, stepCount: 1, txHash: hash, fromDomainId: step.fromDomainId, toDomainId: step.toDomainId, bridge: crossChain ? step.provider.id : undefined,
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
    if (fd.kind === 'solana' && fd.id === td.id) {
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
