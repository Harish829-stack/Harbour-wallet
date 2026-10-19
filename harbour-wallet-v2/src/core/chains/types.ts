// Chain registry types. A chain is one of Trust Wallet's 86 enabled networks (HAR /v1/balances/chains, v26.41.0), keyed by its
// wallet-core CoinType value (`twId`). `kind` selects the adapter family used for balances / history / send (core/chains/adapters).
export type ChainKind =
  | 'evm' | 'utxo' | 'solana' | 'cosmos' | 'tron' | 'ton' | 'aptos' | 'sui' | 'near' | 'algorand' | 'ripple' | 'stellar' | 'substrate'
  | 'tezos' | 'filecoin' | 'icp' | 'waves' | 'vechain' | 'harmony' | 'icon' | 'zilliqa' | 'fio' | 'nimiq' | 'aion' | 'theta' | 'multiversx'
  | 'ontology' | 'iotex';

export interface ChainInfo {
  twId: number;            // wallet-core CoinType value == Trust Wallet coin id
  id: string;              // Trust Wallet handle ("smartchain", "polygon", …) — also the logo file name and the asset id of the native coin
  name: string;
  wcId: string;            // wallet-core registry id
  ct: string;              // wallet-core CoinType property name (core.CoinType[ct])
  kind: ChainKind;
  blockchain: string;      // wallet-core blockchain family
  symbol: string;
  decimals: number;
  evmChainId?: number;
  rpcs?: string[];         // EVM JSON-RPC endpoints (public), primary first
  endpoints?: string[];    // non-EVM public endpoints, primary first
  explorer?: string; txPath?: string; accountPath?: string;
  path?: string;           // default derivation path
  cg?: string;             // CoinGecko id for native pricing
  hrp?: string;
  dbLookup?: boolean; ws?: boolean;
  testnet?: boolean;
}
