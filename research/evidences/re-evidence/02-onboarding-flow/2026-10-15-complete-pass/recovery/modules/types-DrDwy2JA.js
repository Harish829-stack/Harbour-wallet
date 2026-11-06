(()=>{
    try {
        const E = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        E.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const _ = (new E.Error).stack;
        if (_) {
            E._sentryDebugIds = E._sentryDebugIds || {};
            E._sentryDebugIds[_] = "12592edd-345f-4a40-8264-397074ecfa32";
            E._sentryDebugIdIdentifier = "sentry-dbid-12592edd-345f-4a40-8264-397074ecfa32";
        }
    } catch (E) {}
})();
export const n = {
    AUTHENTICATION: "AUTHENTICATION",
    CREATE_PASSWORD: "CREATE_PASSWORD",
    SELECT_IMPORT_METHOD: "SELECT_IMPORT_METHOD",
    SELECT_TRUST_WALLET_METHOD: "SELECT_TRUST_WALLET_METHOD",
    COMPLETED: "COMPLETED",
    FLOWS_SELECTION: "FLOWS_SELECTION",
    BLOCKED_MAX_WALLETS: "BLOCKED_MAX_WALLETS",
    IMPORT_WALLET: "IMPORT_WALLET",
    SCAN_QR_WITH_MOBILE: "SCAN_QR_WITH_MOBILE",
    IMPORT_WITH_QR: "IMPORT_WITH_QR",
    INPUT_QR_PASSWORD: "INPUT_QR_PASSWORD",
    DERIVE_SOLANA_ADDRESS: "DERIVE_SOLANA_ADDRESS",
    CONNECT_LEDGER_DEVICE: "CONNECT_LEDGER_DEVICE",
    IMPORT_LEDGER_ADDRESS: "IMPORT_LEDGER_ADDRESS",
    SET_BIOMETRICS: "SET_BIOMETRICS",
    VERIFY_MNEMONIC: "VERIFY_MNEMONIC",
    BACKUP_MNEMONIC: "BACKUP_MNEMONIC"
};
export const t = {
    HOME: "HOME",
    CREATE_MNEMONIC: "CREATE_MNEMONIC",
    IMPORT_LEDGER: "IMPORT_LEDGER",
    IMPORT_WALLET: "IMPORT_WALLET",
    IMPORT_QR: "IMPORT_QR",
    BACKUP_SEEDPHRASE: "BACKUP_SEEDPHRASE",
    SET_PASSKEY: "SET_PASSKEY"
};
export const r = {
    HOME: 1,
    1: "HOME",
    CREATE_MNEMONIC: 2,
    2: "CREATE_MNEMONIC",
    IMPORT_WALLET: 3,
    3: "IMPORT_WALLET",
    IMPORT_LEDGER: 3,
    3: "IMPORT_LEDGER",
    IMPORT_QR: 4,
    4: "IMPORT_QR",
    BACKUP_SEEDPHRASE: 2,
    2: "BACKUP_SEEDPHRASE",
    SET_PASSKEY: 2,
    2: "SET_PASSKEY"
};
