import { f, i } from "./preload-helper-C61CWiqK.js";
import { D, E as E_1, P as P_1, W, ft, t } from "./useAnalytics-COpZR7i2.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { xn as onClick } from "./store-cAVdfWrK.js";
import { t as t_3 } from "./useAnalyticsCaptureOnMount-BJcdtAcr.js";
import { t as t_4 } from "./PrivateDataProvider-8vglgSNV.js";
import { t as C1 } from "./Security-BkVC-Kss.js";
import { n } from "./useOnboardingType-C_Lvvffu.js";
import { n as n_2, t as M1 } from "./InputPassword-D9sGWGS1.js";
import { n as n_3, t as t_5 } from "./types-DrDwy2JA.js";
import { t as t_6 } from "./useValidatePassword-Dn2iwOd-.js";
import { n as n_4, t as E } from "./OnboardingBoxContent-DcFJIaKL.js";
import { n as n_5, t as t_7 } from "./useSetupAuthentication-EZlruew7.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const a = (new e.Error).stack;
        if (a) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[a] = "5d7fe423-7b4a-4d55-a6e9-7391d884cf19";
            e._sentryDebugIdIdentifier = "sentry-dbid-5d7fe423-7b4a-4d55-a6e9-7391d884cf19";
        }
    } catch (e) {}
})();
const M = f(i(), 1);
const S = t_2();
const CreatePassword = ({ setCurrentStep })=>{
    const { formatMessage } = P_1();
    const { trackAnalytics } = t();
    const { currentFlow } = n_4();
    const setupType = n();
    const O = n_2("");
    const I = n_2("");
    const [_, set_] = M.useState(0);
    const [P, setP] = M.useState(0);
    const [R, setR] = M.useState(false);
    const [x, setX] = M.useState("");
    const [k, setK] = M.useState("");
    const B = t_6({
        value: O.getValue()
    });
    const { update } = M.useContext(t_4);
    const { createMnemonic, errorMessage } = n_5();
    const { setupAuthentication } = t_7();
    const generateRandomMask = (length)=>Array.from({
            length
        }, ()=>"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"[Math.floor(70 * Math.random())]).join("");
    t_3({
        event: D.ONBOARDING_PASSWORD_CREATE,
        props: {
            setupType
        }
    });
    const trackEvent = ()=>{
        trackAnalytics({
            event: E_1.AUTHENTICATION_SETUP_COMPLETED,
            props: {
                authenticationType: "password",
                pageViewSource: D.ONBOARDING_PASSWORD_CREATE,
                setupType
            }
        });
    };
    const F = B.isValid && O.getValue() === I.getValue() && _ > 0;
    return <E heading={formatMessage({
        id: "set-password.heading-new",
        defaultMessage: "Secure your wallet"
    })} subHeading={formatMessage({
        id: "set-password.subheading-new",
        defaultMessage: "Create password"
    })} animation=<C1 styles={{
        marginLeft: "-60px",
        marginTop: "-60px"
    }}/> activeTab={1} onBackClick={()=>{
        O.wipe();
        I.wipe();
        setCurrentStep(n_3.AUTHENTICATION);
    }}><form onSubmit={async (a)=>{
        a.preventDefault();
        if (R || !F) {
            return;
        }
        const password = O.getValue();
        update({
            password
        });
        switch(currentFlow){
            case t_5.CREATE_MNEMONIC:
                setR(true);
                setX(generateRandomMask(_));
                setK(generateRandomMask(P));
                await setupAuthentication({
                    pageViewSource: D.ONBOARDING_PASSWORD_CREATE,
                    password
                });
                O.wipe();
                I.wipe();
                await createMnemonic(false);
                setR(false);
                trackEvent();
                setCurrentStep(n_3.COMPLETED);
                break;
            case t_5.IMPORT_WALLET:
                setCurrentStep(n_3.SELECT_IMPORT_METHOD);
                break;
            case t_5.IMPORT_QR:
                setCurrentStep(n_3.SCAN_QR_WITH_MOBILE);
        }
    }} className="space-y-6 mt-8"><M1 testid="password-field" label={formatMessage({
        id: "create-password.input.label",
        defaultMessage: "Password"
    })} placeholder={formatMessage({
        id: "create-password.input.placeholder",
        defaultMessage: "Min 8 characters"
    })} value={R ? x : O.getValue()} onChange={(e)=>(function handlePasswordChange(e) {
            const value = e.target.value;
            O.current = value;
            set_(value.length);
        })(e)} error={R ? undefined : errorMessage} validation={R ? {
        isValid: true
    } : B} autoFocus disabled={R}/><M1 label={formatMessage({
        id: "create-password.input.confirm.label",
        defaultMessage: "Confirm password"
    })} placeholder={formatMessage({
        id: "create-password.input-confirm.placeholder",
        defaultMessage: "Password"
    })} testid="password-field" value={R ? k : I.getValue()} onChange={(e)=>(function handlePasswordConfirmChange(e) {
            const value = e.target.value;
            I.current = value;
            setP(value.length);
        })(e)} error={(()=>{
        if (!R) {
            if (P > 0 && O.getValue() !== I.getValue()) {
                return formatMessage({
                    id: "component.input-password.confirm.validation"
                });
            }
            return errorMessage;
        }
    })()} disabled={R}/><div className="w-1/2 ml-auto"><W type={ft.SUBMIT} onClick={onClick} loading={R} disabled={!F} loadingData={formatMessage({
        id: "onboarding.create-password.loading",
        defaultMessage: "Creating wallet..."
    })}>{formatMessage({
        id: "generic.continue"
    })}</W></div></form></E>;
};
export { CreatePassword as default };
