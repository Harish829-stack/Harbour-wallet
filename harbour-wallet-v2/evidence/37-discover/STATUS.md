# 37 Discover status
Verification: tsc clean (except unrelated ImportSecret), `npm test` all pass with mocked fetch. Live-unverified, no visual QA.

| Screen / flow | Status | Note |
|---|---|---|
| Discover (`discover`) sections, categories, chain filter, search | Real | DeFiLlama |
| DApp detail sheet + Open | Real | https only |
| SearchScreen DApps tab | Real | uses DappsPanel |
| Market sentiment (`marketSentiment`) | Partial | public sources, lexicon fallback, no entry point from token detail yet |
| Help (`help`) FAQ, links | Real | links configurable |
| Announcements | Partial | user-configured feed only |
| TW "Top 100" tab | Gap | shown as Popular |
