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
class NetworkService {
    onApplicationShutdown() {
        this.gasFeesPoller.stopAndRemoveListeners();
        this.pendingTxPoller.stopAndRemoveListeners();
    }
    async onApplicationBoot() {
        this.gasFeesPoller.on("data", (ae)=>{
            if (ae) {
                store.dispatch(txSlice.actions.updateGasFees(ae));
            }
        });
        this.pollPendingTx();
    }
    pollPendingTx() {
        this.pendingTxPoller.start(()=>this.checkPendingTransactions());
    }
    async checkPendingTransactions() {
        if (this.extraBalanceRefreshTicks > 0) {
            this.extraBalanceRefreshTicks--;
            emit(QueueEvent.REFRESH_BALANCE);
        }
        const walletId = getActiveWalletId();
        const accountId = getActiveAccountId();
        const ye = Date.now();
        for (const ss of getTransactions()){
            if (isExpiredProvisionalSwap(ss, ye, {
                ttlMs: provisionalSwapTtlMs(ss.blockchain.id)
            })) {
                store.dispatch(txSlice.actions.removeTx({
                    walletId,
                    accountId,
                    id: ss.hash
                }));
            }
        }
        const es = getTransactions().filter((ae)=>ae.status === "pending" && !isBridgeAwaitingDestination(ae) && !isProvisionalSwap(ae))?.map(async (ye)=>{
            const es = Date.now();
            if (ye.createdAt + _NetworkService1.POLL_PENDING_TX_FIRST_DELAY > es) {
                return;
            }
            const blockchain = getMainnetOrCustomBlockchainById(ye.blockchain.id, ye.blockchain.isCustom);
            if (!blockchain) {
                return;
            }
            const ns = getGasTokenAsset(blockchain, getAssetV2ByAssetId(ye.assetId));
            const ts = {
                blockchain,
                hash: ye.hash,
                blockNumber: ye.blockNumber
            };
            try {
                const ss = await this.transactionServiceManager.status(ts);
                const rs = this.getStatus(ss?.status);
                if (rs !== "confirmed" && ye.createdAt + _NetworkService1.DELAY_BEFORE_FAIL_STATUS > es) {
                    return;
                }
                const os = Boolean(ss?.hash && ye.hash !== ss.hash);
                const as = ye.status !== rs;
                if (os || as) {
                    const es = ns && ss?.fee ? formatTokenFrom(ss.fee, ns.decimals).toFixed(ns.decimals) : undefined;
                    const ts = getSwapBridge(ye);
                    if (rs !== "confirmed" || !ts || ts.status !== "pending" && ts.status !== "expired") {
                        store.dispatch(txSlice.actions.updateTransactionStatus({
                            walletId,
                            accountId,
                            id: ye.hash,
                            ...os ? {
                                hash: ss.hash
                            } : {},
                            status: as ? rs : ye.status,
                            fee: as ? [
                                es
                            ] : [
                                "0"
                            ]
                        }));
                    } else {
                        store.dispatch(txSlice.actions.markBridgeSourceConfirmed({
                            walletId,
                            accountId,
                            id: ye.hash,
                            ...os ? {
                                hash: ss.hash
                            } : {},
                            fee: es ? [
                                es
                            ] : [
                                "0"
                            ]
                        }));
                    }
                }
                if (as) {
                    if (!(rs !== "confirmed" && rs !== "failed")) {
                        store.dispatch(approvalsSlice.actions.settlePendingApprovalByTx({
                            walletId,
                            txHash: ye.hash,
                            confirmed: rs === "confirmed"
                        }));
                    }
                    emit(QueueEvent.REFRESH_BALANCE);
                    this.extraBalanceRefreshTicks = _NetworkService1.EXTRA_REFRESH_TICKS_AFTER_STATUS_FLIP;
                }
            } catch (error) {
                const ns = error instanceof import_trust_sdk$31.RpcError.TxNotFound;
                const ts = pendingNotFoundThresholdMs(ye.blockchain.id, _NetworkService1.FAILED_THRESHOLD);
                if (es - ye.createdAt >= ts && ns) {
                    store.dispatch(txSlice.actions.updateTransactionStatus({
                        walletId,
                        accountId,
                        id: ye.hash,
                        status: "failed",
                        fee: [
                            "0"
                        ]
                    }));
                    store.dispatch(approvalsSlice.actions.settlePendingApprovalByTx({
                        walletId,
                        txHash: ye.hash,
                        confirmed: false
                    }));
                }
                if (ns) {
                    logger_default.warn("Tx not yet found (might still be pending):", error);
                } else {
                    logger_default.error("Unexpected error while checking tx status:", error);
                }
            }
        });
        return Promise.all(es);
    }
    getStatus(ae) {
        if (import_lodash$5.isUndefined(ae)) {
            return "pending";
        }
        if (ae) {
            return "confirmed";
        }
        return "failed";
    }
    async startPollGasFees(ae) {
        _NetworkService1.gasPollStarts += 1;
        logger_default.debug(`[gas-poll] start #${_NetworkService1.gasPollStarts} chain=${ae.network?.id} alreadyPolling=${this.pollingGasFees}`);
        if (this.pollingGasFees) {
            await this.stopPollGasFees();
        }
        if (checkEip1559Tx(ae)) {
            logger_default.debug("Start poll gas fees...");
            this.gasFeesPoller.start(()=>this.blockchainService.estimateFees(ae.network));
            this.pollingGasFees = true;
        } else {
            this.pollingGasFees = false;
        }
    }
    async stopPollGasFees() {
        if (this.pollingGasFees) {
            if (!(store.getState().notification.filter((ae)=>ae.method === "eth_sendTransaction").length > 0)) {
                logger_default.debug("Stop poll gas fees...");
                this.gasFeesPoller.stop();
                this.pollingGasFees = false;
            }
        }
    }
    constructor(){
        this.gasFeesPoller = new Poller({
            interval: _NetworkService1.POLL_GAS_FEES_INTERVAL
        });
        this.pendingTxPoller = new Poller({
            interval: _NetworkService1.POLL_PENDING_TX_INTERVAL,
            firstInterval: _NetworkService1.POLL_PENDING_TX_FIRST_DELAY
        });
        this.pollingGasFees = false;
        this.extraBalanceRefreshTicks = 0;
    }
}
