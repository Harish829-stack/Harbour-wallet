// Generates src/core/chains/registry.json — Trust Wallet's enabled-chain set (HAR /v1/balances/chains, 86 chains, v26.41.0)
// joined with wallet-core's registry.json (symbol/decimals/explorer/rpc/derivation) and curated public endpoints.
// Usage: node scripts/gen-chain-registry.mjs   (reads ../evidences/reference/wallet-core/registry.json and ../evidences/re-evidence/30-chain-registry/*)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { initWasm } = require('@trustwallet/wallet-core');
const core = await initWasm();
const har = JSON.parse(fs.readFileSync('../evidences/re-evidence/30-chain-registry/har-balances-chains.json', 'utf8'));
const viem = JSON.parse(fs.readFileSync('../evidences/re-evidence/30-chain-registry/viem-evm-rpc.json', 'utf8'));
const wc = JSON.parse(fs.readFileSync('../evidences/reference/wallet-core/registry.json', 'utf8'));
const wcById = new Map(wc.map((x) => [x.coinId, x]));
const ctByVal = new Map();
for (const [k, v] of Object.entries(core.CoinType)) if (v && typeof v === 'object' && 'value' in v) ctByVal.set(v.value, k);

// kind = which balance/send adapter family a chain uses.
const KIND = { Ethereum: 'evm', Ronin: 'evm', Bitcoin: 'utxo', Solana: 'solana', Cosmos: 'cosmos', Thorchain: 'cosmos', NativeInjective: 'cosmos', Tron: 'tron',
  TheOpenNetwork: 'ton', Aptos: 'aptos', Sui: 'sui', NEAR: 'near', Algorand: 'algorand', Ripple: 'ripple', Stellar: 'stellar', Polkadot: 'substrate', Kusama: 'substrate',
  Tezos: 'tezos', Filecoin: 'filecoin', InternetComputer: 'icp', Waves: 'waves', Vechain: 'vechain', Harmony: 'harmony', Icon: 'icon', Zilliqa: 'zilliqa', FIO: 'fio',
  Nimiq: 'nimiq', Aion: 'aion', Theta: 'theta', MultiversX: 'multiversx', Ontology: 'ontology', IoTeX: 'iotex' };
const SYMBOL_FIX = { 607: 'TON', 508: 'EGLD', 10005042: 'USDC' };
// CoinGecko ids for native-asset pricing (public data; Trust Wallet's own tickers are gateway-only).
const CG = { 0: 'bitcoin', 60: 'ethereum', 61: 'ethereum-classic', 74: 'icon', 118: 'cosmos', 144: 'ripple', 148: 'stellar', 169: 'ethereum', 195: 'tron', 204: 'binancecoin',
  223: 'internet-computer', 235: 'fio-protocol', 242: 'nimiq-2', 283: 'algorand', 304: 'iotex', 313: 'zilliqa', 330: 'terra-luna', 354: 'polkadot', 397: 'near', 425: 'aion',
  434: 'kusama', 459: 'kava', 461: 'filecoin', 500: 'theta-token', 501: 'solana', 508: 'elrond-erd-2', 564: 'agoric', 607: 'the-open-network', 637: 'aptos', 784: 'sui',
  818: 'vechain', 889: 'viction', 931: 'thorchain', 966: 'polygon-ecosystem-token', 1001: 'thunder-token', 1023: 'harmony', 1024: 'ontology', 1030: 'conflux-token', 1729: 'tezos',
  4200: 'bitcoin', 4326: 'ethereum', 5000: 'mantle', 6001: 'bouncebit', 6060: 'gochain', 8453: 'ethereum', 9745: 'plasma', 10143: 'monad', 52752: 'celo', 59144: 'ethereum',
  81457: 'ethereum', 534352: 'ethereum', 810180: 'ethereum', 5718350: 'wanchain', 5741564: 'waves', 10000025: 'crypto-com-chain', 10000060: 'injective-protocol', 10000070: 'ethereum',
  10000100: 'xdai', 10000118: 'osmosis', 10000146: 'sonic-3', 10000250: 'fantom', 10000288: 'ethereum', 10000321: 'kucoin-shares', 10000324: 'ethereum', 10000999: 'hyperliquid',
  10001088: 'metis-token', 10001284: 'moonbeam', 10001285: 'moonriver', 10002020: 'ronin', 10002222: 'kava', 10004663: 'ethereum', 10004689: 'iotex', 10005042: 'usd-coin',
  10007000: 'zetachain', 10008217: 'kaia', 10009000: 'avalanche-2', 10042221: 'ethereum', 17000118: 'akash-network', 19000118: 'sei-network', 20000714: 'binancecoin',
  30000118: 'juno-network', 40000118: 'stride', 50000118: 'axelar', 90000118: 'neutron-3', 245022934: 'neon', 1323161554: 'ethereum' };
// Public REST/LCD endpoints for non-EVM families (primary first). Unverified from this sandbox (egress blocked) — see evidences/re-evidence/30.
const LCD = { 118: 'https://cosmos-rest.publicnode.com', 330: 'https://terra-classic-lcd.publicnode.com', 459: 'https://kava-rest.publicnode.com', 564: 'https://agoric-api.polkachu.com',
  931: 'https://thornode.ninerealms.com', 10000060: 'https://injective-rest.publicnode.com', 10000118: 'https://osmosis-rest.publicnode.com', 10007000: 'https://zetachain-rest.publicnode.com',
  17000118: 'https://akash-rest.publicnode.com', 19000118: 'https://sei-rest.publicnode.com', 30000118: 'https://juno-rest.publicnode.com', 40000118: 'https://stride-rest.publicnode.com',
  50000118: 'https://axelar-rest.publicnode.com', 90000118: 'https://neutron-rest.publicnode.com' };
const OTHER = { 0: ['https://mempool.space/api', 'https://blockstream.info/api'], 195: ['https://api.trongrid.io'], 607: ['https://toncenter.com/api/v2'], 637: ['https://fullnode.mainnet.aptoslabs.com/v1'],
  784: ['https://fullnode.mainnet.sui.io'], 397: ['https://rpc.mainnet.near.org'], 283: ['https://mainnet-api.algonode.cloud'], 144: ['https://s1.ripple.com:51234'], 148: ['https://horizon.stellar.org'],
  354: ['https://polkadot-rpc.publicnode.com'], 434: ['https://kusama-rpc.polkadot.io'], 1729: ['https://mainnet.api.tez.ie'], 461: ['https://api.node.glif.io/rpc/v1'], 5741564: ['https://nodes.wavesnodes.com'],
  818: ['https://mainnet.vechain.org'], 1023: ['https://api.harmony.one'], 74: ['https://ctz.solidwallet.io/api/v3'], 313: ['https://api.zilliqa.com'], 235: ['https://fio.eosusa.io'],
  508: ['https://gateway.multiversx.com'], 1024: ['https://dappnode1.ont.io:10336'], 500: ['https://theta-node-rpc.thetatoken.org/rpc'], 501: ['https://api.mainnet-beta.solana.com'],
  223: ['https://ic0.app'], 304: ['https://api.iotex.one:443'] };
const EXPLORER_FIX = {}; // explorer base URLs come from wallet-core; txPath/accountPath preserved.

const rows = [];
for (const h of har.chains.filter((c) => c.enabled)) {
  const w = wcById.get(h.chain_id); const ct = ctByVal.get(h.chain_id);
  if (!w || !ct) throw new Error('unmapped chain ' + h.chain_id + ' ' + h.handle);
  const kind = KIND[w.blockchain]; if (!kind) throw new Error('no kind for ' + w.blockchain);
  const isEvm = kind === 'evm';
  const evmId = isEvm ? Number(w.chainId) : undefined;
  const rpcs = [];
  if (isEvm) {
    for (const u of [w.rpc, ...(viem[evmId]?.rpc ?? [])]) {
      if (u && /^https?:\/\//.test(u) && !/thirdweb|zora\.energy|hypersync|\?owner/.test(u) && !rpcs.includes(u.replace(/\/$/, ''))) rpcs.push(u.replace(/\/$/, ''));
    }
    if (h.chain_id === 10000999) rpcs.unshift('https://rpc.hyperliquid.xyz/evm');
    if (h.chain_id === 10000070) rpcs.push('https://optimism-rpc.publicnode.com');
    if (h.chain_id === 60) rpcs.unshift('https://ethereum-rpc.publicnode.com');
    if (h.chain_id === 20000714) rpcs.unshift('https://bsc-dataseed.binance.org');
    if (h.chain_id === 966) rpcs.unshift('https://polygon-rpc.com');
    if (h.chain_id === 10000250) rpcs.unshift('https://fantom-rpc.publicnode.com');
    if (h.chain_id === 10000100) { rpcs.length = 0; rpcs.push('https://rpc.gnosischain.com'); }
  }
  rows.push({
    twId: h.chain_id, id: h.handle, name: h.name, wcId: w.id, ct, kind, blockchain: w.blockchain, symbol: SYMBOL_FIX[h.chain_id] ?? w.symbol, decimals: w.decimals,
    evmChainId: evmId, rpcs: isEvm ? rpcs : undefined, endpoints: isEvm ? undefined : (LCD[h.chain_id] ? [LCD[h.chain_id]] : OTHER[h.chain_id]),
    explorer: viem[evmId]?.explorer && !w.explorer?.url ? viem[evmId].explorer : w.explorer?.url, txPath: w.explorer?.txPath, accountPath: w.explorer?.accountPath,
    path: w.derivation?.[0]?.path, cg: CG[h.chain_id], hrp: w.hrp,
    dbLookup: h.db_lookup_enabled, ws: h.ws_supported,
  });
}
rows.sort((a, b) => a.twId - b.twId);
fs.writeFileSync('src/core/chains/registry.json', JSON.stringify(rows, null, 1));
console.log('wrote', rows.length, 'chains;', rows.filter((r) => r.kind === 'evm').length, 'evm;', rows.filter((r) => !r.cg).map((r) => r.id).join(',') || 'all have cg');
const noEp = rows.filter((r) => (r.kind === 'evm' ? !r.rpcs?.length : !r.endpoints?.length)).map((r) => r.id);
console.log('no endpoint:', noEp.join(', ') || 'none');
