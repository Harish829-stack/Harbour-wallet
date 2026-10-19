import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, jsonRes, fakeFetch } from './_ramps-load.mjs';
const D = await load('./discover/index');
const H = await load('./discover/help');
const S = await load('./sentiment/index');

const P = (o) => ({ name: 'Proto', slug: 'proto', url: 'https://proto.example/', logo: 'https://icons.llama.fi/proto.png', description: 'A protocol', category: 'Dexs', chains: ['Ethereum'], tvl: 1000, change_1d: 1, change_7d: 2, listedAt: 1700000000, twitter: 'proto', symbol: 'PRO', ...o });
const BODY = [
  P({ name: 'Uniswap V3', slug: 'uniswap-v3', tvl: 5e9, category: 'Dexs', chains: ['Ethereum', 'Base', 'Arbitrum'], change_7d: 3 }),
  P({ name: 'Aave V3', slug: 'aave-v3', tvl: 9e9, category: 'Lending', chains: ['Ethereum', 'Polygon'], change_7d: -1 }),
  P({ name: 'Lido', slug: 'lido', tvl: 2e10, category: 'Liquid Staking', chains: ['Ethereum'], change_7d: 1 }),
  P({ name: 'Binance CEX', slug: 'binance-cex', category: 'CEX', tvl: 9e10 }),
  P({ name: 'EvilHttp', slug: 'evil-http', url: 'http://evil.example/' }),
  P({ name: 'EvilJs', slug: 'evil-js', url: 'javascript:alert(1)' }),
  P({ name: '<img src=x onerror=alert(1)>Hax', slug: 'hax', url: 'https://hax.example/', description: '<script>alert(1)</script>Text', tvl: 3e6, logo: 'javascript:1' }),
  P({ name: 'NoSlug', slug: '../../x' }), P({ name: 'Chain', slug: 'eth-chain', category: 'Chain' }),
  P({ name: 'NewThing', slug: 'new-thing', tvl: 500000, listedAt: 1799999999, category: 'Gaming' }),
  ...Array.from({ length: 12 }, (_, i) => P({ name: `Filler ${i}`, slug: `filler-${i}`, tvl: 1e12 + i, change_7d: -1 })),
  P({ name: 'Bridgy', slug: 'bridgy', category: 'Bridge', tvl: 7e7, change_7d: 5, chains: ['Solana'] }),
  null, 'x',
];

test('mapProtocols: https-only sites, CEX/Chain removed, text sanitised, sorted by TVL', () => {
  const m = D.mapProtocols(BODY);
  const ids = m.map((d) => d.id);
  assert.deepEqual(ids.slice(12, 15), ['lido', 'aave-v3', 'uniswap-v3']);
  for (const bad of ['binance-cex', 'evil-http', 'evil-js', 'eth-chain']) assert.ok(!ids.includes(bad), bad);
  assert.ok(!ids.includes('../../x'));
  const hax = m.find((d) => d.id === 'hax'); assert.equal(hax.name, 'Hax'.padStart(3)); // tags stripped
  assert.ok(!/[<>]/.test(hax.name + hax.desc)); assert.equal(hax.logo, ''); assert.equal(hax.desc, 'Text');
  assert.equal(m.find((d) => d.id === 'lido').categoryId, 'staking'); assert.equal(m.find((d) => d.id === 'new-thing').categoryId, 'games');
  assert.deepEqual(D.mapProtocols('nope'), []);
});
test('categories map to TW-style groups', () => {
  for (const [c, id] of [['Dexs', 'exchange'], ['DEX Aggregator', 'exchange'], ['Lending', 'lending'], ['Liquid Staking', 'staking'], ['Yield Aggregator', 'yield'], ['Bridge', 'bridge'], ['Derivatives', 'derivatives'], ['NFT Marketplace', 'nft'], ['Gaming', 'games'], ['Algo-Stables', 'stablecoins'], ['SocialFi', 'social'], ['Whatever', 'other'], [undefined, 'other']]) assert.equal(D.categoryId(c), id, String(c));
});
test('sections: Popular by TVL, Latest by listing date, Featured = large and growing, no overlap with top popular', () => {
  const items = D.mapProtocols(BODY); const s = D.buildSections(items, 1800000000);
  assert.deepEqual(s.map((x) => x.id), ['popular', 'latest', 'featured']);
  assert.equal(s[0].items[0].id, 'filler-11'); assert.equal(s[0].items[12].id, 'lido'); assert.equal(s[1].items[0].id, 'new-thing');
  assert.ok(s[2].items.every((d) => d.tvl >= 25e6 && d.change7d > 0)); assert.ok(s[2].items.some((d) => d.id === 'bridgy'));
  assert.ok(!s[2].items.some((d) => s[0].items.slice(0, 10).some((p) => p.id === d.id)));
});
test('filter: category, chain, ranked search', () => {
  const items = D.mapProtocols(BODY);
  assert.deepEqual(D.filterDapps(items, { categoryId: 'lending' }).map((d) => d.id), ['aave-v3']);
  assert.ok(D.filterDapps(items, { chain: 'base' }).every((d) => d.chains.includes('Base')));
  assert.equal(D.filterDapps(items, { query: 'uni' })[0].id, 'uniswap-v3'); assert.equal(D.filterDapps(items, { query: 'zzzzz' }).length, 0);
  assert.equal(D.filterDapps(items, { query: 'lend' })[0].id, 'aave-v3'); // category match
  assert.equal(D.filterDapps(items, { categoryId: 'all' }).length, items.length);
});
test('chains: top by TVL, mapped to Harbour chain ids', () => {
  const c = D.mapChains([{ name: 'Ethereum', tvl: 100 }, { name: 'Binance', tvl: 50 }, { name: 'Obscure', tvl: 1 }, { name: 'Bad' }, null]);
  assert.deepEqual(c.map((x) => [x.name, x.chainId]), [['Ethereum', 'ethereum'], ['Binance', 'smartchain'], ['Obscure', undefined]]);
  assert.equal(D.llamaChainName('smartchain'), 'Binance'); assert.equal(D.harbourChainFor('Avalanche'), 'avalanchec');
});
test('loadDapps: fetches once, serves cache within TTL, refetches after TTL, stale on failure, error without cache', async () => {
  let store; const kv = { get: async () => store, set: async (v) => { store = v; } };
  let n = 0; const f = fakeFetch([['/protocols', () => { n++; return jsonRes(BODY); }], ['/v2/chains', () => jsonRes([{ name: 'Ethereum', tvl: 1 }])]]);
  const a = await D.loadDapps(kv, f, 1_000); assert.equal(a.ok, true); assert.equal(a.stale, false); assert.equal(n, 1); assert.equal(a.chains[0].chainId, 'ethereum');
  await D.loadDapps(kv, f, 1_000 + 3600_000); assert.equal(n, 1);
  await D.loadDapps(kv, f, 1_000 + D.DISCOVER_TTL_MS + 1); assert.equal(n, 2);
  const bad = fakeFetch([['/protocols', () => jsonRes({}, 500)]]);
  const st = await D.loadDapps(kv, bad, 1_000 + 3 * D.DISCOVER_TTL_MS); assert.equal(st.ok, true); assert.equal(st.stale, true);
  store = undefined; const e = await D.loadDapps(kv, bad, 5); assert.equal(e.ok, false); assert.match(e.error, /HTTP 500/);
  store = undefined; assert.equal((await D.loadDapps(kv, fakeFetch([['/protocols', () => jsonRes([])]]), 5)).ok, false);
  store = { at: 1, items: 'corrupt', chains: [] }; assert.equal((await D.loadDapps(kv, f, 2)).ok, true); // corrupt cache ignored
});

// ---------------------------------------------------------------- help
test('help config: https public links only; empty clears; announcements sanitised', () => {
  const cur = H.DEFAULT_HELP;
  assert.equal(H.applyHelpPatch(cur, { helpCenterUrl: 'http://x.com' }).ok, false);
  assert.equal(H.applyHelpPatch(cur, { helpCenterUrl: 'javascript:alert(1)' }).ok, false);
  assert.equal(H.applyHelpPatch(cur, { guideUrl: 'https://127.0.0.1/' }).ok, false);
  assert.equal(H.applyHelpPatch(cur, { guideUrl: 5 }).ok, false);
  const ok = H.applyHelpPatch(cur, { helpCenterUrl: ' https://help.example.org/en ' }); assert.equal(ok.ok, true); assert.equal(ok.config.helpCenterUrl, 'https://help.example.org/en');
  assert.equal(H.applyHelpPatch(ok.config, { helpCenterUrl: '' }).config.helpCenterUrl, '');
  assert.deepEqual(H.normalizeHelp({ helpCenterUrl: 'javascript:1', guideUrl: 'https://a.example/' }), { helpCenterUrl: '', guideUrl: 'https://a.example/', announcementsUrl: '' });
  const a = H.parseAnnouncements({ items: [{ id: 1, title: '<b>Hello</b>', body: '<script>x</script>Body', url: 'javascript:1', date: '2026-10-01' }, { title: '' }, { title: 'Newer', date: '2026-10-10', url: 'https://ok.example/p' }] });
  assert.deepEqual(a.map((x) => x.title), ['Newer', 'Hello']); assert.equal(a[1].url, ''); assert.equal(a[1].body, 'Body');
  assert.equal(H.FAQ.length > 0 && H.FAQ.every((g) => g.items.every((i) => i.q && i.a)), true);
});

// ---------------------------------------------------------------- sentiment
test('cleanText strips tags/entities/control chars/script bodies and truncates', () => {
  assert.equal(S.cleanText('<p>Hello &amp; <b>world</b> &#8211; ok</p><script>alert(1)</script><style>p{x:y}</style>'), 'Hello & world \u2013 ok');
  assert.equal(S.cleanText('&lt;script&gt;alert(1)&lt;/script&gt;'), ''); // entity-encoded script is decoded THEN stripped
  assert.equal(S.cleanText('a\u0000b\tc'), 'a b c'); assert.equal(S.cleanText(5), ''); assert.equal(S.cleanText('x'.repeat(500), 10).length, 10);
  assert.ok(!/<[a-z]/i.test(S.cleanText('<img src=x onerror=alert(1)>text')));
});
test('lexicon classifier: negation, balance, score = positives / (positives + negatives)', () => {
  assert.ok(S.lexiconScore('Bitcoin surges to record high after ETF approval') > 0.5);
  assert.ok(S.lexiconScore('Exchange hacked, users lose funds in massive exploit') < -0.5);
  assert.ok(S.lexiconScore('This is not bullish') < 0); assert.equal(S.lexiconScore('The committee met on Tuesday'), 0);
  assert.equal(S.labelFor(0.1), 'neutral'); assert.equal(S.labelFor(0.2), 'positive'); assert.equal(S.labelFor(-0.2), 'negative');
  assert.equal(S.sentimentScore({ positive: 3, negative: 3 }), 50); assert.equal(S.sentimentScore({ positive: 0, negative: 0 }), null); assert.equal(S.sentimentScore({ positive: 3, negative: 1 }), 75);
});
test('asset matching: symbols are case-sensitive, names are not, no substring false positives', () => {
  assert.equal(S.matchesAsset('ETH jumps 5%', 'ETH', 'Ethereum'), true); assert.equal(S.matchesAsset('the method works', 'ETH', 'Ethereum'), false);
  assert.equal(S.matchesAsset('Ethereum upgrade ships', 'ETH', 'Ethereum'), true); assert.equal(S.matchesAsset('$SOL to the moon', 'SOL', 'Solana'), true);
  assert.equal(S.matchesAsset('solution architects', 'SOL', 'Solana'), false); assert.equal(S.matchesAsset('', 'ETH', 'Ethereum'), false);
  assert.ok(S.sentimentAssets().some((a) => a.symbol === 'BTC')); assert.equal(S.assetName('BTC'), 'Bitcoin'); assert.equal(S.isSymbol('BTC'), true); assert.equal(S.isSymbol('BTC/../x'), false);
});
test('RSS / JSON parsers: only https links, HTML removed', () => {
  const rss = `<rss><channel><item><title><![CDATA[Bitcoin <b>surges</b>]]></title><link>https://news.example/a?x=1&amp;y=2</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Rally &amp; more</p>]]></description></item><item><title>Bad</title><link>javascript:alert(1)</link></item><item><title>Http</title><link>http://insecure.example/x</link></item></channel></rss>`;
  const r = S.parseRss(rss, 'Feed'); assert.equal(r.length, 1); assert.equal(r[0].title, 'Bitcoin surges'); assert.equal(r[0].url, 'https://news.example/a?x=1&y=2'); assert.equal(r[0].snippet, 'Rally & more'); assert.ok(r[0].at > 0);
  assert.equal(S.parseRss(5, 'x').length, 0);
  const cc = S.parseCryptoCompare({ Data: [{ id: 1, title: 'ETH up', url: 'https://cc.example/1', body: 'b', source_info: { name: 'Src' }, published_on: 1760000000 }, { title: 'x', url: 'ftp://no' }] }); assert.equal(cc.length, 1); assert.equal(cc[0].source, 'Src');
  const rd = S.parseReddit({ data: { children: [{ data: { id: 'a', title: 'BTC thoughts', permalink: '/r/Bitcoin/comments/abc/btc_thoughts/', subreddit: 'Bitcoin', created_utc: 1760000000, selftext: '<i>hi</i>' } }, { data: { title: 'nsfw', over_18: true, permalink: '/r/x/comments/1/a/' } }, { data: { title: 'evil', permalink: '//evil.example/x' } }] } });
  assert.equal(rd.length, 1); assert.equal(rd[0].url, 'https://www.reddit.com/r/Bitcoin/comments/abc/btc_thoughts/'); assert.equal(rd[0].snippet, 'hi');
  const st = S.parseStocktwits({ messages: [{ id: 5, body: 'to the moon', created_at: '2026-10-19T10:00:00Z', user: { username: 'bob_1' }, entities: { sentiment: { basic: 'Bearish' } } }, { id: 6, body: 'x', user: { username: 'a/../b' } }] });
  assert.equal(st.length, 1); assert.equal(st[0].label, 'negative'); assert.equal(st[0].labelBy, 'source'); assert.equal(st[0].url, 'https://stocktwits.com/bob_1/message/5');
});
test('fetchSentiment aggregates sources, buckets items, tolerates failing sources, dedupes', async () => {
  const f = fakeFetch([
    ['cryptocompare', () => jsonRes({ Data: [{ id: 1, title: 'Bitcoin surges to record high', url: 'https://cc.example/1', published_on: 1760000100 }, { id: 2, title: 'Bitcoin exchange hacked', url: 'https://cc.example/2', published_on: 1760000200 }] })],
    ['coindesk', () => jsonRes('<rss><channel><item><title>Bitcoin surges to record high</title><link>https://cc.example/1</link></item><item><title>Unrelated Ether news</title><link>https://cd.example/3</link></item></channel></rss>')],
    ['cointelegraph', () => jsonRes({}, 503)], ['decrypt', () => jsonRes('<rss><channel></channel></rss>')],
    ['reddit.com', () => jsonRes({ data: { children: [{ data: { id: 'a', title: 'BTC is mooning, bullish', permalink: '/r/Bitcoin/comments/abc/x/', subreddit: 'Bitcoin', created_utc: 1760000300 } }] } })],
    ['stocktwits', () => { throw new Error('blocked'); }],
  ]);
  const r = await S.fetchSentiment('btc', f, 123);
  assert.equal(r.symbol, 'BTC'); assert.equal(r.at, 123);
  assert.equal(r.positive.articles.length, 1); assert.equal(r.negative.articles.length, 1); assert.equal(r.positive.posts.length, 1); assert.equal(r.neutral.articles.length, 0);
  assert.deepEqual(r.counts, { positive: 2, neutral: 0, negative: 1 }); assert.equal(r.score, 67);
  const bad = r.sources.filter((s) => !s.ok).map((s) => s.name).sort(); assert.deepEqual(bad, ['Cointelegraph', 'StockTwits']);
  await assert.rejects(S.fetchSentiment('BTC/../x', f), /Invalid/);
  const empty = await S.fetchSentiment('BTC', async () => { throw new Error('offline'); }); assert.equal(empty.score, null); assert.ok(empty.sources.every((s) => !s.ok));
});
