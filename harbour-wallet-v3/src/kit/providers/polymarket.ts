import { http } from '../httpClient';
// Polymarket Gamma API (read-only market data). Order placement needs the builder/CLOB flow and region gating, so it stays off.
export interface PmMarket { id: string; question: string; slug: string; outcomes: string[]; prices: number[]; volume: number; endDate?: string }
export async function pmMarkets(limit = 20): Promise<PmMarket[]> {
  const j = await http.json<any[]>(`https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${limit}&order=volumeNum&ascending=false`, { cacheTtlMs: 60_000 });
  const arr = (v: unknown): any[] => { try { return typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : []; } catch { return []; } };
  return j.map((m) => ({ id: String(m.id), question: String(m.question ?? ''), slug: String(m.slug ?? ''), outcomes: arr(m.outcomes).map(String), prices: arr(m.outcomePrices).map(Number), volume: Number(m.volumeNum ?? m.volume ?? 0), endDate: m.endDate }));
}
