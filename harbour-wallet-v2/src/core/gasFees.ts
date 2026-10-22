// Gas station: live fee tiers for one EVM chain from its public JSON-RPC (TW's /gas-station screen uses its own gateway, which is not used).
//   eth_feeHistory(5, "latest", [10, 50, 90]) -> baseFeePerGas[] (last entry = next block's base fee) + per-block priority-fee percentiles
//   eth_gasPrice                              -> legacy gas price (also the fallback when a chain has no EIP-1559 data)
//   eth_maxPriorityFeePerGas                  -> priority-fee fallback when feeHistory rewards are empty
// Tier rule (documented, not a TW formula): priority = median of that percentile over the sampled blocks;
//   maxFeePerGas = nextBaseFee x (1.25 slow | 2 standard | 2 fast) + priority   (2x is viem's default headroom).
import type { ChainInfo } from './chains/types';
import { getRpcUrls } from './chains/rpcUrls';
import { rpc } from './chains/adapters/net';
import { firstOf } from './chains/adapters/types';

type F = typeof fetch;
export interface GasTier { id: 'slow' | 'standard' | 'fast'; label: string; maxFeePerGas: string; priorityFee: string; /** wei strings */ costWei: string /** for a plain transfer (21,000 gas) at maxFeePerGas */ }
export interface GasQuote { chainId: string; eip1559: boolean; gasPrice: string; baseFee?: string; tiers: GasTier[]; transferGas: number; at: number }
export const TRANSFER_GAS = 21000n;

const hex = (v: unknown): bigint => { if (typeof v !== 'string' || !/^0x[0-9a-fA-F]*$/.test(v)) throw new Error('bad hex'); return v === '0x' ? 0n : BigInt(v); };
const median = (xs: bigint[]): bigint => { const s = [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); return s.length ? s[Math.floor(s.length / 2)] : 0n; };
const ceilMul = (v: bigint, num: bigint, den: bigint) => (v * num + den - 1n) / den;

/** Pure: build tiers from raw RPC answers (testable without a network). */
export function buildQuote(chainId: string, o: { gasPrice: bigint; feeHistory?: any; maxPriority?: bigint }, now = Date.now()): GasQuote {
  const bf: bigint[] = Array.isArray(o.feeHistory?.baseFeePerGas) ? o.feeHistory.baseFeePerGas.map(hex) : [];
  const next = bf.length ? bf[bf.length - 1] : 0n;
  const rewards: bigint[][] = Array.isArray(o.feeHistory?.reward) ? o.feeHistory.reward.map((r: any[]) => r.map(hex)) : [];
  if (next === 0n) { // legacy chain (or no base fee): a single honest tier from eth_gasPrice
    return { chainId, eip1559: false, gasPrice: o.gasPrice.toString(), transferGas: Number(TRANSFER_GAS),
      tiers: [{ id: 'standard', label: 'Standard', maxFeePerGas: o.gasPrice.toString(), priorityFee: '0', costWei: (o.gasPrice * TRANSFER_GAS).toString() }], at: now };
  }
  const pct = (i: number) => { const col = rewards.map((r) => r[i]).filter((x) => x !== undefined); return col.length ? median(col) : undefined; };
  const fb = o.maxPriority ?? 0n;
  const prio = { slow: pct(0) ?? fb, standard: pct(1) ?? fb, fast: pct(2) ?? fb };
  const mk = (id: GasTier['id'], label: string, num: bigint, den: bigint): GasTier => {
    const p = prio[id]; const max = ceilMul(next, num, den) + p;
    return { id, label, maxFeePerGas: max.toString(), priorityFee: p.toString(), costWei: (max * TRANSFER_GAS).toString() };
  };
  return { chainId, eip1559: true, gasPrice: o.gasPrice.toString(), baseFee: next.toString(), transferGas: Number(TRANSFER_GAS), tiers: [mk('slow', 'Slow', 5n, 4n), mk('standard', 'Standard', 2n, 1n), mk('fast', 'Fast', 2n, 1n)], at: now };
}

export async function fetchGasQuote(chain: ChainInfo, f: F = fetch): Promise<{ ok: true; quote: GasQuote } | { ok: false; error: string }> {
  if (chain.kind !== 'evm') return { ok: false, error: 'Gas station is only available on EVM networks.' };
  const urls = getRpcUrls(chain); if (!urls.length) return { ok: false, error: 'No RPC endpoint for this network.' };
  try {
    return await firstOf(urls, async (u) => {
      const gp = await rpc(f, u, 'eth_gasPrice', []); if (gp.error) throw new Error(gp.error.message ?? 'RPC error');
      const [fh, mp] = await Promise.all([rpc(f, u, 'eth_feeHistory', [5, 'latest', [10, 50, 90]]).catch(() => null), rpc(f, u, 'eth_maxPriorityFeePerGas', []).catch(() => null)]);
      let maxPriority: bigint | undefined; try { maxPriority = mp && !mp.error ? hex(mp.result) : undefined; } catch { maxPriority = undefined; }
      const feeHistory = fh && !fh.error ? fh.result : undefined;
      return { ok: true as const, quote: buildQuote(chain.id, { gasPrice: hex(gp.result), feeHistory, maxPriority }) };
    });
  } catch (e: any) { return { ok: false, error: 'Could not load fees right now.' }; }
}
export const gwei = (wei: string | bigint): string => {
  const n = Number(BigInt(wei)) / 1e9;
  return n === 0 ? '0' : n < 0.01 ? n.toFixed(4).replace(/0+$/, '') : n < 10 ? n.toFixed(3).replace(/\.?0+$/, '') : n.toFixed(1).replace(/\.0$/, '');
};
