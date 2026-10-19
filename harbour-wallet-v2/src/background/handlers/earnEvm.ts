// Executes a staking call plan on an EVM chain: estimate -> sign (viem, local key) -> broadcast -> (wait between dependent calls).
// Fee estimation never invents a number: if the node cannot estimate gas the plan's documented upper bound is used and labelled.
import { createPublicClient, defineChain, fallback, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ChainInfo } from '../../core/chains/types';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import type { CallPlan } from '../../core/staking/evm';

export function evmClientFor(chain: ChainInfo) {
  const urls = getRpcUrls(chain); if (!urls.length || !chain.evmChainId) throw new Error('No RPC endpoint for this network');
  const def = defineChain({ id: chain.evmChainId, name: chain.name, nativeCurrency: { name: chain.symbol, symbol: chain.symbol, decimals: chain.decimals }, rpcUrls: { default: { http: urls } } });
  return createPublicClient({ chain: def, transport: urls.length > 1 ? fallback(urls.map((u) => http(u, { timeout: 15000, retryCount: 1 }))) : http(urls[0], { timeout: 15000, retryCount: 1 }) });
}
type Client = ReturnType<typeof evmClientFor>;
export interface Fees { gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
export async function feeData(client: Client, legacy: boolean): Promise<Fees> {
  if (!legacy) { try { const f = await client.estimateFeesPerGas(); if (f.maxFeePerGas) return { maxFeePerGas: f.maxFeePerGas, maxPriorityFeePerGas: f.maxPriorityFeePerGas }; } catch { /* fall through */ } }
  return { gasPrice: await client.getGasPrice() };
}
export interface GasEstimate { gas: bigint; estimated: boolean }
export async function estimateCall(client: Client, from: `0x${string}`, c: CallPlan, canEstimate: boolean): Promise<GasEstimate> {
  if (canEstimate) { try { return { gas: ((await client.estimateGas({ account: from, to: c.to, data: c.data, value: c.value })) * 12n) / 10n, estimated: true }; } catch { /* use bound */ } }
  return { gas: c.gasFallback, estimated: false };
}
/** Total fee (wei) of a plan: only the first call can be estimated against current state, later ones use their bound. */
export async function estimatePlan(chain: ChainInfo, from: `0x${string}`, plan: CallPlan[]): Promise<{ fee: bigint; exact: boolean; steps: number }> {
  const client = evmClientFor(chain); const fees = await feeData(client, chain.evmChainId === 56);
  const price = fees.maxFeePerGas ?? fees.gasPrice ?? 0n;
  let gas = 0n; let exact = true;
  for (let i = 0; i < plan.length; i++) { const g = await estimateCall(client, from, plan[i], i === 0); gas += g.gas; exact = exact && g.estimated; }
  return { fee: gas * price, exact, steps: plan.length };
}
export async function runPlan(chain: ChainInfo, privateKey: `0x${string}`, plan: CallPlan[]): Promise<string[]> {
  const client = evmClientFor(chain); const account = privateKeyToAccount(privateKey);
  const legacy = chain.evmChainId === 56; const hashes: string[] = [];
  let nonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' });
  for (let i = 0; i < plan.length; i++) {
    const c = plan[i]; const fees = await feeData(client, legacy);
    const gas = (await estimateCall(client, account.address, c, true)).gas;
    const base = { chainId: chain.evmChainId!, to: c.to, data: c.data, value: c.value, nonce, gas };
    const raw = await account.signTransaction(legacy || !fees.maxFeePerGas ? { ...base, type: 'legacy' as const, gasPrice: fees.gasPrice ?? fees.maxFeePerGas! } : { ...base, type: 'eip1559' as const, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 0n });
    const hash = await client.sendRawTransaction({ serializedTransaction: raw });
    hashes.push(hash); nonce++;
    if (i < plan.length - 1) { // a dependent call (approve -> request): wait until the first is mined
      const r = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (r.status !== 'success') throw new Error('The first transaction failed on-chain; nothing else was sent');
    }
  }
  return hashes;
}
