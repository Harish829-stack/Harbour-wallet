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
class SwapService {
    static allowMaxApproval() {
        return getSwapSetting("unlimitedAllowance") === true;
    }
    getSharedStep(ae, pe, ye, es = {}) {
        return this.getSharedStepWithMeta(ae, pe, ye, es).then(({ step })=>step);
    }
    getSharedStepWithMeta(ae, pe, ye, { variant, preferFresh } = {}) {
        return this.stepRepository.getStepWithMeta(`${ye}|${variant ?? ""}`, ()=>retryOnTransientNetworkError(()=>this.walletKitService.AmberService.getStep(ae, pe, ye)), {
            preferFresh
        });
    }
    async getSupportedDomains() {
        const ae = getActiveWallet();
        const pe = getActiveWalletAccounts();
        const ye = Object.values(pe ?? {}).map((ae)=>ae.coin);
        const es = getSwapCapabilityFingerprint(ae?.type, ye);
        return this.supportedDomainsCache.get(es, async ()=>{
            const pe = getBlockchainsByPrefixedCoinId();
            const es = await this.amberDomains();
            const ss = new Set(ye);
            const walletHasAccountFor = (pe)=>{
                if (ae?.type !== WalletType.PRIVATE_KEY && ae?.type !== WalletType.HARDWARE) {
                    return !!pe;
                }
                return pe !== undefined && ss.has(pe.coinId);
            };
            const ns = es.filter((ae)=>{
                const ye = pe[getPrefixedCoinId(ae.coin.value)];
                return ye?.id !== Blockchain.fantom && walletHasAccountFor(ye);
            }).map((ae)=>getPrefixedCoinId(ae.coin.value));
            if (!ns.includes("c10000999") && walletHasAccountFor(pe.c10000999)) {
                ns.push(HL_HYPE_ASSET_ID);
            }
            return ns;
        });
    }
    getPairTokenList(blockchainId) {
        return this.pairTokenListCache.get(blockchainId, async ()=>{
            try {
                return (await this.apiService.getSwapPairsForBlockchain(blockchainId))?.data?.tokens ?? [];
            } catch (error) {
                if (isAxiosError(error) && error.response?.status === 404) {
                    logger_default.debug("No swap pairs for blockchain", {
                        blockchainId
                    });
                    return [];
                }
                throw error;
            }
        });
    }
    async getPairsForBlockchainCoinIds(ae) {
        const pe = getCombinedBalances();
        const ye = getBlockchainsByPrefixedCoinId();
        const es = [];
        for(const ts in ye){
            if (ae.includes(ts)) {
                es.push(ye[ts]);
            }
        }
        const ss = await Promise.all(es.map(async (blockchain_1)=>{
            try {
                return {
                    blockchain: blockchain_1,
                    list: await this.getPairTokenList(blockchain_1.id),
                    failed: false
                };
            } catch (pe) {
                logger_default.debug("Swap pairs unavailable for blockchain", {
                    blockchainId: blockchain_1.id
                });
                return {
                    blockchain: blockchain_1,
                    list: [],
                    failed: true
                };
            }
        }));
        const pairs = {};
        for (const { blockchain, list } of ss){
            if (!pairs[blockchain.id]) {
                pairs[blockchain.id] = [];
            }
            for (const ae of list){
                pairs[blockchain.id].push({
                    name: ae.name,
                    address: ae.address,
                    symbol: ae.symbol,
                    type: ae.type,
                    decimals: ae.decimals,
                    iconUrl: ae.logoURI,
                    balance: pe[ae.asset] || "0",
                    fiat: getFiat(ae.asset),
                    assetId: ae.asset,
                    blockchainId: blockchain.id,
                    blockchain
                });
            }
        }
        return {
            pairs,
            failedBlockchainIds: ss.filter(({ failed })=>failed).map(({ blockchain })=>blockchain.id)
        };
    }
    async getSettlementStatus(ae) {
        try {
            const { data } = await this.apiService.getSwapSettlementStatus(ae);
            return toSettlementCheck(data);
        } catch (error) {
            logger_default.debug("[swap-settlement] status check failed; still pending", error);
            return {
                outcome: "pending"
            };
        }
    }
    async getQuote({ assetOut, assetIn, amount, slippage, destinationAddress, frontendSource = "swaps", isMax = false, preferredProviderId, enforceProvider = false, sessionStepId, excludeIntentRoutes = false }) {
        if (isHlBridgeRoute(assetOut, assetIn)) {
            try {
                return await this.relaySwapService.getQuote({
                    assetOut,
                    assetIn,
                    amount,
                    slippage: slippage ?? null,
                    isMax,
                    destinationAddress
                });
            } catch (error) {
                logger_default.error(error);
                if (error instanceof RelayQuoteRefusalError) {
                    throw new Error(FAILED_AMBER_RPC_ERROR + error.message);
                }
                if (error instanceof RelayApiError) {
                    if ((error.status ?? 0) >= 400 && (error.status ?? 0) < 500 && error.message) {
                        throw new Error(FAILED_AMBER_RPC_ERROR + error.message.slice(0, 140));
                    }
                    throw new Error(FAILED_QUOTE_GENERATION);
                }
                captureException(error instanceof Error ? error : new Error(String(error)), {
                    tags: {
                        feature: "swap",
                        stage: "quote",
                        provider: RELAY_PROVIDER_ID,
                        chain: assetOut?.blockchain?.id
                    },
                    stage: "quote",
                    assetOut: assetOut?.symbol,
                    assetIn: assetIn?.symbol
                });
                throw new Error(FAILED_QUOTE_GENERATION);
            }
        }
        if (assetOut.blockchain.id === Blockchain.hyperevm || assetIn.blockchain.id === Blockchain.hyperevm) {
            throw new Error(FAILED_AMBER_UNSUPPORTED_PAIR);
        }
        let isMax_1 = false;
        try {
            const ls = getBalance$2(getAssetId({
                coinId: assetOut.blockchain.coinId
            }));
            const fromAsset = await this.getWalletSwapAsset(assetOut);
            const toAsset = await this.getWalletSwapAsset(assetIn, destinationAddress);
            const isNativeSpend = !("contract" in fromAsset);
            const _s = new import_trust_sdk$15.AmberSettings(getSwapSetting("thorchainStreams"), getSwapSetting("solanaTurboSwaps") ? import_trust_sdk$15.SolanaSwapFeeSettings.Turbo : import_trust_sdk$15.SolanaSwapFeeSettings.Fast);
            let amountIn = this.transformAmountToBigInt(amount);
            let spendValue = amount.value;
            if (isMax && isNativeSpend) {
                amountIn = deductFeeFromMaxAmount(amountIn, await this.estimateDefaultFee(fromAsset, toAsset, amountIn, assetOut.blockchain.id));
                spendValue = formatTokenFrom(amountIn.toString(), amount.decimals).toFixed();
                isMax_1 = true;
            }
            const ps = isMax && isNativeSpend;
            const canPayGasInTokens = canPayGasInTokensForQuote({
                spendChainId: assetOut.blockchain.id,
                chainsSupporting7702: BlockchainService.getBlockchainsSupporting7702(),
                isHardwareWallet: isHardwareWallet()
            });
            const ks = ps || canPayGasInTokens ? Promise.resolve(null) : this.estimateDefaultFee(fromAsset, toAsset, amountIn, assetOut.blockchain.id);
            const sessionQuote = async (slippage_2)=>{
                if (!this.proactiveQuotesEnabled()) {
                    return null;
                }
                if (excludeIntentRoutes) {
                    logger_default.debug("[swap-route] intent order in flight for this token; polling instead", {
                        assetId: assetOut.assetId
                    });
                    return null;
                }
                const es = await this.getProactiveQuote({
                    fromAsset,
                    toAsset,
                    amountIn,
                    slippage: slippage_2,
                    frontendSource,
                    preferredProviderId,
                    enforceProvider,
                    sessionStepId,
                    assetOut,
                    assetIn
                });
                if (!es) {
                    return null;
                }
                const ss = effectiveNetworkFee(toHumanNetworkFee(await ks, assetOut.blockchain.decimals), {
                    isNativeSpend,
                    spendChainId: assetOut.blockchain.id,
                    isMax,
                    canPayGasInTokens,
                    spendValue,
                    nativeBalance: ls?.balance ?? "0",
                    nativeDecimals: assetOut.blockchain.decimals
                });
                es.networkFeeSource = ss.source;
                es.insufficientBalance = isQuoteUnderfunded({
                    isNativeSpend,
                    isMax,
                    spendValue,
                    routingFeesTotal: Big(nativeFeeTotal(es.fees.routing.breakdown, `c${assetOut.blockchain.coinId}`)),
                    estimatedNetworkFee: ss.value,
                    canPayGasInTokens,
                    nativeBalance: ls?.balance ?? "0"
                });
                return es;
            };
            const Rs = await sessionQuote(parseUserSlippagePercent(slippage));
            if (Rs) {
                return Rs;
            }
            const { routes, config } = await this.walletKitService.AmberService.getRoutes(fromAsset, toAsset, amountIn, slippage ? parseFloat(slippage) : null, _SwapService1.allowMaxApproval(), import_trust_sdk$15.AmberRouteSort.Quantity, _s, preferredProviderId ? [
                preferredProviderId
            ] : [], [], this.supportsEip712Routes() && !excludeIntentRoutes, frontendSource);
            const Ms = selectSwapRoute(routes, preferredProviderId);
            const { approval, id, priceImpact, priceInfo, provider, providerFees, slippage: slippage_1, to: { amount: amount_1, minAmountOut } } = Ms.steps[0];
            const xs = config;
            const qs = await getTappedPriceImpactLevels();
            const zs = {
                networkFee: null,
                id,
                receiveAmount: formatTokenFrom(amount_1.toString(), assetIn.decimals).toFixed(5),
                minimumAmount: formatTokenFrom(minAmountOut.toString(), assetIn.decimals).toFixed(5),
                priceImpact: new Big(priceImpact).toFixed(2),
                exchangeRate: {
                    fromAsset: {
                        symbol: assetOut.symbol,
                        amount: "1"
                    },
                    toAsset: {
                        symbol: assetIn.symbol,
                        amount: Number(priceInfo).toFixed(5)
                    }
                },
                approval: approval ? {
                    contract: approval.to,
                    data: approval.encodedApprove
                } : null,
                fees: {
                    approvalNetwork: {
                        breakdown: [],
                        total: 0
                    },
                    provider: {
                        breakdown: [],
                        total: 0
                    },
                    relayer: {
                        breakdown: [],
                        total: 0
                    },
                    routing: {
                        breakdown: [],
                        total: 0
                    }
                },
                provider: {
                    id: provider.id,
                    origin: provider.name,
                    favIconUrl: provider.logoUrl,
                    title: provider.name,
                    url: provider.name
                },
                slippage: slippage_1.toString(),
                insufficientBalance: false,
                networkFeeSource: "none",
                warnings: Ms.warnings,
                refreshInterval: parseInt(config.refreshInterval),
                quoteSource: "route",
                priceImpactMediumLevel: parsePriceImpactLevel(xs.priceImpactMediumLevel) || qs.medium,
                priceImpactHighLevel: parsePriceImpactLevel(xs.priceImpactHighLevel) || qs.high
            };
            if (providerFees) {
                const { providerFees: providerFees_1, relayerFees, routingFees, approvalNetworkFees, unmatched } = classifyProviderFees(providerFees);
                if (unmatched.length) {
                    logger_default.warn("Unrecognized swap provider fee name(s), folding into provider bucket:", unmatched.map((ae)=>ae.name));
                }
                const sumAmounts = (breakdown)=>breakdown.reduce((acc, item)=>acc + parseFloat(item.amount), 0);
                zs.fees.provider.breakdown = await this.transformFees(providerFees_1);
                zs.fees.provider.total = sumAmounts(zs.fees.provider.breakdown);
                zs.fees.relayer.breakdown = await this.transformFees(relayerFees);
                zs.fees.relayer.total = sumAmounts(zs.fees.relayer.breakdown);
                zs.fees.routing.breakdown = await this.transformFees(routingFees);
                zs.fees.routing.total = sumAmounts(zs.fees.routing.breakdown);
                zs.fees.approvalNetwork.breakdown = await this.transformFees(approvalNetworkFees);
                zs.fees.approvalNetwork.total = sumAmounts(zs.fees.approvalNetwork.breakdown);
            }
            const Ns = `c${assetOut.blockchain.coinId}`;
            const routingFeesTotal = Big(nativeFeeTotal(zs.fees.routing.breakdown, Ns));
            const Ds = toHumanNetworkFee(await ks, assetOut.blockchain.decimals);
            const Bs = effectiveNetworkFee(Ds, {
                isNativeSpend,
                spendChainId: assetOut.blockchain.id,
                isMax,
                canPayGasInTokens,
                spendValue,
                nativeBalance: ls?.balance ?? "0",
                nativeDecimals: assetOut.blockchain.decimals
            });
            zs.networkFeeSource = Bs.source;
            zs.insufficientBalance = isQuoteUnderfunded({
                isNativeSpend,
                isMax,
                spendValue,
                routingFeesTotal,
                estimatedNetworkFee: Bs.value,
                canPayGasInTokens,
                nativeBalance: ls?.balance ?? "0"
            });
            if (isDebugEnabled()) {
                logger_default.debug(`[swap-fee-gate] ${assetOut.blockchain.id} ${assetOut.symbol}->${assetIn.symbol} native=${isNativeSpend} max=${isMax} gasInTokens=${canPayGasInTokens} spend=${spendValue} nativeBalance=${ls?.balance ?? "0"} routingNative=${routingFeesTotal.toFixed()} estimate=${Ds} required=${Bs.value} source=${Bs.source} INSUFFICIENT=${zs.insufficientBalance}`);
            }
            if (Bs.source === "max_reserve_cap") {
                logger_default.warn(`[swap-fee-gate] local network-fee estimate ${Ds} exceeded the Max reserve ${Bs.value} on ${assetOut.blockchain.id} — clamped`);
            }
            return zs;
        } catch (error) {
            logger_default.error(error);
            const es = expectedAmberOutcomeCode(error);
            if (es) {
                throw new Error(es);
            }
            if (error instanceof Error && error.message === "FAILED_MAX_AMOUNT_BELOW_FEES") {
                throw error;
            }
            if (!isExpectedAmberOutcome(error)) {
                captureException(error instanceof Error ? error : new Error(String(error)), {
                    tags: {
                        feature: "swap",
                        stage: "quote",
                        chain: assetOut?.blockchain?.id
                    },
                    stage: "quote",
                    assetOut: assetOut?.symbol,
                    assetIn: assetIn?.symbol
                });
            }
            if (error instanceof import_trust_sdk$15.AmberRpcError) {
                const pe = error.code === "amount_too_small" ? lastAmountIn(error.message ?? "") : null;
                const es = Boolean(pe?.unit && pe.unit.toUpperCase() !== assetOut.symbol.toUpperCase());
                if (error.code === "amount_too_small" && !es) {
                    throw new Error(encodeAmountTooSmall({
                        symbol: assetOut.symbol,
                        minimum: pe?.value ?? null,
                        isMax: isMax_1
                    }));
                }
                throw new Error(FAILED_AMBER_RPC_ERROR + error.message);
            }
            throw new Error(FAILED_QUOTE_GENERATION);
        }
    }
    async getApprovalTransactionPayload({ approval, provider }) {
        try {
            return {
                to: approval.contract,
                isInternal: true,
                data: approval.data,
                source: provider
            };
        } catch (error) {
            logger_default.error(error);
            captureException(error instanceof Error ? error : new Error(String(error)), {
                tags: {
                    feature: "swap",
                    stage: "approval-payload"
                },
                stage: "approval-payload",
                provider: provider?.id
            });
            throw new Error(`${FAILED_APPROVAL_TRANSACTION_PAYLOAD_GENERATION}: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
        }
    }
    async getSwapTransactionPayload({ id, assetOut, assetIn, provider }) {
        if (this.relaySwapService.isRelayQuoteId(id)) {
            try {
                return this.relaySwapService.getTransactionPayload(id);
            } catch (error) {
                logger_default.error(error);
                captureException(error instanceof Error ? error : new Error(String(error)), {
                    tags: {
                        feature: "swap",
                        stage: "transaction-payload",
                        provider: RELAY_PROVIDER_ID,
                        chain: assetOut?.blockchain?.id
                    },
                    stage: "transaction-payload",
                    assetOut: assetOut?.symbol,
                    assetIn: assetIn?.symbol
                });
                throw new Error(`${FAILED_SWAP_TRANSACTION_PAYLOAD_GENERATION}: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
            }
        }
        try {
            const ss = await this.getWalletSwapAsset(assetOut);
            const ns = await this.getWalletSwapAsset(assetIn);
            if (this.quoteSessionService.isSessionStep(id)) {
                this.quoteSessionService.commit(id);
            }
            const { transaction } = await this.getSharedStep(ss, ns, id);
            const { to, meta, amount, isEip712 } = transaction;
            const us = {
                to,
                data: meta,
                isInternal: true,
                source: provider,
                mev: this.isMevEnabled(assetOut),
                isEip712
            };
            if (amount) {
                us.value = formatTokenFrom(amount, assetOut.blockchain.decimals).toFixed();
            }
            return us;
        } catch (error) {
            logger_default.error(error);
            if (!isExpectedAmberOutcome(error)) {
                captureException(error instanceof Error ? error : new Error(String(error)), {
                    tags: {
                        feature: "swap",
                        stage: "transaction-payload",
                        chain: assetOut?.blockchain?.id
                    },
                    stage: "transaction-payload",
                    assetOut: assetOut?.symbol,
                    assetIn: assetIn?.symbol
                });
            }
            throw new Error(`${FAILED_SWAP_TRANSACTION_PAYLOAD_GENERATION}: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
        }
    }
    async getAssetBalance(ae) {
        let balance;
        const ye = getBalance$2(ae.assetId);
        let price;
        balance = ye === undefined ? (await this.balanceService.fetchBalance(ae.blockchain.id, ae.address, ae.decimals, ae))?.balance.toString() ?? "0" : ye.balance;
        const ss = getFiat(ae.assetId);
        price = ss === undefined ? (await this.tickerService.fetchTicker(ae.assetId, true))?.[0]?.price?.toString() ?? "0" : ss.price.toString();
        return {
            balance,
            price
        };
    }
    proactiveQuotesEnabled() {
        return getSwapSetting("environment") !== SWAP_ENVIRONMENT.STAGING;
    }
    amberDomains() {
        return this.amberDomainsCache.get("amber", ()=>this.walletKitService.AmberService.getDomains());
    }
    async getProactiveQuote({ fromAsset, toAsset, amountIn, slippage, frontendSource, preferredProviderId, enforceProvider = false, sessionStepId, assetOut, assetIn }) {
        try {
            const device_id = getDeviceId();
            if (!device_id) {
                return null;
            }
            const us = await this.amberDomains();
            const domainFor = (ae)=>us.find((pe)=>pe.coin.value === ae.account.coin.value);
            const ls = domainFor(fromAsset);
            const ms = domainFor(toAsset);
            if (!ls || !ms) {
                return null;
            }
            const gs = {
                from_asset: wireAssetFor(fromAsset.account.coin.value, "contract" in fromAsset ? fromAsset.contract : undefined),
                from_address: fromAsset.account.address,
                from_domain: ls.id,
                amount: amountIn.toString(),
                ...slippage === null ? {} : {
                    slippage
                },
                to_asset: wireAssetFor(toAsset.account.coin.value, "contract" in toAsset ? toAsset.contract : undefined),
                to_address: toAsset.account.address,
                to_domain: ms.id,
                frontend_source: frontendSource,
                device_id
            };
            const ds = preferredProviderId ? enforceProvider ? {
                enforced_providers: [
                    preferredProviderId
                ]
            } : {
                preferred_providers: [
                    preferredProviderId
                ]
            } : undefined;
            const { winner, config } = await this.quoteSessionService.quote(gs, ds, {
                stepId: sessionStepId
            });
            const vs = parseDurationMs(config.quoteChangeTtl) ?? SwapQuoteSessionService.DEFAULT_QUOTE_CHANGE_MS;
            const ps = await getTappedPriceImpactLevels();
            const { quote, unmatchedFeeNames } = mapProactiveWinner(winner, {
                spendAsset: assetOut,
                receiveAsset: assetIn,
                coinForDomain: (ae)=>us.find((pe)=>pe.id === ae)?.coin.value,
                refreshIntervalSec: Math.max(1, Math.ceil(vs / 1000)),
                unlimitedApproval: _SwapService1.allowMaxApproval(),
                priceImpactMediumLevel: parsePriceImpactLevel(config.priceImpactMediumLevel) || ps.medium,
                priceImpactHighLevel: parsePriceImpactLevel(config.priceImpactHighLevel) || ps.high
            });
            if (unmatchedFeeNames.length) {
                logger_default.warn("Unrecognized swap provider fee name(s), folding into provider bucket:", unmatchedFeeNames);
            }
            if ((winner.quote.approvalRequired ?? Boolean(winner.quote.approval)) && winner.quote.approval && !quote.approval) {
                quote.approval = await this.resolveSessionApproval(fromAsset, toAsset, winner);
            }
            return quote;
        } catch (error) {
            if (error instanceof ProactiveQuoteError) {
                logger_default.debug(`Proactive quote unavailable (${error.reason}); polling`, error.detail);
            } else {
                logger_default.debug("Proactive quote failed; polling", error);
            }
            return null;
        }
    }
    async resolveSessionApproval(ae, pe, ye) {
        const es = `${ye.quote.from.asset.address}|${ye.quote.approval?.operatorAddress ?? ""}`;
        const ss = this.sessionApprovalCache.get(es);
        if (ss) {
            return ss;
        }
        try {
            const { transaction } = await this.getSharedStep(ae, pe, ye.quote.id);
            const { swapApproveCallData } = transaction;
            const contract = "contract" in ae ? ae.contract : null;
            const rs = swapApproveCallData && contract ? {
                contract,
                data: swapApproveCallData
            } : null;
            if (rs) {
                this.sessionApprovalCache.set(es, rs);
            }
            return rs;
        } catch (error) {
            logger_default.debug("Could not resolve session approval from the SDK step", error);
            return null;
        }
    }
    async getWalletSwapAsset(ae, pe) {
        let ye = await this.walletService.createWalletKitAccount({
            coinId: getCoinId(ae.assetId, true),
            blockchainId: ae.blockchainId,
            blockchain: ae.blockchain
        });
        if (pe) {
            ye = ye.copy(pe);
        }
        return this.walletService.createWalletKitAsset(ae, ye, ae.blockchainId);
    }
    async recordSwapTransaction(ae, pe) {
        if (this.relaySwapService.isRelayQuoteId(ae)) {
            await this.relaySwapService.recordSwapTransaction(ae, pe);
        } else {
            await this.walletKitService.AmberService.createTransaction(ae, pe);
        }
    }
    supportsEip712Routes() {
        return typeof this.getAmberSubmitTransaction() === "function";
    }
    getAmberSubmitTransaction() {
        return this.walletKitService.AmberService.submitTransaction;
    }
    async submitSwapTransaction(stepId, pe) {
        const ye = this.getAmberSubmitTransaction();
        if (!ye) {
            throw new Error(`${FAILED_SWAP_ORDER_SUBMISSION}: AmberService.submitTransaction is not exported by this SDK build`);
        }
        const es = pe.startsWith("0x") ? pe : `0x${pe}`;
        let ss = null;
        for(let ts = 0; ts <= ORDER_SUBMISSION_BACKOFF_MS.length; ts += 1){
            try {
                return await ye.call(this.walletKitService.AmberService, stepId, es);
            } catch (error) {
                ss = describeSubmissionFailure(error);
                const backoffMs = ORDER_SUBMISSION_BACKOFF_MS[ts];
                if (!ss.isTransient || backoffMs === undefined) {
                    break;
                }
                logger_default.debug("[swap-submit] provider declined for now; retrying", {
                    stepId,
                    code: ss.code,
                    traceId: ss.traceId,
                    attempt: ts + 1,
                    backoffMs
                });
                await new Promise((resolve)=>setTimeout(resolve, backoffMs));
            }
        }
        const ns = ss ?? {
            code: null,
            traceId: null,
            message: "unknown submission failure",
            isTransient: false
        };
        logger_default.error("[swap-submit] order submission failed", ns);
        captureException(new Error(ns.message), {
            tags: {
                feature: "swap",
                stage: "broadcast"
            },
            stage: "broadcast",
            stepId,
            providerCode: ns.code,
            providerTraceId: ns.traceId
        });
        throw new Error(`${FAILED_SWAP_ORDER_SUBMISSION}: ${ns.message.slice(0, 200)}`);
    }
    async transformFees(ae) {
        return await Promise.all(ae.map(async ({ asset, amount })=>({
                amount: formatTokenFrom(amount.toString(), asset.metadata.decimals).toFixed(10),
                symbol: asset.metadata.symbol,
                assetId: `c${asset.coin.value}${asset.metadata.isNative ? "" : `_t${asset.contract}`}`
            })));
    }
    getProviderOrigin(ae) {
        if (ae === "rango") {
            return "https://rango.exchange";
        }
        return "https://app.1inch.io";
    }
    transformAmountToBigInt(ae) {
        return BigInt(formatTokenTo(ae.value, ae.decimals).toFixed(0));
    }
    async estimateDefaultFee(ae, pe, ye, es) {
        if (es === Blockchain.tron) {
            return null;
        }
        let ss;
        try {
            const es = new this.walletKitService.TransactionTrade(ae, pe, ye.toString(), null, "", import_trust_sdk$15.MetaType.Unspecified, true, null, null, null, null);
            const ns = await Promise.race([
                this.walletKitService.BlockchainService.getDefaultFee(es),
                new Promise((resolve)=>{
                    ss = setTimeout(()=>resolve(null), _SwapService1.DEFAULT_FEE_TIMEOUT_MS);
                })
            ]);
            if (ns === null) {
                logger_default.warn("Default network fee estimation timed out, degrading to the no-estimate fallback");
                return null;
            }
            return BigInt(ns.amount);
        } catch (error) {
            logger_default.warn("Default network fee estimation failed, degrading to the no-estimate fallback", error);
            return null;
        } finally{
            clearTimeout(ss);
        }
    }
    isMevEnabled(ae) {
        return getSwapSetting("mev") && this.supportsMEV(ae.blockchain);
    }
    supportsMEV(ae) {
        return ae.id === Blockchain.ethereum || ae.id === Blockchain.polygon || ae.id === Blockchain.smartchain;
    }
    async swapQuoteSupports7702({ spendAsset, receiveAsset, is7702CrossSwapEnabledByExperiment }) {
        if (is7702CrossSwapEnabledByExperiment || spendAsset?.blockchainId === receiveAsset?.blockchainId) {
            return await this.blockchainService.swapSupportsFeeTokenQuotes(spendAsset?.blockchainId) && !isHardwareWallet();
        }
        return Boolean(is7702CrossSwapEnabledByExperiment);
    }
    constructor(){
        this.stepRepository = createStepRepository();
        this.amberDomainsCache = new SuccessTtlCache(_SwapService1.DOMAINS_CACHE_MS, 1);
        this.supportedDomainsCache = new SuccessTtlCache(_SwapService1.SUPPORTED_DOMAINS_CACHE_MS, 8);
        this.pairTokenListCache = new SuccessTtlCache(_SwapService1.PAIR_TOKEN_LIST_CACHE_MS, 64);
        this.sessionApprovalCache = new Map;
    }
}
