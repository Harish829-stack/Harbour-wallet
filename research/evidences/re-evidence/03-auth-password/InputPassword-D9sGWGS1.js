import { f, i } from "./preload-helper-C61CWiqK.js";
import { t } from "./logger-BMfNJZDI.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { Tn } from "./store-cAVdfWrK.js";
import { r as r_1 } from "./types-Da-Ovuve.js";
import { t as U } from "./InputText--Q-rwLzs.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "0ded7b71-af32-401b-80cd-0124c2119182";
            e._sentryDebugIdIdentifier = "sentry-dbid-0ded7b71-af32-401b-80cd-0124c2119182";
        }
    } catch (e) {}
})();
const n = f(i(), 1);
const o = t_2();
const EyeHideIcon = ({ width = 24, height = 24, colorClass })=><svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={colorClass}><path d="M12 4.75C10.57 4.75 9.19 5.08 7.94 5.63L9.68 7.37C10.41 7.14 11.19 7 12 7C16.11 7 19.52 10.56 19.75 11.75C19.63 12.39 18.61 13.68 17.07 14.76L18.68 16.37C20.7 14.87 22 12.98 22 11.76C22 9.44 17.37 4.75 12 4.75Z" fill="currentColor"/><path d="M15.27 11.75C15.27 9.93998 13.81 8.47998 12 8.47998C11.64 8.47998 11.29 8.53998 10.96 8.64998L15.1 12.79C15.21 12.46 15.27 12.11 15.27 11.75Z" fill="currentColor"/><path d="M19.53 19.22L3.53 3.22003C3.44 3.13003 3.33 3.07003 3.22 3.03003C2.97 2.96003 2.67 3.02003 2.47 3.22003C2.18 3.51003 2.18 3.99003 2.47 4.28003L5.32 7.13003C3.3 8.64003 2 10.53 2 11.76C2 14.06 6.63 18.75 12 18.75C13.43 18.75 14.81 18.42 16.07 17.88L18.47 20.28C18.62 20.43 18.81 20.5 19 20.5C19.19 20.5 19.38 20.43 19.53 20.28C19.73 20.08 19.79 19.78 19.72 19.53C19.68 19.42 19.62 19.31 19.53 19.22ZM12 16.5C7.9 16.5 4.48 12.95 4.25 11.75C4.37 11.12 5.39 9.82003 6.93 8.74003L8.9 10.71C8.79 11.04 8.73 11.39 8.73 11.75C8.73 13.56 10.19 15.02 12 15.02C12.36 15.02 12.71 14.96 13.04 14.85L14.32 16.13C13.58 16.36 12.81 16.5 12 16.5Z" fill="currentColor"/></svg>;
const EyeShowIcon = ({ width = 24, height = 24, colorClass })=><svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={colorClass}><path d="M12 7.25244C16.12 7.25244 19.53 10.8124 19.75 12.0024C19.52 13.2024 16.11 16.7524 12 16.7524C7.89 16.7524 4.49 13.2024 4.26 12.0024C4.48 10.8024 7.89 7.25244 12 7.25244ZM12 5.00244C6.63 5.00244 2 9.69244 2 12.0124C2 14.3324 6.63 19.0024 12 19.0024C17.37 19.0024 22 14.3124 22 12.0124C22 9.71244 17.37 5.00244 12 5.00244Z" fill="currentColor"/><path d="M12 10.7324C12.7 10.7324 13.27 11.3024 13.27 12.0024C13.27 12.7024 12.7 13.2724 12 13.2724C11.3 13.2724 10.73 12.7024 10.73 12.0024C10.73 11.3024 11.3 10.7324 12 10.7324ZM12 8.73242C10.19 8.73242 8.73001 10.1924 8.73001 12.0024C8.73001 13.8124 10.19 15.2724 12 15.2724C13.81 15.2724 15.27 13.8124 15.27 12.0024C15.27 10.1924 13.81 8.73242 12 8.73242Z" fill="currentColor"/></svg>;
export const r = {
    VERIFY_PASSWORD: Tn("VERIFY_PASSWORD"),
    GENERATE_PASSKEY_VAULT: Tn("GENERATE_PASSKEY_VAULT"),
    GET_PASSKEY_VAULT: Tn("GET_PASSKEY_VAULT")
};
const c = class SecureString {
    constructor(e){
        this.wiped = false;
        const t = new TextEncoder;
        this.buffer = t.encode(e);
    }
    static{
        if (typeof Symbol !== "undefined" && Symbol.dispose !== undefined) {
            Object.defineProperty(SecureString.prototype, Symbol.dispose, {
                value: function() {
                    this.wipe();
                },
                writable: true,
                configurable: true
            });
        }
    }
    getValue() {
        if (this.wiped || !this.buffer) {
            return "";
        }
        return (new TextDecoder).decode(this.buffer);
    }
    getLength() {
        if (this.wiped || !this.buffer) {
            return 0;
        }
        return this.buffer.length;
    }
    hasValue() {
        return !this.wiped && this.buffer !== null && this.buffer.length > 0;
    }
    wipe() {
        if (!this.wiped && this.buffer) {
            try {
                const e = 65536;
                if (typeof crypto !== "undefined" && crypto.getRandomValues) {
                    for(let t = 0; t < this.buffer.length; t += e){
                        const r = Math.min(e, this.buffer.length - t);
                        const s = this.buffer.subarray(t, t + r);
                        crypto.getRandomValues(s);
                    }
                }
                this.buffer.fill(0);
                this.buffer = null;
                this.wiped = true;
            } catch (error) {
                t.error("Failed to wipe SecureString:", error);
            }
        }
    }
};
class h {
    constructor(e = null){
        this.secureValue = null;
        this.wiped = false;
        if (e !== null && e !== "") {
            this.secureValue = new c(e);
        }
    }
    get current() {
        return this.getValue();
    }
    set current(e) {
        if (this.secureValue !== null) {
            this.secureValue.wipe();
            this.secureValue = null;
        }
        if (e !== null && e !== "") {
            this.secureValue = new c(e);
            this.wiped = false;
        } else {
            this.wiped = true;
        }
    }
    wipe() {
        if (!this.wiped && this.secureValue !== null) {
            try {
                this.secureValue.wipe();
                this.secureValue = null;
                this.wiped = true;
            } catch (error) {
                t.error("Failed to wipe SecureRef:", error);
            }
        }
    }
    getValue() {
        if (this.wiped || this.secureValue === null) {
            return "";
        }
        return this.secureValue.getValue();
    }
    hasValue() {
        return !this.wiped && this.secureValue !== null && this.secureValue.hasValue();
    }
}
function useSecureRef(e = null) {
    const tRef = n.useRef(null);
    if (!tRef.current) {
        tRef.current = new h(e);
    }
    n.useEffect(()=>(function createSecureCleanup(e) {
            return ()=>{
                try {
                    e();
                } catch (error) {
                    t.error("Secure cleanup failed:", error);
                }
            };
        })(()=>{
            if (tRef.current) {
                tRef.current.wipe();
            }
        }), []);
    return tRef.current;
}
const InputPassword = (e)=>{
    const [t, setT] = n.useState(false);
    const [s, setS] = n.useState(!e.value);
    const error = s ? "" : e.error;
    n.useEffect(()=>{
        if (e.value) {
            setS(false);
        }
    }, [
        e.value
    ]);
    return <div className="flex flex-col space-y-2"><U testid={e.testid} type={t ? r_1.TEXT : r_1.PASSWORD} {...e} error={error} validation={e.validation} onEnter={e.onEnter} actions={[
        {
            key: "show-password",
            placeholder: t ? <EyeShowIcon width={16} height={16} colorClass="text-tw3-brand-foreground-secondary"/> : <EyeHideIcon width={16} height={16} colorClass="text-tw3-brand-foreground-secondary"/>,
            onClick: ()=>setT((e)=>!e)
        }
    ]}/></div>;
};
export { EyeHideIcon as a, EyeShowIcon as i, useSecureRef as n, InputPassword as t };
