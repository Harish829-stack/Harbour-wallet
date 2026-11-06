// "Buy with P2P" (TW fund.buy-locally.title). TW's P2P is a Binance P2P integration behind its gateway; Harbour's public equivalent is the
// Binance P2P marketplace page for the chosen asset/fiat. Funds land in the user's Binance account (no wallet address is passed), so the
// UI tells the user to withdraw to Harbour afterwards (Fund > Deposit from exchange).
import { buildSafeUrl } from './guard';
import { isRampFiat } from './fiat';
export const P2P_ASSETS = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC'] as const;
export const isP2pAsset = (s: unknown): s is (typeof P2P_ASSETS)[number] => typeof s === 'string' && (P2P_ASSETS as readonly string[]).includes(s);
export function buildP2pUrl(asset: string, fiat: string): string {
  if (!isP2pAsset(asset)) throw new Error('Asset not available on P2P');
  if (!isRampFiat(fiat)) throw new Error('Unsupported currency');
  return buildSafeUrl(`https://p2p.binance.com/en/trade/all-payments/${asset}`, { fiat }, ['binance.com']).toString();
}
