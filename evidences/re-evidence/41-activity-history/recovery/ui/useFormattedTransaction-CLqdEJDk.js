import { f, i } from "./preload-helper-C61CWiqK.js";
import { B } from "./store-cAVdfWrK.js";
import { n } from "./useAccounts-CoMylq9s.js";
import { t as t_1 } from "./useBlockchains-CyglC5V0.js";
import { C, T, _, b as b_1, g, x, y as y_1 } from "./sendLikeTransactionType-Bwls70uE.js";
import { n as n_1, t as t_2 } from "./useAsset-DL8yf1Bm.js";
import { t as t_3 } from "./useAccount-DmXl3FcQ.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "bb042236-8374-47ba-a998-33a2ad1a5521";
            e._sentryDebugIdIdentifier = "sentry-dbid-bb042236-8374-47ba-a998-33a2ad1a5521";
        }
    } catch (e) {}
})();
const b = "swap-pending:";
export const r = 900000;
const provisionalSwapHash = (e)=>`${b}${e}`;
const isProvisionalSwap = (e)=>e.hash.startsWith(b);
const isFailedSwapAttempt = (e)=>e.hash.startsWith("swap-failed:");
const isLocalSwapAttempt = (e)=>isProvisionalSwap(e) || isFailedSwapAttempt(e);
const y = f(i(), 1);
function useAnyBlockchain(e) {
    const t = t_1();
    const a = n();
    return y.useMemo(()=>t[e] ?? a[e], [
        e,
        t,
        a
    ]);
}
const useFormattedTransaction = (e)=>{
    const t = useAnyBlockchain(e.blockchain.id);
    const n = t_3(t?.coinId);
    const s = n_1(t, e.assetId);
    const b = e.events[0]?.type === "swap" ? e.events[0].metadata : undefined;
    const v = t_2(b?.sent?.assetId ?? "");
    const h = t_2(b?.received?.assetId ?? "");
    return y.useMemo(()=>{
        const c = {
            id: e.hash,
            from: e.events[0].metadata.from,
            to: e.events[0].metadata.to,
            type: e.events[0].type,
            status: e.status,
            symbol: v?.symbol ?? s?.symbol ?? t?.symbol ?? "",
            swapToSymbol: h?.symbol,
            isCrossChainSwap: x(e.events[0]),
            fee: e.fee,
            date: e.createdAt,
            amount: g(e, s)
        };
        if (T(e.events)) {
            if (!n) {
                c.type = B.Send;
                c.amount = Math.abs(Number(c.amount)).toString();
                return c;
            }
            const t = n.address;
            const { from, to } = e.events[0].metadata;
            const i = from === t ? to : from;
            if (parseFloat(c.amount) > 0) {
                c.type = B.Receive;
                c.from = i;
                c.to = t;
            } else {
                c.type = B.Send;
                c.from = t;
                c.to = i;
                c.amount = Math.abs(Number(c.amount)).toString();
            }
        }
        if (b_1(e.events)) {
            c.input = e.events[0].metadata.input;
        }
        if (_(e.events)) {
            c.isUnlimited = e.events[0].metadata.isUnlimited;
        }
        if (y_1(e.events)) {
            c.burnData = {
                tokenCount: e.events[0].metadata.tokenCount,
                estimatedReceived: e.events[0].metadata.estimatedReceived,
                totalFiatValue: e.events[0].metadata.totalFiatValue,
                tokens: e.events[0].metadata.tokens
            };
        }
        if (C(e.events)) {
            const t = e.events[0].metadata;
            if (t.internal) {
                c.burnData = {
                    tokenCount: t.internal.tokenCount,
                    estimatedReceived: t.internal.estimatedReceived,
                    totalFiatValue: t.internal.totalFiatValue,
                    tokens: t.internal.tokens
                };
            }
        }
        if (e.nft) {
            c.nft = {
                onChainId: e.nft.onChainId,
                previewImage: e.nft.previewImageURL,
                originalImage: e.nft.originalMediaURL,
                name: e.nft.name,
                collectionName: e.nft.collectionName,
                collectionId: e.nft.collectionId,
                blockchain: {
                    iconUrl: t?.iconUrl,
                    name: t?.displayName ?? t?.name ?? ""
                }
            };
        }
        return c;
    }, [
        JSON.stringify(e),
        s,
        t,
        n,
        v?.symbol,
        h?.symbol
    ]);
};
export { isLocalSwapAttempt as a, isFailedSwapAttempt as i, useAnyBlockchain as n, isProvisionalSwap as o, provisionalSwapHash as s, useFormattedTransaction as t };
