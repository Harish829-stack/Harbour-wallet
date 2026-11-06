const store = {
    dispatch () {},
    getState: ()=>({})
};
const logger_default = {
    error () {},
    warn () {},
    info () {},
    debug () {}
};
class AssetService {
    onApplicationShutdown() {
        this.assetPoller.stopAndRemoveListeners();
    }
    async fetchAndPersistAssets(ae = false) {
        if (ae || await this.staleAssets()) {
            try {
                const ae = this.fetchAssets();
                const pe = getActiveWalletId();
                if (ae && ae.length > 0) {
                    logger_default.debug(`Adding ${ae.length} new assets`);
                    store.dispatch(assetSlice.actions.updateAssetsV2({
                        walletId: pe,
                        assets: ae
                    }));
                    const ye = ae.filter((ae)=>ae.isShownInHomeScreen);
                    if (ye.length > 0) {
                        this.tickerService.fetchTickers(ye).catch((ae)=>{
                            logger_default.warn("Failed to fetch tickers for newly shown assets", ae);
                        });
                    }
                }
                store.dispatch(assetSlice.actions.touchAssets());
            } catch (error) {
                logger_default.error(error);
            }
        }
    }
    async fetchAndPersistMigratableAssets() {
        if (await this.staleMigratableAssets()) {
            try {
                const { data } = await this.apiService.getBep2Assets() || {};
                if (Array.isArray(data) && data.length > 0) {
                    logger_default.debug(`Adding ${data.length} new migratable assets`);
                    const pe = data.filter((ae)=>!!ae.contract_address).map(({ contract_address, contract_decimals, symbol })=>{
                        const es = {
                            contract_decimals,
                            symbol
                        };
                        if (contract_address === "0x0000000000000000000000000000000000000000") {
                            es.coin_id = getBlockchainById(Blockchain.binance).coinId;
                        } else {
                            es.contract_address = contract_address;
                        }
                        return es;
                    });
                    store.dispatch(assetSlice.actions.updateMigratableAssets(pe));
                }
            } catch (error) {
                logger_default.error(error);
            }
        }
    }
    async onApplicationBoot() {
        (async ()=>{
            _AssetService1.auditNativeAliasRecords();
            await this.fetchAndPersistAssets();
            await this.fetchAndPersistMigratableAssets();
            this.assetPoller.start(this.fetchAndPersistAssets.bind(this));
        })().catch(logger_default.error);
    }
    static auditNativeAliasRecords() {
        const ae = getAssetsV2().filter((ae)=>isNativeAssetAlias(ae.assetId));
        if (ae.length !== 0) {
            logger_default.debug("[asset-audit] this wallet holds native-alias asset records", {
                count: ae.length,
                records: ae.map((ae)=>({
                        assetId: ae.assetId,
                        symbol: ae.symbol,
                        name: ae.name,
                        shown: ae.isShownInHomeScreen,
                        hasIcon: Boolean(ae.iconUrl)
                    }))
            });
        }
    }
    async getCoinStatusIfNeeded(ae) {
        const pe = getAssetsV2();
        const ye = getAssetsLastSync();
        const es = pe.find((pe)=>pe.assetId === ae);
        if ((new Date).getTime() - (ye || 0) >= _AssetService1.ASSETS_CACHE_LIFETIME || !es || es.isBuyCryptoEnabled === undefined || es.isSellCryptoEnabled === undefined) {
            await this.getCoinStatus(ae, true);
        }
    }
    async getCoinStatus(ae, pe) {
        const ye = getAssetsV2();
        const es = getActiveWalletId();
        return this.apiService.getCoinStatus(ae, pe).then((pe)=>{
            const ss = ye.find((pe)=>pe.assetId === ae);
            if (ss) {
                const ae = {
                    ...ss,
                    isBuyCryptoEnabled: pe.data.isBuyCryptoEnabled,
                    isSellCryptoEnabled: pe.data.isSellCryptoEnabled,
                    isSwapEnabled: pe.data.isSwapEnabled,
                    defaultSwapPair: pe.data.defaultSwapPair,
                    isSwapCrossChainEnabled: pe.data.isSwapCrossChainEnabled,
                    defaultSwapCrossChainPair: pe.data.defaultSwapCrossChainPair
                };
                store.dispatch(assetSlice.actions.updateAssetsV2({
                    walletId: es,
                    assets: [
                        ae
                    ]
                }));
            }
            return pe.data;
        }).catch(()=>logger_default.warn("Coin status not available for", ae));
    }
    async getCoinStatuses(ae) {
        const pe = getAssetsV2();
        const ye = getActiveWalletId();
        const es = ae?.length ? new Set(ae) : undefined;
        const ss = es ? pe.filter((ae)=>es.has(ae.assetId)) : pe;
        if (ss.length === 0) {
            return;
        }
        const ns = await Promise.all(ss.map((ae)=>this.apiService.getCoinStatus(ae.assetId).catch(()=>logger_default.warn("Coin status not available for", ae.assetId))));
        const ts = new Map(ns.filter(Boolean).map((ae)=>[
                ae.data.asset.asset_id,
                ae.data
            ]));
        const assets = ss.map((ae)=>{
            const pe = ts.get(ae.assetId);
            ae.isBuyCryptoEnabled = pe?.isBuyCryptoEnabled ?? false;
            ae.isSellCryptoEnabled = pe?.isSellCryptoEnabled ?? false;
            if (pe) {
                ae.isSwapEnabled = pe.isSwapEnabled;
            }
            return ae;
        });
        store.dispatch(assetSlice.actions.updateAssetsV2({
            assets,
            walletId: ye
        }));
    }
    async staleAssets() {
        const ae = getAssetsV2();
        const pe = getAssetsLastSync();
        const ye = this.appService.appIsStale();
        return ae.length === 0 || ye || (new Date).getTime() - (pe || 0) >= _AssetService1.ASSETS_CACHE_LIFETIME;
    }
    async staleMigratableAssets() {
        const { items, lastSync } = getMigratableAssets();
        const ye = this.appService.appIsStale();
        return items.length === 0 || ye || (new Date).getTime() - (lastSync || 0) >= _AssetService1.MIGRATABLE_ASSETS_CACHE_LIFETIME;
    }
    async getNonManagedAssets(ae = false) {
        const pe = getBlockchains();
        const ye = getActiveWallet();
        const es = getActiveWalletAccounts();
        if (!ye || !es) {
            return;
        }
        const ss = this.buildDiscoveryAccounts(pe, es);
        const timestamp = Date.now();
        const ts = ae || ye.assetsDiscoveryVersion !== ApiService.ASSETS_DISCOVERY_VERSION;
        const rs = await this.apiService.getAssetsPerBlockchainAddress(ss, !ts && ye.assetsLastRun ? Math.floor(ye.assetsLastRun / 1000) : 0);
        const os = rs?.data.docs ?? [];
        const { added } = this.addDiscoveredAssets(os, pe, ye.id);
        if (added.length > 0 || ts && rs) {
            store.dispatch(walletSlice.actions.updateAssetsLastRun({
                walletId: ye.id,
                timestamp,
                discoveryVersion: ApiService.ASSETS_DISCOVERY_VERSION
            }));
        }
        if (added.length > 0) {
            await this.tickerService.fetchTickers(added);
        }
    }
    async fetchAssetsChangeFeed(ae) {
        const pe = getBlockchains();
        const ye = getActiveWallet();
        const es = getActiveAccountId();
        const ss = getActiveWalletAccounts();
        if (!ye || !ss) {
            return;
        }
        const ns = await this.apiService.getAssetsChangeFeed(this.buildDiscoveryAccounts(pe, ss), Math.floor(ae / 1000));
        if (getActiveWallet()?.id !== ye.id || getActiveAccountId() !== es) {
            return;
        }
        const ts = ns.data?.docs ?? [];
        const { added, reported } = this.addDiscoveredAssets(ts, pe, ye.id);
        if (added.length > 0) {
            await this.tickerService.fetchTickers(added);
        }
        const as = ns.data?.meta?.interval_ms;
        return {
            assetIds: reported,
            intervalMs: typeof as === "number" ? as : undefined
        };
    }
    buildDiscoveryAccounts(ae, pe) {
        const ye = [];
        const es = pe[CoinId.Ethereum];
        Object.keys(ae).forEach((ss)=>{
            const ns = ae[ss];
            const ns_coinId = ns.coinId;
            if (pe[ns_coinId]) {
                ye.push(pe[ns_coinId]);
            } else if (es && isEvmChainRecord(ns)) {
                ye.push({
                    ...es,
                    coin: ns_coinId
                });
            }
        });
        return ye;
    }
    addDiscoveredAssets(ae, pe, ye) {
        const es = store.getState().asset?.assetsPerWallet?.[ye]?.itemsV2 ?? [];
        const keyOf = (ae)=>{
            if (/_t0x[0-9a-fA-F]{40}$/.test(ae)) {
                return ae.toLowerCase();
            }
            return ae;
        };
        const ss = new Map(es.map((ae)=>[
                keyOf(ae.assetId),
                ae.assetId
            ]));
        const ns = [];
        const ts = new Set;
        ae.forEach((ae)=>{
            if (isNativeAssetAlias(ae.asset_id)) {
                return;
            }
            const ye = ss.get(keyOf(ae.asset_id));
            if (ye) {
                return void ts.add(ye);
            }
            const es = this.mapTokenToAsset(ae, pe, true);
            ss.set(keyOf(es.assetId), es.assetId);
            ns.push(es);
            ts.add(es.assetId);
        });
        if (ns.length > 0) {
            store.dispatch(assetSlice.actions.setIsShownInHomeScreenBulk({
                items: ns,
                walletId: ye
            }));
        }
        return {
            added: ns,
            reported: [
                ...ts
            ]
        };
    }
    fetchAssets() {
        try {
            logger_default.debug("Fetching assets");
            const ae = getBlockchains();
            const pe = getCustomBlockchains();
            const ye = getActiveWalletAccounts();
            const es = getAssetsV2();
            const ss = getActiveWallet();
            const ns = [];
            const ts = [
                ...this.getDefaultHomescreenAssets(),
                ...this.getHardwareNativeHomescreenAssets(ss, ye, ae)
            ].filter((ae, pe, ye)=>BlockchainService.getAllowedBlockchains().includes(ae) && ye.indexOf(ae) === pe);
            const rs = Object.values(ae).filter(({ id })=>BlockchainService.getAllowedBlockchains().includes(id));
            const os = Object.values(pe);
            if (rs.length === 0) {
                return void logger_default.debug("Blockchains not persisted yet, wait");
            }
            let as;
            if (ss?.type === WalletType.PRIVATE_KEY) {
                as = rs.find((ae)=>ae.coinId === Object.values(ye ?? {})[0]?.coin);
            }
            const cs = rs.filter(({ id })=>!ts.includes(id)).filter(({ id })=>id !== as?.id).map((ae)=>this.mapNativeToAsset(ae));
            const us = os.filter(({ id })=>!ts.includes(id)).map((ae)=>this.mapNativeToAsset(ae));
            const ls = GAS_FEE_TOKEN_ASSETS;
            const ms = ts.map((ae)=>{
                const pe = rs.find(({ id })=>id === ae);
                if (!pe) {
                    logger_default.error(`Blockchain for asset ${ae} not found`);
                }
                return this.mapNativeToAsset(pe, true);
            });
            if (as) {
                ms.push(this.mapNativeToAsset(as, true));
            }
            const gs = _AssetService1.DEFAULT_HOMESCREEN_TOKENS.map((pe)=>this.mapTokenToAsset(pe, ae, true));
            ns.push(...cs, ...ms, ...gs, ...us, ...ls);
            const ds = new Map(es.map((ae)=>[
                    `${ae.blockchainId ?? ""}:${ae.address ?? ""}`,
                    1
                ]));
            const _s = ns.filter(Boolean).filter((ae)=>!ds.has(`${ae.blockchainId ?? ""}:${ae.address ?? ""}`)).map((ae)=>{
                if (!this.assetIsSupportedByWallet(ss, ae)) {
                    ae.isShownInHomeScreen = false;
                }
                return ae;
            });
            const hs = es.filter((ae)=>!ae.address && !ae.isShownInHomeScreen && ae.homeOverride?.action !== "hide" && ts.includes(ae.blockchainId) && !this.getDefaultHomescreenAssets().includes(ae.blockchainId)).map((ae)=>({
                    ...ae,
                    isShownInHomeScreen: true
                }));
            return [
                ..._s,
                ...hs
            ];
        } catch (error) {
            logger_default.error(error, "AssetService - Failed to fetch assets.");
            throw error;
        }
    }
    assetIsSupportedByWallet(ae, pe) {
        return !ae || this.walletSupportsBlockchain(ae, pe.blockchainId);
    }
    walletSupportsBlockchain(ae, pe) {
        const ye = getAccounts$3();
        const es = this.blockchainService.getCoinTypesFromBlockchain();
        if (ae.type === WalletType.HARDWARE) {
            const ae = es[pe];
            return !!ae && Boolean(ye[ae.value]);
        }
        return true;
    }
    getDefaultHomescreenAssets() {
        return _AssetService1.DEFAULT_HOMESCREEN_COINS;
    }
    getHardwareNativeHomescreenAssets(ae, pe, ye) {
        if (ae?.type !== WalletType.HARDWARE || !pe) {
            return [];
        }
        const es = new Set(Object.values(pe).map((ae)=>ae.coin));
        return Object.values(ye).filter((ae)=>es.has(ae.coinId) && !isEvmChainRecord(ae)).map((ae)=>ae.id);
    }
    mapNativeToAsset(ae, pe = false) {
        return {
            blockchainId: ae.id,
            name: ae.displayName ?? ae.name,
            symbol: ae.symbol,
            decimals: ae.decimals,
            iconUrl: this.resolveNativeIconUrl(ae),
            balance: "0",
            assetId: ae.isCustom ? crypto.randomUUID() : getAssetId({
                coinId: +(ae.coinId || ae.chainId || 0)
            }),
            isShownInHomeScreen: pe,
            isCustomAsset: ae.isCustom
        };
    }
    resolveNativeIconUrl(ae) {
        if (!ae.isCustom && isL2NativeEth({
            symbol: ae.symbol,
            blockchainId: ae.id
        })) {
            return _AssetService1.coinUri(Blockchain.ethereum);
        }
        return ae.iconUrl;
    }
    mapTokenToAsset(ae, pe, ye = false) {
        const es = new Map(Object.values(pe).map((ae)=>[
                ae.coinId,
                ae.id
            ]));
        const { address, coinId } = parseAssetId(ae.asset_id);
        const ts = es.get(coinId);
        let iconUrl;
        if (!ts) {
            logger_default.debug("[asset-map] chain did not resolve; no icon and no network for this asset", {
                assetId: ae.asset_id,
                coinId,
                networksGiven: es.size,
                hasIconFromApi: Boolean(ae.icon_url)
            });
        }
        iconUrl = ts ? address ? ae.icon_url ?? _AssetService1.tokenUri(ts, address) : isL2NativeEth({
            symbol: ae.symbol,
            blockchainId: ts
        }) ? _AssetService1.coinUri(Blockchain.ethereum) : ae.icon_url ?? _AssetService1.coinUri(ts) : ae.icon_url ?? undefined;
        return {
            blockchainId: ts ?? "",
            name: ae.name,
            address,
            symbol: ae.symbol,
            type: ae.type,
            decimals: ae.decimals,
            iconUrl,
            balance: "0",
            isShownInHomeScreen: ye,
            assetId: ae.asset_id,
            isVerified: ae.verifiers?.includes("trustwallet"),
            verifiers: ae.verifiers
        };
    }
    customBlockchainToAsset(ae) {
        return this.mapNativeToAsset(ae, true);
    }
    async getAssetDetails(ae) {
        const pe = getAssetsV2().find((pe)=>pe.assetId === ae);
        if (pe) {
            return pe;
        }
        try {
            const pe = unwrapApiData(await this.apiService.getAsset(ae), "getAsset");
            return this.mapTokenToAsset(pe, getBlockchainsByPrefixedCoinId());
        } catch (error) {
            logger_default.error(error);
            return null;
        }
    }
    async getAssetsDetails(ae) {
        if (!ae.length) {
            return [];
        }
        const pe = new Map(getAssetsV2().map((ae)=>[
                ae.assetId,
                ae
            ]));
        const ye = ae.reduce((acc, item)=>{
            const es = pe.get(item);
            if (es) {
                acc.push(es);
            }
            return acc;
        }, []);
        const es = ae.filter((ae)=>!pe.has(ae));
        if (!es.length) {
            return ye;
        }
        const ss = unwrapApiData(await this.apiService.getAssetsByIds(es), "getAssetsByIds");
        const ns = getBlockchainsByPrefixedCoinId();
        for (const ts of Array.isArray(ss) ? ss : []){
            const ae = this.mapTokenToAsset(ts, ns);
            if (ae) {
                ye.push(ae);
            }
        }
        return ye;
    }
    async fetchAssetChart(ae) {
        try {
            return (await this.apiService.fetchAssetChart(ae))?.data;
        } catch (error) {
            logger_default.error(error);
            return null;
        }
    }
    async fetchHotTokenCategories() {
        return this.hotTokenCategoriesCache.get("categories", async ()=>{
            try {
                const ae = await this.apiService.fetchTrendingTabs();
                const pe = (Array.isArray(ae?.data) ? ae.data : []).filter((ae)=>!ae.data_source).map((ae)=>({
                        id: ae.categories?.[0]?.id ?? "",
                        name: ae.tab
                    })).filter((ae)=>ae.id && ae.name);
                if (pe.length > 0) {
                    return pe;
                }
                const ye = unwrapApiData(await this.apiService.fetchHotTokenCategories(), "fetchHotTokenCategories");
                const es = Array.isArray(ye.docs) ? ye.docs : [];
                if (es.length === 0) {
                    throw new Error("Trending categories response was empty");
                }
                return es;
            } catch (error) {
                logger_default.error(error);
                throw error;
            }
        });
    }
    async fetchTrendingNetworks() {
        return this.trendingNetworksCache.get("networks", async ()=>{
            try {
                const ae = await this.apiService.fetchTrendingConfig();
                const pe = ae?.data?.supported_networks?.length ? ae.data.supported_networks : ae?.data?.trending_networks ?? [];
                if (pe.length === 0) {
                    throw new Error("Trending network configuration response was empty");
                }
                return pe;
            } catch (error) {
                logger_default.error(error);
                throw error;
            }
        });
    }
    async fetchHotTokens(ae, pe, ye, es, ss) {
        if (!ae) {
            return [];
        }
        const ns = getSelectedBaseCurrency();
        const ts = JSON.stringify([
            ns,
            ae,
            pe ? [
                ...new Set(pe)
            ].sort((ae, pe)=>ae - pe) : null,
            ye ?? 100,
            es ?? "",
            ss ?? ""
        ]);
        return this.hotTokenListingsCache.get(ts, async ()=>(unwrapApiData(await this.apiService.fetchHotTokens(ae, pe, ye, es, ss, ns), "fetchHotTokens").docs ?? []).filter((ae)=>!TRENDING_EXCLUDED_ASSET_TYPES.includes(ae.asset?.type ?? "")));
    }
    async fetchMarketFigures(ae) {
        return this.tickerService.fetchMarketFigures(ae);
    }
    async fetchMarketInfo(ae) {
        try {
            return keysToCamelCase(unwrapApiData(await this.apiService.fetchMarketInfo(ae), "fetchMarketInfo"));
        } catch (error) {
            logger_default.error(error);
            return null;
        }
    }
    async searchCoinsAndTokens(ae) {
        const { query, type, limit, page, blockchainId } = ae;
        const ts = getBlockchains();
        const rs = getActiveWallet();
        const os = blockchainId ? Object.fromEntries(Object.entries(ts).filter(([ae, pe])=>pe.id === blockchainId)) : ts;
        const as = Object.values(os).filter((ae)=>{
            if (rs?.type === WalletType.PRIVATE_KEY) {
                const pe = getActiveWalletAccounts();
                return Object.values(pe ?? {}).some((pe)=>pe.coin === ae.coinId);
            }
            return true;
        }).map((ae)=>ae.coinId).join(",");
        const cs = await this.apiService.getAssets(as, query, type, page, limit);
        if (cs) {
            const pe = cs.data?.docs.filter((ae)=>!isNativeAssetAlias(ae.asset_id)).map((ae)=>this.mapTokenToAsset(ae, os)).filter((ae)=>this.assetIsSupportedByWallet(rs, ae));
            return {
                data: pe,
                nextPage: pe.length > 0 ? ae.page + 1 : undefined
            };
        }
        return {
            data: []
        };
    }
    async search({ query, type, limit, page, networks, includeNonCustomTokenNetworks, includeExistingAssets, fromAsset }) {
        const as = getAssetsV2();
        const cs = getBlockchains();
        const us = getActiveWallet();
        const ls = getCombinedBalances();
        const ms = networks || includeExistingAssets ? [] : as.map((ae)=>ae.assetId);
        let gs = cs;
        if (networks) {
            gs = filterNetworksBy((ae)=>networks?.includes(getPrefixedCoinId(cs[ae].coinId)), gs);
        }
        if (!includeNonCustomTokenNetworks) {
            const ae = BlockchainService.getBlockchainsWithCustomTokensEnabled();
            gs = filterNetworksBy((pe)=>ae.includes(cs[pe].id), gs);
        }
        const ds = Object.values(gs).map((ae)=>ae.coinId).join(",");
        const _s = await this.apiService.getAssets(ds, query, type, page, limit, fromAsset);
        if (_s) {
            const docs = _s.data?.docs?.length ?? 0;
            const returned = [
                ...new Set((_s.data?.docs ?? []).map((ae)=>{
                    const pe = parseAssetId(ae.asset_id);
                    if (pe?.coinId == null) {
                        return "?";
                    }
                    return `c${pe.coinId}`;
                }))
            ];
            const askedFor = ds.split(",").filter(Boolean);
            const offScope = returned.filter((ae)=>!askedFor.includes(ae));
            if (offScope.length > 0) {
                logger_default.debug("[asset-search] the gateway answered OUTSIDE the network scope it was given", {
                    askedFor,
                    returned,
                    offScope,
                    docs,
                    type,
                    query: query ? "typed" : "(empty)"
                });
            }
            const rs = type === ITokenType.SWAP;
            const os = _s.data?.docs.filter(({ asset_id })=>{
                const ye = parseAssetId(asset_id);
                return !isNativeAssetAlias(asset_id) && (!ms.includes(asset_id) || docs === 1) && (ye?.address || rs && ye?.coinId != null);
            }).map((ae)=>({
                    ...this.mapTokenToAsset(ae, gs),
                    balance: ls[ae.asset_id] ?? "0",
                    marketCap: typeof ae.market_cap === "number" ? ae.market_cap : undefined,
                    volume24h: typeof ae.volume_24h === "number" ? ae.volume_24h : undefined
                })).filter((ae)=>this.assetIsSupportedByWallet(us, ae));
            if (rs && os.length > 0) {
                const ae = os.filter((ae)=>getFiat(ae.assetId) === undefined);
                if (ae.length > 0) {
                    this.tickerService.fetchTickers(ae);
                }
            }
            return {
                data: os,
                nextPage: os.length > 0 ? page + 1 : undefined,
                useOnlyBackendResults: docs === 1
            };
        }
        return {
            data: [],
            useOnlyBackendResults: false
        };
    }
    async validate(ae) {
        const pe = {
            global: true,
            symbol: {
                length: true,
                characters: true
            },
            name: {
                length: true,
                characters: true
            },
            decimals: true,
            existInDatabase: true
        };
        try {
            if (ae?.fromDB) {
                pe.existInDatabase = true;
            }
            if (!(ae?.assetId && !ae?.fromDB && (await fetch$2(_AssetService1.assetDatabaseUri(ae.assetId))).data?.asset_id)) {
                pe.existInDatabase = false;
            }
        } catch (ye) {
            pe.existInDatabase = false;
        }
        if (ae?.decimals < 0 || ae?.decimals > 25) {
            pe.decimals = false;
            pe.global = false;
        }
        if (ae?.symbol.length < 1 || ae?.symbol.length > 25) {
            pe.symbol.length = false;
            pe.global = false;
        }
        if (!ae?.symbol.match(/^[\p{L}\p{N}_\.\-$@^#'© ]+$/giu)) {
            pe.symbol.characters = false;
            pe.global = false;
        }
        if (ae?.name.length < 1 || ae?.name.length > 50) {
            pe.name.length = false;
            pe.global = false;
        }
        if (!ae?.name.match(/^[\p{L}\p{N}\p{Zs}_\.\-$@#'^()©]+$/u)) {
            pe.name.characters = false;
            pe.global = false;
        }
        return pe;
    }
    async fetchMarketSentimentSupportedCrypto() {
        const ae = unwrapApiData(await this.apiService.fetchMarketSentimentSupportedCrypto(), "fetchMarketSentimentSupportedCrypto");
        store.dispatch(assetSlice.actions.setMarketSentimentSupportedCrypto(ae));
        return ae;
    }
    async fetchMarketSentiment(ae) {
        return keysToCamelCase(unwrapApiData(await this.apiService.fetchMarketSentiment(ae), "fetchMarketSentiment"));
    }
    async fetchCexFundingAssets(ae) {
        return unwrapApiData(await this.apiService.fetchCexFundingAssets(ae), "fetchCexFundingAssets");
    }
    async fetchCexFundingLink(providerId, pe, ye, pageViewSource, ss) {
        const ns = Math.floor(Date.now() / 1000);
        const ts = `${ns}
${providerId}
${pe}
${ye}`;
        const rs = import_crypto_browserify$2.createHmac("sha256", "tw-prd-U3J$INp5Iab6").update(ts).digest("hex");
        let os = null;
        try {
            os = await this.apiService.fetchCexFundingLink(providerId, pe, ye, rs, ns, ss);
        } catch (error) {
            throw new Error(error.response?.data?.error?.message || error.message);
        }
        if (os?.data?.transferParams?.transactionID) {
            const pe = new Poller({
                interval: _AssetService1.CEX_FUNDING_TRANSFER_POLLING_INTERVAL,
                lifetime: _AssetService1.CEX_FUNDING_TRANSFER_POLLING_LIFETIME
            });
            const fetchTransactionStatus = async ()=>{
                const ye = await this.apiService.fetchCexFundingTransferStatus(providerId, os.data.transferParams.transactionID);
                if (ye?.data?.status === CexFundingTransferStatus.SUCCESS) {
                    store.dispatch(appSlice.actions.addToast({
                        id: ye.data.transactionID,
                        analyticsEvent: {
                            event: PageActionAnalyticsEvents.FUND_CEX_DEPOSIT_SUCCESS,
                            props: {
                                providerId,
                                pageViewSource
                            }
                        },
                        i18n: {
                            message: {
                                id: "cex-funding-transfer-success",
                                defaultMessage: "Funding transfer from {providerName} successful"
                            },
                            params: {
                                providerName: CEX_NAMES[providerId]
                            }
                        }
                    }));
                    pe.stop();
                }
            };
            pe.start(fetchTransactionStatus.bind(this));
        }
        return os?.data?.widgetURL;
    }
    async fetchTrendingTokens() {
        const ae = getActiveWalletId();
        const pe = Object.values(getBlockchains()).map((ae)=>getPrefixedCoinId(ae.coinId));
        const ye = getSelectedBaseCurrency();
        return keysToCamelCase(unwrapApiData(await this.apiService.fetchTrendingTokens(ae, pe, ye), "fetchTrendingTokens").content.tokens).map((ae)=>({
                ...ae,
                id: ae.id.includes("-") ? ae.id.split("-")[1] : ae.id
            }));
    }
    async persistAssets(ae) {
        const pe = getActiveWalletId();
        if (pe && ae.length !== 0) {
            try {
                store.dispatch(assetSlice.actions.updateAssetsV2({
                    walletId: pe,
                    assets: ae
                }));
                await Promise.all(ae.map((ae)=>this.tickerService.fetchTicker(ae.assetId).catch((error)=>{
                        logger_default.warn("Failed to fetch ticker", {
                            assetId: ae.assetId,
                            error
                        });
                        return null;
                    })));
            } catch (error) {
                logger_default.error("Failed to persist assets", error);
            }
        }
    }
    async fetchAndPersistTokensByAddress(ae, pe) {
        const ye = (await Promise.all(ae.map(async ({ address, symbol })=>{
            if (!address) {
                logger_default.warn("Skipping token with missing address", {
                    address,
                    symbol
                });
                return null;
            }
            try {
                const es = (await this.searchCoinsAndTokens({
                    query: address,
                    type: undefined,
                    limit: 20,
                    page: 0,
                    blockchainId: pe
                })).data?.find((pe)=>{
                    const es = pe.address?.toLowerCase() === address.toLowerCase();
                    if (symbol) {
                        return es && pe.symbol === symbol;
                    }
                    return es;
                });
                if (!es) {
                    logger_default.warn("Token not found in search results", {
                        address,
                        symbol,
                        blockchainId: pe
                    });
                }
                return es ?? null;
            } catch (error) {
                logger_default.error("Failed to search for token", {
                    address,
                    symbol,
                    blockchainId: pe,
                    error
                });
                return null;
            }
        }))).filter((ae)=>ae !== null);
        if (ye.length > 0) {
            return await this.persistAssetsWithBalances(ye, pe);
        }
        return ye;
    }
    async persistAssetsWithBalances(ae, pe) {
        await this.persistAssets(ae);
        try {
            const ye = getBlockchainById(pe);
            const es = getAccounts$3();
            const accountId = getActiveAccountId();
            const ns = getActiveWalletId();
            if (!es || !accountId || !ns) {
                logger_default.warn("No account or wallet found, skipping balance fetch", {
                    blockchainId: pe
                });
                return ae;
            }
            const balances = await this.balanceServiceManager.fetchTokensBalance(ye, es, ae);
            if (balances && balances.length > 0) {
                store.dispatch(walletSlice.actions.setBalances({
                    walletId: ns,
                    accountId,
                    balances
                }));
                return ae.map((ae, pe)=>({
                        ...ae,
                        balance: balances[pe]?.balance || ae.balance
                    }));
            }
            return ae;
        } catch (error) {
            logger_default.error("Failed to fetch balances for new tokens", {
                assets: ae,
                blockchainId: pe,
                error
            });
            return ae;
        }
    }
    constructor(){
        this.hotTokenListingsCache = new SuccessTtlCache(_AssetService1.HOT_TOKEN_LISTINGS_CACHE_LIFETIME, 32);
        this.hotTokenCategoriesCache = new SuccessTtlCache(_AssetService1.TRENDING_CONFIG_CACHE_LIFETIME, 1);
        this.trendingNetworksCache = new SuccessTtlCache(_AssetService1.TRENDING_CONFIG_CACHE_LIFETIME, 1);
        this.assetPoller = new Poller({
            interval: _AssetService1.POLL_ASSET_INTERVAL
        });
    }
}
