// Read-only deployment smoke test. Never loads wallet storage or signs/broadcasts transactions.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, zeroAddress } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';

const out = await build({ stdin: { contents: `export * from './aave'; export * from './uniswap'; export * from './config';`, resolveDir: fileURLToPath(new URL('../src/integrations/testnet-defi/', import.meta.url)), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const m = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com', { timeout: 20000, retryCount: 0 }) });
if (await client.getChainId() !== m.SEPOLIA.chainId) throw new Error('RPC chain mismatch');
for (const key of ['pool', 'dataProvider', 'apiRouter', 'apiRouterLegacy', 'universalRouter', 'weth']) {
  const code = await client.getCode({ address: m.SEPOLIA[key] });
  if (!code || code === '0x') throw new Error(`Missing ${key} contract`);
}
console.log('PASS: all configured Sepolia contracts have bytecode');
const assets = await m.listEarnAssets(client, zeroAddress);
console.log('Aave available reserves:', assets.map((a) => `${a.symbol} (${a.address})`).join(', '));
const catalog = await m.swapCatalog(client, zeroAddress);
console.log(`Uniswap: ${catalog.tokens.length} seeded tokens (routes are checked per quote by the Trading API)`);
console.log('Swap tokens:', catalog.tokens.map((t) => `${t.symbol} (${t.address})`).join(', '));
const base = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC_URL ?? 'https://base-sepolia-rpc.publicnode.com', { timeout: 20000, retryCount: 0 }) });
if (await base.getChainId() !== m.BASE_SEPOLIA.chainId) throw new Error('Base Sepolia RPC chain mismatch');
for (const key of ['pool', 'dataProvider']) {
  const code = await base.getCode({ address: m.BASE_SEPOLIA[key] });
  if (!code || code === '0x') throw new Error(`Missing Base Sepolia ${key} contract`);
}
const baseAssets = await m.listEarnAssets(base, zeroAddress, m.BASE_SEPOLIA);
if (!baseAssets.length) throw new Error('No Aave Base Sepolia reserves available');
console.log('Aave Base Sepolia available reserves:', baseAssets.map((a) => `${a.symbol} (${a.address})`).join(', '));
