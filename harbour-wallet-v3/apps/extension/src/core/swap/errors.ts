import type { SwapError, SwapErrorCode } from './types';
// User-facing texts are TW's own English strings (composeResources strings.commonMain.cvr,
// QuoteError* / SwapError* keys; extension react-intl swap.* ids) — see evidences/re-evidence/25-swap.
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
  busy: 'Another swap is still being sent. Wait for it to finish.',
  not_verified: 'This swap couldn’t be checked on this network right now, so it was not sent. Please try again later.',
  rate_limited: 'Swap providers are busy right now. Please try again in a moment.',
  fee_too_high: 'The network fee is unusually high right now, so the swap was not sent. Try again later.',
  unsupported_route: 'Harbour can’t verify where this route delivers your funds, so it isn’t offered. Try another token or network.',
};
export const swapError = (code: SwapErrorCode, extra?: Partial<SwapError>): SwapError => ({ code, message: SWAP_MESSAGES[code], ...extra });
