import { f, i } from "./preload-helper-C61CWiqK.js";
import { t } from "./logger-BMfNJZDI.js";
import { B, D, H, L, N as N_1, O, P, R, V as V_1, W, at as X1, ct, dt, ot, t as t_1, u, z } from "./useAnalytics-COpZR7i2.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { _ as __1, a as V1, f as T, i as K1, n as N, t as C, v } from "./Page-7xxhohWn.js";
import { B as B_2, Dt, M, Ot, cn, dt as dt_1, ft, g, ut, w } from "./store-cAVdfWrK.js";
import { t as t_3 } from "./useAnalyticsCaptureOnMount-BJcdtAcr.js";
import { a as a_1, i as U, t as G } from "./Alert-Hvaga4Yx.js";
import { t as _ } from "./CheckSolidIcon-BhQrXkEI.js";
import { t as V } from "./AssetImage-BQ2Pnx9g.js";
import { t as t_4 } from "./useNetworkBlockchain-Da_3X3wB.js";
import { t as t_5 } from "./formatTruncatedString-CZ8GNKMv.js";
import { C as C_1, N as N_2, S, g as g_2, h } from "./sendLikeTransactionType-Bwls70uE.js";
import { t as t_6 } from "./useFiat-DH2a13VO.js";
import { i as i_2, n as n_1, t as t_7 } from "./useAsset-DL8yf1Bm.js";
import { t as Se1 } from "./transition-B174DQ7a.js";
import { n as Te1, r as Ae1, t as Ne1 } from "./popover-C4NHkoPs.js";
import { t as t_8 } from "./formatAssetAmount-BJWMMv5e.js";
import { t as Re1 } from "./FormattedAmount-CZiJdoJL.js";
import { t as t_9 } from "./useSelectedBaseCurrency-drfds3sV.js";
import { a as a_2, c, i as De, o, r as Ue, s, t as He } from "./TransactionSenderRow-ctp5_55S.js";
import { r, t as Fe1 } from "./DataListRow-CWCrec8q.js";
import { t as Je } from "./SkeletonLine-gBdUFNjv.js";
import { n as n_2, t as Ge } from "./CopyIcon-BjPIDqyP.js";
import { t as Be } from "./CopyToClipboardButton-C1uY6ocr.js";
import { t as We } from "./ChevronDownIcon--tkyd4-4.js";
import { r as r_1 } from "./window-COx4dq7s.js";
import { a as a_3, i as i_3, n as n_3, o as o_2, t as t_10 } from "./useFormattedTransaction-CLqdEJDk.js";
import { t as Re } from "./FormattedDate-KI6n61_6.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const s = (new e.Error).stack;
        if (s) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[s] = "8489d67f-0df6-4ace-bff7-0ecd7fa06b9f";
            e._sentryDebugIdIdentifier = "sentry-dbid-8489d67f-0df6-4ace-bff7-0ecd7fa06b9f";
        }
    } catch (e) {}
})();
ut();
Ot();
new Dt("units/5.8.0");
const Ae = [
    "wei",
    "kwei",
    "mwei",
    "gwei",
    "szabo",
    "finney",
    "ether"
];
const Ee = t_2();
const BurnTokensList = ({ tokens, tokenCount, totalFiatValue, isDarkenedMode, centered })=>{
    const { currency } = t_9();
    return <Ae1 className="relative"><Ne1 className="flex items-center space-x-2 outline-none"><div className={`flex flex-col ${centered ? "items-center" : "items-end"} flex-1 space-y-1`}><L type={B.SUBTITLE}><N_1 id="dust-cleaner.token-count" defaultMessage="{count, plural, one {# token} other {# tokens}}" values={{
        count: tokenCount
    }}/></L><Re1 textType={B.FOOTNOTE} theme={z.LABEL_SECONDARY} value={parseFloat(totalFiatValue)} amountType={t_8.FIAT} currency={currency}/></div><div className="flex items-center"><We width={16} height={16} colorClass="text-tw3-label-secondary"/></div></Ne1><Se1 enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1"><Te1 className={`absolute ${centered ? "left-1/2 -translate-x-1/2" : "right-0"} mt-2 z-10 shadow-lg rounded-2xl p-4 max-h-64 overflow-y-auto min-w-[280px] ${isDarkenedMode ? "bg-tw3-background-secondary" : "bg-tw3-background-primary"}`}><div className="flex flex-col space-y-3">{tokens.map((e)=><div key={e.assetId} className="flex items-center space-x-3 px-1"><V src={e.iconUrl} name={e.name} size={ct.SMALL}/><div className="overflow-hidden flex-1 min-w-0"><div className="truncate"><Re1 textType={B.EMPHASIS} value={parseFloat(e.balance)} amountType={t_8.CRYPTO} currency={e.symbol}/></div></div></div>)}</div></Te1></Se1></Ae1>;
};
const TransactionStatus = ({ status })=>{
    const { formatMessage } = P();
    switch(status){
        case "failed":
            return <div className="flex items-center space-x-1"><div><L testid="tx-status" theme={z.ERROR}>{formatMessage({
                id: "generic.failed"
            })}</L></div><div className="text-tw3-destructive-primary-default"><U width={15} height={15}/></div></div>;
        case "pending":
            return <div className="flex items-center space-x-1"><div><L testid="tx-status" theme={z.WARNING}>{formatMessage({
                id: "generic.pending"
            })}</L></div></div>;
        case "confirmed":
            return <div className="flex items-center space-x-1"><div><L testid="tx-status" theme={z.SUCCESS}>{formatMessage({
                id: "generic.confirmed"
            })}</L></div><div className="text-tw3-success-primary-default"><_ width={15} height={15}/></div></div>;
    }
};
const Se = f(i(), 1);
const TransactionDetails = ({ transaction, asset, network, totalTransactionFee, gasPrice })=>{
    const { formatMessage } = P();
    const { isAdvancedTransactionDataEnabled } = c();
    const { from, to, type, input, amount, isUnlimited, burnData } = t_10(transaction);
    const f = Se.useMemo(()=>(transaction.feeIs7702 || transaction.solanaFlexGasRequestId !== undefined) && transaction.status === "pending", [
        transaction
    ]);
    const j = Se.useMemo(()=>{
        if (transaction.solanaFlexGasRequestId) {
            return transaction.hash;
        }
        if (transaction.feeIs7702) {
            return transaction.initialHash ?? transaction.hash;
        }
        return transaction.hash;
    }, [
        transaction
    ]);
    return <V1><Fe1 label={formatMessage({
        id: "generic.status"
    })}><TransactionStatus status={transaction.status}/></Fe1><Fe1 label={formatMessage({
        id: "generic.time"
    })}><Re value={transaction.createdAt}/></Fe1>{transaction.nft && <><Fe1 label={formatMessage({
        id: "generic.collection"
    })}><L>{transaction.nft.collectionName}</L></Fe1><Fe1 label={`${formatMessage({
        id: "generic.token"
    })} ID`}><L>{transaction.nft.onChainId}</L></Fe1></>}<He network={network} sender={from}/><Ue recipient={to} type={type} network={transaction.destination?.blockchain ?? network}/><Fe1 label={formatMessage({
        id: "generic.hash"
    })}><Je isLoading={f} widthClass="w-22.5" heightClass="h-4"><div className="flex space-x-1 items-center"><L>{t_5({
        value: j
    })}</L><Be width={15} height={15} value={j}/></div></Je></Fe1>{transaction.memo && <Fe1 label={formatMessage({
        id: "generic.memo"
    })}><L>{isNaN(parseInt(transaction.memo)) ? transaction.memo : parseInt(transaction.memo)}</L></Fe1>}{(parseFloat(amount) > 0 || isUnlimited || type === B_2.Burn || C_1(transaction.events)) && <Fe1 label={formatMessage({
        id: "generic.amount"
    })}>{(type === B_2.Burn || C_1(transaction.events)) && burnData ? <BurnTokensList tokens={burnData.tokens} tokenCount={burnData.tokenCount} totalFiatValue={burnData.totalFiatValue}/> : <Re1 testid="tx-amount" value={amount} amountType={t_8.CRYPTO} currency={transaction.nft ? "" : asset.symbol} tinyThreshold={10} maxSignificantDecimals={10} isUnlimited={isUnlimited}/>}</Fe1>}{(type === B_2.Burn || C_1(transaction.events)) && burnData?.estimatedReceived && <Fe1 label={formatMessage({
        id: "generic.receive"
    })}><Re1 value={burnData.estimatedReceived} amountType={t_8.CRYPTO} currency={type === B_2.Burn ? "SOL" : asset.symbol} maxSignificantDecimals={9}/></Fe1>}<Fe1 label={formatMessage({
        id: "generic.network-fee"
    })}>{transaction.fee.map((a, n)=><Re1 key={n + a} testid={`tx-fee-${n}`} value={transaction.feeIs7702 ? transaction.initialFee?.[0] ?? a : a} amountType={t_8.CRYPTO} tinyThreshold={10} maxSignificantDecimals={10} currency={transaction?.feeAsset?.symbol ?? N_2(network, asset)}/>)}</Fe1><Fe1 label={formatMessage({
        id: "generic.network"
    })}><L testid="tx-network">{network.displayName ?? network.name}</L></Fe1>{isAdvancedTransactionDataEnabled && <>{transaction.nonce && <Fe1 label={formatMessage({
        id: "generic.nonce"
    })}><L>{parseInt(transaction.nonce)}</L></Fe1>}{transaction.gasLimit && <Fe1 label={formatMessage({
        id: "generic.gas-limit"
    })}><L>{parseInt(transaction.gasLimit)}</L></Fe1>}{transaction.gasPrice && <Fe1 label={formatMessage({
        id: "generic.gas-price"
    })}><L>{gasPrice} {network.symbol}</L></Fe1>}{type === B_2.Contract && <Fe1 label={formatMessage({
        id: "generic.input-data"
    })}><div className="w-2/3 bg-tw3-background-secondary rounded-lg p-4 text-right overflow-auto"><L>{input}</L></div></Fe1>}</>}{!network.isCustom && <De asset={asset} blockchain={network} type={type} amount={transaction.nft ? 0 : parseFloat(amount)} fee={totalTransactionFee} feeAsset={transaction.feeAsset}/>}</V1>;
};
const TransactionFooter = ({ transaction })=>{
    const { formatMessage } = P();
    const t = t_4(transaction.blockchain.id, transaction.blockchain.isCustom);
    const { trackAnalytics } = t_1();
    const i = o_2(transaction) || (transaction.feeIs7702 || transaction.solanaFlexGasRequestId !== undefined) && transaction.status === "pending";
    const r = s(t, transaction.hash);
    if (!r || i_3(transaction)) {
        return null;
    }
    return <div><W onClick={async ()=>{
        trackAnalytics({
            event: D.BLOCKCHAIN_EXPLORER,
            props: {
                pageViewResourceType: O.EXTERNAL,
                explorerUrl: t?.explorer?.url ?? ""
            }
        });
        await r_1(r);
    }} loading={i} disabled={i}>{formatMessage({
        id: "transaction.btn-view-on-explorer"
    })}</W></div>;
};
const TransactionHeader = ({ asset, transaction, totalTransactionFee })=>{
    const n = t_4(transaction.blockchain.id, transaction.blockchain.isCustom);
    const { type, burnData } = t_10(transaction);
    const l = t_6(asset);
    const { currency, baseCurrencyType } = t_9();
    const transaction_nft = transaction.nft;
    const m = type === B_2.Burn;
    const u = type === B_2.Swap && burnData;
    const x = Se.useMemo(()=>Number(g_2(transaction, asset)), [
        transaction,
        asset
    ]);
    const p = l?.price ? cn(transaction_nft ? totalTransactionFee : x).mul(l.price ?? 0).toNumber() : null;
    if ((m || u) && burnData) {
        const e = burnData.tokens[0];
        return <div className="flex flex-col items-center space-y-1"><div className="relative"><V name={e.name} src={e.iconUrl} size={ct.XLARGE}/><div className="absolute bottom-0 right-0 bg-tw3-background-secondary rounded-full w-5 h-5 flex items-center justify-center border-2 border-tw3-background-primary"><span className="text-tw3-label-secondary text-center font-inter text-xs font-semibold leading-[18px]">{burnData.tokenCount}</span></div></div><BurnTokensList tokens={burnData.tokens} tokenCount={burnData.tokenCount} totalFiatValue={burnData.totalFiatValue} centered/></div>;
    }
    return <div className="flex flex-col items-center space-y-1"><V name={transaction_nft ? transaction.nft?.name ?? "" : asset.name} network={M(asset, n)} src={transaction_nft ? transaction.nft?.previewImageURL.url : asset.iconUrl} size={ct.XLARGE}/>{x === 0 ? null : <Re1 textType={B.TITLE1} amountType={t_8.CRYPTO} value={x}/>}{p === 0 ? null : <Re1 textType={B.BODY} theme={z.LABEL_SECONDARY} amountType={baseCurrencyType} value={p} currency={currency}/>}</div>;
};
const TransactionStatusBanner = ({ transaction, network })=>{
    const { formatMessage } = P();
    const a = __1();
    const n = s(network, transaction.hash);
    const l = transaction.status === "pending" && !o_2(transaction) && Date.now() - transaction.createdAt >= 900000;
    const o = transaction.status === "failed" && C_1(transaction.events);
    const d = o && a_3(transaction);
    if (l || o) {
        return <div className="my-3 space-y-3">{l && <G theme={a_1.WARNING} testid="tx-still-pending-banner"><L weight={V_1.SEMIBOLD} theme={z.WARNING}>{formatMessage({
            id: "transaction.still-pending.title",
            defaultMessage: "This transaction is still pending"
        })}</L><L theme={z.WARNING}>{formatMessage({
            id: "transaction.still-pending.body",
            defaultMessage: "It's taking longer than usual to confirm. You can check its status on the block explorer, or learn what to do if it stays stuck."
        })}</L><div className="flex space-x-4 mt-2">{n && <button type="button" data-testid="tx-still-pending-explorer" className="text-primary font-medium text-tw3-paragraph-body" onClick={()=>r_1(n)}>{formatMessage({
            id: "transaction.btn-view-on-explorer"
        })}</button>}<button type="button" data-testid="tx-still-pending-support" className="text-primary font-medium text-tw3-paragraph-body" onClick={()=>r_1("https://support.trustwallet.com/en/support/solutions/articles/67000635278-why-is-my-transaction-pending-or-stuck-")}>{formatMessage({
            id: "transaction.still-pending.learn-more",
            defaultMessage: "Learn more"
        })}</button></div></G>}{o && <G theme={a_1.ERROR} testid="tx-failed-swap-banner"><L weight={V_1.SEMIBOLD} theme={z.ERROR}>{formatMessage({
            id: d ? "transaction.swap-not-submitted.title" : "transaction.swap-reverted.title",
            defaultMessage: d ? "This swap was not submitted" : "This swap failed on-chain"
        })}</L><L theme={z.ERROR}>{formatMessage({
            id: d ? "transaction.swap-not-submitted.body" : "transaction.swap-reverted.body",
            defaultMessage: d ? "The swap stopped before a swap transaction was submitted. Your funds were not swapped. You can try again with a fresh quote." : "The transaction was reverted on-chain. This often happens when the price moves past the allowed slippage. Your funds were not swapped (network fees still apply). You can try again with a fresh quote."
        })}</L><div className="mt-3"><W testid="tx-failed-swap-retry" theme={dt.SECONDARY} onClick={()=>a(H.SWAP, {
                state: {
                    pushedFrom: "transaction"
                }
            })}>{formatMessage({
            id: "transaction.swap-reverted.retry",
            defaultMessage: "Try again"
        })}</W></div></G>}</div>;
    }
    return null;
};
const SwapLeg = ({ symbol, name, iconUrl, network, amount, prefix, amountTheme, fiatValue, currency, baseCurrencyType })=>{
    const x = name && name !== symbol ? name : network?.displayName ?? network?.name ?? name;
    return <div className="flex items-center justify-between space-x-2 py-2"><div className="flex min-w-0 items-center space-x-3"><V src={iconUrl} name={name} network={network} size={ct.LARGE}/><div className="flex min-w-0 flex-col"><L type={B.SUBTITLE} theme={z.LABEL_PRIMARY}>{symbol}</L><L type={B.BODY} theme={z.LABEL_SECONDARY}>{x}</L></div></div><div className="flex min-w-0 flex-col items-end"><Re1 textType={B.SUBTITLE} theme={amountTheme} amountType={t_8.CRYPTO} value={amount} currency={symbol} prefix={prefix} tinyThreshold={10} maxSignificantDecimals={10} align={R.RIGHT}/>{fiatValue !== null && <Re1 textType={B.BODY} theme={z.LABEL_SECONDARY} amountType={baseCurrencyType} value={fiatValue} currency={currency} prefix="≈ " align={R.RIGHT}/>}</div></div>;
};
const StatusConnector = ({ status })=>{
    switch(status){
        case "confirmed":
            return <_ width={20} height={20} colorClass="text-tw3-success-primary-default"/>;
        case "failed":
            return <U width={20} height={20} colorClass="text-tw3-destructive-primary-default"/>;
        default:
            return <X1 size={ct.SMALL} thickness={2} theme={ot.PRIMARY}/>;
    }
};
const fiatOf = (e, s)=>{
    if (s && s > 0) {
        return cn(e || 0).mul(s).toNumber();
    }
    return null;
};
const SwapTransactionHeader = ({ transaction, asset })=>{
    const t = h(transaction);
    const { currency, baseCurrencyType } = t_9();
    const i = t_7(t?.sent.assetId ?? "") ?? asset;
    const r = t_7(t?.received.assetId ?? "");
    const l = n_3(i.blockchainId);
    const o = n_3(r?.blockchainId ?? "");
    const c = t_6(i);
    const d = t_6(r);
    if (t) {
        return <div className="grid grid-rows-[1fr_auto_1fr] px-1 pb-4"><SwapLeg symbol={i.symbol} name={i.name} iconUrl={i.iconUrl} network={M(i, l)} amount={t.sent.value} prefix="-" amountTheme={z.LABEL_PRIMARY} fiatValue={fiatOf(t.sent.value, c?.price)} currency={currency} baseCurrencyType={baseCurrencyType}/><div className="flex items-center"><div className="flex w-10 justify-center"><StatusConnector status={transaction.status}/></div></div><SwapLeg symbol={r?.symbol ?? ""} name={r?.name ?? ""} iconUrl={r?.iconUrl} network={r && M(r, o)} amount={t.received.value} prefix="+" amountTheme={z.SUCCESS} fiatValue={fiatOf(t.received.value, d?.price)} currency={currency} baseCurrencyType={baseCurrencyType}/></div>;
    }
    return null;
};
const Le = f(n_2(), 1);
const r_TABLE_LIST = r.TABLE_LIST;
const Card = ({ children })=><div className="flex flex-col space-y-1 rounded-4 bg-tw3-background-secondary py-1">{children}</div>;
const HashCopyButton = ({ value })=>{
    const { formatMessage } = P();
    const [t, setT] = Se.useState(false);
    Se.useEffect(()=>{
        if (!t) {
            return;
        }
        const e = setTimeout(()=>setT(false), 1200);
        return ()=>clearTimeout(e);
    }, [
        t
    ]);
    return <button type="button" aria-label={formatMessage({
        id: "generic.copy"
    })} className="flex p-0 text-tw3-label-secondary" onClick={(s)=>{
        s.stopPropagation();
        Le.default(value, {
            format: "text/plain"
        });
        setT(true);
    }}>{t ? <_ width={15} height={15} colorClass="text-tw3-success-primary-default"/> : <Ge width={15} height={15} colorClass="text-tw3-label-secondary"/>}</button>;
};
const SwapTransactionDetails = ({ transaction, asset, network })=>{
    const { formatMessage } = P();
    const { from, to, type } = t_10(transaction);
    const { currency, baseCurrencyType } = t_9();
    const u = i_2(network.coinId);
    const x = t_6(transaction.feeAsset ?? u);
    const currency_1 = transaction.feeAsset?.symbol ?? N_2(network, asset);
    const p = transaction.fee.map((s)=>{
        if (transaction.feeIs7702) {
            return transaction.initialFee?.[0] ?? s;
        }
        return s;
    });
    const f = x?.price ? p.reduce((acc, item)=>acc.plus(parseFloat(item) || 0), new cn(0)).mul(x.price).toNumber() : null;
    const j = i_3(transaction);
    const y = Se.useMemo(()=>o_2(transaction) || (transaction.feeIs7702 || transaction.solanaFlexGasRequestId !== undefined) && transaction.status === "pending", [
        transaction
    ]);
    const b = Se.useMemo(()=>{
        if (transaction.solanaFlexGasRequestId) {
            return transaction.hash;
        }
        if (transaction.feeIs7702) {
            return transaction.initialHash ?? transaction.hash;
        }
        return transaction.hash;
    }, [
        transaction
    ]);
    return <div className="flex flex-col gap-3"><Card><Fe1 variant={r_TABLE_LIST} label={formatMessage({
        id: "generic.time"
    })}><Re value={transaction.createdAt}/></Fe1><Fe1 variant={r_TABLE_LIST} label={formatMessage({
        id: "generic.status"
    })}><TransactionStatus status={transaction.status}/></Fe1><He network={network} sender={from} variant={r_TABLE_LIST} maxCharsPerSide={6} maxCharsEnd={5}/><Ue recipient={to} type={type ?? B_2.Swap} network={transaction.destination?.blockchain ?? network} variant={r_TABLE_LIST} maxCharsPerSide={6} maxCharsEnd={5}/><Fe1 variant={r_TABLE_LIST} label={formatMessage({
        id: "generic.hash"
    })}><Je isLoading={y} widthClass="w-22.5" heightClass="h-4">{j ? <L>—</L> : <div className="flex items-center space-x-1"><L>{t_5({
        value: b,
        maxCharsPerSide: 6,
        maxCharsEnd: 5
    })}</L><HashCopyButton value={b}/></div>}</Je></Fe1>{transaction.memo && <Fe1 variant={r_TABLE_LIST} label={formatMessage({
        id: "generic.memo"
    })}><L>{isNaN(parseInt(transaction.memo)) ? transaction.memo : parseInt(transaction.memo)}</L></Fe1>}</Card><Card><Fe1 variant={r_TABLE_LIST} label={formatMessage({
        id: "generic.network-fee"
    })}><div className="flex min-w-0 flex-col items-end">{p.map((e, s)=><Re1 key={s + e} testid={`tx-fee-${s}`} value={e} amountType={t_8.CRYPTO} currency={currency_1} tinyThreshold={10} maxSignificantDecimals={10} align={R.RIGHT}/>)}{f !== null && <Re1 theme={z.LABEL_SECONDARY} amountType={baseCurrencyType} value={f} currency={currency} prefix="≈ " align={R.RIGHT}/>}</div></Fe1></Card></div>;
};
const Page = ()=>{
    const { id } = v();
    const transaction = ((e)=>{
        const s = u();
        return Se.useMemo(()=>g(s, e), [
            e,
            s
        ]);
    })(id ?? "");
    const blockchain = n_3(transaction?.blockchain.id ?? "");
    const n = t_4(blockchain?.id ?? "", blockchain?.isCustom);
    const asset = n_1(n, transaction?.assetId);
    if (transaction && blockchain && n && asset) {
        return <TransactionPage transaction={transaction} blockchain={blockchain} asset={asset}/>;
    }
    return t.error("Transaction detail: an entity did not resolve; leaving the screen", {
        id,
        hasTransaction: Boolean(transaction),
        txBlockchainId: transaction?.blockchain?.id ?? null,
        txAssetId: transaction?.assetId ?? null,
        resolvedBlockchain: blockchain?.id ?? null,
        resolvedNetwork: n?.id ?? null,
        resolvedAsset: Boolean(asset)
    }), <T to={H.DEFAULT} replace/>;
};
var TransactionPage = ({ transaction, blockchain, asset })=>{
    const { type } = t_10(transaction);
    const { isAdvancedTransactionDataEnabled } = c();
    const gasPrice = Se.useMemo(()=>(function formatUnits(e) {
            let s = "ether";
            if (typeof s === "string") {
                const e = Ae.indexOf(s);
                if (e !== -1) {
                    s = 3 * e;
                }
            }
            return dt_1(e, s ?? 18);
        })(transaction.gasPrice ?? 0), [
        transaction
    ]);
    const totalTransactionFee = Se.useMemo(()=>{
        if (transaction.feeIs7702) {
            return Number(transaction.initialFee?.[0] ?? transaction.fee[0]);
        }
        return transaction.fee.reduce((acc, item)=>parseFloat(String(acc) ?? "0") + parseFloat(item ?? "0"), 0) + (isAdvancedTransactionDataEnabled ? parseFloat(gasPrice) : 0);
    }, [
        transaction.fee,
        gasPrice
    ]);
    t_3({
        event: D.TRANSACTION,
        props: {
            blockchainName: blockchain.name,
            blockchainType: blockchain.isCustom ? w.CUSTOM : w.MAIN,
            blockchainChainId: blockchain.chainId
        }
    });
    const { formatMessage } = P();
    const d = __1();
    return <N><K1 backAction={()=>d(-1)} title={formatMessage({
        id: `transaction.${type}.title`
    }, {
        assetSymbol: asset.symbol
    })}/><C><TransactionStatusBanner transaction={transaction} network={blockchain}/>{S(transaction) ? <V1><div className="flex flex-col"><SwapTransactionHeader transaction={transaction} asset={asset}/><SwapTransactionDetails transaction={transaction} asset={asset} network={blockchain}/></div></V1> : <><TransactionHeader transaction={transaction} asset={asset} totalTransactionFee={totalTransactionFee}/><TransactionDetails transaction={transaction} asset={asset} network={blockchain} totalTransactionFee={totalTransactionFee} gasPrice={gasPrice}/></>}<TransactionFooter transaction={transaction}/></C></N>;
};
export { Page as default };
