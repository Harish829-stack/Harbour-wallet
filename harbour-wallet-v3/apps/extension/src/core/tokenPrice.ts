// Best-effort USD price for custom tokens from CoinGecko's public contract-price endpoint (key-less):
//   GET https://api.coingecko.com/api/v3/simple/token_price/{platform}?contract_addresses=a,b&vs_currencies=usd&include_24hr_change=true
//   -> { "<lowercase address>": { usd: 1.0, usd_24h_change: 0.1 } }   (shape per public docs; UNVERIFIED live: egress is blocked in the build env)
// Unlisted tokens simply have no entry: the UI then shows the balance without a fiat value. TW takes prices from its own
// ticker gateway (`POST /v2/market/tickers`), which needs a TW credential and is not used.
export const PLATFORM: Record<number, string> = { 1: 'ethereum', 56: 'binance-smart-chain', 137: 'polygon-pos', 42161: 'arbitrum-one', 8453: 'base' };
export interface TokenPrice { price: number; change: number | null }
type F = typeof fetch;

export async function fetchTokenPrices(tokens: Array<{ chainId: number; address: string }>, f: F = fetch): Promise<Record<string, TokenPrice>> {
  const out: Record<string, TokenPrice> = {};
  const byChain = new Map<number, string[]>();
  for (const t of tokens) if (PLATFORM[t.chainId]) byChain.set(t.chainId, [...(byChain.get(t.chainId) ?? []), t.address.toLowerCase()]);
  await Promise.all([...byChain].map(async ([chainId, addrs]) => {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/${PLATFORM[chainId]}?contract_addresses=${addrs.slice(0, 50).join(',')}&vs_currencies=usd&include_24hr_change=true`;
      const res = await f(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
      if (!res.ok) return;
      const j: any = await res.json();
      for (const a of addrs) {
        const e = j?.[a]; const p = e?.usd;
        if (typeof p === 'number' && Number.isFinite(p) && p >= 0) out[`${chainId}_t${a}`] = { price: p, change: typeof e.usd_24h_change === 'number' && Number.isFinite(e.usd_24h_change) ? e.usd_24h_change : null };
      }
    } catch { /* no price: fine */ }
  }));
  return out;
}
