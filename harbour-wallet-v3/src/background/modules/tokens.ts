import { chainByEvmId } from '../../core/chains/index';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { probeToken, clientFor, tokenBalance, formatTokenAmount } from '../../core/erc20';
import { readTokens, sanitizeToken, upsertToken, removeToken, networkByChainId } from '../../core/customTokens';
import { fetchTokenPrices } from '../../core/tokenPrice';
import { setNetworkState, getNetworkState, customNetwork } from '../../core/networkRegistry';
import { validateNetwork, checkNetwork, isBuiltinChain, normalizeUrl, BUILTIN_EVM } from '../../core/networks';
import { ensureAccounts, activeEntry } from '../walletState';
import { tokenItems } from '../../core/harbour/data';
import type { HandlerMap } from '../handlers/types';
import { saveNetworks, networksReady } from './shared';

export const handlers: HandlerMap = {
  tokenProbe: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      // Public chain read only (no wallet state, no TW gateway): name/symbol/decimals over the chain's RPC.
      const chainId = Number(msg.chainId);
      if (!networkByChainId(chainId)) return { ok: false, code: 'UNSUPPORTED_NETWORK', error: 'This network is not supported.' };
      const r = await probeToken(clientFor(chainId), String(msg.address ?? ''));
      return r.ok ? { ok: true, token: r.token } : { ok: false, code: r.code, error: r.error };
    }
  },
  networkList: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      await networksReady;
      const st = getNetworkState();
      return { ok: true, custom: st.custom, builtin: BUILTIN_EVM.map((c) => ({ chainId: c.chainId, name: c.name, testnet: c.testnet, rpcUrl: getRpcUrls(chainByEvmId(c.chainId)!)[0] ?? '', overridden: !!st.rpcOverrides[String(c.chainId)] })), rpcOverrides: st.rpcOverrides };
    }
  },
  networkSave: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      await networksReady;
      // Add (msg.editing undefined) or edit a custom network, or change the RPC of a built-in one.
      try {
        const st = getNetworkState();
        const chainId = Number(msg.chainId);
        if (isBuiltinChain(chainId)) {
          if (msg.rpcOnly !== true) return { ok: false, error: 'This chain is already built in. Edit its RPC from the list instead.', field: 'chainId' };
          const u = normalizeUrl(msg.rpcUrl); if (!u.ok) return { ok: false, error: u.error, field: 'rpcUrl' };
          const chk = await checkNetwork({ chainId, rpcUrl: u.url }); if (!chk.ok) return chk;
          const current = getNetworkState();
          setNetworkState({ ...current, rpcOverrides: { ...current.rpcOverrides, [String(chainId)]: u.url } }); await saveNetworks();
          return { ok: true };
        }
        const editing = msg.editing != null ? Number(msg.editing) : undefined;
        const v = validateNetwork(msg as any, st.custom.filter((n) => n.chainId !== editing), editing);
        if (!v.ok) return v;
        if (editing != null && v.network.chainId !== editing) return { ok: false, error: 'The chain ID cannot be changed. Remove the network and add it again.', field: 'chainId' };
        const chk = await checkNetwork(v.network); if (!chk.ok) return chk;
        const current = getNetworkState();
        if (editing == null && current.custom.some((n) => n.chainId === v.network.chainId)) return { ok: false, error: 'A custom network with this chain ID already exists.', field: 'chainId' };
        if (editing != null && !current.custom.some((n) => n.chainId === editing)) return { ok: false, error: 'This network was removed while the RPC was checked.', field: 'chainId' };
        const prev = customNetwork(v.network.chainId);
        const next = { ...v.network, addedAt: prev?.addedAt ?? Date.now() };
        setNetworkState({ ...current, custom: [...current.custom.filter((n) => n.chainId !== next.chainId), next].sort((a, b) => a.addedAt - b.addedAt) }); await saveNetworks();
        return { ok: true, network: next };
      } catch (e: any) { return { ok: false, error: e?.message || 'Could not save the network' }; }
    }
  },
  networkRemove: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      await networksReady;
      // Custom network: delete it. Built-in: reset its RPC to the default.
      const st = getNetworkState(); const chainId = Number(msg.chainId);
      if (isBuiltinChain(chainId)) { const { [String(chainId)]: _x, ...rest } = st.rpcOverrides; setNetworkState({ ...st, rpcOverrides: rest }); }
      else setNetworkState({ ...st, custom: st.custom.filter((n) => n.chainId !== chainId) });
      await saveNetworks(); return { ok: true };
    }
  },
  tokenList: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      try { const st: any = await vault.getState(); const e = activeEntry(st); return { ok: true, tokens: readTokens(e?.[1]?.customTokens) }; }
      catch (e: any) { return { ok: false, error: e.message, tokens: [] }; }
    }
  },
  tokenAdd: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      try {
        const chainId = Number(msg.chainId); const manual = msg.manual === true;
        let meta: any = { name: msg.name, symbol: msg.symbol, decimals: msg.decimals };
        if (!manual) {
          // Automatic mode trusts only what the chain says, never client-supplied metadata.
          const r = await probeToken(clientFor(chainId), String(msg.address ?? ''));
          if (!r.ok) return { ok: false, code: r.code, error: r.error };
          meta = r.token;
        }
        const clean = sanitizeToken({ chainId, address: msg.address, ...meta, manual });
        if (!clean.ok) return { ok: false, error: clean.error };
        const st: any = await vault.getState(); const entry = activeEntry(st);
        if (!entry) return { ok: false, error: 'No wallet found' };
        const res = upsertToken(readTokens(entry[1].customTokens), clean.token);
        if ('error' in res) return { ok: false, error: res.error };
        entry[1].customTokens = res.list;
        await vault.persist(st);
        return { ok: true, token: clean.token, existed: res.existed };
      } catch (e: any) { return { ok: false, error: e?.message || 'Could not add token' }; }
    }
  },
  tokenRemove: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      try {
        const st: any = await vault.getState(); const entry = activeEntry(st);
        if (!entry) return { ok: false, error: 'No wallet found' };
        entry[1].customTokens = removeToken(readTokens(entry[1].customTokens), String(msg.id ?? ''));
        await vault.persist(st); return { ok: true };
      } catch (e: any) { return { ok: false, error: e?.message || 'Could not remove token' }; }
    }
  },
  tokenBalances: async (msg, ctx) => {
    const { vault } = ctx as any;
 {
      // Balances + best-effort USD price for every custom token of the active wallet, for the active account's EVM address.
      try {
        const st: any = await vault.getState(); const entry = activeEntry(st);
        if (!entry) return { ok: true, items: [] };
        const w = entry[1]; const accts = ensureAccounts(w);
        const owner: string | undefined = msg.address || accts[w.activeAccount]?.addresses?.ethereum;
        if (!owner) return { ok: true, items: [] };
        // Only tokens the user added are listed (a chain shows its native coin until then). For those on Harbour networks the indexer's
        // balance and price are used when it has them; everything else is read from the network.
        const tokens = readTokens(w.customTokens);
        if (!tokens.length) return { ok: true, items: [] };
        const indexed = await tokenItems(owner).catch(() => []);
        const held = new Map(indexed.map((i) => [`${i.token.chainId}:${i.token.address.toLowerCase()}`, i]));
        const prices = await fetchTokenPrices(tokens);
        const items = await Promise.all(tokens.map(async (t) => {
          const price = prices[t.id] ?? null; const c = clientFor(t.chainId);
          const h = held.get(`${t.chainId}:${t.address.toLowerCase()}`);
          if (h) return { token: t, ok: true, raw: h.raw, formatted: h.formatted, price: h.price ?? price?.price ?? null, change: price?.change ?? null, usd: h.usd ?? (price ? Number(h.formatted) * price.price : null) };
          if (!c) return { token: t, ok: false, raw: '0', formatted: '0', price: price?.price ?? null, change: price?.change ?? null, usd: null };
          try {
            const raw = await tokenBalance(c, t.address, owner);
            const formatted = formatTokenAmount(raw, t.decimals);
            return { token: t, ok: true, raw: raw.toString(), formatted, price: price?.price ?? null, change: price?.change ?? null, usd: price ? Number(formatted) * price.price : null };
          } catch { return { token: t, ok: false, raw: '0', formatted: '0', price: price?.price ?? null, change: price?.change ?? null, usd: null }; }
        }));
        return { ok: true, items };
      } catch (e: any) { return { ok: false, error: e?.message || 'Balances unavailable', items: [] }; }
    }
  },
};
