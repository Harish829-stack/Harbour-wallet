// Taxonomy + response shape taken from a real Trust Wallet capture (network-log.har,
// GET /v1/assets/listings?version=27). Data is sourced from public APIs (CoinGecko);
// Harbour does NOT call TW's authenticated gateway.
export interface TwNetwork { coinId: number; name: string; cgCategory?: string }
// coin ids seen in the HAR's `networks=` param and /v1/balances/chains.
export const TW_NETWORKS: TwNetwork[] = [
  { coinId: 60, name: 'Ethereum', cgCategory: 'ethereum-ecosystem' },
  { coinId: 501, name: 'Solana', cgCategory: 'solana-ecosystem' },
  { coinId: 8453, name: 'Base', cgCategory: 'base-ecosystem' },
  { coinId: 20000714, name: 'BNB Smart Chain', cgCategory: 'binance-smart-chain' },
  { coinId: 966, name: 'Polygon', cgCategory: 'polygon-ecosystem' },
  { coinId: 10042221, name: 'Arbitrum', cgCategory: 'arbitrum-ecosystem' },
  { coinId: 10000070, name: 'Optimism', cgCategory: 'optimism-ecosystem' },
  { coinId: 10009000, name: 'Avalanche C-Chain', cgCategory: 'avalanche-ecosystem' },
  { coinId: 10000999, name: 'HyperEVM' },
  { coinId: 10004663, name: 'Robinhood Chain' },
  { coinId: 10005042, name: 'Arc' },
];
// category_id values seen in the capture. `cg` is the closest public equivalent.
export interface TwCategory { id: string; name: string; sortField: 'volume_24h' | 'market_cap'; cg?: string }
export const TW_CATEGORIES: TwCategory[] = [
  { id: 'trending', name: 'Trending', sortField: 'volume_24h' },
  { id: 'trending_ave', name: 'Trending (all networks)', sortField: 'volume_24h' },
  { id: 'ai', name: 'AI', sortField: 'market_cap', cg: 'artificial-intelligence' },
  { id: 'solana-ecosystem', name: 'Solana Ecosystem', sortField: 'volume_24h', cg: 'solana-ecosystem' },
];
// UNMAPPED (seen in capture, no verified public equivalent): 'bstocks'.

// Response shape of /v1/assets/listings docs[]
export interface TwListingDoc {
  asset: { name: string; symbol: string; network: number; asset_id: string; icon_url?: string; is_verified?: boolean };
  market: { market_cap: number; volume_24h: number; total_supply?: number };
  price: { price: number; percent_change_1h: number; percent_change_24h: number; percent_change_7d: number; percent_change_30d: number };
}
export interface TwMarketRow { id: string; symbol: string; name: string; image: string; price: number; change: number; change1h: number; change24h: number; change7d: number; change30d: number; marketCap: number; volume24h: number; network: number }
