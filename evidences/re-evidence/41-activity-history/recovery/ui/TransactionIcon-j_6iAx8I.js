import { at as E, ct } from "./useAnalytics-COpZR7i2.js";
import { t } from "./jsx-runtime-C2w7GV0M.js";
import { c as A, l as R } from "./Page-7xxhohWn.js";
import { n as O } from "./Skeleton-CuI4vc4O.js";
import { t as t_1 } from "./txType-CH4ucKXs.js";
import { t as I } from "./CheckIcon-EcHbjY0b.js";
import { r as N } from "./useEnhancedUnmount-CF3xX24E.js";
import { t as C1 } from "./DocumentIcon-DVQhyCu1.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const s = (new e.Error).stack;
        if (s) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[s] = "0147dac8-4512-4737-aa3a-3569b39f7b28";
            e._sentryDebugIdIdentifier = "sentry-dbid-0147dac8-4512-4737-aa3a-3569b39f7b28";
        }
    } catch (e) {}
})();
const d = t();
const HotIcon = ({ width = 24, height = 24, colorClass })=><svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={colorClass}><path d="M19.5599 8.66001L19.4999 8.54001C19.2399 7.99001 18.7199 7.63001 18.1099 7.57001C17.5099 7.52001 16.9299 7.78001 16.5799 8.26002C16.5299 8.33002 16.4799 8.39001 16.4299 8.45001C16.1099 5.10001 14.0199 2.91001 13.2999 2.15001C12.8499 1.67001 12.1699 1.48001 11.5299 1.66001C10.8899 1.83001 10.3999 2.34001 10.2599 2.97001C9.91986 4.36001 8.78986 5.41001 7.46986 6.62001C5.63986 8.32001 3.57986 10.25 3.39986 13.61C3.38986 13.67 3.35986 13.73 3.35986 13.8C3.35986 13.83 3.35986 13.87 3.35986 13.92C3.35986 13.97 3.35986 14.02 3.35986 14.05C3.35986 14.1 3.37986 14.13 3.38986 14.18C3.57986 18.75 7.37986 22.43 11.9899 22.43C16.5999 22.43 20.4199 18.73 20.5999 14.13C20.5999 14.1 20.6199 14.08 20.6199 14.05V13.8C20.5899 10.77 20.0099 9.60001 19.5499 8.67001L19.5599 8.66001ZM11.9999 20.16C8.52986 20.16 5.67986 17.34 5.62986 13.91C5.66986 11.34 7.28986 9.84001 9.00986 8.25001C10.2599 7.09001 11.5499 5.90001 12.1999 4.26002C13.0099 5.22002 14.2199 6.97002 14.2199 9.30001C14.2199 10.48 14.5999 11.2 15.3499 11.45C16.2599 11.75 17.0999 11.12 17.8299 10.27C18.1099 10.96 18.3499 11.92 18.3699 13.78C18.3699 13.78 18.3699 13.81 18.3699 13.82C18.3399 17.31 15.4799 20.14 11.9899 20.14L11.9999 20.16Z" fill="currentColor"/></svg>;
const TransactionIcon = ({ status, type })=>{
    if (status === "pending") {
        return <E size={ct.SMALL}/>;
    }
    let C;
    switch(type){
        case t_1.Contract:
        case t_1.RegisterToken:
        case t_1.TrustLine:
        case t_1.Approve:
        case t_1.Revoke:
            C = <C1 width={24} height={24} colorClass="text-tw3-label-secondary"/>;
            break;
        case t_1.Receive:
            C = <O width={20} height={20} colorClass="text-tw3-label-secondary"/>;
            break;
        case t_1.Send:
            C = <N width={20} height={20} colorClass="text-tw3-label-secondary"/>;
            break;
        case t_1.Swap:
        case t_1.Trade:
            C = <A width={20} height={20} colorClass="text-tw3-label-secondary"/>;
            break;
        case t_1.Delegate:
        case t_1.Undelegate:
        case t_1.Redelegate:
        case t_1.Claim:
        case t_1.ClaimRewards:
            C = <R width={20} height={20} colorClass="text-tw3-label-secondary"/>;
            break;
        case t_1.Burn:
            C = <HotIcon width={20} height={20} colorClass="text-tw3-label-secondary"/>;
            break;
        default:
            C = <I width={20} height={20} colorClass="text-tw3-label-secondary"/>;
    }
    return <div className="flex w-full justify-center items-center h-full bg-tw3-background-secondary rounded-full">{C}</div>;
};
export { TransactionIcon as t };
