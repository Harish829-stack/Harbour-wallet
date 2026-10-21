// Generates src/core/chains/registry.extra.json: wallet-core coins that are NOT in Trust Wallet's 86 visible chains (the other 82 of the
// 168-entry embedded registry, doc 03) for which Harbour has a working adapter family. Extras stay hidden until their id is listed in
// src/core/chains/extra-enabled.json, which you fill after `node tools/check-chains.mjs` shows PASS for them.
// Usage: node scripts/gen-extra-chains.mjs   (reads ../wallet-core/registry.json)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { initWasm } = createRequire(import.meta.url)('@trustwallet/wallet-core');
const core = await initWasm();
const wc = new Map(JSON.parse(fs.readFileSync('../wallet-core/registry.json', 'utf8')).map((x) => [x.coinId, x]));
const have = new Set(JSON.parse(fs.readFileSync('src/core/chains/registry.json', 'utf8')).map((c) => c.twId));
const ctByVal = new Map(); for (const [k, v] of Object.entries(core.CoinType)) if (v && typeof v === 'object' && 'value' in v) ctByVal.set(v.value, k);

// Curated public endpoints (primary first). Unverified from the build sandbox: `tools/check-chains.mjs` probes each one live.
const EVM = { // twId: [handle, rpcs, coingecko id]
  137: ['rootstock', ['https://public-node.rsk.co'], 'rootstock'], 10001101: ['polygonzkevm', ['https://zkevm-rpc.com'], 'ethereum'], 10042170: ['arbitrumnova', ['https://nova.arbitrum.io/rpc'], 'ethereum'],
  1329: ['seievm', ['https://evm-rpc.sei-apis.com'], 'sei-network'], 1890: ['lightlink', ['https://replicator.phoenix.lightlink.io/rpc/v1'], 'ethereum'], 20007000: ['zetaevm', ['https://zetachain-evm.blockpi.network/v1/rpc/public'], 'zetachain'],
  18000: ['meter', ['https://rpc.meter.io'], 'meter'], 361: ['tfuelevm', ['https://eth-rpc-api.thetatoken.org/rpc'], 'theta-fuel'], 820: ['callisto', ['https://rpc.callisto.network'], 'callisto'], 10000787: ['acalaevm', ['https://eth-rpc-acala.aca-api.network'], 'acala'],
};
const BLOCKBOOK = { 2: ['litecoin', 'https://ltc1.trezor.io', 'litecoin'], 3: ['dogecoin', 'https://doge1.trezor.io', 'dogecoin'], 5: ['dash', 'https://dash1.trezor.io', 'dash'] };

const rows = [];
for (const [twId, [id, rpcs, cg]] of Object.entries(EVM)) {
  const w = wc.get(+twId); if (!w || have.has(+twId)) continue;
  rows.push({ twId: +twId, id, name: w.name, wcId: w.id, ct: ctByVal.get(+twId), kind: 'evm', blockchain: w.blockchain, symbol: w.symbol, decimals: w.decimals, evmChainId: Number(w.chainId), rpcs,
    explorer: w.explorer?.url, txPath: w.explorer?.txPath, accountPath: w.explorer?.accountPath, path: w.derivation?.[0]?.path, cg, extra: true });
}
for (const [twId, [id, ep, cg]] of Object.entries(BLOCKBOOK)) {
  const w = wc.get(+twId); if (!w || have.has(+twId)) continue;
  rows.push({ twId: +twId, id, name: w.name, wcId: w.id, ct: ctByVal.get(+twId), kind: 'utxo', api: 'blockbook', blockchain: w.blockchain, symbol: w.symbol, decimals: w.decimals, endpoints: [ep],
    explorer: ep, txPath: '/tx/', accountPath: '/address/', path: w.derivation?.[0]?.path, cg, hrp: w.hrp, extra: true });
}
for (const r of rows) if (!r.ct) throw new Error('no CoinType for ' + r.id);
fs.writeFileSync('src/core/chains/registry.extra.json', JSON.stringify(rows, null, 1));
if (!fs.existsSync('src/core/chains/extra-enabled.json')) fs.writeFileSync('src/core/chains/extra-enabled.json', '[]\n');
console.log('wrote', rows.length, 'extra chains:', rows.map((r) => r.id).join(', '));
