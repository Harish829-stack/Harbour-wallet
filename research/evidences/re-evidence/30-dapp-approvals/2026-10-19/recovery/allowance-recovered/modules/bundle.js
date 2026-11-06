import { f, i } from "./preload-helper-C61CWiqK.js";
import { t } from "./logger-BMfNJZDI.js";
import { B as B_1, H, L, P, V, W as W_1, ct, dt, z as z_1 } from "./useAnalytics-COpZR7i2.js";
import { i as i_1 } from "./constants-CV-R2xp4.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { _ as __1, a as U1, g, i as F1, n as X1, r as Y1, t as E } from "./Page-7xxhohWn.js";
import { c, rn, vn, w } from "./store-cAVdfWrK.js";
import { t as t_3 } from "./dapps-D5KacSOR.js";
import { t as t_4 } from "./dAppBlockchain-Bmr4Qqt_.js";
import { t as t_5 } from "./useSelectedBlockchain-CdAMZ61x.js";
import { t as M } from "./AssetImage-BQ2Pnx9g.js";
import { t as t_6 } from "./blockchain-DRDWqNiT.js";
import { t as t_7 } from "./useBlockchains-CyglC5V0.js";
import { t as _ } from "./Card-BZmkTDlX.js";
import { n, o } from "./erc20-DMn3RMu5.js";
import { t as t_8 } from "./useAsset-DL8yf1Bm.js";
import { t as t_9 } from "./formatAssetAmount-BJWMMv5e.js";
import { t as B } from "./FormattedAmount-CZiJdoJL.js";
import { t as C } from "./ShareIcon-DQEJf4ke.js";
import { o as o_2, p } from "./codes-BxmijjuO.js";
import { n as n_2, r, t as W } from "./Tag-B9IIC0ts.js";
import { t as t_10 } from "./useShowToast-CRiwUCIa.js";
import { t as G } from "./DocumentIcon-DVQhyCu1.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const s = (new e.Error).stack;
        if (s) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[s] = "b8c7b6ac-6388-4e10-99cb-b46cbe31e55f";
            e._sentryDebugIdIdentifier = "sentry-dbid-b8c7b6ac-6388-4e10-99cb-b46cbe31e55f";
        }
    } catch (e) {}
})();
const K = f(i(), 1);
const z = t_2();
const ApprovalDetail = ()=>{
    const e = __1();
    const s = g();
    const { formatMessage } = P();
    const Y = t_7();
    const [loading, setLoading] = K.useState(false);
    const [$] = t_5();
    const X = o(t_4.ethereum);
    const J = t_10();
    const { assetId, spenderAddress, spenderName, chain, allowance, isUnlimited, riskLevel = c.LOW_RISK, riskDetails, walletAddress } = s.state || {};
    const le = t_8(assetId || "");
    const ne = chain ? Y[chain] : null;
    const de = ne?.displayName ?? ne?.name ?? chain;
    const theme = ((riskLevel_1)=>{
        switch(riskLevel_1){
            case c.HIGH_RISK:
                return r.ERROR;
            case c.MEDIUM_RISK:
                return r.WARNING;
            case c.LOW_RISK:
            default:
                return r.SUCCESS;
        }
    })(riskLevel);
    const ce = ((riskLevel_1, formatMessage_1)=>{
        switch(riskLevel_1){
            case c.HIGH_RISK:
                return formatMessage_1({
                    id: "approvals.risk.high",
                    defaultMessage: "High Risk"
                });
            case c.MEDIUM_RISK:
                return formatMessage_1({
                    id: "approvals.risk.medium",
                    defaultMessage: "Medium Risk"
                });
            case c.LOW_RISK:
            default:
                return null;
        }
    })(riskLevel, formatMessage);
    const me = K.useMemo(()=>{
        if (riskDetails && Array.isArray(riskDetails) && riskDetails.length !== 0) {
            return `${riskDetails.map((e)=>e.details).join(". ")}.`;
        }
        return null;
    }, [
        riskDetails
    ]);
    const pe = K.useMemo(()=>{
        if (isUnlimited || !allowance || !le) {
            return null;
        }
        try {
            return rn(BigInt(allowance).toString(), le.decimals || 0).toString();
        } catch (e) {
            return allowance;
        }
    }, [
        allowance,
        isUnlimited,
        le
    ]);
    if (le) {
        return <X1><F1 backAction={()=>e(H.DEFAULT, {
                state: {
                    activeTab: i_1.APPROVALS
                }
            })} title={formatMessage({
            id: "approval-detail.title",
            defaultMessage: "Approval"
        })}/><E><U1><div className="pb-4"><div className="flex justify-between items-center pb-2"><L type={B_1.EMPHASIS} theme={z_1.LABEL_SECONDARY}>{formatMessage({
            id: "approval-detail.contract",
            defaultMessage: "Contract"
        })}</L>{ce && <W size={n_2.MEDIUM} theme={theme}>{ce}</W>}</div><_><div className="py-2 px-3"><div className="flex items-center space-x-3 pb-6"><div className="relative"><div className="flex items-center justify-center w-10 h-10 bg-white rounded-full"><G width={24} height={24} colorClass="text-tw3-label-secondary"/></div>{ne && <div className="absolute -bottom-px -right-0.5"><M name={ne.name} src={ne.iconUrl} size={ct.XXSMALL}/></div>}</div><div><L type={B_1.EMPHASIS}>{spenderName || "Unknown"}</L><L type={B_1.BODY} theme={z_1.LABEL_SECONDARY}>{de}</L></div></div>{spenderAddress && <div className="space-y-1"><L type={B_1.FOOTNOTE} weight={V.MEDIUM} theme={z_1.LABEL_PRIMARY}>{formatMessage({
            id: "approval-detail.contract-address",
            defaultMessage: "Contract address"
        })}</L><div className="flex items-center justify-between gap-2"><div className="break-all"><L type={B_1.EMPHASIS} theme={z_1.LABEL_SECONDARY}>{spenderAddress}</L></div>{ne?.explorer?.url && <a className="text-tw3-label-secondary shrink-0" href={`${ne.explorer.url}${ne.explorer.accountPath}${spenderAddress}`} target="_blank" rel="noopener nofollow noreferrer"><C width={20} height={20}/></a>}</div></div>}{me && ce && <div className="pt-4 space-y-1"><L type={B_1.BODY} theme={z_1.LABEL_PRIMARY}>{formatMessage({
            id: "approval-detail.risk-detail",
            defaultMessage: "Risk detail"
        })}</L><L type={B_1.BODY} theme={z_1.LABEL_SECONDARY}>{me}</L></div>}</div></_></div><div className="pb-4"><div className="pb-2"><L type={B_1.EMPHASIS} theme={z_1.LABEL_SECONDARY}>{formatMessage({
            id: "approval-detail.asset",
            defaultMessage: "Asset"
        })}</L></div><_><div className="py-2 px-3"><div className="flex items-center space-x-3 pb-6 "><M name={le.name} src={le.iconUrl} size={ct.LARGE} network={ne ? {
            iconUrl: ne.iconUrl,
            name: ne.name,
            displayName: ne.displayName
        } : undefined}/><div><L type={B_1.EMPHASIS}>{le.symbol}</L><L type={B_1.BODY} theme={z_1.LABEL_SECONDARY}>{de}</L></div></div><div className="space-y-1"><L type={B_1.FOOTNOTE} weight={V.MEDIUM} theme={z_1.LABEL_PRIMARY}>{formatMessage({
            id: "approval-detail.amount",
            defaultMessage: "Amount"
        })}</L>{isUnlimited ? <L type={B_1.SUBTITLE} theme={z_1.LABEL_PRIMARY}>{formatMessage({
            id: "approvals.unlimited",
            defaultMessage: "Unlimited"
        })}</L> : <B textType={B_1.SUBTITLE} weight={V.MEDIUM} amountType={t_9.CRYPTO} currency={le.symbol} value={parseFloat(pe || "0")} maxSignificantDecimals={4} tinyThreshold={4}/>}</div>{isUnlimited && <div className="pt-2"><L type={B_1.BODY} theme={z_1.LABEL_SECONDARY}>{formatMessage({
            id: "approval-detail.unlimited-warning",
            defaultMessage: "Unlimited approval is not safe unless you fully trust the contract"
        })}</L></div>}{walletAddress && <div className="pt-4 space-y-1"><L type={B_1.FOOTNOTE} weight={V.MEDIUM} theme={z_1.LABEL_PRIMARY}>{formatMessage({
            id: "approval-detail.wallet-address",
            defaultMessage: "Wallet address"
        })}</L><div className="break-all"><L type={B_1.EMPHASIS} theme={z_1.LABEL_SECONDARY}>{walletAddress}</L></div></div>}</div></_></div></U1></E><Y1><W_1 onClick={async ()=>{
            if (le && ne && spenderAddress && X.data?.address) {
                try {
                    setLoading(true);
                    if ($ !== ne.id) {
                        await vn.emit(t_6.SWITCH_BLOCKCHAIN, {
                            blockchainId: ne.id,
                            blockchainType: ne.isCustom ? w.CUSTOM : w.MAIN
                        });
                    }
                    const s = n(le.address, spenderAddress);
                    if (await vn.emit(t_3.ETH_SIGN_TRANSACTION, s)) {
                        e(H.HISTORY);
                    }
                } catch (error) {
                    t.error("Failed to revoke approval", error);
                    if ([
                        "FAILED_APPROVAL_TRANSACTION_PAYLOAD_GENERATION",
                        "FAILED_SWAP_TRANSACTION_PAYLOAD_GENERATION"
                    ].some((e)=>(error.message ?? "").startsWith(e))) {
                        J("errors.transaction-generation", "Transaction generation failed");
                    }
                } finally{
                    setLoading(false);
                }
            }
        }} theme={dt.PRIMARY} loading={loading}>{formatMessage({
            id: "approval-detail.revoke-approval",
            defaultMessage: "Revoke Approval"
        })}</W_1></Y1></X1>;
    }
    return null;
};
export { ApprovalDetail as default };
