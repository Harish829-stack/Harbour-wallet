// Call validation for the MetaMask Stateless7702 delegate. The ENCODING is MetaMask's kit (kit.ts); this file only refuses
// malformed input before it reaches the kit (strict address, value and data, and a call-count cap).
import { getAddress, isAddress, isHex, type Hex } from 'viem';
import { MAX_CALLS, type Address } from './constants';
import { encodeKitCalls } from './kit';

export interface Call { to: Address; value: bigint; data: Hex }

/** Strict normalization of one call: a valid address, a non-negative value and even-length hex data. */
export function normalizeCall(c: { to: unknown; value?: unknown; data?: unknown }): Call {
  if (typeof c?.to !== 'string' || !isAddress(c.to, { strict: false })) throw new Error('Invalid call target.');
  let value = 0n;
  if (c.value !== undefined && c.value !== null && c.value !== '') {
    try { value = BigInt(c.value as any); } catch { throw new Error('Invalid call value.'); }
    if (value < 0n) throw new Error('Invalid call value.');
  }
  const data = (c.data ?? '0x') as string;
  if (typeof data !== 'string' || !isHex(data) || (data.length % 2) !== 0) throw new Error('Invalid call data.');
  return { to: getAddress(c.to) as Address, value, data: data as Hex };
}

export function encodeCalls(calls: readonly Call[]): Hex {
  if (!calls.length) throw new Error('No calls.');
  if (calls.length > MAX_CALLS) throw new Error(`At most ${MAX_CALLS} calls.`);
  return encodeKitCalls(calls);
}
