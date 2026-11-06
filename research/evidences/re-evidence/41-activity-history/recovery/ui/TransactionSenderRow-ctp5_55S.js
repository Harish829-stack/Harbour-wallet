import { f, i } from "./preload-helper-C61CWiqK.js";
import { B as B_1, D, E, G as G_1, L as L_1, P, ct, t, z } from "./useAnalytics-COpZR7i2.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { t as t_3 } from "./react-dom-DmK0ZQY1.js";
import { cn, i as i_1, r, v } from "./store-cAVdfWrK.js";
import { t as B1 } from "./AssetImage-BQ2Pnx9g.js";
import { t as t_4 } from "./fp-DA8NAoIP.js";
import { t as t_5 } from "./formatTruncatedString-CZ8GNKMv.js";
import { n as V, o as o_1, t as t_6 } from "./sendLikeTransactionType-Bwls70uE.js";
import { t as t_7 } from "./useFiat-DH2a13VO.js";
import { i as i_2 } from "./useAsset-DL8yf1Bm.js";
import { t as T } from "./FormattedAmount-CZiJdoJL.js";
import { t as t_8 } from "./useSelectedBaseCurrency-drfds3sV.js";
import { r as r_2, t as N } from "./DataListRow-CWCrec8q.js";
import { t as L } from "./SkeletonLine-gBdUFNjv.js";
import { t as I } from "./ShareIcon-DQEJf4ke.js";
import { n, t as R } from "./CopyIcon-BjPIDqyP.js";
import { t as _ } from "./CheckIcon-EcHbjY0b.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "59ceb683-fe96-4b48-b431-e6699c7d225c";
            e._sentryDebugIdIdentifier = "sentry-dbid-59ceb683-fe96-4b48-b431-e6699c7d225c";
        }
    } catch (e) {}
})();
const k = f(i(), 1);
const useDeveloperSettings = ()=>{
    const e = r();
    const { trackAnalytics } = t();
    const s = i_1((e)=>e.settings.developerSettings);
    const n = k.useMemo(()=>({
            setIsCustomNonceEnabled: (s)=>{
                e(v.actions.setIsCustomNonceEnabled(s));
                trackAnalytics({
                    event: E.TOGGLE_TRANSACTION_NONCE,
                    props: {
                        enabled: s,
                        pageViewSource: D.SETTINGS_DEVELOPER
                    }
                });
            },
            setIsAdvancedGasControlsEnabled: (s)=>{
                e(v.actions.setIsAdvancedGasControlsEnabled(s));
                trackAnalytics({
                    event: E.TOGGLE_ADVANCED_GAS_CONTROLS,
                    props: {
                        enabled: s,
                        pageViewSource: D.SETTINGS_DEVELOPER
                    }
                });
            },
            setIsAdvancedTransactionDataEnabled: (s)=>{
                e(v.actions.setIsAdvancedTransactionDataEnabled(s));
                trackAnalytics({
                    event: E.TOGGLE_ADVANCED_TRANSACTION_DATA,
                    props: {
                        enabled: s,
                        pageViewSource: D.SETTINGS_DEVELOPER
                    }
                });
            }
        }), [
        e
    ]);
    return k.useMemo(()=>({
            ...s,
            ...n
        }), [
        s,
        n
    ]);
};
function buildTxExplorerUrl(e, t) {
    const s = e?.explorer;
    if (!s?.url) {
        return null;
    }
    const r = s.url.endsWith("/") ? s.url : `${s.url}/`;
    const { txPath } = s;
    return `${r}${txPath ? `${txPath.replace(/^\/+/, "").replace(/\/+$/, "")}/` : "tx/"}${t}`;
}
export const a = "https://support.trustwallet.com/en/support/solutions/articles/67000635278-why-is-my-transaction-pending-or-stuck-";
export const o = 900000;
const G = t_2();
const TransactionAssetTotalFiatRow = ({ blockchain, fee, asset, type, amount, reserveFee, feeAsset, isLoading, variant = r_2.DEFAULT })=>{
    const { formatMessage } = P();
    const u = i_2(blockchain.coinId);
    const m = t_7(asset);
    const h = t_7(feeAsset ?? u);
    const { currency, baseCurrencyType } = t_8();
    const value = k.useMemo(()=>{
        const e = cn(fee || 0).mul(h?.price ?? 0);
        const s = t_6(type) ? cn(amount).mul(m?.price ?? 0) : cn(0);
        const i = cn(reserveFee || 0).mul(h?.price ?? 0);
        return e.plus(s).plus(i).toNumber();
    }, [
        amount,
        fee,
        h,
        m,
        reserveFee
    ]);
    return <N label={formatMessage({
        id: "generic.total-fiat"
    }, {
        currency
    })} labelInfoBox={formatMessage({
        id: "generic-total-fiat-info"
    }, {
        currency
    })} variant={variant}><L widthClass="w-22.5" heightClass="h-4" isLoading={isLoading}><T testid="total-fiat-amount" value={value} amountType={baseCurrencyType} currency={currency}/></L></N>;
};
const TransactionRecipientRow = ({ recipient, type, network, variant = r_2.DEFAULT, testid, labelTheme = z.LABEL_PRIMARY, maxCharsPerSide = 15, maxCharsEnd = maxCharsPerSide })=>{
    const { formatMessage } = P();
    if (!recipient) {
        return null;
    }
    if (!o_1(recipient, type)) {
        return <N labelTheme={z.LABEL_SECONDARY} label={formatMessage({
            id: "generic.to"
        })} variant={variant}><div className="flex items-center space-x-1"><div><L_1 theme={labelTheme} testid={testid}>{t_5({
            value: recipient,
            maxCharsPerSide,
            maxCharsEnd
        })}</L_1></div><div><a className="text-tw3-label-secondary" href={`${network.explorer?.url}/address/${recipient}`} target="_blank" rel="noopener nofollow noreferrer"><I width={15} height={15}/></a></div></div></N>;
    }
    const f = recipient.filter((e)=>!!e?.info?.name?.trim() || !!e?.id?.trim());
    if (f.length === 0) {
        return null;
    }
    return <N label={formatMessage({
        id: "generic.validators"
    })} variant={variant}><div className="flex flex-col">{f.map((e, t)=>{
        const s = e.info?.name?.trim();
        const r = s || t_5({
            value: e.id,
            maxCharsPerSide: 8
        });
        return <div key={e.id || t} className="flex items-center justify-end space-x-1"><div><B1 name={s ?? e.id} src={e.info?.image} size={ct.XXSMALL}/></div><div className="flex items-center space-x-1"><div><L_1>{r}</L_1></div><div>{e.info?.website && <a className="text-tw3-label-secondary" href={e.info?.website} target="_blank" rel="noopener nofollow noreferrer"><I width={15} height={15}/></a>}</div></div></div>;
    })}</div></N>;
};
const M = f(t_3(), 1);
const B = f(n(), 1);
const $ = t_4();
const F = 14;
const CopyableAddress = ({ address, maxCharsPerSide = 6, maxCharsEnd = maxCharsPerSide, fit = false, network, theme = z.BRAND, testid = "copyable-address" })=>{
    const { formatMessage } = P();
    const [f, setF] = k.useState(false);
    const [p, setP] = k.useState(address);
    const id = k.useMemo(()=>$.uniqueId("copyable-address-"), []);
    const jRef = k.useRef(null);
    const wRef = k.useRef(null);
    const ERef = k.useRef(null);
    const href = ((network_1, address_1)=>{
        const s = network_1?.explorer;
        if (s?.url) {
            return `${s.url}${s.accountPath ?? "/address/"}${address_1}`;
        }
        return null;
    })(network, address);
    k.useEffect(()=>()=>{
            if (jRef.current) {
                clearTimeout(jRef.current);
            }
        }, []);
    k.useLayoutEffect(()=>{
        if (!fit) {
            return;
        }
        const wRef_current = wRef.current;
        const ERef_current = ERef.current;
        if (!wRef_current || !ERef_current) {
            return;
        }
        const r = href ? 2 : 1;
        const widthOf = (e)=>{
            ERef_current.textContent = e;
            return ERef_current.getBoundingClientRect().width;
        };
        const candidate = (t)=>{
            const maxCharsPerSide_1 = Math.ceil(t / 2);
            return t_5({
                value: address,
                maxCharsPerSide: maxCharsPerSide_1,
                maxCharsEnd: t - maxCharsPerSide_1
            });
        };
        const compute = ()=>{
            const s = wRef_current.getBoundingClientRect().width - 18 * r;
            if (s <= 0 || widthOf(address) <= s) {
                return void setP(address);
            }
            let a = 10;
            let n = address.length - 1;
            while(a < n){
                const e = Math.ceil((a + n) / 2);
                if (widthOf(candidate(e)) <= s) {
                    a = e;
                } else {
                    n = e - 1;
                }
            }
            setP(candidate(a));
        };
        compute();
        let n = false;
        if (typeof document !== "undefined" && "fonts" in document) {
            document.fonts.ready.then(()=>{
                if (!n) {
                    compute();
                }
            });
        }
        if (typeof ResizeObserver === "undefined") {
            return ()=>{
                n = true;
            };
        }
        const i = new ResizeObserver(compute);
        i.observe(wRef_current);
        return ()=>{
            n = true;
            i.disconnect();
        };
    }, [
        fit,
        address,
        href
    ]);
    const C = fit ? p : t_5({
        value: address,
        maxCharsPerSide,
        maxCharsEnd
    });
    const T = C !== address;
    return <><span ref={wRef} className={`relative inline-flex items-center gap-1 max-w-full ${fit ? "w-full" : ""}`}><button type="button" data-testid={testid} data-tooltip-id={T ? id : undefined} data-tooltip-content={T ? address : undefined} onClick={()=>{
        B.default(address, {
            format: "text/plain"
        });
        setF(true);
        if (jRef.current) {
            clearTimeout(jRef.current);
        }
        jRef.current = setTimeout(()=>setF(false), 1500);
    }} className="inline-flex items-center gap-1 min-w-0 text-left" style={{
        fontFeatureSettings: '"calt" 0',
        fontVariantLigatures: "none"
    }}><L_1 theme={theme} type={B_1.BODY}><span className="whitespace-nowrap">{C}</span></L_1>{f ? <_ width={F} height={F} colorClass="shrink-0 text-tw3-brand-foreground-secondary"/> : <R width={F} height={F} colorClass="shrink-0 text-tw3-label-secondary"/>}</button>{href && <a href={href} target="_blank" rel="noopener nofollow noreferrer" aria-label={formatMessage({
        id: "transaction.btn-view-on-explorer"
    })} data-testid={`${testid}-explorer`} className="inline-flex shrink-0"><V width={F} height={F} colorClass="text-tw3-label-secondary"/></a>}{fit && <div aria-hidden className="absolute left-0 top-0 invisible whitespace-nowrap pointer-events-none"><L_1 theme={theme} type={B_1.BODY}><span ref={ERef} className="whitespace-nowrap"/></L_1></div>}</span>{T && M.createPortal(<G_1 id={id} className="tw-tooltip break-all text-center" place="top" positionStrategy="fixed"/>, document.body)}</>;
};
const TransactionSenderRow = ({ sender, network, variant = r_2.DEFAULT, testid, maxCharsPerSide, maxCharsEnd })=>{
    const { formatMessage } = P();
    if (sender) {
        return <N label={formatMessage({
            id: "generic.from"
        })} variant={variant}><div className={maxCharsPerSide === undefined ? "ml-auto w-2/3 min-w-0" : "ml-auto min-w-0"}><CopyableAddress address={sender} network={network} fit={maxCharsPerSide === undefined} maxCharsPerSide={maxCharsPerSide} maxCharsEnd={maxCharsEnd} theme={z.LABEL_PRIMARY} testid={testid}/></div></N>;
    }
    return null;
};
export { useDeveloperSettings as c, TransactionAssetTotalFiatRow as i, CopyableAddress as n, TransactionRecipientRow as r, buildTxExplorerUrl as s, TransactionSenderRow as t };
