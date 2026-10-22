const __x = class FetchAssetsTransactionHistoryWalk {
    handle({ from, to, nextToken, blockchains, maxWindows, floor }) {
        return this.transactionHistoryService.walkBulkTransactionHistory({
            addresses: getAddressesForTxHub(blockchains),
            from,
            to,
            nextToken,
            maxWindows,
            floor
        });
    }
};
