import { i } from "./store-cAVdfWrK.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const d = (new e.Error).stack;
        if (d) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[d] = "a3a62f08-1104-4214-ae26-b9fd5d87bcdb";
            e._sentryDebugIdIdentifier = "sentry-dbid-a3a62f08-1104-4214-ae26-b9fd5d87bcdb";
        }
    } catch (e) {}
})();
function useSeedPhraseBackupRequired() {
    return i((e)=>e.wallet.wallets[e.wallet.walletId]?.seedPhraseBackupRequired);
}
export { useSeedPhraseBackupRequired as t };
