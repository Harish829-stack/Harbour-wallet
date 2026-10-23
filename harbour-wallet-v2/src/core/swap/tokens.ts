import { getAddress } from 'viem';
import type { SwapAsset } from './types';
import { SWAP_DOMAINS, domainById } from './domains';
import { tokenLogoPath } from '../assetLogos';

// Asset id convention used by TW: c<coinId> for the native asset, c<coinId>_t<address> for tokens.
export function assetId(domainId: string, address: string): string {
  const d = domainById(domainId)!;
  return address === 'native' ? `c${d.twCoinId}` : `c${d.twCoinId}_t${address}`;
}
// Logos are bundled with the extension (public-production/chains + /tokens); a token without a bundled logo returns '' and the UI shows its fallback.
export function logoFor(domainId: string, address: string): string {
  const d = domainById(domainId)!;
  if (address === 'native') return `/chains/${d.trustAssetsDir}.png`;
  try { return tokenLogoPath(d.trustAssetsDir, d.kind === 'evm' ? getAddress(address) : address); } catch { return ''; }
}
export function nativeAsset(domainId: string): SwapAsset {
  const d = domainById(domainId)!;
  return { assetId: assetId(domainId, 'native'), domainId, address: 'native', symbol: d.nativeSymbol, name: d.name === 'BNB Smart Chain' ? 'BNB' : d.name === 'Polygon' ? 'Polygon' : d.name === 'Solana' ? 'Solana' : d.name === 'Ethereum' ? 'Ethereum' : 'Ether', decimals: d.nativeDecimals, logoUrl: logoFor(domainId, 'native') };
}
export function makeToken(domainId: string, address: string, symbol: string, name: string, decimals: number, priceUsd?: number): SwapAsset {
  const d = domainById(domainId)!;
  const addr = d.kind === 'evm' ? getAddress(address) : address;
  return { assetId: assetId(domainId, addr), domainId, address: addr, symbol, name, decimals, logoUrl: logoFor(domainId, addr), priceUsd };
}

// Curated "popular" tokens per domain (stand-in for TW's server-side verified listings sorted
// by volume — /v1/assets/listings is gateway-only). Addresses are canonical mainnet contracts.
type T = [string, string, string, number];
const TOKENS: Record<string, T[]> = {
  ethereum: [
    ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', 'USD Coin', 6], ['0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', 'Tether USD', 6],
    ['0x6B175474E89094C44Da98b954EedeAC495271d0F', 'DAI', 'Dai Stablecoin', 18], ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'WETH', 'Wrapped Ether', 18],
    ['0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 'WBTC', 'Wrapped BTC', 8], ['0x514910771AF9Ca656af840dff83E8264EcF986CA', 'LINK', 'Chainlink', 18],
    ['0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 'UNI', 'Uniswap', 18],
  ],
  smartchain: [
    ['0x55d398326f99059fF775485246999027B3197955', 'USDT', 'Tether USD', 18], ['0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'USDC', 'USD Coin', 18],
    ['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 'WBNB', 'Wrapped BNB', 18], ['0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 'CAKE', 'PancakeSwap Token', 18],
    ['0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 'ETH', 'Ethereum Token', 18],
  ],
  polygon: [
    ['0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 'USDC', 'USD Coin', 6], ['0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 'USDT', 'Tether USD', 6],
    ['0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 'DAI', 'Dai Stablecoin', 18], ['0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 'WETH', 'Wrapped Ether', 18],
    ['0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 'WPOL', 'Wrapped POL', 18],
  ],
  arbitrum: [
    ['0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'USDC', 'USD Coin', 6], ['0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 'USDT', 'Tether USD', 6],
    ['0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 'DAI', 'Dai Stablecoin', 18], ['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 'WETH', 'Wrapped Ether', 18],
    ['0x912CE59144191C1204E64559FE8253a0e49E6548', 'ARB', 'Arbitrum', 18],
  ],
  base: [
    ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 'USD Coin', 6], ['0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 'DAI', 'Dai Stablecoin', 18],
    ['0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', 18], ['0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', 'cbBTC', 'Coinbase Wrapped BTC', 8],
  ],
  solana: [
    ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 'USD Coin', 6], ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'USDT', 'Tether USD', 6],
    ['JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', 'JUP', 'Jupiter', 6], ['DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 'BONK', 'Bonk', 5],
    ['EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', 'WIF', 'dogwifhat', 6], ['J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', 'JitoSOL', 'Jito Staked SOL', 9],
    ['mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', 'mSOL', 'Marinade Staked SOL', 9],
  ],
};
export function popularAssets(domainId?: string): SwapAsset[] {
  const ids = domainId ? [domainId] : SWAP_DOMAINS.map((d) => d.id);
  return ids.flatMap((id) => [nativeAsset(id), ...(TOKENS[id] ?? []).map(([a, s, n, dec]) => makeToken(id, a, s, n, dec))]);
}
// A bundled logo may be selected only for a native coin or an exact curated
// contract. Token symbols alone are attacker-controlled display data.
export function knownLogoSymbol(asset: SwapAsset): string | null {
  if (asset.address === 'native') return asset.domainId === 'polygon' ? 'POL' : asset.symbol;
  const known = (TOKENS[asset.domainId] ?? []).find(([address]) => address.toLowerCase() === asset.address.toLowerCase());
  return known?.[1] === asset.symbol ? known[1] : null;
}
export const sameAsset = (a?: SwapAsset | null, b?: SwapAsset | null) => !!a && !!b && a.assetId === b.assetId;
