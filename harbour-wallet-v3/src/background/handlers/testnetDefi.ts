import { parseUnits, zeroAddress } from 'viem';
import type { Address } from 'viem';
import type { HandlerCtx, HandlerMap } from './types';
import { activeInfo } from './earnKeys';
import { openActiveKeys } from '../keys';
import { evmAccountFromBytes } from '../../core/provider/evmAccount';
import { assertFeature, assertSigningEvmChain } from '../../core/harbour/policy';
import { local, KEYS } from '../../core/storage';
import { decodeCalldata, isUnlimited } from '../../core/provider/decode';
import { perms } from '../provider/index';
import { aaveDeployment, assertTestnetNetwork, PLAN_TTL_MS, SEPOLIA } from '../../integrations/testnet-defi/config';
import { readToken, sameAddress, tokenAddress } from '../../integrations/testnet-defi/rpc';
import { defiClient } from '../../integrations/testnet-defi/client';
import { listEarnAssets, prepareEarn } from '../../integrations/testnet-defi/aave';
import { AaveKitUnavailable, EARN_PROVIDER, NATIVE_TOKEN, listEarnAssetsKit, prepareEarnKit } from '../../integrations/testnet-defi/aavekit';
import { prepareSwap, prepareWrap, swapCatalog } from '../../integrations/testnet-defi/uniswap';
import { ReviewStore } from '../../integrations/testnet-defi/plans';
import type { DefiCall, DefiRequest, DefiReview } from '../../integrations/testnet-defi/types';

interface SavedPlan { owner: string; expiresAt: number; request: DefiRequest; calls: DefiCall[]; review: DefiReview }
const reviews = new ReviewStore<SavedPlan>();
const submitting = new Set<string>();
const ownerKey = (info: { walletId: string; derivationIndex: number }, address: string) => `${info.walletId}:${info.derivationIndex}:${address.toLowerCase()}`;

async function context(ctx: HandlerCtx, networkId: string, kind: 'swap' | 'earn') {
  const deployment = kind === 'earn' ? aaveDeployment(networkId) : (assertTestnetNetwork(networkId), SEPOLIA);
  assertFeature(kind); assertSigningEvmChain(deployment.chainId);
  const prefs = await local.get<{ networkFilter?: string }>(KEYS.UI);
  if (prefs?.networkFilter !== networkId) throw new Error(`Your selected network changed. Select ${deployment.name} and review again.`);
  const info = await activeInfo(ctx);
  if (!info?.addresses.ethereum) throw new Error('Select a wallet with an Ethereum account.');
  if (!['mnemonic', 'privateKey'].includes(info.walletType)) throw new Error('Testnet DeFi currently supports local software wallets.');
  const address = tokenAddress(info.addresses.ethereum);
  const client = defiClient(networkId);
  if (await client.getChainId() !== deployment.chainId) throw new Error(`The RPC returned a different network. Check your ${deployment.name} connection.`);
  return { client, address, info, owner: ownerKey(info, address), deployment };
}
function requestOf(value: any): DefiRequest {
  const action = value?.action;
  if (!['supply', 'withdraw', 'swap', 'wrap', 'unwrap'].includes(action)) throw new Error('Unsupported DeFi action.');
  return { networkId: String(value.networkId ?? ''), action, token: String(value.token ?? ''), tokenOut: value.tokenOut == null ? undefined : String(value.tokenOut), amount: String(value.amount ?? ''), slippageBps: value.slippageBps == null ? 50 : Number(value.slippageBps) };
}
function rawAmount(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value) || (value.split('.')[1]?.length ?? 0) > decimals || value.length > 100) throw new Error('Enter a valid amount within the token’s precision.');
  const amount = parseUnits(value, decimals);
  if (amount <= 0n || amount >= 2n ** 256n) throw new Error('Enter a positive token amount.');
  return amount;
}
// AaveKit first; if its API is unreachable, ERC-20 reserves fall back to direct contract reads.
// Native ETH (WETH gateway) is AaveKit-only. Validation errors never fall back.
async function earnCatalog(c: Awaited<ReturnType<typeof context>>) {
  if (EARN_PROVIDER === 'aavekit') {
    try { return await listEarnAssetsKit(c.client, c.address, c.deployment); }
    catch (error) { if (!(error instanceof AaveKitUnavailable)) throw error; }
  }
  return listEarnAssets(c.client, c.address, c.deployment);
}
async function earnPrepare(c: Awaited<ReturnType<typeof context>>, token: Address, amount: bigint, action: 'supply' | 'withdraw') {
  if (EARN_PROVIDER === 'aavekit') {
    try { return await prepareEarnKit(c.client, c.address, token, amount, action, c.deployment); }
    catch (error) { if (!(error instanceof AaveKitUnavailable) || token === NATIVE_TOKEN) throw error; }
  }
  return prepareEarn(c.client, c.address, token, amount, action, c.deployment);
}
async function build(ctx: HandlerCtx, req: DefiRequest) {
  const c = await context(ctx, req.networkId, req.action === 'supply' || req.action === 'withdraw' ? 'earn' : 'swap');
  const token = tokenAddress(req.token);
  const wrapped = req.action === 'wrap' || req.action === 'unwrap';
  if (wrapped && !sameAddress(token, SEPOLIA.weth)) throw new Error('Unsupported wrapped token.');
  const metadata = wrapped || ((req.action === 'swap' || req.action === 'supply' || req.action === 'withdraw') && sameAddress(token, zeroAddress))
    ? { decimals: 18 } : await readToken(c.client, token, c.address);
  const amount = rawAmount(req.amount, metadata.decimals);
  const expiresAt = Date.now() + PLAN_TTL_MS;
  const prepared = req.action === 'supply' || req.action === 'withdraw'
    ? await earnPrepare(c, token, amount, req.action)
    : req.action === 'swap'
      ? await prepareSwap(c.client, c.address, token, tokenAddress(req.tokenOut ?? ''), amount, req.slippageBps ?? 50, Math.floor(expiresAt / 1000))
      : await prepareWrap(c.client, c.address, amount, req.action);
  const code = await c.client.getCode({ address: prepared.calls[prepared.calls.length - 1].to });
  if (!code || code === '0x') throw new Error('The protocol contract is unavailable on this network.');
  // Estimate the first call against current state. Later calls depend on approvals; the review labels their fee budget as an estimate.
  const first = prepared.calls[0];
  const firstGas = await c.client.estimateGas({ account: c.address, to: first.to, data: first.data, value: first.value });
  const fees = await c.client.estimateFeesPerGas();
  const price = fees.maxFeePerGas;
  if (!price) throw new Error(`Could not estimate ${c.deployment.name} network fees.`);
  const fee = (firstGas * 12n / 10n + BigInt(prepared.calls.length - 1) * 700_000n) * price;
  const native = await c.client.getBalance({ address: c.address });
  if (native < fee + prepared.calls.reduce((sum, call) => sum + call.value, 0n)) throw new Error(`Not enough ${c.deployment.name} test ETH for this transaction and network fees.`);
  const review: DefiReview = { ...prepared.review, id: crypto.randomUUID(), expiresAt, network: c.deployment.name, account: c.address, fee: fee.toString(), steps: prepared.calls.map((call) => call.label) };
  return { ...c, review, prepared, expiresAt };
}

export const handlers: HandlerMap = {
  async defiCatalog(msg, ctx) {
    const kind = msg.kind === 'earn' ? 'earn' : 'swap';
    const c = await context(ctx, String(msg.networkId ?? ''), kind);
    if (kind === 'earn') return { ok: true, assets: await earnCatalog(c), account: c.address };
    const extras: Address[] = Array.isArray(msg.tokens) ? msg.tokens.slice(0, 8).map((t: unknown) => tokenAddress(String(t))) : [];
    // Token search validates metadata before pool discovery. It cannot make an arbitrary contract a supported Aave reserve.
    await Promise.all(extras.map((token) => readToken(c.client, token, c.address)));
    const catalog = await swapCatalog(c.client, c.address, extras);
    const nativeBalance = await c.client.getBalance({ address: c.address });
    const native = { address: zeroAddress, symbol: 'ETH', decimals: 18, balance: nativeBalance.toString() };
    return { ok: true, ...catalog, tokens: [native, ...catalog.tokens.filter((item) => !sameAddress(item.address, SEPOLIA.weth))], nativeBalance: nativeBalance.toString(), account: c.address };
  },
  async defiPrepare(msg, ctx) {
    const request = requestOf(msg.request);
    const { review, prepared, owner, expiresAt } = await build(ctx, request);
    reviews.put(review.id, { owner, expiresAt, request, calls: prepared.calls, review });
    return { ok: true, review };
  },
  async defiSubmit(msg, ctx) {
    const c = await context(ctx, String(msg.networkId ?? ''), msg.kind === 'earn' ? 'earn' : 'swap');
    if (submitting.has(c.owner)) throw new Error('A testnet transaction is already in progress for this account.');
    const saved = reviews.take(String(msg.id ?? ''), c.owner);
    const kind = saved.request.action === 'supply' || saved.request.action === 'withdraw' ? 'earn' : 'swap';
    if (saved.request.networkId !== c.deployment.id || kind !== (msg.kind === 'earn' ? 'earn' : 'swap')) throw new Error('The reviewed network or action changed. Review again.');
    assertFeature(kind);
    submitting.add(c.owner);
    const hashes: string[] = [];
    try {
      for (const call of saved.calls) {
        if (Date.now() >= saved.expiresAt) throw new Error('Review expired. Review the remaining action again.');
        // Account/network/lock changes between dependent transactions stop the sequence.
        const active = await context(ctx, saved.request.networkId, kind);
        if (active.owner !== saved.owner) throw new Error('Your active account changed. Review again.');
        // Re-estimate every call after preceding approvals have mined. Reverts fail closed.
        const gas = await c.client.estimateGas({ account: c.address, to: call.to, data: call.data, value: call.value });
        const fees = await c.client.estimateFeesPerGas();
        const nonce = await c.client.getTransactionCount({ address: c.address, blockTag: 'pending' });
        if (!fees.maxFeePerGas || fees.maxPriorityFeePerGas == null) throw new Error('Could not estimate network fees.');
        // Key material exists only while signing this call, never while waiting for receipts.
        const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
        let bytes: Uint8Array | undefined;
        let serializedTransaction: `0x${string}`;
        try {
          if (keys.walletId !== c.info.walletId || keys.derivationIndex !== c.info.derivationIndex) throw new Error('Your active account changed. Review again.');
          bytes = keys.privateKeyFor({ ct: 'ethereum', kind: 'evm' }, c.address);
          const account = evmAccountFromBytes(bytes);
          if (!sameAddress(account.address, c.address)) throw new Error('Signing account does not match the reviewed account.');
          serializedTransaction = await account.signTransaction({ chainId: c.deployment.chainId, to: call.to, data: call.data, value: call.value, gas: gas * 12n / 10n, nonce, type: 'eip1559', maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
        } finally { bytes?.fill(0); keys.dispose(); }
        const hash = await c.client.sendRawTransaction({ serializedTransaction }); hashes.push(hash);
        const receipt = await c.client.waitForTransactionReceipt({ hash, timeout: 120_000 });
        if (receipt.status !== 'success') throw new Error('The transaction reverted. No further transactions were sent.');
        // Approval ledger (Settings > Token approvals): remember every allowance Harbour itself granted, even for a token the user never added.
        const granted = decodeCalldata(call.data);
        if (granted.kind === 'approve' && !granted.decrease && granted.amount > 0n) void perms.trackApproval({ chainId: c.deployment.chainId, token: call.to, spender: granted.spender, owner: c.address, origin: '', source: kind, txHash: hash, amount: granted.amount.toString(), unlimited: isUnlimited(granted.amount) }).catch(() => {});
      }
      return { ok: true, hashes, explorerUrl: `${c.deployment.id === 'base-sepolia' ? 'https://sepolia.basescan.org' : 'https://sepolia.etherscan.io'}/tx/${hashes[hashes.length - 1]}` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Transaction failed.', hashes, explorerUrl: hashes.length ? `${c.deployment.id === 'base-sepolia' ? 'https://sepolia.basescan.org' : 'https://sepolia.etherscan.io'}/tx/${hashes[hashes.length - 1]}` : undefined };
    } finally { submitting.delete(c.owner); }
  },
};
