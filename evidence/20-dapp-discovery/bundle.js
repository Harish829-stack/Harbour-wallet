import { En, Tn } from "./store-cAVdfWrK.js";
(()=>{
    try {
        const T = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        T.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const _ = (new T.Error).stack;
        if (_) {
            T._sentryDebugIds = T._sentryDebugIds || {};
            T._sentryDebugIds[_] = "93fc26ad-8b72-4f72-8c40-117fcd7836dd";
            T._sentryDebugIdIdentifier = "sentry-dbid-93fc26ad-8b72-4f72-8c40-117fcd7836dd";
        }
    } catch (T) {}
})();
export const t = {
    ADD_CONNECTED_SITE: Tn("AddConnectedSite"),
    DISCONNECT_SITE: Tn("disconnectSite"),
    DISCONNECT_ALL: Tn("disconnectAllSites"),
    FETCH_DAPP_DISCOVERY: Tn("FetchDappDiscovery"),
    ETH_REQUEST_ACCOUNTS: En("requestAccounts"),
    ETH_ACCOUNTS: En("accounts"),
    ETH_COINBASE: En("coinbase"),
    ETH_SIGN_TYPED_MESSAGE: En("signTypedMessage"),
    ETH_SIGN_TYPED_DATA: En("signTypedData"),
    ETH_SIGN: En("sign"),
    ETH_SIGN_PERSONAL_MESSAGE: En("signPersonalMessage"),
    GENERIC_SIGN_MESSAGE: En("signMessage"),
    ETH_ESTIMATE_GAS: En("estimateGas"),
    ETH_SIGN_TRANSACTION: En("signTransaction"),
    ETH_SEND_TRANSACTION: En("sendTransaction"),
    ETH_CHAIN_ID: En("chainId"),
    WALLET_SWITCH_NETWORK: En("switchEthereumChain"),
    WALLET_REQUEST_PERMISSIONS: En("wallet_requestPermissions"),
    WALLET_GET_PERMISSIONS: "wallet_getPermissions",
    WALLET_REVOKE_PERMISSIONS: "wallet_revokePermissions",
    ETH_GET_ENCRYPTION_PUBLIC_KEY: "eth_getEncryptionPublicKey",
    ETH_DECRYPT: "eth_decrypt",
    WALLET_ADD_ETHEREUM_CHAIN: En("addEthereumChain"),
    WALLET_WATCH_ASSET: En("watchAsset"),
    NET_VERSION: En("net_version"),
    CLIENT_VERSION: En("web3_clientVersion"),
    PERSONAL_EC_RECOVER: En("ecRecover"),
    WEB3_SHA3: En("web3_sha3"),
    SOL_SIGN_RAW_TRANSACTION: En("signRawTransaction"),
    SOL_SIGN_RAW_TRANSACTION_MULTI: En("signRawTransactionMulti"),
    SOL_STAGE_RAW_TRANSACTION: Tn("SolStageRawTransaction"),
    SOL_SWAP_TRANSACTION: Tn("SolSwapTransaction"),
    TRON_SWAP_TRANSACTION: Tn("TronSwapTransaction"),
    DAPP_TRIGGERED_STAKING_TRANSACTION: En("dappTriggeredStakingTransaction"),
    LOADING_SPINNER_CONFIRMING: En("LOADING_SPINNER_CONFIRMING"),
    SIGN_COSMOS_TRANSACTION: Tn("SignCosmosTransaction"),
    CALCULATE_COSMOS_GAS: Tn("CalculateCosmosGas"),
    CALCULATE_TRON_FEE: Tn("CalculateTronFee"),
    BROADCAST_TON_TRANSACTION: Tn("BroadcastTonTransaction"),
    TON_DISCONNECT: En("tonConnect_disconnect"),
    TON_RECONNECT: En("tonConnect_reconnect"),
    SIGN_TRON_TRANSACTION: Tn("SignTronTransaction"),
    SWAP_TRANSACTION_CONFIRMATION: Tn("SwapTransactionConfirmation"),
    UNLOCK_POPUP: Tn("UnlockPopup"),
    TOGGLE_BEACON_CHAIN_NETWORK: En("ToggleBeaconChainNetwork"),
    SIGN_BNB_MESSAGE: En("SignBNBMessage"),
    BITCOIN_SIGN_PSBT: En("signPSBT"),
    BITCOIN_PUSH_PSBT: En("pushPSBT")
};
