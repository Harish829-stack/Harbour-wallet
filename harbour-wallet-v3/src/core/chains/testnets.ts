// Test networks. Trust Wallet gates testnets behind a toggle (HAR 26.42.4 shows Sepolia, Base Sepolia and Avalanche Fuji polled once enabled);
// Harbour ships a short list (Sepolia, Base Sepolia, Arbitrum Sepolia, Polygon Amoy, Monad, MegaETH); any other testnet or mainnet is added by the user
// (Manage networks) or by a site (wallet_addEthereumChain, e.g. chainlist.org) and then shows under Custom networks. All derive with the ethereum CoinType, so one address covers them. Test coins have no value,
// so no CoinGecko id is set. Ids match the faucet list (core/settingsExtra.ts). RPCs are public endpoints; `npm run check:rpc` probes them.
import type { ChainInfo } from './types';

type Row = [id: string, name: string, chainId: number, symbol: string, rpcs: string[], explorer: string];
const ROWS: Row[] = [
  ['sepolia', 'Sepolia', 11155111, 'ETH', ['https://ethereum-sepolia-rpc.publicnode.com'], 'https://sepolia.etherscan.io'],
  ['base-sepolia', 'Base Sepolia', 84532, 'ETH', ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'], 'https://sepolia.basescan.org'],
  ['arbitrum-sepolia', 'Arbitrum Sepolia', 421614, 'ETH', ['https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia-rpc.publicnode.com'], 'https://sepolia.arbiscan.io'],
  ['polygon-amoy', 'Polygon Amoy', 80002, 'POL', ['https://rpc-amoy.polygon.technology', 'https://polygon-amoy-bor-rpc.publicnode.com'], 'https://amoy.polygonscan.com'],
  ['monad-testnet', 'Monad Testnet', 10143, 'MON', ['https://testnet-rpc.monad.xyz'], 'https://testnet.monadexplorer.com'],
  // MegaETH testnet (chain 6343): endpoints from docs.megaeth.com / Alchemy; run `npm run check:rpc` before relying on them.
  ['megaeth-testnet', 'MegaETH Testnet', 6343, 'ETH', ['https://timothy.megaeth.com/rpc'], 'https://testnet-mega.etherscan.io'],
];

export const TESTNET_CHAINS: ChainInfo[] = ROWS.map(([id, name, evmChainId, symbol, rpcs, explorer]) => ({
  twId: 60, id, name, wcId: 'ethereum', ct: 'ethereum', kind: 'evm', blockchain: 'Ethereum', symbol, decimals: 18, evmChainId,
  rpcs, explorer, txPath: '/tx/{id}', accountPath: '/address/{address}', testnet: true,
  // Sepolia keeps its historical native price id; every other test coin is unpriced.
  ...(id === 'sepolia' ? { cg: 'ethereum' } : {}),
}));
