import { http } from '../httpClient';
export interface SimplePrice { price: number; change: number }
export async function coingeckoPrices(ids: string[]): Promise<Record<string, SimplePrice>> {
  const j = await http.json<Record<string, { usd: number; usd_24h_change?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`, { cacheTtlMs: 60_000, ratePerSec: 0.5 });
  return Object.fromEntries(Object.entries(j).filter(([, v]) => v?.usd != null).map(([k, v]) => [k, { price: v.usd, change: v.usd_24h_change ?? 0 }]));
}
