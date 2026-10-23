// harbour-gateway: edge proxy (Cloudflare Workers free plan). Holds API keys, normalises responses, caches, rate-limits per device.
// Routes mirror Trust Wallet's gateway paths. Keys are Worker secrets: LIFI_API_KEY, JUP_API_KEY, RELAY_API_KEY, PIMLICO_API_KEY, COINGECKO_KEY, CONFIG_JSON, CONFIG_SIG.
import { register, unregister, runWatcher } from './push';
interface KV { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>; delete(k: string): Promise<void>; list(o: { prefix: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }> }
export interface Env { CACHE?: KV; ALLOWED_ORIGINS?: string; LIFI_API_KEY?: string; JUP_API_KEY?: string; COINGECKO_KEY?: string; HELIUS_API_KEY?: string; ALCHEMY_API_KEY?: string; ETHERSCAN_API_KEY?: string; TRONGRID_API_KEY?: string; TONCENTER_API_KEY?: string; RELAY_API_KEY?: string; PIMLICO_API_KEY?: string; FCM_SERVICE_ACCOUNT?: string; CONFIG_JSON?: string; CONFIG_SIG?: string; ALLOWED_ORIGIN?: string }

const RATE_PER_MIN = 120;
const hits = new Map<string, { n: number; at: number }>(); // per-isolate approximation; KV-backed limiting can replace it
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra } });

export function limited(device: string, now = Date.now()): boolean {
  const h = hits.get(device);
  if (!h || now - h.at > 60_000) { hits.set(device, { n: 1, at: now }); return false; }
  return ++h.n > RATE_PER_MIN;
}

/** Rebuild a query string from a bounded, validated set of parameters so cache keys and upstream URLs cannot be inflated by junk. Returns null when invalid, '' or '?a=b&…' (sorted). */
export function cleanSearch(search: string, o: { keys?: string[]; max?: number; valueRe?: RegExp } = {}): string | null {
  const q = new URLSearchParams(search); const out: Array<[string, string]> = []; const vre = o.valueRe ?? /^[A-Za-z0-9_.,:=-]{0,128}$/;
  let invalid = false;
  q.forEach((v, k) => {
    if (invalid) return;
    if (o.keys ? !o.keys.includes(k) : !/^[A-Za-z][A-Za-z0-9_]{0,31}(\[\])?$/.test(k)) { invalid = true; return; }
    if (!vre.test(v)) { invalid = true; return; }
    out.push([k, v]); if (out.length > (o.max ?? 12)) invalid = true;
  });
  if (invalid) return null;
  out.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  return out.length ? '?' + out.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
}
async function cached(env: Env, key: string, ttl: number, produce: () => Promise<Response>): Promise<Response> {
  const hit = await env.CACHE?.get(key);
  if (hit) return new Response(hit, { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'x-hb-cache': 'hit' } });
  const res = await produce();
  if (res.ok && env.CACHE) { const t = await res.clone().text(); await env.CACHE.put(key, t, { expirationTtl: Math.max(60, ttl) }); }
  return res;
}

async function proxy(base: string, rest: string, search: string, init: RequestInit, headers: Record<string, string>): Promise<Response> {
  const res = await fetch(`${base}${rest}${search}`, { ...init, headers: { 'content-type': 'application/json', ...headers } });
  return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json', 'access-control-allow-origin': '*' } });
}


// ---- keyed RPC / indexer proxies. Method and path allowlists keep this from being an open relay for the keys. ----
const SOL_RPC_METHODS = new Set(['getBalance','getAccountInfo','getMultipleAccounts','getTokenAccountsByOwner','getTokenAccountBalance','getSignaturesForAddress','getSignatureStatuses','getTransaction','getLatestBlockhash','getFeeForMessage','getMinimumBalanceForRentExemption','getRecentPrioritizationFees','getEpochInfo','getVoteAccounts','simulateTransaction','sendTransaction','isBlockhashValid','getHealth',
  'getProgramAccounts','getInflationRate','getInflationReward','getSupply','getStakeMinimumDelegation','getSlot','getBlockHeight','getTokenSupply',
  'getAsset','getAssetsByOwner','getAssetsByGroup','getAssetBatch','getAssetProof','searchAssets','getTokenAccounts']);
const EVM_RPC_METHODS = new Set(['eth_chainId','eth_blockNumber','eth_getBalance','eth_call','eth_estimateGas','eth_gasPrice','eth_maxPriorityFeePerGas','eth_feeHistory','eth_getTransactionCount','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByNumber','eth_getBlockByHash','eth_getCode','eth_getLogs','eth_getStorageAt','eth_sendRawTransaction','eth_simulateV1','net_version','alchemy_getTokenBalances','alchemy_getTokenMetadata','alchemy_getAssetTransfers']);
const AA_METHODS = new Set(['pimlico_getUserOperationGasPrice', 'pm_sponsorUserOperation', 'eth_sendUserOperation', 'eth_getUserOperationReceipt', 'eth_estimateUserOperationGas', 'eth_supportedEntryPoints']);
const RSS_FEEDS: Record<string, string> = { coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/', cointelegraph: 'https://cointelegraph.com/rss', decrypt: 'https://decrypt.co/feed', theblock: 'https://www.theblock.co/rss.xml' };
const ALCHEMY_HOSTS: Record<string, string> = { '1': 'eth-mainnet', '56': 'bnb-mainnet', '137': 'polygon-mainnet', '42161': 'arb-mainnet', '8453': 'base-mainnet', '10': 'opt-mainnet', '11155111': 'eth-sepolia' };
const ETHERSCAN_ACTIONS = /^(account:(txlist|tokentx|tokennfttx|token1155tx|txlistinternal|balance|balancemulti)|gastracker:gasoracle|stats:ethprice|proxy:eth_gasPrice)$/;
const TRON_PATHS = /^\/(wallet|walletsolidity)\/(getaccount|getnowblock|getaccountresource|triggerconstantcontract|triggersmartcontract|createtransaction|broadcasttransaction|broadcasthex|getchainparameters|gettransactioninfobyid|listwitnesses|freezebalancev2|unfreezebalancev2|votewitnessaccount|withdrawbalance|getreward|getdelegatedresourcev2)$|^\/v1\/accounts\/T[1-9A-HJ-NP-Za-km-z]{33}(\/transactions(\/trc20)?)?$/i;

async function jsonRpcGuard(req: Request, allowed: Set<string>): Promise<{ body: string } | Response> {
  const text = await req.text();
  if (text.length > 200_000) return json({ error: 'too_large' }, 413);
  let msg: any; try { msg = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }
  const calls = Array.isArray(msg) ? msg : [msg];
  if (!calls.length || calls.length > 50 || calls.some((c) => typeof c?.method !== 'string' || !allowed.has(c.method))) return json({ error: 'method_not_allowed' }, 403);
  return { body: text };
}
const relay = (url: string, init: RequestInit) => fetch(url, init).then((r) => new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json', 'access-control-allow-origin': '*' } }));

async function keyed(p: string, url: URL, req: Request, env: Env): Promise<Response | null> {
  if (p === '/helius/rpc') {
    if (req.method !== 'POST' || !env.HELIUS_API_KEY) return json({ error: 'unavailable' }, 404);
    const g = await jsonRpcGuard(req, SOL_RPC_METHODS); if (g instanceof Response) return g;
    return relay(`https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: g.body });
  }
  let m = p.match(/^\/alchemy\/(\d+)\/rpc$/);
  if (m) {
    const host = ALCHEMY_HOSTS[m[1]];
    if (req.method !== 'POST' || !host || !env.ALCHEMY_API_KEY) return json({ error: 'unavailable' }, 404);
    const g = await jsonRpcGuard(req, EVM_RPC_METHODS); if (g instanceof Response) return g;
    return relay(`https://${host}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: g.body });
  }
  m = p.match(/^\/alchemy\/(\d+)\/nft\/(getNFTsForOwner|getContractMetadata|getNFTMetadata|getFloorPrice|isSpamContract|getOwnersForNFT)$/);
  if (m) {
    const host = ALCHEMY_HOSTS[m[1]];
    if (req.method !== 'GET' || !host || !env.ALCHEMY_API_KEY) return json({ error: 'unavailable' }, 404);
    const nq = cleanSearch(url.search, { max: 24, valueRe: /^[A-Za-z0-9_.,:=-]{0,200}$/ }); if (nq === null) return json({ error: 'bad_request' }, 400);
    return relay(`https://${host}.g.alchemy.com/nft/v3/${env.ALCHEMY_API_KEY}/${m[2]}${nq}`, { method: 'GET' });
  }
  if (p === '/etherscan/v2') {
    const q = new URLSearchParams(url.search);
    if (req.method !== 'GET' || !env.ETHERSCAN_API_KEY || q.getAll('module').length !== 1 || q.getAll('action').length !== 1 || q.getAll('chainid').length !== 1 || !ETHERSCAN_ACTIONS.test(`${q.get('module')}:${q.get('action')}`) || !/^\d{1,9}$/.test(q.get('chainid') ?? '')) return json({ error: 'not_allowed' }, 403);
    q.set('apikey', env.ETHERSCAN_API_KEY);
    return relay(`https://api.etherscan.io/v2/api?${q}`, { method: 'GET' });
  }
  if (p.startsWith('/trongrid/')) {
    const rest = p.slice('/trongrid'.length);
    if (!env.TRONGRID_API_KEY || !TRON_PATHS.test(rest)) return json({ error: 'not_allowed' }, 403);
    return relay(`https://api.trongrid.io${rest}${url.search}`, { method: req.method, headers: { 'content-type': 'application/json', 'TRON-PRO-API-KEY': env.TRONGRID_API_KEY }, body: req.method === 'POST' ? await req.text() : undefined });
  }
  if (p.startsWith('/toncenter/')) {
    const rest = p.slice('/toncenter'.length);
    if (!env.TONCENTER_API_KEY || !/^\/api\/v[23]\/(getAddressInformation|getWalletInformation|getTransactions|sendBoc|sendBocReturnHash|runGetMethod|estimateFee|jetton\/wallets|jetton\/masters|jetton\/transfers|nft\/items|getMasterchainInfo|transactions)$/.test(rest)) return json({ error: 'not_allowed' }, 403);
    return relay(`https://toncenter.com${rest}${url.search}`, { method: req.method, headers: { 'content-type': 'application/json', 'X-API-Key': env.TONCENTER_API_KEY }, body: req.method === 'POST' ? await req.text() : undefined });
  }
  m = p.match(/^\/pimlico\/(1|56|137|42161|8453)$/); // ERC-4337 bundler + paymaster for gasless (EIP-7702) swaps
  if (m) {
    if (req.method !== 'POST' || !env.PIMLICO_API_KEY) return json({ error: 'unavailable' }, 404);
    const g = await jsonRpcGuard(req, AA_METHODS); if (g instanceof Response) return g;
    return relay(`https://api.pimlico.io/v2/${m[1]}/rpc?apikey=${env.PIMLICO_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: g.body });
  }
  return null;
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'x-hb-device-id,content-type', 'access-control-allow-methods': 'GET,POST' } });
  if (url.pathname === '/v1/health' || url.pathname === '/health') return json({ ok: true, service: 'harbour-gateway', kv: Boolean(env.CACHE), time: new Date().toISOString() }, 200, { 'cache-control': 'no-store' });
  // Rate-limit key: the device id when the client sends one (Kit calls), otherwise the caller IP (plain RPC transports cannot add headers).
  // The key is the caller IP only: x-hb-device-id is client-chosen, so keying on it would let one caller mint a fresh bucket per request (INF-03).
  const device = `ip:${req.headers.get('cf-connecting-ip') ?? 'unknown'}`;
  if (limited(device)) return json({ error: 'rate_limited' }, 429, { 'retry-after': '60' });

  const p = url.pathname;
  if (p === '/push/register' || p === '/push/unregister') {
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    let body: unknown; try { body = JSON.parse((await req.text()).slice(0, 20_000)); } catch { return json({ error: 'bad_json' }, 400); }
    const r = p === '/push/register' ? await register(env, body) : await unregister(env, body);
    return json(r.body, r.status);
  }
  if (p === '/v1/config') {
    if (!env.CONFIG_JSON || !env.CONFIG_SIG) return json({ error: 'no_config' }, 404);
    return json({ config: env.CONFIG_JSON, signature: env.CONFIG_SIG }, 200, { 'cache-control': 'public, max-age=300' });
  }
  if (p === '/v2/market/prices') { // TW-shaped: { <coingeckoId>: { price, change } }
    const ids = (url.searchParams.get('ids') ?? '').split(',').filter((x) => /^[a-z0-9-]{1,64}$/.test(x)).slice(0, 100).sort();
    if (!ids.length) return json({}, 200);
    return cached(env, `px:${ids.join(',')}`, 60, async () => {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`, { headers: env.COINGECKO_KEY ? { 'x-cg-demo-api-key': env.COINGECKO_KEY } : {} });
      if (!r.ok) return json({ error: 'upstream' }, 502);
      const d = (await r.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
      return json(Object.fromEntries(Object.entries(d).filter(([, v]) => v?.usd != null).map(([k, v]) => [k, { price: v.usd, change: v.usd_24h_change ?? 0 }])));
    });
  }
  // ---- market data (CoinGecko with the server key, cached in KV) ----
  const cgHeaders: Record<string, string> = env.COINGECKO_KEY ? { 'x-cg-demo-api-key': env.COINGECKO_KEY } : {};
  const cgCached = (key: string, ttl: number, path: string) => cached(env, key, ttl, async () => {
    const r = await fetch(`https://api.coingecko.com/api/v3${path}`, { headers: cgHeaders });
    return r.ok ? new Response(await r.text(), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }) : json({ error: 'upstream' }, 502);
  });
  if (p === '/v2/market/charts') {
    const coin = url.searchParams.get('coin') ?? ''; const days = url.searchParams.get('days') ?? '';
    if (!/^[a-z0-9-]{1,64}$/.test(coin) || !/^(1|7|30|365|max)$/.test(days)) return json({ error: 'bad_request' }, 400);
    return cgCached(`ch:${coin}:${days}`, days === '1' ? 60 : 600, `/coins/${coin}/market_chart?vs_currency=usd&days=${days}`);
  }
  if (p === '/v2/market/info') {
    const coin = url.searchParams.get('coin') ?? ''; if (!/^[a-z0-9-]{1,64}$/.test(coin)) return json({ error: 'bad_request' }, 400);
    return cgCached(`in:${coin}`, 900, `/coins/${coin}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`);
  }
  if (p === '/v2/market/tickers') {
    const q = new URLSearchParams();
    for (const k of ['vs_currency', 'order', 'per_page', 'page', 'price_change_percentage', 'category']) { const v = url.searchParams.get(k); if (v != null) q.set(k, v); }
    if (!/^(usd)$/.test(q.get('vs_currency') ?? '') || !/^[a-z_]{1,32}$/.test(q.get('order') ?? '') || !/^[a-z0-9-]{0,64}$/.test(q.get('category') ?? '')) return json({ error: 'bad_request' }, 400);
    return cgCached(`tk:${q}`, 120, `/coins/markets?${q}`);
  }
  if (p === '/v2/market/trending') return cgCached('tr', 300, '/search/trending');
  if (p.startsWith('/gt/')) { // GeckoTerminal (keyless, ~30 calls/min): cache to stay under the shared limit
    const rest = p.slice('/gt'.length);
    if (req.method !== 'GET' || !/^\/networks\/(trending_pools|[a-z0-9_-]{2,32}\/(tokens\/[A-Za-z0-9]{20,64}|pools\/[A-Za-z0-9]{20,90}\/ohlcv\/(minute|hour|day)))$/.test(rest)) return json({ error: 'not_found' }, 404);
    const gq = cleanSearch(url.search, { keys: ['page', 'include', 'aggregate', 'limit', 'before_timestamp', 'token', 'currency', 'include_volume_breakdown', 'duration'], max: 8, valueRe: /^[A-Za-z0-9_.,-]{0,64}$/ }); if (gq === null) return json({ error: 'bad_request' }, 400);
    return cached(env, `gt:${rest}${gq}`, rest.includes('ohlcv') ? 120 : 60, async () => {
      const r = await fetch(`https://api.geckoterminal.com/api/v2${rest}${gq}`, { headers: { accept: 'application/json;version=20230302' } });
      return r.ok ? new Response(await r.text(), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }) : json({ error: 'upstream' }, 502);
    });
  }
  if (p.startsWith('/rss/')) { // news feeds for the sentiment screen: fixed allowlist, cached 10 min
    const src = RSS_FEEDS[p.slice('/rss/'.length)]; if (!src) return json({ error: 'not_found' }, 404);
    const hit = await env.CACHE?.get(`rss:${src}`);
    if (hit) return new Response(hit, { headers: { 'content-type': 'application/rss+xml', 'access-control-allow-origin': '*', 'x-hb-cache': 'hit' } });
    const r = await fetch(src, { headers: { accept: 'application/rss+xml, application/xml, text/xml' } }); if (!r.ok) return json({ error: 'upstream' }, 502);
    const t = (await r.text()).slice(0, 2_000_000); await env.CACHE?.put(`rss:${src}`, t, { expirationTtl: 600 });
    return new Response(t, { headers: { 'content-type': 'application/rss+xml', 'access-control-allow-origin': '*' } });
  }
  if (p.startsWith('/lifi/v1/')) // LI.FI with the server-held key; only quote/route/status/token paths are exposed
    return /^\/lifi\/v1\/(advanced\/(routes|stepTransaction)|status|token|tokens|chains)$/.test(p)
      ? proxy('https://li.quest/v1', p.slice('/lifi/v1'.length), url.search, { method: req.method, body: req.method === 'POST' ? await req.text() : undefined }, env.LIFI_API_KEY ? { 'x-lifi-api-key': env.LIFI_API_KEY } : {})
      : json({ error: 'not_found' }, 404);
  if (p.startsWith('/jup/swap/v1/'))
    return /^\/jup\/swap\/v1\/(quote|swap)$/.test(p)
      ? proxy('https://api.jup.ag/swap/v1', p.slice('/jup/swap/v1'.length), url.search, { method: req.method, body: req.method === 'POST' ? await req.text() : undefined }, env.JUP_API_KEY ? { 'x-api-key': env.JUP_API_KEY } : {})
      : json({ error: 'not_found' }, 404);
  if (p.startsWith('/relay/')) // Relay requires a key on every quote from 2026-10-02; only quote + status are exposed
    return /^\/relay\/(quote\/v2|intents\/status\/v[23])$/.test(p)
      ? proxy('https://api.relay.link', p.slice('/relay'.length), url.search, { method: req.method, body: req.method === 'POST' ? await req.text() : undefined }, env.RELAY_API_KEY ? { 'x-api-key': env.RELAY_API_KEY } : {})
      : json({ error: 'not_found' }, 404);
  if (p.startsWith('/thornode/')) // public THORNode (no key): quotes, tx status and inbound addresses, cached briefly for status
    return req.method === 'GET' && /^\/thornode\/thorchain\/(quote\/swap|tx\/status\/[0-9A-Fa-f]{64}|inbound_addresses)$/.test(p)
      ? proxy('https://gateway.liquify.com/chain/thorchain_api', p.slice('/thornode'.length), url.search, { method: 'GET' }, {})
      : json({ error: 'not_found' }, 404);
  const k = await keyed(p, url, req, env); if (k) return k;
  return json({ error: 'not_found' }, 404);
}

// ---- edge hardening: restricted CORS, security headers, centralized error handling (no stack or internals ever reach the client) ----
const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'cross-origin-resource-policy': 'same-site',
  'strict-transport-security': 'max-age=63072000; includeSubDomains', 'permissions-policy': 'interest-cohort=()',
};
/** Origins allowed to call the gateway: ALLOWED_ORIGINS (comma-separated, exact match) or, when unset, any Harbour-style extension origin. Requests with no Origin (non-browser) are rate limited instead. */
export function originAllowed(origin: string, env: Pick<Env, 'ALLOWED_ORIGINS'>): boolean {
  const list = (env.ALLOWED_ORIGINS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return list.length ? list.includes(origin) : /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}
function secure(res: Response, origin: string | null): Response {
  const h = new Headers(res.headers);
  h.delete('access-control-allow-origin');
  if (origin) { h.set('access-control-allow-origin', origin); h.append('vary', 'origin'); }
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
export async function respond(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get('origin');
  if (origin && !originAllowed(origin, env)) return secure(json({ error: 'forbidden_origin' }, 403), null);
  if (req.method === 'OPTIONS')
    return secure(new Response(null, { status: 204, headers: { 'access-control-allow-headers': 'x-hb-device-id,content-type', 'access-control-allow-methods': 'GET,POST', 'access-control-max-age': '600' } }), origin);
  try { return secure(await handle(req, env), origin); }
  catch (e) {
    const requestId = crypto.randomUUID();
    console.error('[gateway] unhandled error', requestId, e instanceof Error ? e.name : typeof e); // name only: never the message, URL or key
    return secure(json({ error: 'internal', requestId }, 500), origin);
  }
}

export default {
  fetch: (req: Request, env: Env) => respond(req, env),
  // cron (wrangler.toml [triggers]): push watcher for registered devices
  scheduled: (_e: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) => ctx.waitUntil(runWatcher(env).catch((e) => console.error('[gateway] watcher failed', e instanceof Error ? e.name : typeof e))),
};
