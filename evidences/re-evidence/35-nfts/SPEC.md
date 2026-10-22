# 35 NFTs — SPEC
Evidence: chunks `nft-collection-DrcRadTj.js`, `nft-item-BRbZMTFu.js`, `nft-reported-collections-QkuxYamZ.js`, `EmptyList-D0dVloH1.js`, `useNFT*.js`; HAR `POST /v3/nft/collections (exclude_spam,page,pageSize)` (gateway, not used).
## TW behaviour [verified from code]
- Collections: 2-col virtual grid; tile = media (preview/original fallback), network badge, name, owned count; filtered by selected network; reported ids per wallet (`nft.reportedByWallet`).
- Collection page: 3-col infinite grid of items (`loadCachedItems`, `initPage`); empty = `nft-collection.nothing-bought` + Receive.
- Reported collections page: title `nft-reported-collections.hidden-collections`, empty `nft-collection.nothing-hidden`; opens collection with `origin=reported`.
- Item page: media, name, Send (only ethereum/solana blockchains) → `/send/:collectionId/:nftId`, "View on OpenSea" (probes opensea URL first), Description (collapsible), rows Network / Contract address / Token ID (copy) / Type / Balance, Attributes 2-col cards (+rarity text).
## Harbour (public data)
Blockscout v2 (`/api/v2/addresses/{a}/nft/collections`, `/nft`) for 15 EVM chains; Solana DAS getAssetsByOwner on configured RPC, fallback Magic Eden v2 (may need API key). Media sanitised (`core/nfts/media.ts`): ipfs/ar → public gateways, https + data:image only, `<img referrerPolicy=no-referrer>`. Hide/report (+ heuristic spam default-hidden, reversible) persisted in `local` `nfts:reports:v1` per wallet. Deviations: no OpenSea probe (link shown for supported chains); Send goes to Harbour's own `nftSend` (ERC-721/1155 safeTransferFrom via viem; classic SPL NFTs via wallet-core) because `send` flow files belong to another worker; no floor price (no public source wired); BSC/Avalanche/etc have no indexer wired (Gap).
