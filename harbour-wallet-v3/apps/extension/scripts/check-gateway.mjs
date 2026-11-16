// Run on your machine:  node scripts/check-gateway.mjs [API_URL]
// Exercises every route of the Harbour backend's third-party gateway (/v1/gw, which replaced the v2 Cloudflare Worker) and the
// Kit code that consumes it. Requests are signed like the extension's (X-HB-* headers, Ed25519 device key), using the test device
// that `cd ../backend && ./run.sh smoke` registers (../backend/.hbdevice.json, or HB_DEVICE_FILE). Prints PASS/FAIL; no secrets printed.
// API_URL: argument, else VITE_HB_API_URL, else the API the device was registered with.
import { readFileSync, existsSync } from 'node:fs';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { build } from 'esbuild';
const devFile = process.env.HB_DEVICE_FILE ?? new URL('../../backend/.hbdevice.json', import.meta.url).pathname;
if (!existsSync(devFile)) { console.error(`No test device at ${devFile}. Register one first:  cd ../backend && ./run.sh smoke`); process.exit(1); }
const dev = JSON.parse(readFileSync(devFile, 'utf8'));
const API = String(process.argv[2] ?? process.env.VITE_HB_API_URL ?? dev.api ?? 'http://localhost:8080').replace(/\/+$/, '');
const GW = `${API}/v1/gw`; const PUB = (() => { try { return readFileSync(new URL('../.env.production', import.meta.url), 'utf8').match(/^VITE_HB_CONFIG_PUBKEY=(.*)$/m)?.[1]?.trim() ?? ''; } catch { return ''; } })();
const devKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(dev.seed, 'base64url')]), format: 'der', type: 'pkcs8' });
// Same canonical string as internal/devicesig: HB1, METHOD, path?query, unix seconds, nonce, device id, sha256(body) hex.
const rawFetch = globalThis.fetch.bind(globalThis);
const signedFetch = (url, init = {}) => {
  const u = new URL(url); if (u.origin !== new URL(API).origin) return rawFetch(url, init);
  const method = (init.method ?? 'GET').toUpperCase(); const body = init.body == null ? '' : String(init.body);
  const date = String(Math.floor(Date.now() / 1000)); const nonce = randomBytes(18).toString('base64url');
  const canon = ['HB1', method, u.pathname + u.search, date, nonce, dev.device_id, createHash('sha256').update(body).digest('hex')].join('\n');
  const headers = { ...(init.headers ?? {}), 'X-HB-Device': dev.device_id, 'X-HB-Date': date, 'X-HB-Nonce': nonce, 'X-HB-Signature': sign(null, Buffer.from(canon), devKey).toString('base64url') };
  return rawFetch(url, { ...init, headers });
};
const H = { 'content-type': 'application/json' };
const rpc = (method, params = []) => ({ method: 'POST', headers: H, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
let bad = 0;
const run = async (name, fn) => { try { const msg = await fn(); console.log(`PASS  ${name}${msg ? ' — ' + msg : ''}`); } catch (e) { bad++; console.log(`FAIL  ${name} — ${String(e.message).slice(0, 200)}`); } };
const get = async (path, init = { headers: H }) => { const r = await signedFetch(GW + path, { ...init, signal: AbortSignal.timeout(20000) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; };
const must = (c, m) => { if (!c) throw new Error(m); };

await run(`API health (${API})`, async () => { const r = await fetch(`${API}/healthz`, { signal: AbortSignal.timeout(10000) }); must(r.ok, `HTTP ${r.status}`); });
await run('signed device accepted (/v1/me)', async () => { const r = await signedFetch(`${API}/v1/me`, { headers: H }); must(r.ok, `HTTP ${r.status}: re-register with ./run.sh smoke`); });
await run('signed config verifies with embedded public key', async () => {
  must(PUB, 'VITE_HB_CONFIG_PUBKEY is not set in .env.production');
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
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_HB_API_URL: API, VITE_HB_GATEWAY_URL: GW }) },
  plugins: [{ name: 'stub-polyfill', setup(b) { // the extension-only storage module is never used by these code paths
    b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'polyfill', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {}', loader: 'js' })); } }] });
globalThis.fetch = (u, i) => (String(u).startsWith(API) ? signedFetch(String(u), i) : rawFetch(u, i)); // the extension signs via fetchHook.ts
const K = await import('data:text/javascript;base64,' + Buffer.from(kit.outputFiles[0].text).toString('base64'));
await run('Kit: Alchemy NFT collections mapped (vitalik, ethereum)', async () => { const c = await K.fetchAlchemyCollections('ethereum', VITALIK, (u, i) => fetch(u, i)); must(c.length > 0 && c[0].items.length > 0, 'no collections'); return `${c.length} collections, ${c.filter((x) => x.suspicious).length} flagged`; });
console.log(bad ? `\n${bad} check(s) failed. Paste this output back to me.` : '\nAll gateway checks passed.');
