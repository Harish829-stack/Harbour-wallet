# Reliability, failover and network health

## RPC endpoints
URLs live in `harbour-wallet-v2/src/config/rpcEndpoints.json`, never in components. For each chain the order is:

1. the user's custom RPC override (Settings › Networks)
2. `VITE_RPC_<chainId>` (comma-separated list allowed; Solana: `VITE_RPC_SOLANA`)
3. the Harbour gateway (server-held Alchemy / Helius keys) for chains it proxies
4. the public providers in the config file (publicnode, Ankr, dRPC, 1RPC, plus each chain's official node where one exists)

The chain registry's own `rpcs` are merged in after these. Run `npm run check:rpc` to verify chain ids and liveness from your own network, and prune dead entries from the JSON.

## Failover behaviour
`src/kit/failoverFetch.ts` wraps `fetch` in the background service worker. A JSON-RPC POST to any endpoint in a known pool is retried on the next healthy endpoint of the same pool when it fails, times out (10 s per attempt) or is rate limited (HTTP 429, and 408/425/5xx). After a full pass over the pool it waits with exponential backoff (jittered) and tries once more.

- Circuit breaker (`kit/nodeRepository.ts`): an endpoint that fails 3 times in a row is skipped for 30 s; it goes to the back of the order, never out of the pool.
- A broadcast (`eth_sendRawTransaction`, Solana `sendTransaction`, TON `sendBoc`) that times out is never resent to another node, because it may already have been accepted.
- Only the original request body is forwarded. Private keys and seed phrases never reach any provider; signing happens locally.
- Failures are logged by host name only. The logger (`core/logger.ts`) masks API keys in URL paths and queries, long hex strings and mnemonic-shaped text.

## Other providers
- Prices: gateway (cached CoinGecko) → CoinGecko → DefiLlama (`kit/clients/priceClient.ts`).
- Trending and hot tokens: gateway → CoinGecko direct; GeckoTerminal for DEX pools.
- Swaps: LI.FI, Jupiter, Relay and THORChain quotes are raced and any can be disabled by signed remote config (kill switches).
- HTTP client (`kit/httpClient.ts`): timeout, retry with backoff, per-host token bucket, per-host circuit breaker, TTL cache.

## Stale data and network banner
Prices are cached as last known good (`kit/lastKnown.ts`, extension storage). When every provider fails the cached values are shown and the popup displays a banner (`popup/NetworkBanner.tsx`): offline, degraded, or "last known prices". Status is derived from real traffic (`kit/netStatus.ts`); no extra probe requests are made.

## Images
Asset and chain logos ship inside the extension (`public-production/asset-logos`, `chains`). Remote images (NFTs, dApp icons, provider logos) always have an `onError` fallback to a placeholder or an initial.

## Gateway
`GET /health` (and `/v1/health`) returns `{ ok, service, kv, time }`. CORS is restricted to `ALLOWED_ORIGINS` (or extension origins when unset), responses carry security headers, errors return a generic body with a request id and no stack, and requests are rate limited per device or IP.
