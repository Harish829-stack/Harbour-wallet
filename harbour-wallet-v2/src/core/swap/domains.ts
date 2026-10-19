import type { SwapDomain } from './types';
// Supported swap domains = the chains Harbour can already sign for (EVM secp256k1 + Solana).
// Bitcoin is excluded: TW routes BTC through THORChain, which needs a UTXO/OP_RETURN signer
// Harbour does not have yet. Sepolia is excluded: public aggregators do not quote testnets.
export const SOLANA_LIFI_CHAIN_ID = 1151111081099710;
export const SWAP_DOMAINS: SwapDomain[] = [
  { id: 'ethereum',   name: 'Ethereum',        kind: 'evm', chainId: 1,     lifiChainId: 1,     nativeSymbol: 'ETH', nativeDecimals: 18, addressKey: 'ethereum', twCoinId: 60,       trustAssetsDir: 'ethereum',   explorerTx: 'https://etherscan.io/tx/' },
  { id: 'smartchain', name: 'BNB Smart Chain', kind: 'evm', chainId: 56,    lifiChainId: 56,    nativeSymbol: 'BNB', nativeDecimals: 18, addressKey: 'ethereum', twCoinId: 20000714, trustAssetsDir: 'smartchain', explorerTx: 'https://bscscan.com/tx/' },
  { id: 'polygon',    name: 'Polygon',         kind: 'evm', chainId: 137,   lifiChainId: 137,   nativeSymbol: 'POL', nativeDecimals: 18, addressKey: 'ethereum', twCoinId: 966,      trustAssetsDir: 'polygon',    explorerTx: 'https://polygonscan.com/tx/' },
  { id: 'arbitrum',   name: 'Arbitrum',        kind: 'evm', chainId: 42161, lifiChainId: 42161, nativeSymbol: 'ETH', nativeDecimals: 18, addressKey: 'ethereum', twCoinId: 10042221, trustAssetsDir: 'arbitrum',   explorerTx: 'https://arbiscan.io/tx/' },
  { id: 'base',       name: 'Base',            kind: 'evm', chainId: 8453,  lifiChainId: 8453,  nativeSymbol: 'ETH', nativeDecimals: 18, addressKey: 'ethereum', twCoinId: 8453,     trustAssetsDir: 'base',       explorerTx: 'https://basescan.org/tx/' },
  { id: 'solana',     name: 'Solana',          kind: 'solana',              lifiChainId: SOLANA_LIFI_CHAIN_ID, nativeSymbol: 'SOL', nativeDecimals: 9, addressKey: 'solana', twCoinId: 501, trustAssetsDir: 'solana', explorerTx: 'https://solscan.io/tx/' },
];
export const domainById = (id: string) => SWAP_DOMAINS.find((d) => d.id === id);
export const domainByLifiId = (id: number) => SWAP_DOMAINS.find((d) => d.lifiChainId === id);
