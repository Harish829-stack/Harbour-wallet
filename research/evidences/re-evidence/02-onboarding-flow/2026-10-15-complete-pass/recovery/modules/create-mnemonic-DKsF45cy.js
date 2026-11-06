import { f as f_1, i as i_1 } from "./preload-helper-C61CWiqK.js";
import { t } from "./jsx-runtime-C2w7GV0M.js";
import { i as i_2 } from "./QrCodeIcon-DyHe5kLn.js";
import { t as t_2 } from "./PrivateDataProvider-8vglgSNV.js";
import { n } from "./types-DrDwy2JA.js";
import { n as n_1 } from "./OnboardingBoxContent-DcFJIaKL.js";
import { globalSteps } from "./onboarding-BHcKddMJ.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "762cc8db-4fed-4962-9e5f-1b37b9e7cd17";
            e._sentryDebugIdIdentifier = "sentry-dbid-762cc8db-4fed-4962-9e5f-1b37b9e7cd17";
        }
    } catch (e) {}
})();
const f = f_1(i_1(), 1);
const i = t();
const CreateMnemonicFlow = ()=>{
    const e = i_2();
    const { flowCompleted } = n_1();
    const { data: { password } } = f.useContext(t_2);
    const [p, setP] = f.useState(e || flowCompleted ? n.COMPLETED : n.AUTHENTICATION);
    f.useEffect(()=>{
        if (e || password) {
            setP(n.COMPLETED);
        } else if (p !== n.COMPLETED) {
            setP(n.AUTHENTICATION);
        }
    }, [
        e
    ]);
    const U = globalSteps[p];
    return <U setCurrentStep={setP}/>;
};
export { CreateMnemonicFlow as default };
