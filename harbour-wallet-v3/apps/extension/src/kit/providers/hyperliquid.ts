import { http } from '../httpClient';
// Hyperliquid public info endpoint (read-only). Exchange (signed) actions are intentionally not implemented here yet.
const URL_INFO = 'https://api.hyperliquid.xyz/info';
const info = <T>(body: unknown) => http.json<T>(URL_INFO, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, cacheTtlMs: 0, retries: 1 });
export const hlMeta = () => info<{ universe: { name: string; szDecimals: number; maxLeverage: number }[] }>({ type: 'meta' });
export const hlMids = () => info<Record<string, string>>({ type: 'allMids' });
export const hlState = (user: string) => info<{ marginSummary: { accountValue: string }; assetPositions: { position: { coin: string; szi: string; entryPx: string; unrealizedPnl: string; leverage: { value: number } } }[] }>({ type: 'clearinghouseState', user });
export const hlOpenOrders = (user: string) => info<unknown[]>({ type: 'openOrders', user });
