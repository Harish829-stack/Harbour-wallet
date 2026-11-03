import { encodeFunctionData } from 'viem';
import type { Address } from 'viem';
import { SEPOLIA, type AaveDeployment } from './config';
import { dataAbi, poolAbi, tokenAbi } from './abis';
import { approvals, readToken, sameAddress } from './rpc';
import type { DefiClient } from './rpc';
import type { EarnAsset, PreparedDefi } from './types';

export function reserveFlags(data: bigint) {
  const active = !!(data & (1n << 56n));
  const frozen = !!(data & (1n << 57n));
  const paused = !!(data & (1n << 60n));
  const supplyCap = (data >> 116n) & ((1n << 36n) - 1n);
  return { active, frozen, paused, supplyCap };
}
export function supplyApy(rate: bigint): number {
  return Math.expm1(31_536_000 * Math.log1p(Number(rate) / 1e27 / 31_536_000)) * 100;
}
export async function reserve(client: DefiClient, token: Address, owner: Address, deployment: AaveDeployment = SEPOLIA): Promise<EarnAsset> {
  const [metadata, config, addresses, data] = await Promise.all([
    readToken(client, token, owner),
    client.readContract({ address: deployment.pool, abi: poolAbi, functionName: 'getConfiguration', args: [token] }),
    client.readContract({ address: deployment.dataProvider, abi: dataAbi, functionName: 'getReserveTokensAddresses', args: [token] }),
    client.readContract({ address: deployment.dataProvider, abi: dataAbi, functionName: 'getReserveData', args: [token] }),
  ]);
  const aToken = addresses[0];
  const [supplied, availableLiquidity] = await Promise.all([
    client.readContract({ address: aToken, abi: tokenAbi, functionName: 'balanceOf', args: [owner] }),
    client.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [aToken] }),
  ]);
  const flags = reserveFlags(config);
  // Aave's cap includes pending treasury accrual, scaled by the liquidity index (ray).
  const cap = flags.supplyCap * 10n ** BigInt(metadata.decimals);
  const total = data[2] + data[1] * data[9] / 10n ** 27n;
  const remaining = cap === 0n ? null : (cap > total ? cap - total : 0n);
  const reason = !flags.active ? 'Reserve inactive' : flags.paused ? 'Reserve paused' : flags.frozen ? 'New deposits paused' : remaining === 0n ? 'Supply cap reached' : undefined;
  return { ...metadata, aToken, supplied: supplied.toString(), apy: supplyApy(data[5]),
    canSupply: !reason, canWithdraw: flags.active && !flags.paused && supplied > 0n && availableLiquidity > 0n,
    availableLiquidity: availableLiquidity.toString(), supplyRemaining: remaining?.toString() ?? null, reason };
}
export async function listEarnAssets(client: DefiClient, owner: Address, deployment: AaveDeployment = SEPOLIA): Promise<EarnAsset[]> {
  const tokens = await client.readContract({ address: deployment.pool, abi: poolAbi, functionName: 'getReservesList' });
  // Fail the refresh rather than silently displaying a partial list as complete.
  const results = await Promise.allSettled(tokens.map((token) => reserve(client, token, owner, deployment)));
  return results.flatMap((result) => result.status === 'fulfilled' && (result.value.canSupply || BigInt(result.value.supplied) > 0n) ? [result.value] : []);
}
export async function prepareEarn(client: DefiClient, owner: Address, token: Address, amount: bigint, action: 'supply' | 'withdraw', deployment: AaveDeployment = SEPOLIA): Promise<PreparedDefi> {
  const tokens = await client.readContract({ address: deployment.pool, abi: poolAbi, functionName: 'getReservesList' });
  if (!tokens.some((t) => sameAddress(t, token))) throw new Error(`This token is not supported by Aave on ${deployment.name}.`);
  const asset = await reserve(client, token, owner, deployment);
  if (action === 'supply') {
    if (!asset.canSupply) throw new Error(asset.reason ?? 'Deposits are unavailable.');
    if (amount > BigInt(asset.balance)) throw new Error('Insufficient token balance.');
    if (asset.supplyRemaining !== null && amount > BigInt(asset.supplyRemaining)) throw new Error('This deposit exceeds the remaining supply cap.');
  } else {
    if (!asset.canWithdraw || amount > BigInt(asset.supplied)) throw new Error('This amount is not available to withdraw.');
    if (amount > BigInt(asset.availableLiquidity)) throw new Error('There is not enough available liquidity to withdraw this amount.');
    // Simulation additionally enforces collateral/health-factor restrictions on existing borrowers.
    await client.simulateContract({ address: deployment.pool, abi: poolAbi, functionName: 'withdraw', args: [token, amount, owner], account: owner });
  }
  return {
    calls: [...(action === 'supply' ? await approvals(client, token, owner, deployment.pool, amount) : []), {
      to: deployment.pool, value: 0n, label: action === 'supply' ? 'Supply to Aave V3' : 'Withdraw from Aave V3',
      data: action === 'supply'
        ? encodeFunctionData({ abi: poolAbi, functionName: 'supply', args: [token, amount, owner, 0] })
        : encodeFunctionData({ abi: poolAbi, functionName: 'withdraw', args: [token, amount, owner] }),
    }],
    review: { action, symbol: asset.symbol, decimals: asset.decimals, amount: amount.toString(), apy: asset.apy },
  };
}
