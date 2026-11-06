# 37 Discover, Market sentiment, Help (spec and deviations)
Tags: [certain] [likely] [guessing] UNKNOWN. All live endpoints LIVE-UNVERIFIED.

## TW flows
- DApps feed `FetchDappDiscovery` -> sections[{id,name,items}] (Popular, Latest, Featured) plus categories and search, from the TW gateway (auth-gated, not used) [certain].
- Market sentiment: News Articles and Social Posts tabs with Negative/Neutral/Positive buckets [likely]. Help: Help Center / Support links, announcements [likely].

## Harbour implementation
- Directory: DeFiLlama `api.llama.fi/protocols` and `/v2/chains` (no key). Popular = top TVL, Latest = newest listings, Featured = large and growing (deviation). Categories mapped from DeFiLlama categories. Cached in storage (`wallet:discover:v1`, TTL 6h, stale-on-error). Detail sheet with Open in a new tab (https only). Used by Discover and SearchScreen's DApps tab.
- Sentiment: CryptoCompare news, RSS feeds, Reddit, Stocktwits; text sanitised (tags/script stripped, entities decoded), https-only links; labels from the source where given else a keyword lexicon (marked "estimated"). Score = positive / (positive + negative). 15 min cache. Source status shown per source.
- Help: FAQ from Harbour copy, configurable Help Center / Support / announcements-feed URLs (https only, stored in `wallet:help:config`).

## Deviations and gaps
- TW "Top 100" tab is "Popular" here. No TW announcements public equivalent: user-supplied JSON feed or documented gap.
- Sentiment sources' response shapes unverified live; some may block extension origins (CORS/host permissions) [guessing].
- No in-app dApp browser; Open launches a new tab.
