// Feature message handlers: discover (dApp directory, market sentiment, help config + announcements). Every message here is UI-only (the router
// enforces isInternalWalletSender before dispatch).
import type { HandlerMap } from './types';
import { local } from '../../core/storage';
import { loadDapps, buildSections, filterDapps, DAPP_CATEGORIES, type DappCache } from '../../core/discover/index';
import { HELP_STORAGE, normalizeHelp, applyHelpPatch, parseAnnouncements, FAQ } from '../../core/discover/help';
import { fetchSentiment, isSymbol, sentimentAssets, type SentimentResult } from '../../core/sentiment/index';

const DAPP_KEY = 'wallet:discover:v1';
const dappKv = { get: () => local.get<DappCache>(DAPP_KEY), set: (v: DappCache) => local.set(DAPP_KEY, v) };
const sentCache = new Map<string, SentimentResult>();
const SENT_TTL = 15 * 60_000;
const fail = (error: string) => ({ ok: false, error });
const MAX_RESULTS = 120;

export const handlers: HandlerMap = {
  // Directory query. With no filter: the three sections (Popular / Latest / Featured). With a filter: ranked results.
  dappsQuery: async (msg) => {
    const l = await loadDapps(dappKv, fetch, Date.now(), !!msg.force);
    if (!l.ok) return fail(l.error);
    const q = typeof msg.query === 'string' ? msg.query.slice(0, 80) : ''; const cat = typeof msg.categoryId === 'string' ? msg.categoryId : ''; const chain = typeof msg.chain === 'string' ? msg.chain.slice(0, 40) : '';
    const counts: Record<string, number> = {}; for (const d of l.items) counts[d.categoryId] = (counts[d.categoryId] ?? 0) + 1;
    const base = { ok: true, at: l.at, stale: l.stale, categories: DAPP_CATEGORIES.filter((c) => counts[c.id]).map((c) => ({ ...c, count: counts[c.id] })), chains: l.chains };
    if (!q && (!cat || cat === 'all') && !chain) return { ...base, sections: buildSections(l.items) };
    const all = filterDapps(l.items, { query: q, categoryId: cat, chain });
    return { ...base, results: all.slice(0, MAX_RESULTS), total: all.length };
  },
  dappDetail: async (msg) => {
    const l = await loadDapps(dappKv, fetch); if (!l.ok) return fail(l.error);
    const d = l.items.find((x) => x.id === msg.id); return d ? { ok: true, dapp: d } : fail('DApp not found');
  },
  sentimentAssets: async () => ({ ok: true, assets: sentimentAssets() }),
  sentiment: async (msg) => {
    if (!isSymbol(msg.symbol)) return fail('Invalid asset');
    const sym = msg.symbol.toUpperCase(); const c = sentCache.get(sym);
    if (c && !msg.force && Date.now() - c.at < SENT_TTL) return { ok: true, sentiment: c };
    try { const r = await fetchSentiment(sym, fetch); sentCache.set(sym, r); return { ok: true, sentiment: r }; } catch (e: any) { return fail(e?.message ?? 'Sentiment unavailable'); }
  },
  helpConfigGet: async () => ({ ok: true, config: normalizeHelp(await local.get(HELP_STORAGE)), faq: FAQ }),
  helpConfigSet: async (msg) => {
    const r = applyHelpPatch(normalizeHelp(await local.get(HELP_STORAGE)), msg.patch); if (!r.ok) return fail(r.error);
    await local.set(HELP_STORAGE, r.config); return { ok: true, config: r.config };
  },
  // Announcements feed (TW GET /v2/announcements has no public equivalent): reads the user-configured https JSON feed, if any.
  announcements: async () => {
    const cfg = normalizeHelp(await local.get(HELP_STORAGE));
    if (!cfg.announcementsUrl) return { ok: true, configured: false, items: [] };
    try {
      const r = await fetch(cfg.announcementsUrl, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { ok: true, configured: true, items: parseAnnouncements(await r.json()) };
    } catch (e: any) { return { ok: false, configured: true, error: String(e?.message ?? 'Feed unavailable').slice(0, 100) }; }
  },
};
