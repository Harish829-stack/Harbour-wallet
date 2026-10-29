// Read-only multi-chain data messages (prefix `chainData*`). Everything here reads PUBLIC chain data for the active account's public addresses;
// no secrets cross this boundary and nothing signs. Send/sign messages live in handlers/chainSend.ts (another feature).
import type { HandlerMap } from './types';
import { chainById, ENABLED_CHAINS } from '../../core/chains/index';
import { addressFor, fetchNativeBalance, BALANCE_ADAPTERS } from '../../core/chains/adapters';
import { activitySupported, activityUnsupportedReason, fetchActivity } from '../../core/activity/index';
import { fetchGasQuote } from '../../core/gasFees';
import { fetchNativePrices } from '../../core/priceService';
import { probeChainToken, chainTokenBalance, validTokenAddress, TOKEN_CHAINS, type TokenStandard } from '../../core/chains/adapters/tokens';
import { activeEntry, ensureAccounts } from '../walletState';
import { cleanText } from '../../core/erc20';
import { isIndexedChain } from '../../core/harbour/config';
import { nativeBalance } from '../../core/harbour/data';

export interface ChainToken { id: string; chain: string; chainId: number; address: string; name: string; symbol: string; decimals: number; standard: TokenStandard; manual: boolean; addedAt: number }
export const MAX_CHAIN_TOKENS = 100;
const tokenId = (chain: string, address: string) => `${chain}_t${address}`; // base58 is case-sensitive: never lower-cased
export const readChainTokens = (list: unknown): ChainToken[] => (Array.isArray(list) ? list : []).filter((t): t is ChainToken => !!t && typeof t.id === 'string' && typeof t.chain === 'string' && !!TOKEN_CHAINS[t.chain] && typeof t.address === 'string' && typeof t.decimals === 'number');

const activeAddresses = async (ctx: any, override?: Record<string, string>): Promise<Record<string, string>> => {
  if (override && typeof override === 'object') return override;
  const st: any = await ctx.vault.getState(); const e = activeEntry(st); if (!e) return {};
  const w = e[1]; const a = ensureAccounts(w); return a[w.activeAccount]?.addresses ?? w.addresses ?? {};
};

export const handlers: HandlerMap = {
  /** Per-chain capability table so the UI can say "unavailable" explicitly instead of showing a fake zero. */
  chainDataCapabilities: () => ({
    ok: true,
    chains: Object.fromEntries(ENABLED_CHAINS.map((c) => [c.id, { balance: !!BALANCE_ADAPTERS[c.kind], history: activitySupported(c.id), historyReason: activitySupported(c.id) ? undefined : activityUnsupportedReason, tokens: c.kind === 'evm' || !!TOKEN_CHAINS[c.id], gas: c.kind === 'evm' }])),
  }),
  chainDataBalance: async (msg, ctx) => {
    const chain = chainById(String(msg.chainId ?? '')); if (!chain) return { ok: false, error: 'Unknown network' };
    const address = addressFor(chain, await activeAddresses(ctx, msg.addresses)); if (!address) return { ok: false, error: 'No address for this network' };
    const r = isIndexedChain(chain.id) ? await nativeBalance(chain.id, address) : await fetchNativeBalance(chain, address);
    return { ok: r.ok, chainId: chain.id, symbol: chain.symbol, raw: r.raw, formatted: r.formatted, error: r.error };
  },
  chainDataHistory: async (msg, ctx) => {
    const chain = chainById(String(msg.chainId ?? '')); if (!chain) return { ok: false, error: 'Unknown network' };
    const address = addressFor(chain, await activeAddresses(ctx, msg.addresses)); if (!address) return { ok: false, error: 'No address for this network.' };
    return fetchActivity(chain, address);
  },
  chainDataGas: async (msg) => {
    const chain = chainById(String(msg.chainId ?? '')); if (!chain) return { ok: false, error: 'Unknown network' };
    const [q, p] = await Promise.all([fetchGasQuote(chain), chain.cg && !chain.testnet ? fetchNativePrices([chain.cg]).catch(() => ({} as any)) : Promise.resolve({} as any)]);
    return q.ok ? { ok: true, quote: q.quote, symbol: chain.symbol, decimals: chain.decimals, nativePriceUsd: chain.cg ? p[chain.cg]?.price ?? null : null, testnet: !!chain.testnet } : q;
  },

  // ---- non-EVM custom assets (Solana SPL, Tron TRC-20) ----
  chainDataTokenProbe: async (msg) => {
    const chain = chainById(String(msg.chain ?? '')); if (!chain || !TOKEN_CHAINS[chain.id]) return { ok: false, code: 'UNSUPPORTED_NETWORK', error: 'Custom tokens are not supported on this network yet.' };
    return probeChainToken(chain, String(msg.address ?? ''), fetch);
  },
  chainDataTokenAdd: async (msg, ctx) => {
    try {
      const chain = chainById(String(msg.chain ?? '')); if (!chain || !TOKEN_CHAINS[chain.id]) return { ok: false, error: 'Unsupported network' };
      const address = String(msg.address ?? '').trim(); if (!validTokenAddress(chain.id, address)) return { ok: false, error: 'Invalid token address' };
      const manual = msg.manual === true; let meta: any = { name: msg.name, symbol: msg.symbol, decimals: Number(msg.decimals) };
      // Always probe: decimals (and name/symbol when the chain/index provides them) come from the network, never from the client.
      const probe = await probeChainToken(chain, address, fetch);
      if (!probe.ok) return { ok: false, code: probe.code, error: probe.error };
      meta = { name: probe.token.name || msg.name, symbol: probe.token.symbol || msg.symbol, decimals: probe.token.decimals };
      const name = cleanText(meta.name, 64), symbol = cleanText(meta.symbol, 32);
      if (!name) return { ok: false, error: 'Token name is required' }; if (!symbol) return { ok: false, error: 'Token symbol is required' };
      const st: any = await ctx.vault.getState(); const entry = activeEntry(st); if (!entry) return { ok: false, error: 'No wallet found' };
      const list = readChainTokens(entry[1].customChainTokens); const id = tokenId(chain.id, address); const i = list.findIndex((t) => t.id === id);
      const tok: ChainToken = { id, chain: chain.id, chainId: chain.twId, address, name, symbol, decimals: meta.decimals, standard: TOKEN_CHAINS[chain.id], manual: manual || probe.needsManual === true, addedAt: i >= 0 ? list[i].addedAt : Date.now() };
      if (i < 0 && list.length >= MAX_CHAIN_TOKENS) return { ok: false, error: `You can add up to ${MAX_CHAIN_TOKENS} custom tokens` };
      entry[1].customChainTokens = i >= 0 ? list.map((t, k) => (k === i ? tok : t)) : [...list, tok];
      await ctx.vault.persist(st); return { ok: true, token: tok, existed: i >= 0 };
    } catch (e: any) { return { ok: false, error: e?.message || 'Could not add token' }; }
  },
  chainDataTokenRemove: async (msg, ctx) => {
    try {
      const st: any = await ctx.vault.getState(); const entry = activeEntry(st); if (!entry) return { ok: false, error: 'No wallet found' };
      entry[1].customChainTokens = readChainTokens(entry[1].customChainTokens).filter((t) => t.id !== String(msg.id ?? ''));
      await ctx.vault.persist(st); return { ok: true };
    } catch (e: any) { return { ok: false, error: e?.message || 'Could not remove token' }; }
  },
  chainDataTokenBalances: async (msg, ctx) => {
    try {
      const st: any = await ctx.vault.getState(); const entry = activeEntry(st); const tokens = readChainTokens(entry?.[1]?.customChainTokens);
      if (!entry || !tokens.length) return { ok: true, items: [] };
      const addrs = await activeAddresses(ctx, msg.addresses);
      const items = await Promise.all(tokens.map(async (t) => {
        const chain = chainById(t.chain); const owner = chain ? addressFor(chain, addrs) : '';
        const r = chain && owner ? await chainTokenBalance(chain, owner, t, fetch) : ({ ok: false, error: 'no address' } as const);
        return { token: t, ok: r.ok, raw: r.ok ? r.raw : '0', formatted: r.ok ? r.formatted : '0', price: null, change: null, usd: null };
      }));
      return { ok: true, items };
    } catch (e: any) { return { ok: false, error: e?.message || 'Balances unavailable', items: [] }; }
  },
};
