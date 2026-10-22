# Recovered API client contracts — supplied v26.41.0

[certain, CODE-CONFIRMED] Exact method bodies below are extracted from REA/Wakaru recovered output. See source locations, original byte mappings in discovery.json, and REA manifests. Synthetic recovery names and runtime equivalence remain unknown. Public methods being bundled does not establish UI reachability. Decorators and interceptors can alter error/retry behavior; see the main backend document.

## transformTransaction

Source: [recovery/background-05/modules/bundle.js:2594](recovery/background-05/modules/bundle.js#L2594); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async transformTransaction(ae, pe) {
            logger_default.debug("Sending transform request");
            const ye = ae === WIZARD_TYPE.SIMULATION ? "simulate" : "visualize";
            const es = await fetch$2.post(`${API_BASE_URL}/v1/wizard/${ye}`, pe);
            logger_default.debug("Data transform request done");
            if (es.data.Result.ResultError) {
                if (es.data.Result.ResultError.error_code === "1") {
                    throw new FailedSilentSimulation;
                }
                throw Error(es.data.Result.ResultError.error_message_en);
            }
            return es.data.Result.ResultSuccess;
        }
```

## updateDevice

Source: [recovery/background-05/modules/bundle.js:2607](recovery/background-05/modules/bundle.js#L2607); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async updateDevice(ae, legacy_device_id) {
            logger_default.debug("Sending device id put request");
            const ye = getSelectedBaseCurrency();
            try {
                return await fetch$2.put(`${API_GATEWAY_BASE_URL}/v2/devices/${ae}`, {
                    legacy_device_id,
                    type: "extension",
                    push_enabled: store.getState().settings.pushNotifications.isPushEnabled,
                    app_version: getRunningVersion(),
                    wallets_version: 0,
                    model_name: "",
                    language: getLanguage() ?? "en",
                    currency: ye
                });
            } catch (error) {
                logger_default.debug("Device id put request failed", error);
            }
        }
```

## getFingerprint

Source: [recovery/background-05/modules/bundle.js:2625](recovery/background-05/modules/bundle.js#L2625); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getFingerprint(identifier) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v2/devices/fingerprint`, {
                identifier,
                bundle: BUNDLE_ID,
                sr: SCREEN_RESOLUTION
            });
        }
```

## getDevice

Source: [recovery/background-05/modules/bundle.js:2632](recovery/background-05/modules/bundle.js#L2632); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getDevice(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/devices/${ae}`);
        }
```

## warningDisplayed

Source: [recovery/background-05/modules/bundle.js:2635](recovery/background-05/modules/bundle.js#L2635); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
warningDisplayed(ae) {
            return fetch$2.put(`${API_BASE_URL}/v1/devices/${ae}/metrics`, {
                version: getRunningVersion()
            });
        }
```

## registerWallet

Source: [recovery/background-05/modules/bundle.js:2640](recovery/background-05/modules/bundle.js#L2640); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
registerWallet(ae, pe, ye, operation_type, ss) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v3/devices/${ae}/wallets/${pe}/register`, {
                ...ss ? {
                    parent_wallet_id: ss
                } : {},
                operation_type,
                accounts: Object.keys(ye).map((ae)=>({
                        addresses: [
                            ye[ae].address
                        ],
                        coin: parseInt(ae, 10)
                    }))
            });
        }
```

## registerCoin

Source: [recovery/background-05/modules/bundle.js:2654](recovery/background-05/modules/bundle.js#L2654); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
registerCoin(ae, pe, ye, es) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v3/devices/${ae}/wallets/${pe}/address_association`, {
                ...es ? {
                    parent_wallet_id: es
                } : {},
                coin: ye.coin,
                address: ye.address
            });
        }
```

## getWalletMeta

Source: [recovery/background-05/modules/bundle.js:2663](recovery/background-05/modules/bundle.js#L2663); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getWalletMeta(ae, pe) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/devices/${ae}/wallets/${pe}/meta`);
        }
```

## getAssets

Source: [recovery/background-05/modules/bundle.js:2666](recovery/background-05/modules/bundle.js#L2666); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getAssets(ae, pe, ye = ITokenType.ALL, es = 0, ss = _ApiService1.DEFAULT_ASSETS_LIMIT, ns) {
            const ts = minFromBoundaries({
                floor: 1,
                ceil: ss
            }, _ApiService1.MAX_ASSETS_LIMIT);
            const rs = minFromBoundaries({
                floor: 0,
                ceil: es
            }, _ApiService1.MAX_PAGE_ALLOWED);
            const os = [
                [
                    "sortBy",
                    "market_cap"
                ],
                [
                    "type",
                    ye
                ],
                [
                    "include_pricing_info",
                    "true"
                ],
                [
                    "version",
                    _ApiService1.SEARCH_ASSETS_VERSION
                ],
                [
                    "limit",
                    ts
                ],
                [
                    "offset",
                    rs * ts
                ]
            ];
            if (pe) {
                os.unshift([
                    "exactQuery",
                    pe
                ]);
            }
            if (ns) {
                os.push([
                    "fromAsset",
                    ns
                ]);
            }
            const as = os.flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/search/assets?networks=${ae}&${as}`);
        }
```

## fetchDappDiscovery

Source: [recovery/background-05/modules/bundle.js:2716](recovery/background-05/modules/bundle.js#L2716); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
fetchDappDiscovery({ currency, walletId, deviceId }) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/discover/new`, {
                params: {
                    currency,
                    wallet_id: `m_${walletId}`,
                    device_id: deviceId,
                    content: "discover-v2",
                    source: "extension"
                }
            });
        }
```

## searchDappDiscovery

Source: [recovery/background-05/modules/bundle.js:2727](recovery/background-05/modules/bundle.js#L2727); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
searchDappDiscovery(query) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/discover/search`, {
                params: {
                    content: "dapp",
                    query,
                    source: "extension"
                }
            });
        }
```

## getAsset

Source: [recovery/background-05/modules/bundle.js:2736](recovery/background-05/modules/bundle.js#L2736); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getAsset(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/${ae}`);
        }
```

## getAssetsByIds

Source: [recovery/background-05/modules/bundle.js:2739](recovery/background-05/modules/bundle.js#L2739); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getAssetsByIds(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets?asset_ids=${ae.join(",")}`);
        }
```

## getAssetBySymbol

Source: [recovery/background-05/modules/bundle.js:2742](recovery/background-05/modules/bundle.js#L2742); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getAssetBySymbol(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/symbols/${ae}`);
        }
```

## getAssetsBySymbols

Source: [recovery/background-05/modules/bundle.js:2745](recovery/background-05/modules/bundle.js#L2745); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getAssetsBySymbols(ae) {
            const pe = ae.join(",");
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/symbols?symbols=${pe}`);
        }
```

## getAssetsPerBlockchainAddress

Source: [recovery/background-05/modules/bundle.js:2749](recovery/background-05/modules/bundle.js#L2749); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getAssetsPerBlockchainAddress(ae, pe) {
            return this.requestAssets(ae, pe);
        }
```

## getAssetsChangeFeed

Source: [recovery/background-05/modules/bundle.js:2752](recovery/background-05/modules/bundle.js#L2752); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getAssetsChangeFeed(ae, pe) {
            return this.requestAssets(ae, pe);
        }
```

## requestAssets

Source: [recovery/background-05/modules/bundle.js:2755](recovery/background-05/modules/bundle.js#L2755); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
requestAssets(ae, from_time) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/assets`, {
                assets: ae,
                from_time,
                version: _ApiService1.ASSETS_DISCOVERY_VERSION
            });
        }
```

## streamBalances

Source: [recovery/background-05/modules/bundle.js:2762](recovery/background-05/modules/bundle.js#L2762); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
streamBalances(ae, pe) {
            const ye = {
                currency: pe,
                addresses: ae
            };
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/balances/stream`, ye, {
                headers: {
                    Accept: "application/x-ndjson"
                },
                responseType: "text",
                timeout: 15000
            });
        }
```

## getBep2Assets

Source: [recovery/background-05/modules/bundle.js:2775](recovery/background-05/modules/bundle.js#L2775); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getBep2Assets() {
            return fetch$2.get("https://dex.binance.org/api/v1/tokens?limit=10000");
        }
```

## fetchAssetChart

Source: [recovery/background-05/modules/bundle.js:2778](recovery/background-05/modules/bundle.js#L2778); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchAssetChart(ae) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/market/charts/${ae.assetId}?currency=${ae.currency}&period=${ae.period}`);
        }
```

## fetchHotTokenCategories

Source: [recovery/background-05/modules/bundle.js:2781](recovery/background-05/modules/bundle.js#L2781); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchHotTokenCategories() {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/listing-categories`);
        }
```

## fetchTrendingTabs

Source: [recovery/background-05/modules/bundle.js:2784](recovery/background-05/modules/bundle.js#L2784); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchTrendingTabs() {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/tabs-config`);
        }
```

## fetchTrendingConfig

Source: [recovery/background-05/modules/bundle.js:2787](recovery/background-05/modules/bundle.js#L2787); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchTrendingConfig() {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/trending-config`);
        }
```

## fetchHotTokens

Source: [recovery/background-05/modules/bundle.js:2790](recovery/background-05/modules/bundle.js#L2790); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchHotTokens(ae, pe, ye, es, ss, ns = getSelectedBaseCurrency()) {
            const ts = [
                [
                    "version",
                    _ApiService1.HOT_TOKENS_LISTING_VERSION
                ],
                [
                    "category_id",
                    ae
                ],
                [
                    "currency",
                    ns
                ],
                [
                    "limit",
                    ye ?? 100
                ]
            ];
            if (pe) {
                ts.push([
                    "networks",
                    pe.join(",")
                ]);
            }
            if (es) {
                ts.push([
                    "sort_field",
                    es
                ]);
            }
            if (ss) {
                ts.push([
                    "sort_direction",
                    ss
                ]);
            }
            const rs = new URLSearchParams(ts.map(([ae, pe])=>[
                    String(ae),
                    String(pe)
                ]));
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/listings?${rs.toString()}`);
        }
```

## fetchMarketInfo

Source: [recovery/background-05/modules/bundle.js:2833](recovery/background-05/modules/bundle.js#L2833); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchMarketInfo(ae) {
            const pe = getSelectedBaseCurrency();
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/market/info/${ae}?currency=${pe}`);
        }
```

## fetchSimilarTokensCount

Source: [recovery/background-05/modules/bundle.js:2837](recovery/background-05/modules/bundle.js#L2837); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchSimilarTokensCount(ae) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/symbols/similar/${ae}/count`);
        }
```

## fetchSimilarTokens

Source: [recovery/background-05/modules/bundle.js:2840](recovery/background-05/modules/bundle.js#L2840); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchSimilarTokens(ae) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/symbols/similar/${ae}`);
        }
```

## getNFTCollections

Source: [recovery/background-05/modules/bundle.js:2843](recovery/background-05/modules/bundle.js#L2843); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getNFTCollections(owners, pe = 0, ye = _ApiService1.DEFAULT_NFTS_LIMIT) {
            const es = [
                [
                    "page",
                    minFromBoundaries({
                        floor: 0,
                        ceil: pe
                    }, _ApiService1.MAX_PAGE_ALLOWED)
                ],
                [
                    "pageSize",
                    minFromBoundaries({
                        floor: 1,
                        ceil: ye
                    }, _ApiService1.DEFAULT_NFTS_LIMIT)
                ],
                [
                    "exclude_spam",
                    true
                ]
            ].flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
            return await fetch$2.post(`${API_GATEWAY_BASE_URL}/v3/nft/collections?${es}`, {
                owners
            });
        }
```

## getNFTCollectionItems

Source: [recovery/background-05/modules/bundle.js:2868](recovery/background-05/modules/bundle.js#L2868); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getNFTCollectionItems(ae, pe, ye, es = 0, ss = _ApiService1.DEFAULT_NFTS_LIMIT) {
            const ns = [
                [
                    "address",
                    pe
                ],
                [
                    "page",
                    minFromBoundaries({
                        floor: 0,
                        ceil: es
                    }, _ApiService1.MAX_PAGE_ALLOWED)
                ],
                [
                    "pageSize",
                    minFromBoundaries({
                        floor: 1,
                        ceil: ss
                    }, _ApiService1.DEFAULT_NFTS_LIMIT)
                ],
                [
                    "exclude_spam",
                    true
                ]
            ].flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/nft/chains/${ye.id}/collections/${ae}/tokens?${ns}`);
        }
```

## getNFTMetadata

Source: [recovery/background-05/modules/bundle.js:2895](recovery/background-05/modules/bundle.js#L2895); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getNFTMetadata(ae, pe, ye) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/nft/chains/${ye.id}/contracts/${ae}/tokens/${pe}`);
        }
```

## buyCrypto

Source: [recovery/background-05/modules/bundle.js:2898](recovery/background-05/modules/bundle.js#L2898); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async buyCrypto(ae, pe, ye, es) {
            return await fetch$2(`${API_GATEWAY_BASE_URL}/v1/buycrypto/request/${ae}?address=${pe}&ts=${ye}&sig=${es}`);
        }
```

## buyCryptoQuote

Source: [recovery/background-05/modules/bundle.js:2901](recovery/background-05/modules/bundle.js#L2901); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
buyCryptoQuote({ coinId, amount, address, currency, twtAmount, timestamp, hexSignature }) {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v1/buycrypto/quotes/${coinId}?amount=${amount}&address=${address}&currency=${currency}&twt_amount=${twtAmount}&ts=${timestamp}&sig=${hexSignature}`);
        }
```

## buyCryptoConfig

Source: [recovery/background-05/modules/bundle.js:2904](recovery/background-05/modules/bundle.js#L2904); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async buyCryptoConfig(ae, pe, ye = true) {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v3/buycrypto/config/${ae}?wallet_id=w_${pe}&is_asset_recommendation_required=${ye}`);
        }
```

## getBuyCryptoAssets

Source: [recovery/background-05/modules/bundle.js:2907](recovery/background-05/modules/bundle.js#L2907); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getBuyCryptoAssets(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/buycrypto/assets`, {
                params: {
                    wallet_id: `m_${ae.walletId}`,
                    version: _ApiService1.SEARCH_ASSETS_VERSION,
                    query: ae.query,
                    is_recurring_buy_enabled: ae.isRecurringBuyEnabled || undefined,
                    all_network: ae.allNetwork,
                    all_limit: ae.allLimit,
                    all_offset: ae.allOffset,
                    top100_network: ae.top100Network,
                    top100_limit: ae.top100Limit,
                    top100_offset: ae.top100Offset,
                    stablecoins_network: ae.stablecoinsNetwork,
                    stablecoins_limit: ae.stablecoinsLimit,
                    stablecoins_offset: ae.stablecoinsOffset
                }
            });
        }
```

## getBuyProviderRoutes

Source: [recovery/background-05/modules/bundle.js:2926](recovery/background-05/modules/bundle.js#L2926); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getBuyProviderRoutes(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/buycrypto/${ae.assetId}/routes`, {
                params: {
                    address: ae.address,
                    wallet_id: `m_${ae.walletId}`,
                    currency: ae.currency,
                    amount: ae.amount,
                    is_binance_app_installed: ae.isBinanceAppInstalled ?? false,
                    platform: ae.platform ?? "extension",
                    twt_amount: ae.twtAmount ?? "0"
                }
            });
        }
```

## buyCryptoWidgetQuote

Source: [recovery/background-05/modules/bundle.js:2939](recovery/background-05/modules/bundle.js#L2939); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async buyCryptoWidgetQuote({ address, assetId, walletId, currency, fiatAmount }) {
            const ns = [
                [
                    "address",
                    address
                ],
                [
                    "asset_id",
                    assetId
                ],
                [
                    "wallet_id",
                    `m_${walletId}`
                ],
                [
                    "is_binance_app_installed",
                    "true"
                ]
            ];
            if (fiatAmount) {
                ns.push([
                    "fiat_amount",
                    fiatAmount.toString()
                ]);
            }
            if (currency) {
                ns.push([
                    "currency",
                    currency
                ]);
            }
            const ts = ns.flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/widget/quote?${ts}`);
        }
```

## sellCryptoQuote

Source: [recovery/background-05/modules/bundle.js:2973](recovery/background-05/modules/bundle.js#L2973); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async sellCryptoQuote({ coinId, amount, address, currency, twtAmount, timestamp, hexSignature }) {
            return await fetch$2(`${API_GATEWAY_BASE_URL}/v1/sellcrypto/quote/${coinId}?amount=${amount}&address=${address}&currency=${currency}&twt_amount=${twtAmount}&ts=${timestamp}&sig=${hexSignature}`);
        }
```

## sellCrypto

Source: [recovery/background-05/modules/bundle.js:2976](recovery/background-05/modules/bundle.js#L2976); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async sellCrypto(ae, pe, ye, es) {
            return await fetch$2(`${API_GATEWAY_BASE_URL}/v1/sellcrypto/request/${ae}?address=${pe}&ts=${ye}&sig=${es}`);
        }
```

## getCoinStatus

Source: [recovery/background-05/modules/bundle.js:2979](recovery/background-05/modules/bundle.js#L2979); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getCoinStatus(ae, pe) {
            const ye = [];
            if (pe) {
                ye.push([
                    "include_security_info",
                    true
                ]);
            }
            if (pe && getCoinId(ae) === "501") {
                ye.push([
                    "include_solana_security_info",
                    true
                ]);
            }
            return fetch$2(`${API_GATEWAY_BASE_URL}/v1/coinstatus/${ae}?${ye.flatMap(([ae, pe])=>`${ae}=${pe}`).join("&")}`);
        }
```

## getSwapPairsForBlockchain

Source: [recovery/background-05/modules/bundle.js:2995](recovery/background-05/modules/bundle.js#L2995); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getSwapPairsForBlockchain(ae) {
            return fetch$2(`${CDN_BASE_URL}/blockchains/${ae}/tokenlist.json`);
        }
```

## getStakingList

Source: [recovery/background-05/modules/bundle.js:2998](recovery/background-05/modules/bundle.js#L2998); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getStakingList() {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v1/discover/group/invest-staking?currency=USD`);
        }
```

## validateAddress

Source: [recovery/background-05/modules/bundle.js:3001](recovery/background-05/modules/bundle.js#L3001); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
validateAddress(ae, pe, type = "security_scanner") {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/validate/address`, {
                asset_id: pe,
                address: ae,
                version: 7,
                type
            });
        }
```

## validateDappUrl

Source: [recovery/background-05/modules/bundle.js:3009](recovery/background-05/modules/bundle.js#L3009); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
validateDappUrl(dapp_url) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/validate/url`, {
                dapp_url
            });
        }
```

## validateTransaction

Source: [recovery/background-05/modules/bundle.js:3014](recovery/background-05/modules/bundle.js#L3014); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
validateTransaction(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/validate/transaction`, ae).catch((ae)=>Promise.reject(markUnsupportedChain(ae)));
        }
```

## validateMessage

Source: [recovery/background-05/modules/bundle.js:3017](recovery/background-05/modules/bundle.js#L3017); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
validateMessage(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/validate/message`, ae).catch((ae)=>Promise.reject(markUnsupportedChain(ae)));
        }
```

## getTransactionHistory

Source: [recovery/background-05/modules/bundle.js:3020](recovery/background-05/modules/bundle.js#L3020); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getTransactionHistory(asset, chain, ye, es, ss, limit, ts) {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v1/txhub/txs`, {
                params: {
                    asset,
                    chain,
                    address: ye,
                    from: es,
                    to: ss,
                    limit,
                    next_token: ts
                }
            });
        }
```

## getMultipleAssetTransactionHistory

Source: [recovery/background-05/modules/bundle.js:3033](recovery/background-05/modules/bundle.js#L3033); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getMultipleAssetTransactionHistory(ae, pe, ye, es) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/txhub/bulk_history`, {
                addresses: ae,
                from: pe,
                to: ye,
                next_token: es
            });
        }
```

## togglePushNotifications

Source: [recovery/background-05/modules/bundle.js:3041](recovery/background-05/modules/bundle.js#L3041); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
togglePushNotifications(push_enabled, push_token, ye) {
            return fetch$2.put(`${API_GATEWAY_BASE_URL}/v2/devices/${ye}`, {
                push_enabled,
                ...push_enabled ? {
                    push_token
                } : {}
            });
        }
```

## updatePushNotificationTopics

Source: [recovery/background-05/modules/bundle.js:3049](recovery/background-05/modules/bundle.js#L3049); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
updatePushNotificationTopics(ae, pe) {
            return fetch$2.put(`${API_GATEWAY_BASE_URL}/v2/devices/${pe}/push-topics`, {
                ...ae
            });
        }
```

## getCentrifugoToken

Source: [recovery/background-05/modules/bundle.js:3054](recovery/background-05/modules/bundle.js#L3054); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getCentrifugoToken() {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/centrifugo-hooks/token`, {});
        }
```

## getBalanceStreamChains

Source: [recovery/background-05/modules/bundle.js:3057](recovery/background-05/modules/bundle.js#L3057); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getBalanceStreamChains() {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/balances/chains`);
        }
```

## openSwapQuoteSession

Source: [recovery/background-05/modules/bundle.js:3060](recovery/background-05/modules/bundle.js#L3060); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
openSwapQuoteSession(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/amber-api/v2/session`, ae);
        }
```

## getSwapQuoteSessionStatus

Source: [recovery/background-05/modules/bundle.js:3063](recovery/background-05/modules/bundle.js#L3063); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getSwapQuoteSessionStatus(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/amber-api/v2/session/status`, ae);
        }
```

## closeSwapQuoteSession

Source: [recovery/background-05/modules/bundle.js:3066](recovery/background-05/modules/bundle.js#L3066); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
closeSwapQuoteSession(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/amber-api/v2/session/close`, ae);
        }
```

## getSwapSettlementStatus

Source: [recovery/background-05/modules/bundle.js:3069](recovery/background-05/modules/bundle.js#L3069); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getSwapSettlementStatus(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/amber-api/v1/history/status`, {
                params: {
                    stepId: bareStepId(ae)
                }
            });
        }
```

## commitSwapQuoteSessionStep

Source: [recovery/background-05/modules/bundle.js:3076](recovery/background-05/modules/bundle.js#L3076); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
commitSwapQuoteSessionStep(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/amber-api/v2/route/step`, ae);
        }
```

## fetchMarketSentimentSupportedCrypto

Source: [recovery/background-05/modules/bundle.js:3079](recovery/background-05/modules/bundle.js#L3079); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
fetchMarketSentimentSupportedCrypto() {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/market/sentiment-assets`);
        }
```

## fetchMarketSentiment

Source: [recovery/background-05/modules/bundle.js:3082](recovery/background-05/modules/bundle.js#L3082); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
fetchMarketSentiment(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/market/sentiment/${ae}`);
        }
```

## getAnnouncements

Source: [recovery/background-05/modules/bundle.js:3085](recovery/background-05/modules/bundle.js#L3085); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
getAnnouncements(ae, pe) {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v2/announcements?strategy=prioritize_app_update&version=${ae}&platform=extension&device_id=${pe}`);
        }
```

## setSeenAnnouncements

Source: [recovery/background-05/modules/bundle.js:3088](recovery/background-05/modules/bundle.js#L3088); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
setSeenAnnouncements(device_id, announcement_ids) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v2/announcements/seen`, {
                device_id,
                announcement_ids
            });
        }
```

## fetchCexFundingAssets

Source: [recovery/background-05/modules/bundle.js:3094](recovery/background-05/modules/bundle.js#L3094); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
fetchCexFundingAssets(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/cex-transfer/providers/${ae}/assets`);
        }
```

## fetchCexFundingLink

Source: [recovery/background-05/modules/bundle.js:3097](recovery/background-05/modules/bundle.js#L3097); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
fetchCexFundingLink(ae, assetID, walletAddress, es, ss, platform) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/cex-transfer/providers/${ae}`, {
                params: {
                    assetID,
                    ts: ss,
                    walletAddress,
                    sig: es,
                    platform,
                    redirectUrl: "trust%3A%2F%2F"
                },
                paramsSerializer: {
                    encode: (ae)=>ae
                }
            });
        }
```

## fetchCexFundingTransferStatus

Source: [recovery/background-05/modules/bundle.js:3112](recovery/background-05/modules/bundle.js#L3112); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
fetchCexFundingTransferStatus(ae, pe) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/cex-transfer/providers/${ae}/transactions/${pe}`);
        }
```

## fetchTrendingTokens

Source: [recovery/background-05/modules/bundle.js:3115](recovery/background-05/modules/bundle.js#L3115); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
fetchTrendingTokens(ae, pe, ye) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/homepage`, {
                params: {
                    wallet_id: `m_${ae}`,
                    user_type: "new",
                    coins: pe.join(","),
                    currency: ye,
                    version: 0
                }
            });
        }
```

## lookupDomainName

Source: [recovery/background-05/modules/bundle.js:3126](recovery/background-05/modules/bundle.js#L3126); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async lookupDomainName(name, coin) {
            try {
                const ye = await fetch$2.get(`${NAMING_API_BASE_URL}/v1/lookup`, {
                    params: {
                        name,
                        coin
                    }
                });
                if (ye.data.address) {
                    return {
                        address: ye.data.address,
                        memo: ye.data.memo
                    };
                }
                return null;
            } catch (error) {
                logger_default.debug("Domain name lookup failed", {
                    name,
                    coin,
                    error
                });
                return null;
            }
        }
```

## fetchApprovals

Source: [recovery/background-05/modules/bundle.js:3150](recovery/background-05/modules/bundle.js#L3150); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchApprovals(ae) {
            return await fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/approvals/scan`, ae);
        }
```

## fetchFundingMethods

Source: [recovery/background-05/modules/bundle.js:3153](recovery/background-05/modules/bundle.js#L3153); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async fetchFundingMethods() {
            const { data } = await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/screens/funding`);
            return data;
        }
```

## getUserVipTierData

Source: [recovery/background-05/modules/bundle.js:3157](recovery/background-05/modules/bundle.js#L3157); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getUserVipTierData(ae) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/points/${ae}/vip`);
        }
```

## getP2PBuyCryptoConfig

Source: [recovery/background-05/modules/bundle.js:3160](recovery/background-05/modules/bundle.js#L3160); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getP2PBuyCryptoConfig(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/p2p/config`, {
                params: {
                    wallet_id: `m_${ae}`
                }
            });
        }
```

## getP2PBuyCryptoQuotes

Source: [recovery/background-05/modules/bundle.js:3167](recovery/background-05/modules/bundle.js#L3167); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getP2PBuyCryptoQuotes(ae, pe, amount, es, ss) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/p2p/quotes`, {
                params: {
                    wallet_id: `m_${ae}`,
                    asset_id: pe,
                    amount,
                    currency: es,
                    address: ss
                }
            });
        }
```

## getP2PBuyCryptoCheckout

Source: [recovery/background-05/modules/bundle.js:3178](recovery/background-05/modules/bundle.js#L3178); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async getP2PBuyCryptoCheckout(id, pe, ye, es) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/p2p/checkout`, {
                params: {
                    id,
                    address: pe,
                    ts: ye,
                    sig: es
                }
            });
        }
```

## recurringBuyCheckout

Source: [recovery/background-05/modules/bundle.js:3188](recovery/background-05/modules/bundle.js#L3188); Evidence `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc`.

```javascript
async recurringBuyCheckout(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/buycrypto/route/recurring/checkout`, {
                wallet_id: `m_${ae.walletId}`,
                address: ae.address,
                asset_id: ae.assetId,
                fiat_currency: ae.fiatCurrency,
                fiat_amount: ae.fiatAmount,
                frequency: ae.frequency,
                ...ae.chargeMonthDay != null && {
                    charge_month_day: ae.chargeMonthDay
                },
                ...ae.chargeWeekDay != null && {
                    charge_week_day: ae.chargeWeekDay
                }
            });
        }
```

