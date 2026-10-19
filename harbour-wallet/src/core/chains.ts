// Launch chains. RE §4.8. `ct` = wallet-core CoinType property name (resolved at runtime).
export interface Chain { id: string; name: string; ct: string; kind: 'evm'|'utxo'|'solana'; chainId?: number; testnet?: boolean; }
export const CHAINS: Chain[] = [
  { id: 'ethereum',   name: 'Ethereum',        ct: 'ethereum',   kind: 'evm',    chainId: 1 },
  { id: 'bitcoin',    name: 'Bitcoin',         ct: 'bitcoin',    kind: 'utxo' },
  { id: 'smartchain', name: 'BNB Smart Chain', ct: 'smartChain', kind: 'evm',    chainId: 56 },
  { id: 'polygon',    name: 'Polygon',         ct: 'polygon',    kind: 'evm',    chainId: 137 },
  { id: 'solana',     name: 'Solana',          ct: 'solana',     kind: 'solana' },
  { id: 'arbitrum',   name: 'Arbitrum',        ct: 'arbitrum',   kind: 'evm',    chainId: 42161 },
  { id: 'base',       name: 'Base',            ct: 'base',       kind: 'evm',    chainId: 8453 },
];
// Sepolia uses the ethereum CoinType for key derivation; RPC via env SEPOLIA_RPC_URL.
export const TESTNETS: Chain[] = [
  { id: 'sepolia', name: 'Sepolia', ct: 'ethereum', kind: 'evm', chainId: 11155111, testnet: true },
];
