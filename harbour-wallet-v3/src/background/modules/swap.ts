import * as swapSvc from '../swapService';
import type { HandlerMap } from '../handlers/types';

export const handlers: HandlerMap = {
  swapState: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, settings: await swapSvc.getSettings(), history: await swapSvc.listHistory(), gaslessAvailable: await swapSvc.gaslessAvailable() }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Swap state failed' }; }
    }
  },
  swapSetSettings: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, settings: await swapSvc.setSettings(msg.patch ?? {}) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Update failed' }; }
    }
  },
  swapSearchTokens: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, assets: await swapSvc.searchTokens(String(msg.query ?? ''), typeof msg.domainId === 'string' ? msg.domainId : undefined) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Search failed', assets: [] }; }
    }
  },
  swapBalances: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
 {
      try { return { ok: true, balances: await swapSvc.getBalances({ core, vault, wallet }, Array.isArray(msg.assets) ? msg.assets.slice(0, 80) : []) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Balance fetch failed', balances: {} }; }
    }
  },
  swapMax: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
 {
      try { return { ok: true, ...(await swapSvc.maxSpendable({ core, vault, wallet }, msg.asset)) }; }
      catch (e: any) { return { ok: false, error: e?.message || 'Max failed' }; }
    }
  },
  swapQuote: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
 return swapSvc.quote({ core, vault, wallet }, { from: msg.from, to: msg.to, amount: String(msg.amount ?? ''), slippage: String(msg.slippage ?? '2') });
  },
  swapApprove: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
 return swapSvc.approve({ core, vault, wallet }, { route: msg.route, stepIndex: Number(msg.stepIndex ?? 0), unlimited: msg.unlimited === true });
  },
  swapSubmit: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
 return swapSvc.submit({ core, vault, wallet }, { route: msg.route, stepIndex: Number(msg.stepIndex ?? 0), id: typeof msg.id === 'string' ? msg.id : undefined });
  },
  swapDustScan: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
    return swapSvc.scanDust({ core, vault, wallet }, String(msg.domainId ?? ''), Number(msg.thresholdUsd) > 0 ? Math.min(Number(msg.thresholdUsd), 100) : undefined);
  },
  swapDustConvert: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
    return swapSvc.convertDust({ core, vault, wallet }, Array.isArray(msg.assets) ? msg.assets : []);
  },
  swapStatus: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 return swapSvc.status(String(msg.id ?? ''));
  },
  swapHistory: async (msg, ctx) => {
    const { core, vault, wallet, sender } = ctx as any;
 {
      try { return { ok: true, history: await swapSvc.listHistory() }; }
      catch (e: any) { return { ok: false, error: e?.message || 'History failed', history: [] }; }
    }
  },
};
