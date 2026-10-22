import { local, KEYS } from '../../core/storage';
import { ALL_CHAINS, TESTNET_CHAINS } from '../../core/chains/index';
import { fetchNativeBalances, addressFor } from '../../core/chains/adapters';
import { fetchNativePrices, fetchTrending, fetchHot, fetchTrendingNetworks } from '../../core/priceService';
import { solanaRpcUrl } from '../../core/rpc';
import { CHART_RANGES, fetchChart, fetchInfo, type ChartRange } from '../../core/marketData';
import { fetchActivity } from '../../core/activity/index';
import { rateStore } from '../settingsService';
import { getRate, CURRENCY_CODES } from '../../core/fiat';
import { customNetworks } from '../../core/networkRegistry';
import { resolveSendChain, customChainInfo } from '../../core/sendService';
import { activeEntry } from '../walletState';
import type { HandlerMap } from '../handlers/types';
import { defaultHiddenAssets } from './shared';

export const handlers: HandlerMap = {
  getBalances: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      // Native balances for the requested chains (default: Trust Wallet's default home set), via the per-family adapters in
      // core/chains/adapters. A chain whose adapter/endpoint fails reports ok:false — never a fake zero.
      try {
        let addresses = msg.addresses;
        if (!addresses) { const st: any = await vault.getState(); addresses = (activeEntry(st)?.[1] as any)?.addresses ?? {}; }
        const ui = (await local.get<any>(KEYS.UI)) ?? {};
        const hidden = new Set<string>(ui.hiddenAssets ?? defaultHiddenAssets());
        // User-added custom EVM networks are first-class home assets (id `custom-<chainId>`); built-ins never include them.
        const custom = customNetworks();
        const wanted: string[] = Array.isArray(msg.chainIds) && msg.chainIds.length ? msg.chainIds.map(String) : [...ALL_CHAINS, ...TESTNET_CHAINS, ...custom.map((n) => customChainInfo(n))].map((c) => c.id).filter((id) => !hidden.has(id));
        const chains = wanted.map((id) => resolveSendChain(id, undefined, custom)).filter((c): c is NonNullable<typeof c> => !!c);
        const results = await fetchNativeBalances(chains.map((chain) => ({ chain, address: addressFor(chain, addresses) })));
        const prices = await fetchNativePrices(chains.map((c) => c.cg ?? ''));
        let totalUsd = 0;
        const byChain: Record<string, any> = {};
        for (const c of chains) {
          const r = results.get(c.id)!; const mk = c.cg ? prices[c.cg] : undefined;
          const price = c.testnet ? 0 : (mk?.price ?? null);
          const usd = price != null && r.ok ? Number(r.formatted) * price : null;
          if (usd != null) totalUsd += usd;
          byChain[c.id] = { chainId: c.evmChainId ?? c.twId, wei: r.raw, formatted: r.formatted, symbol: c.symbol, ok: r.ok, error: r.error, usd, price, change: mk?.change ?? null };
        }
        return { ok: true, balances: byChain, totalUsd, pricesAvailable: Object.keys(prices).length > 0 };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }
  },
  getTrending: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { const list = await fetchTrending({ category: typeof msg.category === 'string' ? msg.category : undefined, order: typeof msg.order === 'string' ? msg.order : undefined, categoryId: typeof msg.categoryId === 'string' ? msg.categoryId : undefined, networkCoinId: typeof msg.networkCoinId === 'number' ? msg.networkCoinId : undefined }); return { ok: true, list }; }
      catch (e: any) { return { ok: false, error: e.message, list: [] }; }
    }
  },
  getHot: async () => {
    try { const r = await fetchHot(); return { ok: true, ...r }; } catch (e: any) { return { ok: false, error: e?.message ?? 'Hot tokens unavailable', tokens: [], dex: [] }; }
  },
  getTrendingNetworks: async () => {
    try { return { ok: true, list: await fetchTrendingNetworks() }; } catch { return { ok: true, list: [] }; }
  },
  tokenChart: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      const range = String(msg.range ?? '1D');
      if (!(CHART_RANGES as string[]).includes(range) || typeof msg.assetId !== 'string') return { ok: false, error: 'Bad request' };
      const r = await fetchChart(msg.assetId, range as ChartRange); return r.ok ? { ok: true, data: r.data } : r;
    }
  },
  tokenInfo: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      if (typeof msg.assetId !== 'string') return { ok: false, error: 'Bad request' };
      const r = await fetchInfo(msg.assetId); return r.ok ? { ok: true, data: r.data } : r;
    }
  },
  txHistory: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      // public address + asset id only; validated so it cannot steer the explorer URL
      const id = String(msg.assetId ?? ''); const addr = String(msg.address ?? '');
      if (!/^[a-z0-9_-]{3,40}$/.test(id) || !/^[A-Za-z0-9._-]{10,120}$/.test(addr)) return { ok: false, error: 'No address for this network.' };
      const r = await fetchActivity(id, addr, { solanaRpc: solanaRpcUrl() }); return r.ok ? { ok: true, items: r.items } : r;
    }
  },
  getFiatRate: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      const code = String(msg.code ?? '');
      if (!CURRENCY_CODES.has(code)) return { ok: false, error: 'Unsupported currency' };
      const r = await getRate(code, rateStore); return r.ok ? { ok: true, code, usdPer: r.usdPer, stale: r.stale, at: Date.now() } : r;
    }
  },
};
