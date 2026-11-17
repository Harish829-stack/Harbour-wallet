// Call encoding for the MetaMask Stateless7702 delegate (ERC-7821 style execute). Pure. Byte-identical to MetaMask's kit
// (documentation/smart-accounts/validation, vectors.json).
import { encodeAbiParameters, encodeFunctionData, parseAbi, getAddress, isAddress, isHex, type Hex } from 'viem';
import { MAX_CALLS, type Address } from './constants';

export interface Call { to: Address; value: bigint; data: Hex }

const abi = parseAbi([
  'function execute((address target, uint256 value, bytes callData) execution)',
  'function execute(bytes32 mode, bytes executionCalldata)',
]);
/** ERC-7579 execution mode: batch, default exec type. */
export const BATCH_MODE: Hex = '0x0100000000000000000000000000000000000000000000000000000000000000';

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
  if (calls.length === 1) return encodeFunctionData({ abi, functionName: 'execute', args: [{ target: calls[0].to, value: calls[0].value, callData: calls[0].data }] });
  const execs = encodeAbiParameters(
    [{ type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'callData', type: 'bytes' }] }],
    [calls.map((c) => ({ target: c.to, value: c.value, callData: c.data }))],
  );
  return encodeFunctionData({ abi, functionName: 'execute', args: [BATCH_MODE, execs] });
}
