// Popup-side store for custom tokens: balances + prices come from the background (`tokenBalances`), and every loaded token is
// registered as an Asset so Send / Receive / Token detail can open it by id.
import { useSyncExternalStore } from 'react';
import { registerCustomAssets, type Asset } from './data';
import type { CustomToken } from '../../core/customTokens';

type Bg = (m: any) => Promise<any>;
export interface TokenItem { token: CustomToken; ok: boolean; raw: string; formatted: string; price: number | null; change: number | null; usd: number | null }
interface State { items: TokenItem[]; loaded: boolean }
let state: State = { items: [], loaded: false };
const listeners = new Set<() => void>();
const set = (s: State) => { state = s; listeners.forEach((l) => l()); };
export const useTokenItems = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);

// Stable, neutral colour per token so rows are distinguishable without logos (TW loads icons from its CDN: not used).
export const tokenColor = (id: string): string => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 45% 50%)`; };
export const tokenAsset = (t: CustomToken): Asset => ({ id: t.id, name: t.name, sym: t.symbol, color: tokenColor(t.id), chainId: t.chainId, evm: !t.chain, price: 0, change: 0,
  token: { id: t.id, address: t.address, decimals: t.decimals, chainId: t.chainId, networkId: t.networkId } });

export async function refreshTokens(bg: Bg): Promise<void> {
  try {
    const [r, x] = await Promise.all([bg({ type: 'tokenBalances' }), bg({ type: 'chainDataTokenBalances' }).catch(() => null)]);
    if (!r?.ok && !x?.ok) { set({ ...state, loaded: true }); return; }
    // Non-EVM custom assets (Solana SPL, Tron TRC-20) are stored separately and shaped like CustomToken so Home / detail treat both alike.
    const extra: TokenItem[] = (x?.ok ? x.items ?? [] : []).map((i: any) => ({ ...i, token: { ...i.token, networkId: i.token.chain } }));
    const items: TokenItem[] = [...(r?.ok ? r.items ?? [] : []), ...extra];
    registerCustomAssets(items.map((i) => tokenAsset(i.token)));
    set({ items, loaded: true });
  } catch { set({ ...state, loaded: true }); }
}
export const tokenItem = (id: string): TokenItem | undefined => state.items.find((i) => i.token.id === id);
