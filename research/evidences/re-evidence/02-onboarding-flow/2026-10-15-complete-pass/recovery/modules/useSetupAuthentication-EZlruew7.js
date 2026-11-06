import { f, i as i_1 } from "./preload-helper-C61CWiqK.js";
import { A, D, E, t } from "./useAnalytics-COpZR7i2.js";
import { L, Tn, r as r_1, v, vn } from "./store-cAVdfWrK.js";
import { t as t_2 } from "./PrivateDataProvider-8vglgSNV.js";
import { n, t as t_3 } from "./useOnboardingType-C_Lvvffu.js";
import { r as r_2 } from "./InputPassword-D9sGWGS1.js";
import { n as n_2 } from "./OnboardingBoxContent-DcFJIaKL.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "b3ff3ad6-997b-4f9f-9897-b25c670cada0";
            e._sentryDebugIdIdentifier = "sentry-dbid-b3ff3ad6-997b-4f9f-9897-b25c670cada0";
        }
    } catch (e) {}
})();
export const s = {
    DEFAULT: "default",
    PHANTOM: "phantom"
};
export const o = {
    GENERATE_HD_WALLET: Tn("GenerateHDWallet"),
    INITIATE_IMPORT_MNEMONIC: Tn("InitiateImportMnemonic"),
    COMPLETE_IMPORT_MNEMONIC: Tn("CompleteImportMnemonic"),
    DERIVE_SOLANA_ADDRESS: Tn("DeriveSolanaAddress"),
    IMPORT_LEDGER_ADDRESS: Tn("ImportLedgerAddress"),
    INITIATE_IMPORT_PRIVATE_KEY: Tn("InitiateImportPrivateKey"),
    COMPLETE_IMPORT_PRIVATE_KEY: Tn("CompleteImportPrivateKey"),
    SAVE_PASSWORD: Tn("SavePassword")
};
const m = f(i_1(), 1);
export const r = {
    PASSWORD: "password",
    BIOMETRICS: "biometrics"
};
export const i = {
    IMPORT: "import",
    NEW: "new"
};
export const a = {
    SEED_PHRASE: "seed phrase",
    PRIVATE_KEY: "private key",
    LEDGER: "ledger",
    QR: "qr"
};
const useCreateMnemonic = ()=>{
    const { trackAnalytics, setCustomPeoplePropertiesOnce } = t();
    const { setupType } = n_2();
    const [errorMessage, setErrorMessage] = m.useState("");
    const [isCreatingMnemonic, setIsCreatingMnemonic] = m.useState(false);
    const { clear } = m.useContext(t_2);
    return {
        createMnemonic: async (n)=>{
            setIsCreatingMnemonic(true);
            const mnemonic = await vn.emit(o.GENERATE_HD_WALLET);
            try {
                const walletId = await vn.emit(o.INITIATE_IMPORT_MNEMONIC, {
                    mnemonic
                });
                await vn.emit(o.COMPLETE_IMPORT_MNEMONIC, {
                    walletId,
                    solanaDerivationType: s.PHANTOM,
                    isMnemonicNewlyGenerated: true
                });
                trackAnalytics({
                    event: E.WALLET_CREATED,
                    props: {
                        pageViewSource: D.ONBOARDING_PASSWORD_VERIFY,
                        walletType: L.MNEMONIC,
                        mnemonicLength: mnemonic.split(" ").length,
                        actionSourceType: "createwallet",
                        setupType
                    }
                });
                setCustomPeoplePropertiesOnce({
                    [A.ONBOARDING_AUTH_TYPE]: n ? r.BIOMETRICS : r.PASSWORD,
                    [A.ONBOARDING_SETUP_TYPE]: i.NEW,
                    [A.ONBOARDING_WALLET_TYPE]: a.SEED_PHRASE
                });
                clear();
            } catch (error) {
                setErrorMessage(error?.message);
            } finally{
                setIsCreatingMnemonic(false);
            }
        },
        errorMessage,
        isCreatingMnemonic
    };
};
const useSetupAuthentication = ()=>{
    const e = r_1();
    const { trackAnalytics } = t();
    const setupType = n();
    return {
        setupAuthentication: async ({ pageViewSource, passkeyId, passkeyPassword, password, isPasswordGenerated })=>{
            if (setupType !== t_3.ADDITIONAL_WALLET) {
                await vn.emit(o.SAVE_PASSWORD, {
                    password
                });
                if (passkeyId) {
                    await vn.emit(r_2.GENERATE_PASSKEY_VAULT, {
                        password: passkeyPassword,
                        payload: password
                    });
                    trackAnalytics({
                        event: E.AUTHENTICATION_SETUP_COMPLETED,
                        props: {
                            authenticationType: "biometrics",
                            pageViewSource,
                            setupType
                        }
                    });
                    e(v.actions.setPasskeyId(passkeyId));
                    e(v.actions.setIsPasswordGenerated(!!isPasswordGenerated));
                } else {
                    trackAnalytics({
                        event: E.AUTHENTICATION_SETUP_COMPLETED,
                        props: {
                            authenticationType: "password",
                            pageViewSource,
                            setupType
                        }
                    });
                }
            }
        }
    };
};
export { useCreateMnemonic as n, useSetupAuthentication as t };
