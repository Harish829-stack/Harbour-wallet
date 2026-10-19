// USD prices for the native assets, best-effort via CoinGecko's public API.
// If the request fails (offline / rate-limited / egress-blocked), returns {} and the UI
// shows balances without a USD figure rather than breaking.
const COINGECKO_ID: Record<number, string> = {
  1: 'ethereum', 42161: 'ethereum', 8453: 'ethereum', 11155111: 'ethereum',
  56: 'binancecoin', 137: 'matic-network',
};

export async function fetchUsdPrices(chainIds: number[]): Promise<Record<number, number>> {
  const ids = [...new Set(chainIds.map((c) => COINGECKO_ID[c]).filter(Boolean))];
  if (!ids.length) return {};
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usd: number }>;
    const out: Record<number, number> = {};
    for (const [chainId, cgId] of Object.entries(COINGECKO_ID)) {
      if (data[cgId]?.usd != null) out[Number(chainId)] = data[cgId].usd;
    }
    return out;
  } catch {
    return {};
  }
}
