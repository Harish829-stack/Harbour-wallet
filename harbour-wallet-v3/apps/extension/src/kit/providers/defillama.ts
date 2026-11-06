import { http } from '../httpClient';
import type { SimplePrice } from './coingecko';
// coins.llama.fi: free, no key. Keys use the `coingecko:<id>` namespace so it is a drop-in fallback for CoinGecko ids.
export async function defillamaPrices(ids: string[]): Promise<Record<string, SimplePrice>> {
  const q = ids.map((i) => `coingecko:${i}`).join(',');
  const j = await http.json<{ coins: Record<string, { price: number }> }>(`https://coins.llama.fi/prices/current/${q}`, { cacheTtlMs: 60_000 });
  const out: Record<string, SimplePrice> = {};
  for (const [k, v] of Object.entries(j.coins ?? {})) if (typeof v?.price === 'number') out[k.replace('coingecko:', '')] = { price: v.price, change: 0 };
  return out;
}
