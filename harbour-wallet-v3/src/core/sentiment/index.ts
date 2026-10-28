// Market sentiment (TW `/market-sentiment/articles|posts/:symbol`, background FETCH_MARKET_SENTIMENT, asset list GET /v2/market/sentiment-assets).
// TW's backend scores each news article / social post as negative / neutral / positive and shows a score ("equal positive and negative
// mentions => 50%"). Those endpoints are TW-private; Harbour's public equivalent aggregates open sources and scores locally:
//   articles: CryptoCompare news JSON + CoinDesk / Cointelegraph / Decrypt RSS (filtered to the asset)
//   posts:    Reddit search JSON + StockTwits symbol stream (its own Bullish/Bearish tags are used when present)
// The classifier is a small transparent keyword lexicon (NOT a trained model) - see evidences/re-evidence/37-discover/SPEC.md for limits.
import { safeHttpsLink } from '../ramps/guard';
import { ALL_CHAINS } from '../chains/index';
import { GATEWAY_URL } from '../../kit/endpoints';
type F = typeof fetch;
export type Label = 'positive' | 'neutral' | 'negative';
export interface SentimentItem { id: string; kind: 'article' | 'post'; title: string; snippet: string; url: string; source: string; at: number; label: Label; labelBy: 'source' | 'lexicon' }
export interface SourceStatus { name: string; kind: 'articles' | 'posts'; ok: boolean; count: number; error?: string }
type Bucket = { articles: SentimentItem[]; posts: SentimentItem[] };
export interface SentimentResult { symbol: string; name: string; negative: Bucket; neutral: Bucket; positive: Bucket; score: number | null; counts: { positive: number; neutral: number; negative: number }; sources: SourceStatus[]; at: number }

// ------------------------------------------------------------ text helpers
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function cleanText(s: unknown, max = 280): string {
  if (typeof s !== 'string') return '';
  let t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' ');
  t = t.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (ENT[e.toLowerCase()] !== undefined) return ENT[e.toLowerCase()];
    const cp = e[0] === '#' ? (e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : NaN;
    return Number.isFinite(cp) && cp > 31 && cp < 0x10ffff ? String.fromCodePoint(cp) : ' ';
  });
  t = t.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}
const tag = (xml: string, name: string): string => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml); return m ? m[1] : ''; };
export function parseRss(xml: string, source: string): SentimentItem[] {
  if (typeof xml !== 'string') return [];
  const out: SentimentItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks.slice(0, 60)) {
    const title = cleanText(tag(b, 'title'), 200);
    const linkTag = tag(b, 'link').trim() || (/<link[^>]*href=["']([^"']+)["']/i.exec(b)?.[1] ?? '');
    const url = safeHttpsLink(cleanText(linkTag.replace(/<!\[CDATA\[|\]\]>/g, ''), 2048));
    const when = Date.parse(cleanText(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published'), 60));
    if (!title || !url) continue;
    out.push({ id: url, kind: 'article', title, snippet: cleanText(tag(b, 'description') || tag(b, 'summary'), 240), url, source, at: Number.isFinite(when) ? when : 0, label: 'neutral', labelBy: 'lexicon' });
  }
  return out;
}
export function parseCryptoCompare(body: any): SentimentItem[] {
  const rows = Array.isArray(body?.Data) ? body.Data : [];
  const out: SentimentItem[] = [];
  for (const r of rows.slice(0, 60)) {
    const url = safeHttpsLink(r?.url); const title = cleanText(r?.title, 200); if (!url || !title) continue;
    out.push({ id: String(r?.id ?? url), kind: 'article', title, snippet: cleanText(r?.body, 240), url, source: cleanText(r?.source_info?.name ?? r?.source ?? 'CryptoCompare', 40), at: Number(r?.published_on) * 1000 || 0, label: 'neutral', labelBy: 'lexicon' });
  }
  return out;
}
export function parseReddit(body: any): SentimentItem[] {
  const rows = Array.isArray(body?.data?.children) ? body.data.children : [];
  const out: SentimentItem[] = [];
  for (const c of rows.slice(0, 60)) {
    const d = c?.data; if (!d || d.over_18) continue;
    const perm = typeof d.permalink === 'string' && /^\/r\/[A-Za-z0-9_]+\/comments\/[A-Za-z0-9_/\-%.]+$/.test(d.permalink) ? d.permalink : '';
    const url = safeHttpsLink(perm ? `https://www.reddit.com${perm}` : '');
    const title = cleanText(d.title, 200); if (!url || !title) continue;
    out.push({ id: String(d.id ?? url), kind: 'post', title, snippet: cleanText(d.selftext, 240), url, source: `r/${cleanText(d.subreddit, 30)}`, at: Number(d.created_utc) * 1000 || 0, label: 'neutral', labelBy: 'lexicon' });
  }
  return out;
}
export function parseStocktwits(body: any): SentimentItem[] {
  const rows = Array.isArray(body?.messages) ? body.messages : [];
  const out: SentimentItem[] = [];
  for (const m of rows.slice(0, 40)) {
    const user = typeof m?.user?.username === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(m.user.username) ? m.user.username : '';
    const id = typeof m?.id === 'number' || /^\d+$/.test(String(m?.id)) ? String(m.id) : ''; if (!user || !id) continue;
    const text = cleanText(m?.body, 280); if (!text) continue;
    const tagB = String(m?.entities?.sentiment?.basic ?? '').toLowerCase();
    out.push({ id, kind: 'post', title: text, snippet: '', url: `https://stocktwits.com/${user}/message/${id}`, source: 'StockTwits', at: Date.parse(m?.created_at) || 0, label: tagB === 'bullish' ? 'positive' : tagB === 'bearish' ? 'negative' : 'neutral', labelBy: tagB ? 'source' : 'lexicon' });
  }
  return out;
}

// ------------------------------------------------------------ classifier
const POS = ['bullish', 'surge', 'surges', 'soar', 'soars', 'rally', 'rallies', 'gain', 'gains', 'breakout', 'record', 'ath', 'adopt', 'adopts', 'adoption', 'approve', 'approved', 'approval', 'upgrade', 'partnership', 'growth', 'profit', 'profits', 'moon', 'accumulate', 'accumulating', 'strong', 'boost', 'rise', 'rises', 'jump', 'jumps', 'optimistic', 'win', 'wins', 'launch', 'launches', 'milestone', 'recover', 'recovery', 'inflow', 'inflows'];
const NEG = ['bearish', 'crash', 'crashes', 'plunge', 'plunges', 'dump', 'dumps', 'drop', 'drops', 'fall', 'falls', 'slump', 'hack', 'hacked', 'exploit', 'exploited', 'scam', 'fraud', 'rug', 'rugpull', 'lawsuit', 'sue', 'sued', 'ban', 'banned', 'reject', 'rejected', 'delist', 'delisted', 'liquidation', 'liquidations', 'fear', 'selloff', 'loss', 'losses', 'decline', 'declines', 'warn', 'warns', 'risk', 'collapse', 'bankrupt', 'bankruptcy', 'fud', 'rekt', 'outage', 'investigation', 'probe', 'outflow', 'outflows'];
const POSS = new Set(POS), NEGS = new Set(NEG), NOT = new Set(['not', 'no', 'never', 'without', "isn't", "won't", "doesn't", "didn't", "aren't"]);
/** Score in [-1, 1]: (positive - negative) / (positive + negative), negation-aware. 0 when no signal words. */
export function lexiconScore(text: string): number {
  const toks = text.toLowerCase().replace(/[^a-z0-9'\- $]/g, ' ').replace(/\bsell-off\b/g, 'selloff').split(/\s+/).filter(Boolean);
  let p = 0, n = 0;
  toks.forEach((t, i) => {
    const flip = NOT.has(toks[i - 1] ?? '');
    if (POSS.has(t)) (flip ? n++ : p++); else if (NEGS.has(t)) (flip ? p++ : n++);
  });
  return p + n === 0 ? 0 : (p - n) / (p + n);
}
export const labelFor = (s: number): Label => (s >= 0.2 ? 'positive' : s <= -0.2 ? 'negative' : 'neutral');
export function classify(it: SentimentItem): SentimentItem {
  return it.labelBy === 'source' ? it : { ...it, label: labelFor(lexiconScore(`${it.title} ${it.snippet}`)), labelBy: 'lexicon' };
}
/** "equal number of positive and negative mentions => 50%": positives / (positives + negatives); neutral items do not move the score. */
export function sentimentScore(c: { positive: number; negative: number }): number | null { const d = c.positive + c.negative; return d === 0 ? null : Math.round((c.positive / d) * 100); }

// ------------------------------------------------------------ asset matching + supported assets
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function matchesAsset(text: string, symbol: string, name: string): boolean {
  if (!text) return false;
  const sym = new RegExp(`(^|[^A-Za-z0-9])\\$?${esc(symbol)}(?![A-Za-z0-9])`);
  if (sym.test(text)) return true; // case-sensitive: "ETH" matches, "eth" in "method" does not
  return name.length >= 4 && new RegExp(`(^|[^A-Za-z0-9])${esc(name)}(?![A-Za-z0-9])`, 'i').test(text);
}
/** Public equivalent of GET /v2/market/sentiment-assets: every distinct native asset of the chain registry can be looked up. */
export function sentimentAssets(): Array<{ symbol: string; name: string }> {
  const m = new Map<string, string>();
  for (const c of ALL_CHAINS) if (!m.has(c.symbol)) m.set(c.symbol, c.symbol === 'ETH' ? 'Ethereum' : c.symbol === 'BNB' ? 'BNB' : c.name);
  return [...m].map(([symbol, name]) => ({ symbol, name }));
}
export const isSymbol = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9]{1,12}$/.test(s);
const NAME_ALIAS: Record<string, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', POL: 'Polygon', AVAX: 'Avalanche', TRX: 'Tron', XRP: 'XRP', ATOM: 'Cosmos', TON: 'Toncoin', DOGE: 'Dogecoin', ADA: 'Cardano', LINK: 'Chainlink', USDT: 'Tether', USDC: 'USD Coin' };
export const assetName = (symbol: string) => NAME_ALIAS[symbol] ?? sentimentAssets().find((a) => a.symbol === symbol)?.name ?? symbol;

// ------------------------------------------------------------ fetch
// [label, gateway slug, direct URL]: the gateway serves the same feed cached for 10 minutes (one fetch for all users).
const FEEDS: Array<[string, string, string]> = [['CoinDesk', 'coindesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'], ['Cointelegraph', 'cointelegraph', 'https://cointelegraph.com/rss'], ['Decrypt', 'decrypt', 'https://decrypt.co/feed'], ['The Block', 'theblock', 'https://www.theblock.co/rss.xml']];
async function feed(f: F, slug: string, direct: string): Promise<string> {
  if (GATEWAY_URL) { try { return await get(f, `${GATEWAY_URL}/rss/${slug}`, true); } catch { /* direct below */ } }
  return get(f, direct, true);
}
async function get(f: F, url: string, asText = false): Promise<any> {
  const r = await f(url, { signal: AbortSignal.timeout(10_000), headers: { accept: asText ? 'application/rss+xml, application/xml, text/xml, */*' : 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return asText ? r.text() : r.json();
}
export async function fetchSentiment(symbolIn: string, f: F, now = Date.now()): Promise<SentimentResult> {
  if (!isSymbol(symbolIn)) throw new Error('Invalid asset symbol');
  const symbol = symbolIn.toUpperCase(); const name = assetName(symbol);
  const jobs: Array<{ name: string; kind: 'articles' | 'posts'; run: () => Promise<SentimentItem[]> }> = [
    { name: 'CryptoCompare', kind: 'articles', run: async () => parseCryptoCompare(await get(f, `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${encodeURIComponent(symbol)}`)) },
    ...FEEDS.map(([n, slug, u]) => ({ name: n, kind: 'articles' as const, run: async () => parseRss(await feed(f, slug, u), n).filter((i) => matchesAsset(`${i.title} ${i.snippet}`, symbol, name)) })),
    { name: 'Reddit', kind: 'posts', run: async () => parseReddit(await get(f, `https://www.reddit.com/search.json?q=${encodeURIComponent(`${name} OR ${symbol}`)}&sort=new&t=week&limit=40&raw_json=1`)).filter((i) => matchesAsset(`${i.title} ${i.snippet}`, symbol, name)) },
    { name: 'StockTwits', kind: 'posts', run: async () => parseStocktwits(await get(f, `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.X.json`)) },
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const sources: SourceStatus[] = []; const items: SentimentItem[] = [];
  settled.forEach((s, i) => {
    const j = jobs[i];
    if (s.status === 'fulfilled') { sources.push({ name: j.name, kind: j.kind, ok: true, count: s.value.length }); items.push(...s.value); }
    else sources.push({ name: j.name, kind: j.kind, ok: false, count: 0, error: String((s.reason as any)?.message ?? 'failed').slice(0, 80) });
  });
  const seen = new Set<string>(); const res: SentimentResult = { symbol, name, negative: { articles: [], posts: [] }, neutral: { articles: [], posts: [] }, positive: { articles: [], posts: [] }, score: null, counts: { positive: 0, neutral: 0, negative: 0 }, sources, at: now };
  for (const it of items.map(classify).sort((a, b) => b.at - a.at)) {
    const key = `${it.kind}:${it.url}`; if (seen.has(key)) continue; seen.add(key);
    res[it.label][it.kind === 'article' ? 'articles' : 'posts'].push(it); res.counts[it.label]++;
  }
  for (const l of ['negative', 'neutral', 'positive'] as const) { res[l].articles = res[l].articles.slice(0, 25); res[l].posts = res[l].posts.slice(0, 25); }
  res.score = sentimentScore(res.counts);
  return res;
}
