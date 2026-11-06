// Dust cleaner: sweep small token balances on one network into its native coin (TW "convert small balances").
import type { SwapAsset } from './types';

export const DUST_DEFAULT_USD = 5;
export const DUST_MAX_ITEMS = 10;
export interface DustCandidate { asset: SwapAsset; balance: string; usd: number }

/** Non-native holdings worth more than a cent but under the threshold, largest first (they are most worth a network fee). */
export function pickDust(rows: Array<{ asset: SwapAsset; balance: string; priceUsd?: number }>, thresholdUsd = DUST_DEFAULT_USD): DustCandidate[] {
  const out: DustCandidate[] = [];
  for (const r of rows) {
    if (r.asset.address === 'native' || !r.priceUsd || !(r.priceUsd > 0)) continue;
    let bal: bigint; try { bal = BigInt(r.balance); } catch { continue; }
    if (bal <= 0n) continue;
    const usd = (Number(bal) / 10 ** r.asset.decimals) * r.priceUsd;
    if (usd >= 0.01 && usd < thresholdUsd) out.push({ asset: { ...r.asset, priceUsd: r.priceUsd }, balance: bal.toString(), usd });
  }
  return out.sort((a, b) => b.usd - a.usd).slice(0, DUST_MAX_ITEMS);
}
