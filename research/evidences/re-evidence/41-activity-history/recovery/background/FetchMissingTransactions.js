const __x = class FetchMissingTransactions {
    async fetchTransactionsRecursively(ae, pe = []) {
        return this.transactionHistoryService.fetchTransactionHistory(ae).then(async (ye)=>{
            if (ye.transactions) {
                pe.push(...ye.transactions);
            } else {
                this.recursiveCallFailed = true;
            }
            if (ye.nextToken) {
                await this.fetchTransactionsRecursively({
                    ...ae,
                    nextToken: ye.nextToken
                }, pe);
            }
            return pe;
        }).catch(()=>{
            this.recursiveCallFailed = true;
            return [];
        });
    }
    async handle(ae) {
        this.recursiveCallFailed = false;
        let pe = new Date(ae.from);
        const ye = new Date(ae.to);
        const es = getActiveWalletId();
        const accountId = getActiveAccountId();
        const ns = getFetchedTransactionPeriod(ae.asset.assetId);
        let ts = getMonthDifference(ye, pe);
        const rs = [];
        while(ts > API_MONTH_LIMIT){
            const es = new Date(pe);
            es.setMonth(es.getMonth() - API_MONTH_LIMIT);
            rs.push({
                ...ae,
                from: pe.toISOString(),
                to: es.toISOString()
            });
            pe = es;
            ts = getMonthDifference(ye, pe);
        }
        rs.push({
            ...ae,
            from: pe.toISOString(),
            to: ye.toISOString()
        });
        await Promise.all(rs.map((ae)=>this.fetchTransactionsRecursively(ae))).then((pe)=>{
            const items = pe.flat();
            store.dispatch(txSlice.actions.updateTxs({
                items,
                walletId: es,
                accountId
            }));
            if (!this.recursiveCallFailed && ns) {
                store.dispatch(txSlice.actions.updateCachedTransactionsPeriod({
                    accountId,
                    selectedWalletId: es,
                    assetId: ae.asset.assetId,
                    from: new Date(ae.from).toUTCString(),
                    to: ns.to
                }));
            }
        });
    }
    constructor(){
        this.recursiveCallFailed = false;
    }
};
