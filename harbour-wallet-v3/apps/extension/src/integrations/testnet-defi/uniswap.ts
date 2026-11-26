import { decodeFunctionData, encodeFunctionData, getAddress, isAddress, zeroAddress } from 'viem';
import type { Address } from 'viem';
import { SEPOLIA, SWAP_BASES } from './config';
import { tokenAbi, wethAbi } from './abis';
import { readToken, sameAddress } from './rpc';
import type { DefiClient } from './rpc';
import type { DefiToken, PreparedDefi, SwapCatalog } from './types';
import { GATEWAY_URL } from '../../kit/endpoints';
import { HB_API_URL } from '../../core/harbour/config';

/** What the backend swap service returns for POST /v1/swap/uniswap/prepare: Uniswap's own quote, approval and swap answers. */
export interface UniswapPrepared { routing?: string; quote?: any; isTokenApprovalApplicable?: boolean; approval?: any; cancel?: any; swap?: any }
export type UniswapBackend = (body: { chainId: number; tokenIn: string; tokenOut: string; amount: string; swapper: string; slippageBps: number; deadline: number }) => Promise<UniswapPrepared>;
// The Harbour backend calls the Uniswap API (quote -> check_approval -> swap) with its key; requests to /v1/swap are signed
// with the device key by core/harbour/fetchHook.ts. Everything it returns is checked below before anything is signed.
let uniswapBackend: UniswapBackend = async (body) => {
  let response: Response;
  try { response = await fetch(`${HB_API_URL}/v1/swap/uniswap/prepare`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) }); }
  catch { throw new Error('Uniswap is not responding. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(uniswapError(data));
  return data;
};
/** Tests replace the backend call. */
export const setUniswapBackend = (f: UniswapBackend): void => { uniswapBackend = f; };
import { checkUniversalRouterSwap } from './universalRouter';

/** No-Permit2 proxies the Trading API may name (current CREATE2 address first, then the deprecated one). */
const PROXIES: readonly Address[] = [SEPOLIA.apiRouter, SEPOLIA.apiRouterLegacy];

// Token seeds for Sepolia; quotes always go to Uniswap's API, which checks the requested amount and live route.
const BASES: readonly Address[] = SWAP_BASES;
// Seed candidates from Aave's Sepolia address book. Uniswap's API decides per quote whether a route exists.
const CANDIDATES: Address[] = [
  '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357', '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5',
  '0x29f2D40B0605204364af54EC677bD022dA425d03', '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c',
  '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', '0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a',
  '0x6d906e526a4e2Ca02097BA9d0caA3c382F52278E',
];
export async function swapCatalog(client: DefiClient, owner: Address, extras: Address[] = []): Promise<SwapCatalog> {
  const candidates = [...new Map([...BASES, ...CANDIDATES, ...extras].map((a) => [a.toLowerCase(), a])).values()];
  const metadata = await Promise.allSettled(candidates.map((a) => readToken(client, a, owner)));
  return { tokens: metadata.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []) };
}

export function minimumOutput(token: DefiToken, raw: bigint, slippageBps: number): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 500) throw new Error('Slippage must be between 0.01% and 5%.');
  const result = raw * BigInt(10_000 - slippageBps) / 10_000n;
  if (result <= 0n) throw new Error('The output amount is too small.');
  return result;
}
export async function prepareSwap(client: DefiClient, owner: Address, from: Address, to: Address, amount: bigint, slippageBps: number, deadline: number): Promise<PreparedDefi> {
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 500) throw new Error('Slippage must be between 0.01% and 5%.');
  if (!GATEWAY_URL) throw new Error('Uniswap Swap requires Harbour’s signed API gateway.');
  const nativeIn = sameAddress(from, zeroAddress); const nativeOut = sameAddress(to, zeroAddress);
  if (nativeIn && nativeOut) throw new Error('Choose two different assets.');
  const input = nativeIn ? { address: from, symbol: 'ETH', decimals: 18, balance: (await client.getBalance({ address: owner })).toString() } : await readToken(client, from, owner);
  const output = nativeOut ? { address: to, symbol: 'ETH', decimals: 18, balance: (await client.getBalance({ address: owner })).toString() } : await readToken(client, to, owner);
  if (amount > BigInt(input.balance)) throw new Error('Insufficient token balance.');
  const quoteResponse = await uniswapBackend({ chainId: SEPOLIA.chainId, tokenIn: from, tokenOut: to, amount: amount.toString(), swapper: owner, slippageBps, deadline });
  const quote = quoteResponse?.quote;
  if (!quote || !['CLASSIC', 'WRAP', 'UNWRAP'].includes(String(quoteResponse.routing ?? ''))) throw new Error('Uniswap returned a swap route Harbour cannot execute. Try another pair.');
  const expected = String(quote.output?.amount ?? ''); const minimum = String(quote.output?.minimumAmount ?? '');
  if (!/^\d+$/.test(expected) || !/^\d+$/.test(minimum) || BigInt(expected) <= 0n || BigInt(minimum) <= 0n) throw new Error('Uniswap returned an incomplete quote. Refresh and try again.');
  // The review shows the API's minimum, so it must honour the user's slippage (and never exceed the expected output).
  if (BigInt(minimum) > BigInt(expected) || BigInt(minimum) < minimumOutput(output, BigInt(expected), slippageBps)) throw new Error('Uniswap returned a quote outside your slippage tolerance. Refresh and try again.');
  const calls = [] as PreparedDefi['calls'];
  // Token input: the approval names the proxy, and the swap must target that same proxy (never an address the API picks later).
  let proxy: Address | null = null;
  if (!nativeIn && quoteResponse.isTokenApprovalApplicable !== false) {
    const approvalResponse = { approval: quoteResponse.approval, cancel: quoteResponse.cancel };
    // Some tokens (USDT-style) need the old allowance reset to 0 first; the API returns that as `cancel`.
    if (approvalResponse?.cancel) {
      const spender = approvedSpender(validateApiTransaction(approvalResponse.cancel, owner, 'Reset token approval', [from]));
      if (spender.amount !== 0n) throw new Error('Uniswap returned an invalid approval reset. Nothing was submitted.');
      proxy = spender.spender;
      calls.push({ to: getAddress(from), value: 0n, label: 'Reset token approval', data: encodeFunctionData({ abi: tokenAbi, functionName: 'approve', args: [spender.spender, 0n] }) });
    }
    if (approvalResponse?.approval) {
      const spender = approvedSpender(validateApiTransaction(approvalResponse.approval, owner, 'Approve input token', [from]));
      if (proxy && !sameAddress(proxy, spender.spender)) throw new Error('Uniswap requested an unexpected approval target. Nothing was submitted.');
      proxy = spender.spender;
      // The API asks for an unlimited allowance. Harbour approves only this swap's exact input amount.
      calls.push({ to: getAddress(from), value: 0n, label: 'Approve input token', data: encodeFunctionData({ abi: tokenAbi, functionName: 'approve', args: [spender.spender, amount] }) });
    }
  }
  const transaction = quoteResponse.swap;
  if (!transaction) throw new Error('Uniswap did not return transaction data. Refresh and review again.');
  // Native ETH input: the API targets the Universal Router directly (no approval, so no proxy); its calldata is decoded and every
  // step checked (recipient = the user, reviewed minimum enforced, exact input). Token input: the proxy named by the approval.
  const swap = validateApiTransaction(transaction, owner, 'Swap with Uniswap', nativeIn ? [SEPOLIA.universalRouter] : proxy ? [proxy] : PROXIES);
  // ETH input sends exactly the reviewed amount; token input sends no ETH.
  if (swap.value !== (nativeIn ? amount : 0n)) throw new Error('Uniswap returned a swap with an unexpected ETH amount. Nothing was submitted.');
  if (nativeIn) checkUniversalRouterSwap(swap.data, { owner, tokenIn: from, tokenOut: to, amountIn: amount, minimumOut: BigInt(minimum), weth: SEPOLIA.weth, nowSec: Math.floor(Date.now() / 1000) });
  // The proxy's calldata format is not public, so for token input the recipient/minimum are enforced by the quote checks above
  // and by simulation before signing.
  calls.push(swap);
  return { calls, review: { action: 'swap', symbol: input.symbol, decimals: input.decimals, amount: amount.toString(), outputSymbol: output.symbol, outputDecimals: output.decimals,
    expectedOutput: expected, minimumOutput: minimum } };
}

/** Maps gateway/Uniswap error bodies to user-facing text; raw upstream messages are not shown. */
export function uniswapError(data: any): string {
  // Backend errors ({ error: { code, message } }): Uniswap-specific wording for "no route" / "busy", otherwise the backend's own
  // message (already written for users).
  if (typeof data?.error?.code === 'string' && typeof data?.error?.message === 'string') {
    if (/^(no_liquidity|unsupported_pair|amount_too_low|amount_too_high)$/.test(data.error.code)) return 'No Uniswap route is available for this pair and amount. Try a smaller amount or another token.';
    if (/^(server|timeout|network)$/.test(data.error.code)) return 'Uniswap is busy right now. Wait a moment and try again.';
    return data.error.message;
  }
  const code = String(data?.errorCode ?? '');
  if (/NO_ROUTE|QUOTE_ERROR|InsufficientLiquidity/i.test(code)) return 'No Uniswap route is available for this pair and amount. Try a smaller amount or another token.';
  if (/RATE_LIMIT|429/i.test(code)) return 'Uniswap is busy right now. Wait a moment and try again.';
  return 'Uniswap could not prepare this swap. Try another amount or token pair.';
}

/** Decodes an API approval and checks it targets the Uniswap proxy; returns the requested amount. */
function approvedSpender(call: { data: `0x${string}`; value: bigint }): { amount: bigint; spender: Address } {
  let decoded: ReturnType<typeof decodeFunctionData>;
  try { decoded = decodeFunctionData({ abi: tokenAbi, data: call.data }); } catch { throw new Error('Uniswap returned an invalid token approval. Nothing was submitted.'); }
  const spender = PROXIES.find((p) => sameAddress(String(decoded.args?.[0] ?? ''), p));
  if (decoded.functionName !== 'approve' || call.value !== 0n || !spender) throw new Error('Uniswap requested an unexpected approval target. Nothing was submitted.');
  return { amount: BigInt(String(decoded.args?.[1] ?? '0')), spender: getAddress(spender) };
}

function validateApiTransaction(value: any, owner: Address, label: string, expectedTo: readonly (Address | string)[]) {
  if (Number(value?.chainId) !== SEPOLIA.chainId || !isAddress(String(value?.to ?? ''), { strict: false }) || !isAddress(String(value?.from ?? ''), { strict: false }) || !sameAddress(value.from, owner)
    || !expectedTo.some((t) => sameAddress(value.to, t)) || typeof value?.data !== 'string' || !/^0x[0-9a-fA-F]{8,}$/.test(value.data)) throw new Error('Uniswap returned an invalid or unexpected transaction. Nothing was submitted.');
  let callValue: bigint;
  try { callValue = BigInt(value.value ?? '0'); } catch { throw new Error('Uniswap returned an invalid transaction value.'); }
  return { to: getAddress(value.to), data: value.data as `0x${string}`, value: callValue, label };
}
export async function prepareWrap(client: DefiClient, owner: Address, amount: bigint, action: 'wrap' | 'unwrap'): Promise<PreparedDefi> {
  const balance = action === 'wrap' ? await client.getBalance({ address: owner }) : BigInt((await readToken(client, SEPOLIA.weth, owner)).balance);
  if (amount > balance) throw new Error('Insufficient balance. Leave some test ETH for network fees.');
  return { calls: [{ to: SEPOLIA.weth, value: action === 'wrap' ? amount : 0n, label: action === 'wrap' ? 'Wrap test ETH' : 'Unwrap WETH',
    data: action === 'wrap' ? encodeFunctionData({ abi: wethAbi, functionName: 'deposit' }) : encodeFunctionData({ abi: wethAbi, functionName: 'withdraw', args: [amount] }) }],
  review: { action, amount: amount.toString(), symbol: action === 'wrap' ? 'ETH' : 'WETH', decimals: 18, outputSymbol: action === 'wrap' ? 'WETH' : 'ETH', outputDecimals: 18, expectedOutput: amount.toString(), minimumOutput: amount.toString() } };
}
