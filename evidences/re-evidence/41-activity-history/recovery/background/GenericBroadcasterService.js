const __x = class GenericBroadcasterService {
    sendRawTransaction(ae, pe) {
        return this.walletKitService.WebService.sendRawDataV2(ae, pe);
    }
    async sendBroadcast(ae, pe, ye, es, ss) {
        const broadcastPublicly = ()=>{
            if (ae) {
                return this.sendRawTransaction(ye.chain, pe);
            }
            return this.walletKitService.BlockchainService.sendTransactionV2WithoutMeta(ye.chain, pe);
        };
        if (!(ae ? es && !ss : es)) {
            return await broadcastPublicly();
        }
        try {
            if (ae) {
                return await this.walletKitService.MevService.sendPrivateRawTransactionWithoutMeta(ye.chain, pe);
            }
            return await this.walletKitService.MevService.sendPrivateTransactionWithoutMeta(ye.chain, pe);
        } catch (error) {
            if (!isMevUnsupportedError(error)) {
                throw error;
            }
            logger_default.warn("MEV protection unavailable for this chain, broadcasting to the public mempool instead", error);
            return await broadcastPublicly();
        }
    }
    async broadcast(ae) {
        let pe = false;
        try {
            const blockchain = ae.metadata.network;
            const ss = ae.metadata.mev;
            const walletId = ae.account?.walletId ?? getActiveWalletId();
            const accountId = ae.account?.accountId ?? getActiveAccountId();
            const rs = await this.walletService.createWalletKitAccount({
                coinId: blockchain.coinId,
                blockchainId: blockchain.id,
                blockchain
            });
            await this.walletKitService.applyNodeForChain(rs.chain, blockchain);
            const solanaFeeAddress = ae.metadata.selectedFlexGasFee?.tokenAddress;
            if (ae.blockchainId === Blockchain.solana && solanaFeeAddress && ae.signed) {
                try {
                    logger_default.debug("Solana FlexGas: Submitting transaction via FlexGas service", {
                        from: ae.metadata.from,
                        solanaFeeAddress
                    });
                    const pe = Array.isArray(ae.signed) ? ae.signed[0] : ae.signed;
                    const ye = import_core_proto.TW.Solana.Proto.SigningOutput.decode(pe);
                    const requestId = await import_trust_sdk$33.SolanaFlexGasService.submitTransaction(ae.metadata.from, ye.encoded, solanaFeeAddress);
                    logger_default.info("Solana FlexGas: Transaction submitted successfully", {
                        requestId,
                        from: ae.metadata.from,
                        solanaFeeAddress
                    });
                    const ss = ae.metadata.selectedFlexGasFee.transferAmount;
                    const rs = ae.metadata.feeAsset.decimals;
                    ae.metadata.formattedFee = formatTokenFrom(ss, rs).toString();
                    await this.recordTransaction(requestId, ae, walletId, accountId, true);
                    emit(QueueEvent.REFRESH_BALANCE);
                    return requestId;
                } catch (error) {
                    logger_default.error("Solana FlexGas: Failed to submit transaction", error);
                    captureException(error instanceof Error ? error : new Error(String(error)), {
                        context: "GenericBroadcasterService.broadcast",
                        blockchainId: String(blockchain.id),
                        feeAssetId: ae.metadata.feeAsset?.assetId,
                        feeIs7702: ae.metadata.feeIs7702,
                        hasFlexGasFee: Boolean(ae.metadata.selectedFlexGasFee),
                        isMevProtected: Boolean(ss),
                        tags: {
                            feature: "solana-flexgas"
                        }
                    });
                    pe = true;
                    throw error;
                }
            }
            const as = [];
            let cs = 0;
            if (Array.isArray(ae.signed) && ae.signed.length === 1) {
                ae.signed = ae.signed[0];
            }
            if (Array.isArray(ae.signed)) {
                if (ae.blockchainId === Blockchain.solana) {
                    const pe = await Promise.all(ae.signed.map((pe)=>this.sendBroadcast(!!ae.raw, pe, rs, ss)));
                    as.push(...pe);
                } else {
                    for (const pe of ae.signed){
                        await new Retry(async ()=>{
                            const ye = await this.sendBroadcast(!!ae.raw, pe, rs, ss);
                            if (ye && cs === 1) {
                                await this.recordTransaction(ye, ae, walletId, accountId);
                            }
                            as.push(ye);
                        }, {
                            maxAttempts: 10,
                            wait: 3000
                        }).run();
                        if (ae.blockchainId === Blockchain.bitcoin && cs !== ae.signed.length - 1) {
                            await sleep$1(5000);
                        }
                        cs++;
                    }
                }
            } else {
                const pe = isRawSignedTransaction(ae.metadata);
                const ye = !!ae.raw || pe;
                const es = pe && ae.signed instanceof Uint8Array ? uint8ArrayToHex(ae.signed) : ae.signed;
                const os = await this.sendBroadcast(ye, es, rs, ss, pe);
                await recordNonceAccepted({
                    blockchainId: ae.blockchainId,
                    from: ae.metadata.from,
                    signed: ae.signed
                });
                await this.recordTransaction(os, ae, walletId, accountId);
                as.push(os);
            }
            if (ae.blockchainId === Blockchain.solana) {
                emit(QueueEvent.SOLANA_RETRY_BROADCAST, {
                    ...ae,
                    hash: as[0],
                    walletId,
                    accountId
                });
            }
            emit(QueueEvent.REFRESH_BALANCE);
            return as[0];
        } catch (error) {
            logger_default.error("GenericBroadcasterService broadcast error:", error);
            await recordNonceRefused({
                blockchainId: ae.blockchainId,
                from: ae.metadata.from,
                signed: ae.signed,
                error
            });
            if (!pe) {
                captureException(error instanceof Error ? error : new Error(String(error)), {
                    context: "GenericBroadcasterService.broadcast",
                    blockchainId: String(ae.metadata.network.id),
                    feeAssetId: ae.metadata.feeAsset?.assetId,
                    feeIs7702: ae.metadata.feeIs7702,
                    hasFlexGasFee: Boolean(ae.metadata.selectedFlexGasFee),
                    isMevProtected: Boolean(ae.metadata.mev),
                    tags: {
                        stage: "broadcast"
                    }
                });
            }
            handleWalletKitBroadcastError(error);
        }
    }
    async recordTransaction(ae, pe, walletId, accountId, ss = false) {
        const { to, network, from, value, memo, formattedFee, tokenValue, internal, spender } = pe.metadata;
        const gs = getAssetFromParams(pe);
        const assetId = network.isCustom ? (gs ? gs.assetId : getNativeAssetFromCustomChain(network)?.assetId) ?? network.id : getAssetId({
            coinId: network.coinId,
            address: gs?.nft ? undefined : gs?.address
        });
        let _s;
        _s = ss && pe.metadata.selectedFlexGasFee ? value || "0" : value === "0x0" ? tokenValue : value;
        let hs;
        let type = pe.metadata.internal.type;
        let isUnlimited = false;
        let fs = _s;
        if (type === "approve" && pe.metadata.data && gs) {
            try {
                const { allowance } = parseApproveTransaction({
                    data: pe.metadata.data,
                    network
                });
                if (Big(allowance).eq(0)) {
                    type = "revoke";
                } else {
                    isUnlimited = isTokenAmountUnlimited(allowance);
                    fs = formatTokenFrom(allowance, gs.decimals).toString();
                }
            } catch (Rs) {}
        }
        if (type === TRANSACTION_TYPE$4.Revoke) {
            hs = {
                type: TRANSACTION_TYPE$4.Revoke,
                metadata: {
                    from,
                    to,
                    assetId
                }
            };
        } else if (type === TRANSACTION_TYPE$4.Approve) {
            hs = {
                type: TRANSACTION_TYPE$4.Approve,
                metadata: {
                    from,
                    to,
                    assetId,
                    value: fs,
                    isUnlimited
                }
            };
        } else if (type === TRANSACTION_TYPE$4.Burn) {
            const ae = internal;
            hs = {
                type: TRANSACTION_TYPE$4.Burn,
                metadata: {
                    from,
                    to,
                    assetId,
                    value: _s,
                    tokenCount: ae.tokenCount,
                    estimatedReceived: ae.estimatedReceived,
                    totalFiatValue: ae.totalFiatValue,
                    tokens: ae.tokens
                }
            };
        } else if (type === TRANSACTION_TYPE$4.Swap && internal?.tokens) {
            const internal_1 = internal;
            hs = {
                type: TRANSACTION_TYPE$4.Swap,
                metadata: {
                    from,
                    to,
                    assetId,
                    value: _s,
                    internal: internal_1
                }
            };
        } else if (type === TRANSACTION_TYPE$4.Swap && internal.sent) {
            const ae = internal;
            hs = {
                type: TRANSACTION_TYPE$4.Swap,
                metadata: {
                    from,
                    to,
                    sent: ae.sent,
                    received: ae.received,
                    ...ae.bridge ? {
                        bridge: ae.bridge
                    } : {},
                    ...ae.depositTo ? {
                        depositTo: ae.depositTo
                    } : {}
                }
            };
        } else {
            hs = {
                type,
                metadata: {
                    from,
                    to,
                    assetId,
                    value: _s
                }
            };
        }
        const item = {
            fee: [
                formattedFee
            ],
            feeAsset: pe.metadata.feeAsset,
            initialHash: ae,
            swapPressId: pe.metadata.swapPressId,
            feeIs7702: pe.metadata.feeIs7702,
            hash: ae,
            solanaFlexGasRequestId: ss ? ae : undefined,
            memo,
            assetId,
            blockNumber: pe.blockNumber,
            blockchain: {
                id: network.id,
                isCustom: network.isCustom
            },
            status: "pending",
            createdAt: Date.now(),
            nft: gs?.nft,
            destination: internal.destination,
            events: [
                hs
            ]
        };
        store.dispatch(txSlice.actions.updateTx({
            item,
            walletId,
            accountId
        }));
        if (type === TRANSACTION_TYPE$4.Revoke && spender) {
            store.dispatch(approvalsSlice.actions.markApprovalAsPendingRevoke({
                chain: network.id,
                address: from,
                assetId,
                spenderAddress: spender,
                walletId,
                txHash: ae
            }));
            emit(QueueEvent.POLL_APPROVALS);
            logger_default.debug("[Broadcaster] Marked revoke as pending", {
                chain: network.id,
                assetId,
                spender
            });
        }
    }
};
