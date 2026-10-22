import { f, i } from "./preload-helper-C61CWiqK.js";
import { t } from "./logger-BMfNJZDI.js";
import { D, E, H, L as L_1, P, W, dt, ft, t as t_1, z } from "./useAnalytics-COpZR7i2.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { _ as __1 } from "./Page-7xxhohWn.js";
import { Cn, i as i_2, r, v, vn } from "./store-cAVdfWrK.js";
import { i as i_3 } from "./QrCodeIcon-DyHe5kLn.js";
import { t as t_3 } from "./useAnalyticsCaptureOnMount-BJcdtAcr.js";
import { t as W1 } from "./ShieldPassIllustration-Mqv354JL.js";
import { t as I } from "./Checkbox-BLoP25Tu.js";
import { t as t_4 } from "./PrivateDataProvider-8vglgSNV.js";
import { n } from "./useOnboardingType-C_Lvvffu.js";
import { r as r_2 } from "./InputPassword-D9sGWGS1.js";
import { n as A, t as t_5 } from "./biometrics-CO4_TFG1.js";
import { n as n_2 } from "./types-DrDwy2JA.js";
import { t as R } from "./OnboardingBoxContent-DcFJIaKL.js";
import { globalSteps } from "./onboarding-BHcKddMJ.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const s = (new e.Error).stack;
        if (s) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[s] = "a1c756c6-bf68-465e-9380-6135d8563b1a";
            e._sentryDebugIdIdentifier = "sentry-dbid-a1c756c6-bf68-465e-9380-6135d8563b1a";
        }
    } catch (e) {}
})();
const M = f(i(), 1);
const O = t_2();
const SetBiometrics = ()=>{
    const e = i_2((e)=>e.settings.passkeyId);
    const s = r();
    const { trackAnalytics } = t_1();
    const setupType = n();
    const { formatMessage } = P();
    t_3({
        event: D.ONBOARDING_SET_BIOMETRICS,
        props: {
            setupType
        }
    });
    const B = __1();
    const [_, set_] = M.useState(null);
    const { data } = M.useContext(t_4);
    const [L, setL] = M.useState(false);
    const [U, setU] = M.useState(0);
    return <R heading={formatMessage({
        id: "setup-biometrics.heading",
        defaultMessage: "Biometric authentication"
    })} subHeading={formatMessage({
        id: "setup-biometrics.subheading",
        defaultMessage: "A secure and simple way to unlock your wallet"
    })} animation=<W1 width={120} height={120}/> activeTab={2}>{L && <div className="flex justify-center"><div className="flex flex-col gap-2 justify-center p-4 text-left"><div className="items-start"><I onChange={()=>{}} checked={U >= 1}><L_1 theme={U >= 1 ? z.BRAND : z.LABEL_SECONDARY}>{formatMessage({
        id: "generic.biometrics-register",
        defaultMessage: "Register Biometrics"
    })}</L_1></I></div><div className="items-start"><I onChange={()=>{}} checked={U >= 2}><L_1 theme={U >= 2 ? z.BRAND : z.LABEL_SECONDARY}>{formatMessage({
        id: "generic.biometrics-verify",
        defaultMessage: "Verify Biometrics"
    })}</L_1></I></div></div></div>}<div className="flex w-full sm:w-auto sm:min-w-[220px] sm:self-start mt-12"><W loadingData={_ ? <div className="text-tw3-brand-foreground">{formatMessage(_)}</div> : null} type={ft.BUTTON} theme={dt.PRIMARY} loading={L} onClick={async ()=>{
        if (e) {
            B(H.DEFAULT);
        }
        setL(true);
        set_({
            id: "generic.biometrics-register",
            defaultMessage: "Register Biometrics"
        });
        const o = new t_5;
        try {
            const e = await o.create();
            if (!e) {
                return void setL(false);
            }
            setU(1);
            set_({
                id: "generic.biometrics-verifying",
                defaultMessage: "Verifying Biometrics"
            });
            if (await o.verify({
                credential: e.credential,
                password: e.password
            })) {
                setU(2);
                await vn.emit(r_2.GENERATE_PASSKEY_VAULT, {
                    password: e.password,
                    payload: data.password
                });
                trackAnalytics({
                    event: E.BIOMETRICS_SET,
                    props: {
                        pageViewSource: D.ONBOARDING_WELCOME
                    }
                });
                setU(3);
                set_({
                    id: "generic.biometrics-redirecting",
                    defaultMessage: "Redirecting"
                });
                await Cn(2000);
                s(v.actions.setPasskeyId(e.credentialId));
                B(H.DEFAULT);
            }
        } catch (error) {
            set_(null);
            t.error(error);
            setL(false);
        }
    }}><div className="flex gap-2 text-tw3-brand-foreground items-center">{formatMessage({
        id: "generic.set-up-biometrics",
        defaultMessage: "Set up biometrics"
    })}<A/></div></W></div></R>;
};
const SetPasskeyFlow = ()=>{
    const [e, setE] = M.useState(i_3() ? n_2.SET_BIOMETRICS : n_2.AUTHENTICATION);
    const T = {
        [n_2.SET_BIOMETRICS]: SetBiometrics,
        ...globalSteps
    }[e];
    return <T setCurrentStep={setE}/>;
};
export { SetPasskeyFlow as default };
