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

import { rpcOverride } from './networkRegistry';
export function rpcUrl(chainId: number): string | undefined {
  const o = rpcOverride(chainId); if (o) return o;
  const env = (import.meta as any).env?.[`VITE_RPC_${chainId}`];
  return (typeof env === 'string' && env) || DEFAULT_RPC[chainId];
}

// Solana JSON-RPC (public default; override with VITE_RPC_SOLANA, e.g. a user's Helius/QuickNode URL).
export function solanaRpcUrl(): string {
  const env = (import.meta as any).env?.VITE_RPC_SOLANA;
  return (typeof env === 'string' && env) || 'https://api.mainnet-beta.solana.com';
}
// MEV-protected broadcast endpoints (TW "Best price execution" / "MEV protection" setting).
// How TW itself implements this is UNKNOWN (it submits through its own backend); Harbour broadcasts
// through public private-mempool RPCs where they exist and falls back to the normal RPC elsewhere.
const PROTECTED_RPC: Record<number, string> = {
  1: 'https://rpc.flashbots.net/fast',    // Flashbots Protect
  56: 'https://rpc-bsc.48.club',          // 48 Club Puissant builder RPC
};
export const protectedRpcUrl = (chainId: number): string | undefined => PROTECTED_RPC[chainId];
