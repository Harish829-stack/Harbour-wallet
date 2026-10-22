// Run on your own machine:  node tools/check-keys.mjs [path/to/harbour-keys.env]
// Calls one cheap endpoint per provider and prints PASS/FAIL. Key values are never printed.
import { readFileSync } from 'node:fs';
const file = process.argv[2] ?? new URL('../harbour-keys.env', import.meta.url).pathname;
const env = Object.fromEntries(readFileSync(file, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const J = { 'content-type': 'application/json' };
const rpc = (m) => ({ method: 'POST', headers: J, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: m }) });
const checks = [
  ['cloudflare', 'CLOUDFLARE_API_TOKEN', () => ['https://api.cloudflare.com/client/v4/user/tokens/verify', { headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } }], (j) => j.success === true],
  ['coingecko', 'COINGECKO_KEY', () => ['https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { headers: { 'x-cg-demo-api-key': env.COINGECKO_KEY } }], (j) => j.ethereum?.usd > 0],
  ['lifi', 'LIFI_API_KEY', () => ['https://li.quest/v1/chains?chainTypes=EVM', { headers: { 'x-lifi-api-key': env.LIFI_API_KEY } }], (j) => Array.isArray(j.chains)],
  ['jupiter', 'JUP_API_KEY', () => ['https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50', { headers: { 'x-api-key': env.JUP_API_KEY } }], (j) => !!j.outAmount],
  ['helius', 'HELIUS_API_KEY', () => [`https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`, rpc('getHealth')], (j) => j.result === 'ok'],
  ['alchemy-rpc', 'ALCHEMY_API_KEY', () => [`https://eth-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`, rpc('eth_blockNumber')], (j) => !!j.result],
  ['alchemy-nft', 'ALCHEMY_API_KEY', () => [`https://eth-mainnet.g.alchemy.com/nft/v3/${env.ALCHEMY_API_KEY}/getNFTsForOwner?owner=vitalik.eth&pageSize=1`], (j) => Array.isArray(j.ownedNfts)],
  ['etherscan-v2', 'ETHERSCAN_API_KEY', () => [`https://api.etherscan.io/v2/api?chainid=1&module=stats&action=ethprice&apikey=${env.ETHERSCAN_API_KEY}`], (j) => j.status === '1'],
  ['trongrid', 'TRONGRID_API_KEY', () => ['https://api.trongrid.io/wallet/getnowblock', { method: 'POST', headers: { 'TRON-PRO-API-KEY': env.TRONGRID_API_KEY } }], (j) => !!j.blockID],
  ['toncenter', 'TONCENTER_API_KEY', () => ['https://toncenter.com/api/v2/getMasterchainInfo', { headers: { 'X-API-Key': env.TONCENTER_API_KEY } }], (j) => j.ok === true],
  ['goplus (no key)', null, () => ['https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=0xdac17f958d2ee523a2206206994597c13d831ec7'], (j) => j.code === 1],
  ['defillama (no key)', null, () => ['https://coins.llama.fi/prices/current/coingecko:ethereum'], (j) => j.coins?.['coingecko:ethereum']?.price > 0],
  ['hyperliquid (no key)', null, () => ['https://api.hyperliquid.xyz/info', { method: 'POST', headers: J, body: '{"type":"allMids"}' }], (j) => !!j.BTC],
  ['polymarket (no key)', null, () => ['https://gamma-api.polymarket.com/markets?limit=1'], (j) => Array.isArray(j)],
];
const redact = (t) => Object.values(env).filter((v) => v.length > 12).reduce((a, v) => a.split(v).join('***'), t);
let bad = 0;
for (const [name, keyName, mk, ok] of checks) {
  if (keyName && !env[keyName]) { console.log(`SKIP  ${name} (${keyName} empty)`); continue; }
  try {
    const [url, init] = mk(); const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    const text = await r.text(); let pass = false;
    try { pass = r.ok && ok(JSON.parse(text)); } catch { /* not JSON */ }
    console.log(`${pass ? 'PASS ' : 'FAIL '} ${name} (HTTP ${r.status})`);
    if (!pass) { bad++; console.log('      ' + redact(text.slice(0, 200).replace(/\s+/g, ' '))); }
  } catch (e) { console.log(`FAIL  ${name} (${e.message}${e.cause ? ': ' + (e.cause.code ?? e.cause.message) : ''})`); bad++; }
}
console.log(bad ? `\n${bad} check(s) failed. Paste this output back to me; it contains no secrets.` : '\nAll checks passed.');
