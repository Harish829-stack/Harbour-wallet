import { useSyncExternalStore } from 'react';
import type { SwapAsset, SwapSettings, SwapHistoryItem } from '../../../core/swap/types';
import { DEFAULT_SWAP_SETTINGS } from '../../../core/swap/types';
import { nativeAsset, sameAsset } from '../../../core/swap/tokens';

// Tiny shared store for the Swap form (TW keeps this in redux `swap.settings` + page state).
export interface SwapState {
  from: SwapAsset | null; to: SwapAsset | null; amount: string;
  settings: SwapSettings; balances: Record<string, string>; history: SwapHistoryItem[];
  ack: boolean;            // user accepted the high price impact
}
const initial = (): SwapState => ({ from: nativeAsset('ethereum'), to: null, amount: '', settings: DEFAULT_SWAP_SETTINGS, balances: {}, history: [], ack: false });
let state: SwapState = initial();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const getSwap = () => state;
export function setSwap(patch: Partial<SwapState>) { state = { ...state, ...patch }; emit(); }
export function useSwapStore(): SwapState { return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getSwap); }

export function flipPair() { setSwap({ from: state.to, to: state.from, amount: '', ack: false }); }
// Picking the asset already chosen on the other side swaps the two sides.
export function pickAsset(side: 'from' | 'to', a: SwapAsset) {
  const other = side === 'from' ? state.to : state.from;
  if (sameAsset(other, a)) setSwap({ from: side === 'from' ? a : state.to, to: side === 'from' ? state.from : a, amount: '', ack: false });
  else setSwap({ [side]: a, amount: side === 'from' ? '' : state.amount, ack: false } as Partial<SwapState>);
}
export function resetSwapForm() { setSwap({ amount: '', ack: false, to: null }); } // TW resetSwapForm
export const pendingCount = (h: SwapHistoryItem[]) => h.filter((x) => x.status === 'approving' || x.status === 'swapping' || x.status === 'bridging').length;
