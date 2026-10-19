import type { SwapError, SwapErrorCode } from './types';
// User-facing texts are TW's own English strings (composeResources strings.commonMain.cvr,
// QuoteError* / SwapError* keys; extension react-intl swap.* ids) — see evidence/25-swap.
export const SWAP_MESSAGES: Record<SwapErrorCode, string> = {
  amount_too_low: 'Adjust input: Amount entered is too low.',
  amount_too_high: 'Adjust input: Amount entered is too high',
  invalid_amount: 'Adjust input: Invalid amount',
  no_liquidity: 'Swap unavailable: No provider found',
  unsupported_pair: 'These two tokens can’t be swapped with each other. Try another pair.',
  unsupported_domain: 'Try a different network',
  invalid_asset: 'Unsupported asset: Select another token',
  high_price_impact: 'Swap blocked: Swap may result in high price impact',
  server: 'Server error, please try again',
  timeout: 'Quote request timed out. Please try again.',
  network: 'Couldn’t fetch a quote. Please try again.',
  invalid_slippage: 'Invalid slippage',
  price_moved: 'The price moved while preparing this swap. Refresh the quote and try again.',
  unsafe_transaction: 'Swap blocked: the provider returned a transaction that does not match your quote.',
  simulation_failed: 'Swap couldn\'t be completed. Please, try again later.',
  insufficient_gas: 'Not enough balance to cover network fees.',
};
export const swapError = (code: SwapErrorCode, extra?: Partial<SwapError>): SwapError => ({ code, message: SWAP_MESSAGES[code], ...extra });

// Map an aggregator HTTP failure / error body onto a TW-style quote error.
export function classifyAggregatorError(status: number, body: any): SwapError {
  const msg = String(body?.message ?? body?.error ?? body?.errorCode ?? '').toLowerCase();
  if (status === 429) return swapError('server');
  if (status >= 500) return swapError('server');
  if (/no available quotes|no possible route|could_not_find_any_route|no route|route.*not.*found|insufficient liquidity|no liquidity/.test(msg)) return swapError('no_liquidity');
  if (/too low|too small|minimum|below the min|amount.*small|dust/.test(msg)) return swapError('amount_too_low');
  if (/too high|exceeds|too large|above the max/.test(msg)) return swapError('amount_too_high');
  if (/token_not_tradable|not supported|unsupported|unknown token|invalid token|token.*not found/.test(msg)) return swapError('unsupported_pair');
  if (/slippage/.test(msg)) return swapError('invalid_slippage');
  if (/chain/.test(msg)) return swapError('unsupported_domain');
  if (/amount/.test(msg)) return swapError('invalid_amount');
  return status === 404 ? swapError('no_liquidity') : swapError('network');
}
