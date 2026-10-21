// Run on your machine:  node scripts/check-gateway.mjs    (reads VITE_HB_GATEWAY_URL / VITE_HB_CONFIG_PUBKEY from .env.production)
// Exercises every gateway route and the Kit code that consumes them. Prints PASS/FAIL; no secrets involved.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const env = Object.fromEntries(readFileSync(new URL('../.env.production', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const GW = env.VITE_HB_GATEWAY_URL; const PUB = env.VITE_HB_CONFIG_PUBKEY;
const H = { 'x-hb-device-id': crypto.randomUUID(), 'content-type': 'application/json' };
const rpc = (method, params = []) => ({ method: 'POST', headers: H, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
let bad = 0;
const run = async (name, fn) => { try { const msg = await fn(); console.log(`PASS  ${name}${msg ? ' — ' + msg : ''}`); } catch (e) { bad++; console.log(`FAIL  ${name} — ${String(e.message).slice(0, 200)}`); } };
const get = async (path, init = { headers: H }) => { const r = await fetch(GW + path, { ...init, signal: AbortSignal.timeout(20000) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; };
const must = (c, m) => { if (!c) throw new Error(m); };

await run('health', async () => must((await get('/v1/health')).j.ok === true, 'not ok'));
await run('signed config verifies with embedded public key', async () => {
  const { j } = await get('/v1/config'); const b = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
  const key = await crypto.subtle.importKey('raw', b(PUB), { name: 'Ed25519' }, false, ['verify']);
  must(await crypto.subtle.verify('Ed25519', key, b(j.signature), new TextEncoder().encode(j.config)), 'signature invalid');
  return `version ${JSON.parse(j.config).version}`;
});
await run('prices (CoinGecko via gateway)', async () => { const { j } = await get('/v2/market/prices?ids=ethereum,solana'); must(j.ethereum?.price > 0 && j.solana?.price > 0, JSON.stringify(j).slice(0, 100)); return `ETH $${j.ethereum.price}`; });
await run('helius rpc', async () => { const { j } = await get('/helius/rpc', rpc('getHealth')); must(j.result === 'ok', JSON.stringify(j).slice(0, 100)); });
await run('helius rejects non-allowlisted method', async () => must((await get('/helius/rpc', rpc('requestAirdrop'))).status === 403, 'expected 403'));
for (const id of [1, 8453, 42161, 137, 56]) await run(`alchemy rpc chain ${id}`, async () => { const { j } = await get(`/alchemy/${id}/rpc`, rpc('eth_blockNumber')); must(j.result, JSON.stringify(j).slice(0, 120)); return `block ${parseInt(j.result, 16)}`; });
await run('alchemy rejects non-allowlisted method', async () => must((await get('/alchemy/1/rpc', rpc('debug_traceTransaction'))).status === 403, 'expected 403'));
await run('etherscan v2 txlist (chain 1)', async () => { const { j } = await get(`/etherscan/v2?chainid=1&module=account&action=txlist&address=${VITALIK}&page=1&offset=3&sort=desc`); must(j.status === '1', JSON.stringify(j).slice(0, 120)); });
await run('trongrid', async () => { const { j } = await get('/trongrid/wallet/getnowblock', { method: 'POST', headers: H, body: '{}' }); must(j.blockID, JSON.stringify(j).slice(0, 100)); });
await run('lifi chains', async () => { const { j } = await get('/lifi/v1/chains?chainTypes=EVM'); must(Array.isArray(j.chains), JSON.stringify(j).slice(0, 100)); });
await run('jupiter quote', async () => { const { j } = await get('/jup/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50'); must(j.outAmount, JSON.stringify(j).slice(0, 100)); return `0.1 SOL -> ${Number(j.outAmount) / 1e6} USDC`; });

// Kit code against the live gateway (bundled with esbuild so the real TypeScript runs).
const kit = await build({ stdin: { contents: `export { fetchAlchemyCollections } from './src/core/nfts/alchemy'; export { getPrices } from './src/kit/clients/priceClient';`, resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_HB_GATEWAY_URL: GW }) },
  plugins: [{ name: 'stub-polyfill', setup(b) { // the extension-only storage module is never used by these code paths
    b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'polyfill', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {}', loader: 'js' })); } }] });
const K = await import('data:text/javascript;base64,' + Buffer.from(kit.outputFiles[0].text).toString('base64'));
await run('Kit: Alchemy NFT collections mapped (vitalik, ethereum)', async () => { const c = await K.fetchAlchemyCollections('ethereum', VITALIK, (u, i) => fetch(u, { ...i, headers: { ...(i?.headers ?? {}), 'x-hb-device-id': H['x-hb-device-id'] } })); must(c.length > 0 && c[0].items.length > 0, 'no collections'); return `${c.length} collections, ${c.filter((x) => x.suspicious).length} flagged`; });
console.log(bad ? `\n${bad} check(s) failed. Paste this output back to me.` : '\nAll gateway checks passed.');
