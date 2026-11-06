import { f, i } from "./preload-helper-C61CWiqK.js";
import { s } from "./logger-BMfNJZDI.js";
import { B, D, G, H, L as L_1, P, R as R_1, V, W as W_1, ct, dt, f as f_2, it, lt, p, u, ut, z } from "./useAnalytics-COpZR7i2.js";
import { t as t_1 } from "./useQuery-xfIhCxCG.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { _, s as s_1 } from "./Page-7xxhohWn.js";
import { _ as __2, cn, mn, vn } from "./store-cAVdfWrK.js";
import { a as a_1, t as C } from "./Alert-Hvaga4Yx.js";
import { t as L } from "./AssetImage-BQ2Pnx9g.js";
import { t as t_3 } from "./formatTruncatedString-CZ8GNKMv.js";
import { A, E, f as f_3, h, k, m, t as t_4 } from "./sendLikeTransactionType-Bwls70uE.js";
import { t as t_5 } from "./useAsset-DL8yf1Bm.js";
import { t as Y } from "./ClickableArea-BE_vFWHj.js";
import { t as t_6 } from "./formatAssetAmount-BJWMMv5e.js";
import { t as W } from "./FormattedAmount-CZiJdoJL.js";
import { t as t_7 } from "./useAssets-Bjfxdw7H.js";
import { t as t_8 } from "./txType-CH4ucKXs.js";
import { t as t_9 } from "./useIsFeatureEnabled-BIr5U5d0.js";
import { t as t_10 } from "./asset-63gBbrJ-.js";
import { t as t_11 } from "./useNavigateInNewTab-CH8tITZN.js";
import { o as o_1, r, t as t_12 } from "./useFormattedTransaction-CLqdEJDk.js";
import { t as Z } from "./Category-vM_OyGpQ.js";
import { n as n_1, r as r_1, t as Te } from "./Tag-B9IIC0ts.js";
import { t as Se } from "./SpaceshipIllustration-Cm5_a9hc.js";
import { n as n_2, o as o_2 } from "./useTransferable-vb_RgYBB.js";
import { t as t_13 } from "./onramp-revamp-Bs6CZqaj.js";
import { t as Oe } from "./TransactionIcon-j_6iAx8I.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "8619ab06-0c52-4924-9cd8-ae73358be016";
            e._sentryDebugIdIdentifier = "sentry-dbid-8619ab06-0c52-4924-9cd8-ae73358be016";
        }
    } catch (e) {}
})();
const ie = it();
const ce = f(i(), 1);
const le = t_2();
const SquareActionButton = ({ text, icon, theme, onClick, disabled, tooltip, testid })=>{
    const id = ce.useMemo(()=>ie.uniqueId("circle-action-tooltip-"), []);
    return <div className="flex flex-col space-y-2 items-center"><div data-tooltip-id={id} data-tooltip-content={tooltip} data-tooltip-place="top" data-tooltip-role="tooltip"><W_1 testid={testid} disabled={disabled} theme={theme ?? dt.SECONDARY} shape={lt.ICON_SQUARE} onClick={onClick}>{icon}</W_1></div><div><L_1 theme={disabled ? z.LABEL_TERTIARY : z.LABEL_PRIMARY}>{text}</L_1></div>{tooltip && <G id={id} className="tw-tooltip"/>}</div>;
};
const de = {
    DEFAULT: "space-y-5",
    SMALL: "space-y-2",
    TINY: "space-y-1",
    NONE: ""
};
const List = ({ spacing = "space-y-5", noMargin, children })=><div className={`flex flex-col ${noMargin ? "" : "my-5"} ${spacing}`}>{children}</div>;
const ListItem = ({ children, fullWidth })=><div className="flex">• <div className={`pl-2 ${fullWidth ? "w-full" : ""}`}>{children}</div></div>;
const useCoinStatusFetching = (assetId, t = true)=>{
    const { isPending, data } = t_1({
        queryKey: [
            "coin-status",
            assetId
        ],
        queryFn: ()=>vn.emit(t_10.GET_COIN_STATUS, {
                assetId,
                securityInfo: true
            }),
        staleTime: 3600000,
        refetchOnWindowFocus: false,
        enabled: t && !!assetId
    });
    return [
        isPending,
        data
    ];
};
const me = [
    mn.ripple
];
const pe = [
    mn.ripple
];
const useIsTokenRequiringRegistration = (e)=>!!e.address && (!(!me.includes(e.blockchainId) || e.isRegistered !== undefined) || e.isRegistered === false);
const GenericAssetAlertMessage = ({ coinStatus, asset, onlyStakingBanner = false })=>{
    const a = useIsTokenRequiringRegistration(asset);
    const n = ce.useCallback((e)=>(e.metadata.enabled || e.metadata.enabled === undefined) && e.targets.extension_enabled && p(f_2(), e.targets.extension_version_from ?? null, e.targets.extension_version_to ?? null) && (onlyStakingBanner ? e.type === "staking_banner" : e.type !== "staking_banner") && !(asset.blockchainId === "ripple" && asset.address && e.metadata.description === "Enable this token to start using it." && !a) && !(asset.blockchainId === "aptos" && !a), [
        coinStatus,
        a,
        onlyStakingBanner
    ]);
    const getMessageType = (type)=>{
        switch(type){
            case "error":
                return a_1.ERROR;
            case "warning":
            default:
                return a_1.WARNING;
            case "ok":
                return a_1.DEFAULT;
        }
    };
    const r = ce.useMemo(()=>Boolean(coinStatus?.messages.some(n)), [
        coinStatus
    ]);
    if (coinStatus && r) {
        return <div className="flex space-y-2 flex-col">{coinStatus.messages.map((e)=>{
            if (n(e)) {
                return <C key={e.id} theme={getMessageType(e.metadata.type)}><pre className="font-brand text-tw3-paragraph-footnote text-tw3-label-primary whitespace-pre-wrap">{e.metadata.description}</pre>{e.metadata.link && e.metadata.link.url && <div className="inline-block"><L_1 theme={z.LABEL_PRIMARY} weight={V.MEDIUM}><a target="_blank" rel="noopener nofollow noreferrer" href={e.metadata.link?.url}>Learn More</a></L_1></div>}</C>;
            }
            return null;
        })}</div>;
    }
    return null;
};
const fe = {
    INITIATE: "initiate",
    UPDATE: "update",
    CLOSE: "close",
    SET_CURRENT_WALLET: "set-current-wallet"
};
const SwapRowSummary = ({ transaction })=>{
    const t = h(transaction);
    const s = t_5(t?.sent.assetId ?? "");
    const n = t_5(t?.received.assetId ?? "");
    const r = n?.symbol ?? t?.received.symbol;
    const o = n?.name ?? t?.received.name ?? r;
    const src = n?.iconUrl ?? t?.received.iconUrl;
    if (!t || !s?.symbol || !r) {
        return null;
    }
    const s_symbol = s.symbol;
    const name = o ?? r;
    return <div className="flex min-w-0 items-center gap-1"><L src={s?.iconUrl} name={s?.name ?? s_symbol} size={ct.XXSMALL} abstractFallback/><L_1 type={B.BODY} theme={z.LABEL_SECONDARY}>{s_symbol}</L_1><L_1 type={B.BODY} theme={z.LABEL_SECONDARY}>→</L_1><L src={src} name={name} size={ct.XXSMALL} abstractFallback/><L_1 type={B.BODY} theme={z.LABEL_SECONDARY}>{r}</L_1></div>;
};
const TransactionSubtitle = ({ type, from, to, symbol, swapToSymbol })=>{
    const { formatMessage } = P();
    const l = t_3({
        value: from ?? "",
        maxCharsPerSide: 7
    });
    const d = t_3({
        value: to ?? "",
        maxCharsPerSide: 7
    });
    let m;
    switch(type){
        case t_8.Receive:
        case t_8.Claim:
        case t_8.ClaimRewards:
        case t_8.Undelegate:
            m = `${formatMessage({
                id: "generic.from"
            })}: ${l}`;
            break;
        case t_8.Send:
        case t_8.Delegate:
        case t_8.Redelegate:
        case t_8.Compound:
        case t_8.Approve:
        case t_8.Revoke:
            m = `${formatMessage({
                id: "generic.to"
            })}: ${d}`;
            break;
        case t_8.Swap:
            m = swapToSymbol ? `${symbol} → ${swapToSymbol}` : symbol;
            break;
        default:
            return null;
    }
    return <L_1 testid="tx-item-subtitle" type={B.BODY} theme={z.LABEL_SECONDARY}>{m}</L_1>;
};
const TransactionRecordRow = ({ transaction, onOpen })=>{
    const { formatMessage } = P();
    const a = _();
    const n = ce.useMemo(()=>[
            "merlin",
            "internet_computer",
            "blast",
            "scroll",
            "bouncebit"
        ], []);
    const { id, status, type, from, to, symbol, swapToSymbol, isCrossChainSwap, nft, amount, fee, isUnlimited } = t_12(transaction);
    const I = type === t_8.Receive || type === t_8.ClaimRewards || type === t_8.Claim || type === t_8.Undelegate;
    const S = t_4(type);
    const to_1 = Array.isArray(to) && to.length > 0 && to[0].id !== undefined ? to[0].id : to;
    const R = ce.useMemo(()=>{
        if (type === t_8.Revoke) {
            return "0";
        }
        if (S || I || type === t_8.Swap || type === t_8.Contract && parseFloat(amount) > 0 || type === t_8.Approve && parseFloat(amount) > 0) {
            return amount;
        }
        return fee[0] || "0";
    }, [
        S,
        fee,
        amount,
        type
    ]);
    const shouldHideAmount = type === t_8.Approve && isUnlimited || type === t_8.Revoke;
    return <Y testid="tx-item" onClick={()=>{
        onOpen?.();
        a(`${H.TRANSACTION}/${encodeURIComponent(id)}`);
    }}><div className="flex items-center justify-between"><div className="flex items-center space-x-3"><div className="flex w-9 h-9 justify-center items-center"><Oe status={status} type={type}/></div><div className="flex flex-col space-y-1"><div className="flex items-center space-x-1"><L_1 testid="tx-type">{type === t_8.Swap && isCrossChainSwap ? formatMessage({
        id: "component.transaction-item.type.bridge",
        defaultMessage: "Bridge"
    }) : formatMessage({
        id: `component.transaction-item.type.${type}`
    })}</L_1>{status !== "confirmed" && (!n.includes(transaction.blockchain.id) || status === "pending") && <Te testid="tx-status" size={n_1.SMALL} theme={status === "pending" ? r_1.WARNING : r_1.ERROR}>{formatMessage({
        id: `component.transaction-item.status.${status}`
    })}</Te>}</div>{type === t_8.Swap && h(transaction) && swapToSymbol ? <SwapRowSummary transaction={transaction}/> : (typeof to_1 === "string" || typeof from === "string") && <TransactionSubtitle type={type} from={from} to={to_1} symbol={symbol} swapToSymbol={swapToSymbol}/>}</div></div><div>{nft ? <L size={ct.LARGE} src={nft.previewImage.url} name={nft.name} network={nft.blockchain}/> : <W testid="tx-amount" amountType={t_6.CRYPTO} value={R} currency={symbol} theme={R === "0" ? z.LABEL_PRIMARY : I ? z.SUCCESS : z.LABEL_PRIMARY} prefix={R === "0" || type === t_8.Approve || type === t_8.Revoke ? "" : I ? "+" : "-"} tinyThreshold={6} maxSignificantDecimals={6} shouldHideAmount={shouldHideAmount} align={R_1.RIGHT}/>}</div></div></Y>;
};
function useIsSwapEnabled(e) {
    return n_2(t_5(e), s_1());
}
function getSwapUrl(e) {
    if (e) {
        if (e.defaultSwapPair) {
            return `${H.SWAP}?from=${e.defaultSwapPair.fromAsset}&to=${e.defaultSwapPair.toAsset}`;
        }
        if (e.defaultSwapCrossChainPair) {
            return `${H.SWAP}?from=${e.defaultSwapCrossChainPair.fromAsset}&to=${e.defaultSwapCrossChainPair.toAsset}`;
        }
        return `${H.SWAP}?from=${e.assetId}`;
    }
    return H.SWAP;
}
const TransactionList = ({ transactions, children, loadMoreItems, hasNextPage, historyAvailable, fetchingStarted, fetchingTransactions, scrollableAreaHeight, asset, onTransactionOpen })=>{
    const { formatMessage } = P();
    const j = t_11();
    const w = _();
    const I = ((e)=>{
        const t = t_5(e);
        const s = o_2(e);
        return !!e && t?.isBuyCryptoEnabled && !s;
    })(asset?.assetId ?? "");
    const T = useIsSwapEnabled(asset?.assetId ?? "");
    const R = getSwapUrl(asset);
    const ERef = ce.useRef(null);
    const k = ce.useMemo(()=>{
        const e = scrollableAreaHeight < (ERef.current?.offsetHeight ?? 0);
        return historyAvailable && !e && hasNextPage || fetchingStarted && fetchingTransactions;
    }, [
        historyAvailable,
        Object.values(transactions).length,
        hasNextPage
    ]);
    const C = Object.keys(transactions).length > 0;
    const { enabled } = t_9(t_13);
    return <div className="flex flex-col w-full space-y-4 mb-3 items-center" ref={ERef}>{children}{C && <div className="flex flex-col w-full space-y-4">{Object.entries(transactions).map(([e, t])=><Z key={e} title={e}>{t.map((transaction)=><TransactionRecordRow key={__2(transaction)} transaction={transaction} onOpen={onTransactionOpen}/>)}</Z>)}</div>}{!C && !fetchingTransactions && <div className="flex flex-col space-y-4 items-center w-[310px]"><Se/><div className="text-center px-6"><L_1 type={B.BODY} theme={z.LABEL_SECONDARY}>{formatMessage({
        id: "history-list.no-transactions-found",
        defaultMessage: "Your crypto transactions will appear here once you start using wallet."
    })}</L_1></div>{I || T && <W_1 testid="show-more-btn" onClick={I ? ()=>{
        if (enabled) {
            w(H.BUY_NEW, asset ? {
                state: {
                    assetId: asset.assetId
                }
            } : undefined);
        } else {
            j(`${H.BUY}/${asset?.assetId ?? ""}`);
        }
    } : ()=>{
        w(R, {
            state: {
                pageViewSource: D.ASSET,
                pushedFrom: "asset"
            }
        });
    }} shape={lt.DEFAULT} theme={dt.PRIMARY}>{formatMessage({
        id: `history-list.${I ? "buy" : "swap"}-crypto`,
        defaultMessage: I ? "Buy Crypto" : "Swap Crypto"
    })}</W_1>}</div>}{k && <W_1 testid="show-more-btn" onClick={loadMoreItems} shape={lt.DEFAULT} size={ut.SMALL} theme={dt.SUBTLE} fullWidth={false} loading={fetchingTransactions} loadingData={formatMessage({
        id: "generic.loading",
        defaultMessage: "Loading"
    })}>{formatMessage({
        id: "history-list.load-more"
    })}</W_1>}</div>;
};
const ue = new Date("01/03/2009");
const he = {
    cancelRefetch: false
};
function getDateMonthsAgo(e, t) {
    const s = new Date(e.getTime());
    s.setMonth(s.getMonth() - t);
    return s;
}
function getDateDaysAgo(e, t) {
    const s = new Date(e.getTime());
    s.setDate(s.getDate() - t);
    return s;
}
const isIndexedIntentSettlement = (e, t, s)=>{
    const a = m(e);
    const n = h(e);
    const r = h(t);
    const o = e.events?.find((e)=>e.type === "swap");
    const i = t.events?.find((e)=>e.type === "swap");
    return !(a?.dstBlockchainId !== e.blockchain?.id || !n || !r || t.status !== "confirmed" || t.swapPressId || t.blockchain?.id !== e.blockchain?.id || t.createdAt < e.createdAt || t.createdAt - e.createdAt > 900000) && E(r.sent.assetId) === E(n.sent.assetId) && E(r.received.assetId) === E(n.received.assetId) && ((e, t, s)=>{
        try {
            return !!cn(e).eq(t) || s !== undefined && cn(e).div(cn(10).pow(s)).eq(t);
        } catch  {
            return false;
        }
    })(r.sent.value, n.sent.value, s.get(E(n.sent.assetId))) && (c = i?.metadata.from, l = o?.metadata.from, typeof c === "string" && typeof l === "string" && c.toLowerCase() === l.toLowerCase());
    var c;
    var l;
};
let ge = false;
const useTransactionsByDate = (e, t)=>{
    const { locale } = P();
    const n = u();
    const r = t_7();
    ce.useEffect(()=>{
        if (ge) {
            return;
        }
        const e = n.find((e)=>typeof e.assetId !== "string");
        if (e) {
            ge = true;
            s(new Error("Transaction record has a non-string assetId"), {
                context: "useTransactionsByDate",
                assetIdType: typeof e.assetId,
                assetIdPreview: f_3(e.assetId),
                blockchainId: e.blockchain?.id,
                eventTypes: e.events?.map((e)=>e.type).join(",") ?? ""
            });
        }
    }, [
        n
    ]);
    const o = ce.useMemo(()=>new Set(r.filter((e)=>e.isShownInHomeScreen || Number(e.balance) > 0).map((e)=>E(e.assetId)).filter(Boolean)), [
        r
    ]);
    return ce.useMemo(()=>{
        const s = e && t ? n.filter((s)=>{
            const a = s.events.some((e)=>(function sendLikeTransactionType(e) {
                    return e === t_8.Trade || e === t_8.Inscribe || e === t_8.Send || e === t_8.Delegate || e === t_8.Undelegate || e === t_8.ClaimRewards || e === t_8.Claim || e === t_8.Compound || e === t_8.Redelegate || e === t_8.Utxo || e === t_8.Contract || e === t_8.Receive || e === t_8.Revoke || e === t_8.Approve;
                })(e.type) || e.type === "swap") && s.blockchain.id === e.id && s.assetId === t.assetId;
            if (s.events.some((e)=>e.type === "contract" || e.type === "swap")) {
                return a;
            }
            return a && !s.events.some((e)=>!e.metadata.to);
        }) : n;
        const i = Boolean(e && t);
        const c = o.size > 0;
        const l = ((e, t = [])=>{
            const s = new Set;
            const a = new Map(t.map((e)=>[
                    E(e.assetId),
                    e.decimals
                ]));
            for (const o of e){
                for (const e of o.events ?? []){
                    if (e.type !== "swap") {
                        continue;
                    }
                    const t = e.metadata?.bridge;
                    if (t?.dstTxHash && t.dstTxHash !== o.hash && t.dstBlockchainId === o.blockchain?.id) {
                        s.add(t.dstTxHash);
                    }
                }
            }
            const n = e.filter((e)=>!o_1(e) && !s.has(e.hash)).sort((e, t)=>e.createdAt - t.createdAt);
            const r = e.filter(o_1).sort((e, t)=>e.createdAt - t.createdAt);
            for (const o of r){
                const e = n.findIndex((e)=>isIndexedIntentSettlement(o, e, a));
                if (e < 0) {
                    continue;
                }
                const [t] = n.splice(e, 1);
                s.add(t.hash);
            }
            return s;
        })(s, r);
        const d = s.filter((e)=>e.events.some((e)=>e.type !== undefined) && !l.has(e.hash) && !(i ? k(e, o) : c && A(e, o)));
        const m = {};
        for (const e of d){
            const t = new Date(e.createdAt);
            const s = `${t.toLocaleDateString(locale, {
                month: "short"
            })} ${t.getDate()}, ${t.getFullYear()}`;
            if (!m[s]) {
                m[s] = [];
            }
            m[s].push(e);
        }
        return m;
    }, [
        t?.address,
        e?.chainId,
        e?.id,
        n,
        o,
        r
    ]);
};
export { List as _, he as a, useIsSwapEnabled as c, useIsTokenRequiringRegistration as d, me as f, de as g, ListItem as h, ue as i, fe as l, useCoinStatusFetching as m, getDateDaysAgo as n, TransactionList as o, pe as p, getDateMonthsAgo as r, getSwapUrl as s, useTransactionsByDate as t, GenericAssetAlertMessage as u, SquareActionButton as v };
