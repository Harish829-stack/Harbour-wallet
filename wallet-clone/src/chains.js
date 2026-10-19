// Launch chain subset (7 mainnets + Sepolia testnet). RE source: §4.8 default coin set.
// coinType = wallet-core CoinType.value. Extend from the 128-coin list as needed.
export const CHAINS = [
  { id: 'ethereum',   name: 'Ethereum',        coinType: 60,  kind: 'evm', chainId: 1 },
  { id: 'bitcoin',    name: 'Bitcoin',         coinType: 0,   kind: 'utxo' },
  { id: 'smartchain', name: 'BNB Smart Chain', coinType: 20000714, kind: 'evm', chainId: 56 },
  { id: 'polygon',    name: 'Polygon',         coinType: 966, kind: 'evm', chainId: 137 },
  { id: 'solana',     name: 'Solana',          coinType: 501, kind: 'solana' },
  { id: 'arbitrum',   name: 'Arbitrum',        coinType: 60,  kind: 'evm', chainId: 42161 },
  { id: 'base',       name: 'Base',            coinType: 60,  kind: 'evm', chainId: 8453 },
];
export const TESTNETS = [
  { id: 'sepolia', name: 'Sepolia', coinType: 60, kind: 'evm', chainId: 11155111, rpcEnv: 'SEPOLIA_RPC_URL' },
];
