import { getAddress, isAddress, encodeFunctionData } from 'viem';
import type { Address, PublicClient } from 'viem';
import { tokenAbi } from './abis';
import type { DefiCall, DefiToken } from './types';

export type DefiClient = Pick<PublicClient, 'readContract' | 'multicall' | 'simulateContract' | 'getBalance' | 'getChainId' | 'getCode'>;
export function tokenAddress(value: string): Address {
  if (!isAddress(value, { strict: false })) throw new Error('Enter a valid token contract address.');
  return getAddress(value.toLowerCase());
}
export const sameAddress = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
export async function readToken(client: DefiClient, address: Address, owner: Address): Promise<DefiToken> {
  const [symbol, decimals, balance] = await Promise.all([
    client.readContract({ address, abi: tokenAbi, functionName: 'symbol' }),
    client.readContract({ address, abi: tokenAbi, functionName: 'decimals' }),
    client.readContract({ address, abi: tokenAbi, functionName: 'balanceOf', args: [owner] }),
  ]);
  if (!Number.isInteger(decimals) || decimals > 36 || !symbol) throw new Error('Unsupported token metadata.');
  return { address, symbol: symbol.slice(0, 24), decimals, balance: balance.toString() };
}
export async function approvals(client: DefiClient, token: Address, owner: Address, spender: Address, amount: bigint): Promise<DefiCall[]> {
  const allowance = await client.readContract({ address: token, abi: tokenAbi, functionName: 'allowance', args: [owner, spender] });
  if (allowance >= amount) return [];
  const call = (value: bigint): DefiCall => ({ to: token, data: encodeFunctionData({ abi: tokenAbi, functionName: 'approve', args: [spender, value] }), value: 0n, label: value === 0n ? 'Reset token allowance' : 'Approve exact amount' });
  // Supports tokens that require an existing non-zero allowance to be reset first.
  return [...(allowance > 0n ? [call(0n)] : []), call(amount)];
}
