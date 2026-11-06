# REA recovery — Search / DApps / Network filter (2026-10-16)

Recovered with the same engine the prior evidence used: Wakaru 1.14.0 (@wakaru/cli),
the provider behind REA `recover_javascript_sources`. This session's REA wrapper had no
REA_WAKARU_COMMAND configured, so the engine was run directly on the shipped TW chunks.

Source chunks (Trust Wallet extension v26.41.0, artifacts/reference-26.41.0/chunks/):
- manage-crypto-CZfZXrkn.js  -> 19-search-manage-crypto/bundle.js  (Search screen: Crypto+DApps tabs, asset toggles, dapp discovery)
- dapps-D5KacSOR.js          -> 20-dapp-discovery/bundle.js         (message-type map incl. FetchDappDiscovery)
- HorizontalNetworksFilter-D_mSA3oc.js -> 21-network-filter/bundle.js (network chip row + Select-network modal)

Key recovered facts implemented in Harbour:
- Search = tabs Crypto|DApps; Crypto placeholder "Token name or contract address",
  DApps placeholder "Search DApps"; top-right "+" (Crypto only).
- Asset row has a Switch bound to isShownInHomeScreen; toggle emits SET_HOME_OVERRIDE show/hide.
- HorizontalNetworksFilter: "All" + popular chips + a count button opening a searchable
  "Select network" modal (All Networks + Popular/A-Z groups, radios).
- DApp discovery: sections[{id,name,items[{id,name,description,image,url}]}] + searchResults;
  DappRow truncates description to 74 chars; error "DApps are unavailable right now".
