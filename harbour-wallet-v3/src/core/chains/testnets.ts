// Test networks. Trust Wallet gates testnets behind a toggle (HAR 26.42.4 shows Sepolia, Base Sepolia and Avalanche Fuji polled once enabled);
// Harbour ships the common public EVM testnets. All derive with the ethereum CoinType, so one address covers them. Test coins have no value,
// so no CoinGecko id is set. Ids match the faucet list (core/settingsExtra.ts). RPCs are public endpoints; `npm run check:rpc` probes them.
import type { ChainInfo } from './types';

type Row = [id: string, name: string, chainId: number, symbol: string, rpcs: string[], explorer: string];
const ROWS: Row[] = [
  ['sepolia', 'Sepolia', 11155111, 'ETH', ['https://ethereum-sepolia-rpc.publicnode.com'], 'https://sepolia.etherscan.io'],
  ['hoodi', 'Ethereum Hoodi', 560048, 'ETH', ['https://ethereum-hoodi-rpc.publicnode.com', 'https://rpc.hoodi.ethpandaops.io'], 'https://hoodi.etherscan.io'],
  ['base-sepolia', 'Base Sepolia', 84532, 'ETH', ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'], 'https://sepolia.basescan.org'],
  ['arbitrum-sepolia', 'Arbitrum Sepolia', 421614, 'ETH', ['https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia-rpc.publicnode.com'], 'https://sepolia.arbiscan.io'],
  ['optimism-sepolia', 'Optimism Sepolia', 11155420, 'ETH', ['https://sepolia.optimism.io', 'https://optimism-sepolia-rpc.publicnode.com'], 'https://sepolia-optimism.etherscan.io'],
  ['polygon-amoy', 'Polygon Amoy', 80002, 'POL', ['https://rpc-amoy.polygon.technology', 'https://polygon-amoy-bor-rpc.publicnode.com'], 'https://amoy.polygonscan.com'],
  ['smartchain-testnet', 'BNB Smart Chain Testnet', 97, 'BNB', ['https://bsc-testnet-rpc.publicnode.com', 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'], 'https://testnet.bscscan.com'],
  ['opbnb-testnet', 'opBNB Testnet', 5611, 'BNB', ['https://opbnb-testnet-rpc.bnbchain.org'], 'https://opbnb-testnet.bscscan.com'],
  ['avalanche-fuji', 'Avalanche Fuji', 43113, 'AVAX', ['https://api.avax-test.network/ext/bc/C/rpc', 'https://avalanche-fuji-c-chain-rpc.publicnode.com'], 'https://testnet.snowtrace.io'],
  ['linea-sepolia', 'Linea Sepolia', 59141, 'ETH', ['https://rpc.sepolia.linea.build', 'https://linea-sepolia-rpc.publicnode.com'], 'https://sepolia.lineascan.build'],
  ['scroll-sepolia', 'Scroll Sepolia', 534351, 'ETH', ['https://sepolia-rpc.scroll.io', 'https://scroll-sepolia-rpc.publicnode.com'], 'https://sepolia.scrollscan.com'],
  ['zksync-sepolia', 'zkSync Sepolia', 300, 'ETH', ['https://sepolia.era.zksync.dev'], 'https://sepolia.explorer.zksync.io'],
  ['mantle-sepolia', 'Mantle Sepolia', 5003, 'MNT', ['https://rpc.sepolia.mantle.xyz'], 'https://explorer.sepolia.mantle.xyz'],
  ['blast-sepolia', 'Blast Sepolia', 168587773, 'ETH', ['https://sepolia.blast.io', 'https://blast-sepolia.drpc.org'], 'https://sepolia.blastscan.io'],
  ['unichain-sepolia', 'Unichain Sepolia', 1301, 'ETH', ['https://sepolia.unichain.org'], 'https://sepolia.uniscan.xyz'],
  ['ink-sepolia', 'Ink Sepolia', 763373, 'ETH', ['https://rpc-gel-sepolia.inkonchain.com'], 'https://explorer-sepolia.inkonchain.com'],
  ['worldchain-sepolia', 'World Chain Sepolia', 4801, 'ETH', ['https://worldchain-sepolia.g.alchemy.com/public'], 'https://sepolia.worldscan.org'],
  ['polygon-zkevm-cardona', 'Polygon zkEVM Cardona', 2442, 'ETH', ['https://rpc.cardona.zkevm-rpc.com'], 'https://cardona-zkevm.polygonscan.com'],
  ['gnosis-chiado', 'Gnosis Chiado', 10200, 'xDAI', ['https://rpc.chiadochain.net', 'https://gnosis-chiado-rpc.publicnode.com'], 'https://gnosis-chiado.blockscout.com'],
  ['monad-testnet', 'Monad Testnet', 10143, 'MON', ['https://testnet-rpc.monad.xyz'], 'https://testnet.monadexplorer.com'],
  ['berachain-bepolia', 'Berachain Bepolia', 80069, 'BERA', ['https://bepolia.rpc.berachain.com'], 'https://testnet.berascan.com'],
  ['moonbase-alpha', 'Moonbase Alpha', 1287, 'DEV', ['https://rpc.api.moonbase.moonbeam.network'], 'https://moonbase.moonscan.io'],
];

export const TESTNET_CHAINS: ChainInfo[] = ROWS.map(([id, name, evmChainId, symbol, rpcs, explorer]) => ({
  twId: 60, id, name, wcId: 'ethereum', ct: 'ethereum', kind: 'evm', blockchain: 'Ethereum', symbol, decimals: 18, evmChainId,
  rpcs, explorer, txPath: '/tx/{id}', accountPath: '/address/{address}', testnet: true,
  // Sepolia keeps its historical native price id; every other test coin is unpriced.
  ...(id === 'sepolia' ? { cg: 'ethereum' } : {}),
}));
