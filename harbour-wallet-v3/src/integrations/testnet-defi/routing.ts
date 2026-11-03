import { encodePacked } from 'viem';
import type { Address, Hex } from 'viem';
import type { PoolEdge } from './types';
import { sameAddress } from './rpc';
import { SWAP_BASES } from './config';

/** Bounded V3 route graph: direct or one intermediate token, without a hosted routing service. */
export function pathsFor(pools: PoolEdge[], from: Address, to: Address, bases: readonly Address[] = SWAP_BASES): Hex[] {
  if (sameAddress(from, to)) return [];
  const next = (p: PoolEdge, token: Address) => sameAddress(p.token0, token) ? p.token1 : sameAddress(p.token1, token) ? p.token0 : null;
  const paths: Hex[] = [];
  for (const first of pools) {
    const middle = next(first, from); if (!middle) continue;
    if (sameAddress(middle, to)) paths.push(encodePacked(['address', 'uint24', 'address'], [from, first.fee, to]));
    else if (bases.some((base) => sameAddress(base, middle))) for (const second of pools) {
      const end = next(second, middle);
      if (end && sameAddress(end, to)) paths.push(encodePacked(['address', 'uint24', 'address', 'uint24', 'address'], [from, first.fee, middle, second.fee, to]));
    }
  }
  return [...new Set(paths)];
}
