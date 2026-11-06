// Network-fee presets for the approval screen (TW "Gas station": Safe / Average / Fast). Derived from the node's own data only.
import type { RpcCall } from './rpc';
export type FeeLevel = 'safe' | 'average' | 'fast';
export interface FeeValues { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasPrice?: bigint }
export interface FeePresets { eip1559: boolean; presets: Record<FeeLevel, FeeValues> }
const mul = (v: bigint, num: bigint, den: bigint) => (v * num) / den;
export async function feePresets(chainId: number, rpc: RpcCall): Promise<FeePresets> {
  const [block, tip, gp] = await Promise.all([
    rpc(chainId, 'eth_getBlockByNumber', ['latest', false]).catch(() => null),
    rpc(chainId, 'eth_maxPriorityFeePerGas', []).catch(() => null),
    rpc(chainId, 'eth_gasPrice', []).catch(() => null),
  ]);
  const base = block && typeof block.baseFeePerGas === 'string' ? BigInt(block.baseFeePerGas) : null;
  const gasPrice = typeof gp === 'string' ? BigInt(gp) : null;
  if (base !== null) {
    let t = typeof tip === 'string' ? BigInt(tip) : gasPrice !== null && gasPrice > base ? gasPrice - base : null;
    if (t === null) throw new Error('Fee data unavailable');
    if (t < 1n) t = 1n;
    const mk = (tipMul: bigint, baseMul: bigint, den = 10n): FeeValues => { const p = mul(t!, tipMul, den) || 1n; return { maxPriorityFeePerGas: p, maxFeePerGas: mul(base, baseMul, den) + p }; };
    return { eip1559: true, presets: { safe: mk(9n, 11n), average: mk(10n, 13n), fast: mk(15n, 16n) } };
  }
  if (gasPrice === null) throw new Error('Fee data unavailable');
  return { eip1559: false, presets: { safe: { gasPrice: mul(gasPrice, 9n, 10n) || 1n }, average: { gasPrice }, fast: { gasPrice: mul(gasPrice, 12n, 10n) } } };
}
export const maxFeeOf = (f: FeeValues): bigint => f.maxFeePerGas ?? f.gasPrice ?? 0n;
