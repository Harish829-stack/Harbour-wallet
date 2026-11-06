const __x = class TransactionHistoryService {
    async fetchTransactionHistory({ asset, blockchain, accountAddress, from, to, limit, nextToken }) {
        const rs = await this.apiService.getTransactionHistory(asset.assetId, blockchain.id, accountAddress, from, to, limit, nextToken);
        if (!rs) {
            return {
                chainUnsupported: true
            };
        }
        const transactions = (await this.mapTransactions(rs?.data?.data ?? [], asset, blockchain)).filter(Boolean);
        return {
            transactions,
            nextToken: rs?.data?.meta?.next_token,
            emptyPeriodFetched: !transactions.length
        };
    }
    async fetchBulkTransactionHistory({ addresses, from, to, nextToken }) {
        const ss = await this.apiService.getMultipleAssetTransactionHistory(addresses, from, to, nextToken);
        return {
            transactions: (await Promise.all(this.mapBulkTransactions(ss?.data?.data ?? []))).flat(),
            nextToken: ss?.data?.meta?.next_token,
            unsupportedChains: ss?.data?.meta?.unsupported_chains,
            failed: !ss
        };
    }
    assertWindowFetched(ae, pe, ye) {
        if (ae.failed) {
            throw new Error(`History walk aborted: txhub bulk_history failed for ${pe} → ${ye}`);
        }
    }
    async walkBulkTransactionHistory({ addresses, from, to, nextToken, maxWindows, floor }) {
        if (nextToken) {
            const ss = await this.fetchBulkTransactionHistory({
                addresses,
                from,
                to,
                nextToken
            });
            this.assertWindowFetched(ss, from, to);
            return {
                ...ss,
                from,
                to,
                windowsScanned: 1,
                exhausted: false
            };
        }
        const ts = new Date(floor);
        let unsupportedChains;
        let from_1 = new Date(from);
        let to_1 = new Date(to);
        let windowsScanned = 0;
        let us = {
            from: from_1,
            to: to_1
        };
        while(windowsScanned < maxWindows && from_1 > ts){
            const pe = windowsScanned === 0 ? 1 : 3;
            const ye = [];
            while(ye.length < Math.min(pe, maxWindows - windowsScanned) && from_1 > ts){
                ye.push({
                    from: from_1,
                    to: to_1
                });
                from_1 = to_1;
                to_1 = getDateDaysAgo(to_1, 29);
            }
            const es = await Promise.all(ye.map((pe)=>this.fetchBulkTransactionHistory({
                    addresses,
                    from: pe.from.toISOString(),
                    to: pe.to.toISOString()
                })));
            es.forEach((ae, pe)=>this.assertWindowFetched(ae, ye[pe].from.toISOString(), ye[pe].to.toISOString()));
            windowsScanned += ye.length;
            us = ye[ye.length - 1];
            for(let ae = 0; ae < es.length; ae++){
                unsupportedChains ??= es[ae].unsupportedChains;
                if (es[ae].transactions?.length) {
                    return {
                        ...es[ae],
                        unsupportedChains,
                        from: ye[ae].from.toISOString(),
                        to: ye[ae].to.toISOString(),
                        windowsScanned: windowsScanned - (es.length - 1 - ae),
                        exhausted: false
                    };
                }
            }
        }
        return {
            transactions: [],
            nextToken: undefined,
            unsupportedChains,
            from: us.from.toISOString(),
            to: us.to.toISOString(),
            windowsScanned,
            exhausted: true
        };
    }
    mapBulkTransactions(ae) {
        return ae.map(async (ae)=>{
            try {
                const pe = new Set(ae.events.filter((ae)=>this.isAirdropCandidate(ae)));
                const ye = await this.getAssetFromEvents(ae.events);
                if (!ye) {
                    logger_default.error("Asset not found on the server", ae.events);
                    return [];
                }
                const es = (await Promise.all(ae.events.map((ae)=>this.mapTransactionEvent(ae, ye, pe)))).filter(Boolean);
                if (!es.length) {
                    logger_default.error("Transaction events unable to be parsed", ae.events);
                    return [];
                }
                const ss = store.getState().blockchains.items[ae.chain];
                const ns = ae.fees.length > 0 ? getAssetV2ByAssetId(ae.fees[0].asset) : undefined;
                return [
                    {
                        hash: ae.hash,
                        assetId: ye.assetId,
                        blockchain: {
                            id: ss.id,
                            isCustom: ss.isCustom
                        },
                        status: TxHubItemTransferStatusMap[ae.status],
                        createdAt: new Date(ae.created_at).getTime(),
                        fee: ae.fees.map((ae)=>this.getFee(ae, ss)),
                        feeAsset: ns,
                        symbol: ye.symbol,
                        locale: store.getState().settings.locale,
                        events: es
                    }
                ];
            } catch (error) {
                logger_default.error("Failed to map transaction", ae.hash, error);
                return [];
            }
        });
    }
    getFee(ae, pe) {
        const ye = getAssetV2ByAssetId(ae.asset);
        return formatTokenFrom(ae.value, ye?.decimals ?? pe.decimals).toString();
    }
    isAirdropCandidate(ae) {
        if (ae.type !== TxHubItemEventType.transfer) {
            return false;
        }
        const { asset, to, from } = ae.data;
        if (!asset?.includes("_t")) {
            return false;
        }
        const ss = getAssetsV2Map();
        let ns = ss.get(asset);
        if (!ns) {
            const ae = asset.toLowerCase();
            for (const pe of ss.values()){
                if (pe.assetId.toLowerCase() === ae) {
                    ns = pe;
                    break;
                }
            }
        }
        if (ns && (ns.isShownInHomeScreen || Number(ns.balance) > 0)) {
            return false;
        }
        const ts = getActiveWalletAccount(getCoinId(asset))?.address?.toLowerCase();
        return !!ts && to?.toLowerCase() === ts && from?.toLowerCase() !== ts;
    }
    async mapTransactions(ae, pe, ye) {
        const { settings } = store.getState();
        const ss = ae.map(async (ae)=>{
            try {
                const ss = (await Promise.all(ae.events.map((ae)=>this.mapTransactionEvent(ae, pe)))).filter(Boolean);
                if (!ss.length) {
                    logger_default.error("Transaction events unable to be parsed", ae.events);
                    return null;
                }
                const ns = ae.fees.length > 0 ? getAssetV2ByAssetId(ae.fees[0].asset) : undefined;
                return {
                    hash: ae.hash,
                    assetId: pe.assetId,
                    blockchain: {
                        id: ye.id,
                        isCustom: ye.isCustom
                    },
                    status: TxHubItemTransferStatusMap[ae.status],
                    createdAt: new Date(ae.created_at).getTime(),
                    fee: ae.fees.map((ae)=>this.getFee(ae, ye)),
                    feeAsset: ns,
                    symbol: pe.symbol,
                    locale: settings.locale,
                    events: ss
                };
            } catch (error) {
                logger_default.error("Failed to map transaction", ae.hash, error);
                return null;
            }
        });
        return await Promise.all(ss);
    }
    async getAssetFromEvents(ae) {
        const pe = getAssetsV2Map();
        const ye = getActiveWalletId();
        let es;
        const ss = [];
        const resolve = async (ae)=>{
            const ye = pe.get(ae) ?? ss.find((pe)=>pe.assetId === ae);
            if (ye) {
                return ye;
            }
            const es = await this.assetService.getAssetDetails(ae);
            if (es) {
                ss.push(es);
                return es;
            }
            logger_default.error("Asset not found on the server", ae);
        };
        for (const ns of ae){
            const ae = ns.data;
            const pe = ae.asset || ae.sent?.asset;
            if (pe) {
                es = await resolve(pe) ?? es;
            }
            const ye = ae.received?.asset;
            if (ye) {
                await resolve(ye);
            }
        }
        _TransactionHistoryService.dispatchPendingAutoEnable(ss, ye);
        return es;
    }
    static markPendingAutoEnable(ae) {
        return {
            ...ae,
            pendingAutoEnable: true
        };
    }
    static dispatchPendingAutoEnable(ae, walletId) {
        const ye = getAssetsV2Map();
        const es = ae.filter((ae)=>!ye.has(ae.assetId));
        if (es.length) {
            store.dispatch(assetSlice.actions.updateAssetsV2({
                walletId,
                assets: es.map(_TransactionHistoryService.markPendingAutoEnable)
            }));
        }
    }
    async mapTransactionEvent(ae, pe, ye = new Set) {
        const es = getAssetsV2Map();
        const ss = getActiveWalletId();
        const ns = getActiveWalletAccount(getCoinId(pe.assetId));
        switch(ae.type){
            case TxHubItemEventType.token_approval:
                const pe = await this.assetService.getAssetDetails(ae.data.asset);
                if (!pe) {
                    return void logger_default.error("Asset not found on the server when loading approval history", ae.data.asset);
                }
                const ts = formatTokenFrom(ae.data.amount, pe.decimals).toString();
                return {
                    type: TRANSACTION_TYPE$4.Approve,
                    metadata: {
                        from: ae.data.owner,
                        to: ae.data.spender,
                        value: ts,
                        assetId: ae.data.asset,
                        isUnlimited: ae.data.is_unlimited
                    }
                };
            case TxHubItemEventType.token_revoke:
                return {
                    type: TRANSACTION_TYPE$4.Revoke,
                    metadata: {
                        from: ae.data.owner,
                        to: ae.data.spender,
                        assetId: ae.data.asset
                    }
                };
            case TxHubItemEventType.swap:
                const rs = ae.data.sent.asset;
                const os = ae.data.received.asset;
                let as = es.get(rs);
                let cs = es.get(os);
                if (!as) {
                    const ae = await this.assetService.getAssetDetails(rs);
                    if (ae) {
                        _TransactionHistoryService.dispatchPendingAutoEnable([
                            ae
                        ], ss);
                        as = ae;
                    }
                }
                if (!cs) {
                    const ae = await this.assetService.getAssetDetails(os);
                    if (ae) {
                        _TransactionHistoryService.dispatchPendingAutoEnable([
                            ae
                        ], ss);
                        cs = ae;
                    }
                }
                if (as || cs) {
                    if (cs) {
                        if (as) {
                            return {
                                type: TRANSACTION_TYPE$4.Swap,
                                metadata: {
                                    from: ae.data.from,
                                    to: ae.data.to,
                                    sent: {
                                        assetId: rs,
                                        value: formatTokenFrom(ae.data.sent.value, as.decimals).toString()
                                    },
                                    received: {
                                        assetId: os,
                                        value: formatTokenFrom(ae.data.received.value, cs.decimals).toString()
                                    }
                                }
                            };
                        }
                        return {
                            type: TRANSACTION_TYPE$4.Receive,
                            metadata: {
                                from: ae.data.from,
                                to: ae.data.to,
                                value: formatTokenFrom(ae.data.received.value, cs.decimals).toString(),
                                assetId: os
                            }
                        };
                    }
                    return {
                        type: TRANSACTION_TYPE$4.Send,
                        metadata: {
                            from: ae.data.from,
                            to: ae.data.to,
                            value: formatTokenFrom(ae.data.sent.value, as.decimals).toString(),
                            assetId: rs
                        }
                    };
                }
                return void logger_default.error("Swap assets not found on the server", rs, os);
            default:
                const us = await this.assetService.getAssetDetails(ae.data.asset);
                if (!us) {
                    return void logger_default.error("Asset not found on the server when loading history", ae.data.asset);
                }
                const ls = us.decimals;
                const ms = formatTokenFrom(ae.data.value, ls).toString();
                const direction = ae.data.direction;
                const input = ae.data.input;
                let _s = TxHubItemTransferTypeMap[ae.type];
                if (_s === TRANSACTION_TYPE$4.Send && ae.data.to === ns?.address && ae.data.from !== ns?.address) {
                    _s = TRANSACTION_TYPE$4.Receive;
                }
                return {
                    type: _s,
                    metadata: {
                        from: ae.data.from,
                        to: ae.data.to,
                        value: ms,
                        assetId: ae.data.asset,
                        ...direction && {
                            direction
                        },
                        ...input && {
                            input
                        },
                        ...ye.has(ae) && {
                            airdrop: true
                        }
                    }
                };
        }
    }
    async fetchAllChainsTransactionsRecursively(ae, pe = []) {
        try {
            const ye = await this.fetchBulkTransactionHistory(ae);
            if (ye.transactions) {
                pe.push(...ye.transactions);
            } else {
                this.recursiveMultipleChainCallFailed = true;
            }
            if (ye.nextToken) {
                await this.fetchAllChainsTransactionsRecursively({
                    ...ae,
                    nextToken: ye.nextToken
                }, pe);
            }
            return pe;
        } catch (ye) {
            this.recursiveMultipleChainCallFailed = true;
            return [];
        }
    }
    async fetchAllChainsMissingTransactions(ae) {
        this.recursiveMultipleChainCallFailed = false;
        let pe = new Date(ae.from);
        const ye = new Date(ae.to);
        const es = getActiveWalletId();
        const accountId = getActiveAccountId();
        const ns = getAllChainsFetchedTransactionPeriod();
        const addresses = getAddressesForTxHub(ae.blockchains);
        let rs = getDaysDifference(ye, pe);
        const os = [];
        while(rs > 29){
            const es = getDateDaysAgo(pe, 29);
            os.push({
                ...ae,
                from: pe.toISOString(),
                to: es.toISOString(),
                addresses
            });
            pe = es;
            rs = getDaysDifference(ye, pe);
        }
        os.push({
            ...ae,
            from: pe.toISOString(),
            to: ye.toISOString(),
            addresses
        });
        const items = (await Promise.all(os.map((ae)=>this.fetchAllChainsTransactionsRecursively(ae)))).flat();
        store.dispatch(txSlice.actions.updateTxs({
            walletId: es,
            items,
            accountId
        }));
        if (!this.recursiveMultipleChainCallFailed) {
            const pe = getAllChainsFetchedTransactionPeriod() ?? ns;
            if (pe) {
                const ye = new Set([
                    ...pe.blockchains ?? [],
                    ...ae.blockchains.map((ae)=>ae.id)
                ]);
                store.dispatch(txSlice.actions.updateAllChainsCachedTransactionsPeriod({
                    selectedWalletId: es,
                    accountId,
                    blockchains: [
                        ...ye
                    ],
                    from: new Date(Math.max(new Date(ae.from).getTime(), new Date(pe.from).getTime())).toUTCString(),
                    to: pe.to,
                    nextToken: pe.nextToken
                }));
            }
        }
    }
    constructor(){
        this.recursiveMultipleChainCallFailed = false;
    }
};
