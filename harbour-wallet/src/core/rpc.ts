// Per-chain JSON-RPC endpoints. Public defaults so the wallet works out of the box;
// override any chain at build time with VITE_RPC_<chainId> (e.g. a user's Alchemy/Infura URL).
// RE note (§7): Trust Wallet routes RPC through its own NaaS gateway; Harbour uses direct RPC.
const DEFAULT_RPC: Record<number, string> = {
  1:        'https://eth.llamarpc.com',                       // Ethereum
  56:       'https://bsc-dataseed.binance.org',               // BNB Smart Chain
  137:      'https://polygon-rpc.com',                        // Polygon
  42161:    'https://arb1.arbitrum.io/rpc',                   // Arbitrum One
  8453:     'https://mainnet.base.org',                       // Base
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',   // Sepolia testnet
};

export function rpcUrl(chainId: number): string | undefined {
  const env = (import.meta as any).env?.[`VITE_RPC_${chainId}`];
  return (typeof env === 'string' && env) || DEFAULT_RPC[chainId];
}
